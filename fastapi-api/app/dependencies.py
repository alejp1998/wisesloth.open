"""Dependency injection for FastAPI."""

from functools import lru_cache

from fastapi import Request

from app.services import AIService, StorageService
from app.services.browser_ai import validate_browser_config


async def get_ai_service(request: Request) -> AIService:
    """Create a request-scoped service; browser mode never loads provider credentials."""
    mode = request.headers.get("X-Browser-AI-Mode")
    if mode is not None:
        form = await request.form()
        model = request.headers.get("X-Browser-AI-Model")
        completion = form.get("_browser_completion")
        validate_browser_config(mode, model, completion)
        return AIService(browser_mode=mode, browser_model=model, browser_completion=completion)
    return AIService(api_key=request.headers.get("X-Provider-Key"))


@lru_cache
def get_storage_service() -> StorageService:
    """Get cached storage service instance."""
    return StorageService()
