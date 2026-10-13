"""Prepare direct provider calls and validate browser-supplied results without billing the host."""

import json

import jsonschema

from app.core.exceptions import AIServiceError

BROWSER_MODELS = {"openai/gpt-6-luna", "gemini/gemini-3.8-flash", "gemini/gemini-3.5-flash-lite"}


class BrowserAIPlan(AIServiceError):
    def __init__(self, plan: dict):
        super().__init__("Browser provider call required")
        self.plan = plan


def validate_browser_config(mode: str | None, model: str | None, completion: str | None):
    if mode not in {"prepare", "complete"} or model not in BROWSER_MODELS:
        raise AIServiceError("Invalid browser AI configuration")
    if mode == "complete" and (not completion or len(completion) > 500_000):
        raise AIServiceError("Browser completion is missing or too large")


def validate_browser_completion(raw: str, schema: dict | None) -> dict:
    content = json.loads(raw)
    if not schema:
        raise AIServiceError("Browser AI requires a response schema")
    jsonschema.validate(content, schema)
    return content
