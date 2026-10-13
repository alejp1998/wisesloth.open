"""Application configuration using Pydantic Settings."""

import json
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base path for the fastapi-api directory
BASE_DIR = Path(__file__).parent.parent


# Load LLM models configuration
def load_llm_config() -> dict[str, Any]:
    """Load LLM models configuration from YAML file."""
    config_path = BASE_DIR / "llm_models.yaml"
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f)
    return {"defaults": {}, "models": {}}


def load_output_schema(schema_name: str) -> dict[str, Any] | None:
    """Load an output schema from its JSON file.

    Args:
        schema_name: The schema name (e.g., 'quiz', 'personality')

    Returns:
        The parsed JSON schema or None if not found
    """
    schemas_config = LLM_CONFIG.get("output_schemas", {})
    schema_path = schemas_config.get(schema_name)

    if schema_path:
        full_path = BASE_DIR / schema_path
        if full_path.exists():
            with open(full_path) as f:
                return json.load(f)
    return None


LLM_CONFIG = load_llm_config()


def get_model_path(model_name: str) -> str:
    """Get the full LiteLLM path for a model name."""
    models = LLM_CONFIG.get("models", {})
    if model_name in models:
        return models[model_name].get("path", model_name)
    # If not found in config, assume it's already a full path
    return model_name


class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Environment
    environment: Environment = Environment.PRODUCTION
    debug: bool = False
    llm_model: str = "openai/gpt-6-luna"
    llm_api_base: str | None = None
    llm_max_output_tokens: int = Field(default=16384, ge=256, le=65536)
    llm_use_catalog_prices: bool = True
    llm_input_usd_per_million: float = Field(default=0.1, ge=0)
    llm_output_usd_per_million: float = Field(default=0.5, ge=0)
    uncertain_request_cost_usd: float = Field(default=1, ge=0)
    upload_dir: str = "../uploads"

    # API Keys (LiteLLM reads these from env automatically)
    openai_api_key: str = ""
    gemini_api_key: str = ""
    anthropic_api_key: str = ""  # Optional: for Claude models
    groq_api_key: str = ""  # Optional: for Groq models
    deepseek_api_key: str = ""  # Optional: for DeepSeek models

    # Limits
    max_characters: int = 50000
    max_image_size_kb: int = 100

    # Paths
    prompts_dir: str = "prompts"
    completion_logs_dir: str = "completion_logs"

    # CORS
    cors_origins: list[str] = ["http://express-app:8080"]

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

    def get_model_for_endpoint(self, endpoint: str) -> str:
        """Get the model path for a specific endpoint from YAML config.

        Args:
            endpoint: One of 'old_exam', 'notes', 'instructions', 'personality'
        """
        return self.llm_model

    @property
    def fallback_models(self) -> list[str]:
        """Get the fallback models from YAML config."""
        return []

    @property
    def available_models(self) -> dict[str, Any]:
        """Get all available models from YAML config."""
        return LLM_CONFIG.get("models", {})

    def get_output_schema(self, schema_name: str) -> dict[str, Any] | None:
        """Get the output schema for a specific type by loading from JSON file.

        Args:
            schema_name: One of 'quiz', 'personality', 'information_synthesizer', 'search_query_generator'

        Returns:
            JSON schema dict or None if not found
        """
        return load_output_schema(schema_name)

    def get_schema_for_endpoint(self, endpoint: str) -> dict[str, Any] | None:
        """Get the appropriate output schema for an endpoint.

        Args:
            endpoint: One of 'old_exam', 'notes', 'instructions', 'personality'

        Returns:
            JSON schema dict or None if not found
        """
        # Map endpoints to schema names
        endpoint_to_schema = {
            "old_exam": "quiz",
            "notes": "quiz",
            "instructions": "quiz",
            "personality": "personality",
        }
        schema_name = endpoint_to_schema.get(endpoint)
        if schema_name:
            return self.get_output_schema(schema_name)
        return None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Create global settings instance
settings = get_settings()
