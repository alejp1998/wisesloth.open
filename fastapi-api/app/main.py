"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as v1_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print(f"🚀 Starting WiseSloth.open API in {settings.environment.value} mode")
    print("🤖 Models by endpoint:")
    print(f"   - old_exam: {settings.get_model_for_endpoint('old_exam')}")
    print(f"   - notes: {settings.get_model_for_endpoint('notes')}")
    print(f"   - instructions: {settings.get_model_for_endpoint('instructions')}")
    print(f"   - personality: {settings.get_model_for_endpoint('personality')}")
    print(f"   - flashcards: {settings.get_model_for_endpoint('flashcards')}")
    print(f"   - quiz_edit: {settings.get_model_for_endpoint('quiz_edit')}")
    print(f"   - flashcard_edit: {settings.get_model_for_endpoint('flashcard_edit')}")
    print(f"   - test_edit_quiz: {settings.get_model_for_endpoint('test_edit_quiz')}")
    print(f"   - test_edit_flashcards: {settings.get_model_for_endpoint('test_edit_flashcards')}")
    yield
    # Shutdown
    print("👋 Shutting down WiseSloth.open API")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="WiseSloth.open API",
        description="AI-powered quiz generation API",
        version="2.0.0",
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routers
    app.include_router(v1_router)

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint for container orchestration."""
        return {
            "status": "healthy",
            "environment": settings.environment.value,
        }

    return app


# Create the app instance
app = create_app()
