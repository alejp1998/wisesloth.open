"""Image upload and management endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.v1.schemas.images import (
    ImageDeleteResponse,
)
from app.dependencies import get_storage_service
from app.services import ImageService, StorageService

router = APIRouter()

# Max file size: 2MB
MAX_FILE_SIZE = 2 * 1024 * 1024

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/bmp",
    "image/webp",
}


@router.post("/quiz/add")
async def upload_quiz_image(
    file: Annotated[UploadFile, File()],
    newFileName: Annotated[str, Form()],
    storage_service: StorageService = Depends(get_storage_service),
):
    """
    Upload an image for a quiz.

    The image will be compressed and stored on this instance.
    """
    try:
        # Validate newFileName is a valid UUID
        file_parts = newFileName.split(".")
        if len(file_parts) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid newFileName format",
            )

        try:
            uuid.UUID(file_parts[0])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid newFileName: must start with a valid UUID",
            ) from None

        # Read file content
        content = await file.read(MAX_FILE_SIZE + 1)

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            return {"success": False, "error": "File exceeds 2MB limit"}

        # Validate content type
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            return {"success": False, "error": f"Invalid file type: {file.content_type}"}

        # Compress image
        compressed = ImageService.compress_image(content, file.content_type)
        compressed_content = compressed.read()

        # Upload to storage
        image_url = await storage_service.upload_image(
            file_content=compressed_content,
            filename=newFileName,
            content_type="image/webp",
        )

        return {"success": True, "imageUrl": image_url}

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": f"Internal server error: {e!s}"}


@router.post("/quiz/delete", response_model=ImageDeleteResponse)
async def delete_quiz_image(
    quizId: Annotated[str, Form()],
    storage_service: StorageService = Depends(get_storage_service),
):
    """
    Delete an image associated with a quiz.

    Removes all image files for the given quiz ID.
    """
    try:
        if not quizId:
            return ImageDeleteResponse(
                success=False,
                error="No quiz ID provided",
            )

        deleted = await storage_service.delete_quiz_images(quizId)

        return ImageDeleteResponse(
            success=True,
            message=f"Quiz {quizId} image{'s' if deleted else ''} deleted successfully",
        )

    except Exception:
        return ImageDeleteResponse(
            success=False,
            error="Invalid image ID or storage failure",
        )
