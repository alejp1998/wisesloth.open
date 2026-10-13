"""Pydantic schemas for image endpoints."""

from pydantic import BaseModel, Field


class ImageUploadResponse(BaseModel):
    """Response model for image upload."""

    success: bool
    image_url: str | None = Field(default=None, serialization_alias="imageUrl")
    error: str | None = None

    model_config = {"populate_by_name": True}


class ImageDeleteRequest(BaseModel):
    """Request model for image deletion."""

    quiz_id: str = Field(..., alias="quizId", description="The quiz ID whose image should be deleted")

    class Config:
        populate_by_name = True


class ImageDeleteResponse(BaseModel):
    """Response model for image deletion."""

    success: bool
    message: str | None = None
    error: str | None = None
