"""Direct browser AI must never fall back to the host's paid provider."""

import json
import unittest
from unittest.mock import AsyncMock, patch

from app.api.v1.endpoints.tests import create_test_from_old_exam
from app.core.exceptions import AIServiceError
from app.services.ai_service import AIService
from app.services.browser_ai import BrowserAIPlan

SCHEMA = {
    "type": "object",
    "properties": {"name": {"type": "string"}},
    "required": ["name"],
    "additionalProperties": False,
}


class BrowserAITests(unittest.IsolatedAsyncioTestCase):
    async def test_prepare_returns_prompts_and_schema_without_keys_or_provider_calls(self):
        service = AIService(api_key="must-not-leak", browser_mode="prepare", browser_model="gemini/gemini-3.8-flash")
        with patch("app.services.ai_service.acompletion", AsyncMock()) as provider:
            with self.assertRaises(BrowserAIPlan) as caught:
                await service._call_llm(service.browser_model, "system", "user", 0, SCHEMA)
        self.assertEqual(caught.exception.plan["schema"], SCHEMA)
        self.assertNotIn("must-not-leak", json.dumps(caught.exception.plan))
        provider.assert_not_called()

    async def test_endpoint_returns_a_plan_instead_of_a_generic_error(self):
        service = AIService(browser_mode="prepare", browser_model="openai/gpt-6-luna")
        response = await create_test_from_old_exam("An exam about arithmetic.", "", service)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.body)["browserAIPlan"]["model"], "openai/gpt-6-luna")

    async def test_complete_validates_without_a_host_call_or_charge(self):
        service = AIService(
            browser_mode="complete", browser_model="openai/gpt-6-luna", browser_completion='{"name":"Quiz"}'
        )
        with patch("app.services.ai_service.acompletion", AsyncMock()) as provider:
            result = await service._call_llm(service.browser_model, "system", "user", 0, SCHEMA)
        self.assertEqual(result["content"], {"name": "Quiz"})
        self.assertEqual(service.cost_usd, 0)
        self.assertEqual(service.outcome, "browser")
        provider.assert_not_called()

    async def test_invalid_output_is_rejected_without_a_paid_fallback(self):
        service = AIService(
            browser_mode="complete", browser_model="gemini/gemini-3.8-flash", browser_completion='{"name":42}'
        )
        with patch("app.services.ai_service.acompletion", AsyncMock()) as provider:
            with self.assertRaises(AIServiceError):
                await service._call_llm(service.browser_model, "system", "user", 0, SCHEMA)
        provider.assert_not_called()

    def test_invalid_browser_configuration_is_rejected(self):
        with self.assertRaises(AIServiceError):
            AIService(browser_mode="invalid", browser_model="openai/gpt-6-luna")
        with self.assertRaises(AIServiceError):
            AIService(browser_mode="prepare", browser_model="https://untrusted.example")
