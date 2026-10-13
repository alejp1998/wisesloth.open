"""Custom exceptions for the API."""

from fastapi import HTTPException, status


class APIError(HTTPException):
    """Base API error."""

    def __init__(self, detail: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        super().__init__(status_code=status_code, detail=detail)


class ValidationError(APIError):
    """Validation error for request data."""

    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)


class AIServiceError(APIError):
    """Error from AI service (OpenAI/Gemini)."""

    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=status.HTTP_502_BAD_GATEWAY)


class StorageError(APIError):
    """Error from local image storage."""

    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
