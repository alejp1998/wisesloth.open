"""Pydantic schemas for test endpoints."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TestCategory(str, Enum):
    OLD_EXAM = "old-exam"
    NOTES = "notes"
    INSTRUCTIONS = "instructions"
    PERSONALITY = "personality"
    FLASHCARDS = "flashcards"


class DifficultyLevel(str, Enum):
    NOT_SPECIFIED = "not-specified"
    BEGINNER = "beginner"
    ELEMENTARY = "elementary"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


# Request Models
class CreateTestFromExamRequest(BaseModel):
    """Request model for creating a test from an old exam."""

    text: str = Field(..., min_length=10, max_length=100000, description="The exam text to extract questions from")
    is_admin: bool = Field(default=False, alias="isAdmin")

    class Config:
        populate_by_name = True


class CreateTestFromNotesRequest(BaseModel):
    """Request model for creating a test from notes."""

    text: str = Field(..., min_length=10, max_length=100000, description="The notes text to generate questions from")
    n_questions: int = Field(..., ge=1, le=50, alias="nQuestions", description="Number of questions to generate")
    n_options: int = Field(..., ge=2, le=6, alias="nOptions", description="Number of options per question")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.NOT_SPECIFIED)
    instructions: str = Field(default="", max_length=5000, description="Additional instructions for generation")
    is_admin: bool = Field(default=False, alias="isAdmin")

    class Config:
        populate_by_name = True


class CreateTestFromInstructionsRequest(BaseModel):
    """Request model for creating a test from instructions."""

    language: str = Field(..., min_length=2, max_length=50, description="Language for the test")
    n_questions: int = Field(..., ge=1, le=50, alias="nQuestions", description="Number of questions to generate")
    n_options: int = Field(..., ge=2, le=6, alias="nOptions", description="Number of options per question")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.NOT_SPECIFIED)
    instructions: str = Field(..., min_length=10, max_length=10000, description="Instructions for test generation")
    is_admin: bool = Field(default=False, alias="isAdmin")

    class Config:
        populate_by_name = True


class CreatePersonalityTestRequest(BaseModel):
    """Request model for creating a personality test."""

    language: str = Field(..., min_length=2, max_length=50, description="Language for the test")
    n_questions: int = Field(..., ge=1, le=50, alias="nQuestions", description="Number of questions to generate")
    n_options: int = Field(..., ge=2, le=10, alias="nOptions", description="Number of personality options")
    instructions: str = Field(..., min_length=10, max_length=10000, description="Instructions for personality test")
    is_admin: bool = Field(default=False, alias="isAdmin")

    class Config:
        populate_by_name = True


class CreateFlashcardsRequest(BaseModel):
    """Request model for creating a flashcard set."""

    text: str = Field(
        ..., min_length=10, max_length=100000, description="The study material to generate flashcards from"
    )
    n_cards: int = Field(..., ge=1, le=100, alias="nCards", description="Number of flashcards to generate")
    language: str = Field(default="", max_length=50, description="Language for the flashcards")
    instructions: str = Field(default="", max_length=5000, description="Additional instructions for generation")
    is_admin: bool = Field(default=False, alias="isAdmin")

    class Config:
        populate_by_name = True


class EditQuizRequest(BaseModel):
    """Request model for AI-editing a single quiz question."""

    question: dict[str, Any] = Field(
        ..., description="Current question in DB shape {question, opt1..opt6, correct_opts}"
    )
    instruction: str = Field(
        ..., min_length=2, max_length=1000, description="Natural language description of the edit to apply"
    )
    language: str = Field(default="", max_length=50, description="Language for the edited question")


class EditFlashcardRequest(BaseModel):
    """Request model for AI-editing a single flashcard."""

    front: str = Field(..., description="Current flashcard front")
    back: str = Field(..., description="Current flashcard back")
    instruction: str = Field(
        ..., min_length=2, max_length=1000, description="Natural language description of the edit to apply"
    )


# Response Models
class CompletionTokens(BaseModel):
    """Token usage information."""

    completion: int
    prompt: int
    total: int


class CompletionData(BaseModel):
    """AI completion data."""

    content: dict[str, Any]
    finish_reason: str
    tokens: CompletionTokens
    model: str | None = None
    costUsd: float = 0
    outcome: str = "success"


class CreateTestResponse(BaseModel):
    """Response model for test creation endpoints."""

    success: bool
    completion: CompletionData | None = None
    usage: dict | None = None
    error: str | None = None
