"""API v1 router that combines all endpoint routers."""

from fastapi import APIRouter

from .endpoints import images, tests

router = APIRouter(prefix="/v1")

# Include sub-routers
router.include_router(tests.router, prefix="/tests", tags=["tests"])
router.include_router(images.router, prefix="/images", tags=["images"])
