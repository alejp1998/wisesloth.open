"""Validate and transcode raster uploads; never serve arbitrary uploaded bytes."""

import io

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 20_000_000


class ImageService:
    @staticmethod
    def compress_image(file_content: bytes, content_type: str) -> io.BytesIO:
        with Image.open(io.BytesIO(file_content)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError("Image is too large")
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1600, 1600))
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=80)
            output.seek(0)
            return output

    @staticmethod
    def is_valid_extension(filename: str, allowed_extensions: set[str]) -> bool:
        return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions
