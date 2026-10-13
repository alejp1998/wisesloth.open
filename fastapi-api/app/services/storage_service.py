"""Local image storage shared with the web service through a named volume."""

from pathlib import Path
from uuid import UUID

from app.config import settings


class StorageService:
    def __init__(self):
        self.directory = Path(settings.upload_dir)
        self.directory.mkdir(parents=True, exist_ok=True)

    async def upload_image(self, file_content: bytes, filename: str, content_type: str) -> str:
        quiz_id = str(UUID(filename.split(".")[0]))
        target = self.directory / f"{quiz_id}.webp"
        # Atomic replacement: readers see either the old or the complete new file.
        temporary = target.with_suffix(".tmp")
        temporary.write_bytes(file_content)
        temporary.replace(target)
        return f"/uploads/{target.name}"

    async def delete_quiz_images(self, quiz_id: str) -> bool:
        target = self.directory / f"{UUID(quiz_id)}.webp"
        existed = target.exists()
        target.unlink(missing_ok=True)
        return existed
