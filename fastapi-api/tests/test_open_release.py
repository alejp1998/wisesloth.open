"""Offline regression checks: no provider keys or paid calls required."""

import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from PIL import Image, UnidentifiedImageError

from app.api.v1.endpoints.tests import create_test_from_old_exam
from app.config import settings
from app.core.exceptions import AIServiceError
from app.services.ai_service import AIService, _prepare_json_schema_for_api, litellm
from app.services.image_service import ImageService
from app.services.storage_service import StorageService


class ProviderUsageTests(unittest.IsolatedAsyncioTestCase):
    async def test_luna_uses_supported_reasoning_and_completion_limit_parameters(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"name":"Quiz"}'), finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20, total_tokens=120),
        )
        with patch("app.services.ai_service.acompletion", AsyncMock(return_value=response)) as provider:
            await AIService()._call_llm("openai/gpt-6-luna", "system", "user", 0.3)
        parameters = provider.call_args.kwargs
        self.assertEqual(parameters["reasoning_effort"], "none")
        self.assertIn("max_completion_tokens", parameters)
        self.assertNotIn("max_tokens", parameters)
        self.assertNotIn("temperature", parameters)

    async def test_provider_timeout_is_metered_as_uncertain(self):
        error = litellm.Timeout(message="provider timeout", model=settings.llm_model, llm_provider="openai")
        service = AIService()
        with patch("app.services.ai_service.acompletion", AsyncMock(side_effect=error)):
            with self.assertRaises(AIServiceError):
                await service._call_llm(settings.llm_model, "system", "user", 0)
        self.assertEqual(service.outcome, "uncertain")
        self.assertEqual(service.cost_usd, settings.uncertain_request_cost_usd)

    async def test_custom_pricing_can_override_a_known_model(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"name":"Sample"}'), finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20, total_tokens=120),
        )
        with patch("app.services.ai_service.acompletion", AsyncMock(return_value=response)):
            with patch.object(settings, "llm_use_catalog_prices", False):
                with patch.object(settings, "llm_input_usd_per_million", 2):
                    with patch.object(settings, "llm_output_usd_per_million", 10):
                        service = AIService()
                        await service._call_llm(settings.llm_model, "system", "user", 0)
        self.assertAlmostEqual(service.cost_usd, 0.0004)

    async def test_structured_schemas_require_declared_optional_fields(self):
        schema = _prepare_json_schema_for_api(
            {
                "type": "object",
                "properties": {"a": {"type": "string"}, "b": {"type": "string"}},
                "required": ["a"],
            }
        )
        self.assertEqual(schema["required"], ["a", "b"])
        self.assertFalse(schema["additionalProperties"])

    async def test_metering_precedes_json_parse_and_key_is_request_scoped(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="malformed"), finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=100, completion_tokens=20, total_tokens=120),
        )
        service = AIService(api_key="user-test-key")
        with patch("app.services.ai_service.acompletion", AsyncMock(return_value=response)) as call:
            with patch("app.services.ai_service.litellm.completion_cost", return_value=0.012):
                with self.assertRaises(AIServiceError):
                    await service._call_llm(settings.llm_model, "system", "user", 0)
        self.assertEqual(service.tokens["total"], 120)
        self.assertEqual(service.cost_usd, 0.012)
        self.assertEqual(call.call_args.kwargs["api_key"], "user-test-key")
        self.assertIsNone(AIService().api_key)

    async def test_known_response_returns_json_and_tokens(self):
        response = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"name":"Sample"}'), finish_reason="stop")],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )
        with patch("app.services.ai_service.acompletion", AsyncMock(return_value=response)):
            with patch("app.services.ai_service.litellm.completion_cost", return_value=0.01):
                result = await AIService()._call_llm(settings.llm_model, "system", "user", 0)
        self.assertEqual(result["content"], {"name": "Sample"})
        self.assertEqual(result["costUsd"], 0.01)


class APIResponseTests(unittest.IsolatedAsyncioTestCase):
    async def test_failure_returns_usage_but_no_prompt_key_or_provider_error(self):
        service = AIService(api_key="never-expose-this-key")
        service.tokens = {"prompt": 100, "completion": 10, "total": 110}
        service.cost_usd = 0.01
        service.generate_from_exam = AsyncMock(side_effect=RuntimeError("private-provider-message"))
        result = (
            await create_test_from_old_exam(text="private-study-content", skills="", ai_service=service)
        ).model_dump()
        self.assertFalse(result["success"])
        self.assertEqual(result["usage"]["costUsd"], 0.01)
        encoded = json.dumps(result)
        for secret in ["never-expose-this-key", "private-provider-message", "private-study-content"]:
            self.assertNotIn(secret, encoded)


class ImageTests(unittest.IsolatedAsyncioTestCase):
    async def test_raster_image_is_transcoded_saved_and_removed_locally(self):
        raw = io.BytesIO()
        Image.new("RGB", (40, 20), "red").save(raw, format="PNG")
        output = ImageService.compress_image(raw.getvalue(), "image/png").getvalue()
        self.assertEqual(Image.open(io.BytesIO(output)).format, "WEBP")
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(settings, "upload_dir", directory):
                storage = StorageService()
            quiz_id = "12345678-1234-4234-8234-123456789012"
            path = await storage.upload_image(output, f"{quiz_id}.png", "image/webp")
            self.assertEqual(path, f"/uploads/{quiz_id}.webp")
            self.assertEqual((Path(directory) / f"{quiz_id}.webp").read_bytes(), output)
            self.assertTrue(await storage.delete_quiz_images(quiz_id))
            self.assertFalse(await storage.delete_quiz_images(quiz_id))
            with self.assertRaises(ValueError):
                await storage.delete_quiz_images("../../etc/passwd")

    async def test_html_and_svg_disguised_as_raster_images_are_rejected(self):
        for raw in [b"<script>alert(1)</script>", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"]:
            with self.assertRaises(UnidentifiedImageError):
                ImageService.compress_image(raw, "image/png")


if __name__ == "__main__":
    unittest.main()
