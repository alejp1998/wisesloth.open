"""Test generation endpoints."""

import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse

from app.api.v1.schemas.tests import (
    CompletionData,
    CompletionTokens,
    CreateTestResponse,
)
from app.dependencies import get_ai_service
from app.services import AIService
from app.services.browser_ai import BrowserAIPlan

logger = logging.getLogger(__name__)
router = APIRouter()


def _log_error(endpoint: str, inputs: dict, error: Exception) -> str:
    """Log an opaque ID and exception type; never prompts, keys or provider messages."""
    error_id = str(uuid.uuid4())
    logger.error("AI request failed [%s] endpoint=%s type=%s", error_id, endpoint, type(error).__name__)
    return error_id


def _usage(ai_service: AIService) -> dict:
    return {
        "tokens": ai_service.tokens,
        "costUsd": ai_service.cost_usd,
        "model": ai_service.model_used,
        "outcome": ai_service.outcome,
    }


@router.post("/old-exam", response_model=CreateTestResponse)
async def create_test_from_old_exam(
    text: Annotated[str, Form()],
    skills: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Create a test from an old exam.

    Extracts questions and answers from the provided exam text.
    """
    try:
        skills_list = json.loads(skills) if skills else []
        result = await ai_service.generate_from_exam(text=text, skills=skills_list)

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="old-exam",
            inputs={"text_length": len(text), "text_preview": text[:500], "text_full": text},
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/notes", response_model=CreateTestResponse)
async def create_test_from_notes(
    text: Annotated[str, Form()],
    nQuestions: Annotated[int, Form()],
    nOptions: Annotated[int, Form()],
    difficulty: Annotated[str, Form()] = "not-specified",
    instructions: Annotated[str, Form()] = "",
    skills: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Create a test from notes.

    Generates questions based on the provided notes text.
    """
    try:
        skills_list = json.loads(skills) if skills else []
        result = await ai_service.generate_from_notes(
            text=text,
            n_questions=nQuestions,
            n_options=nOptions,
            difficulty=difficulty,
            instructions=instructions,
            skills=skills_list,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="notes",
            inputs={
                "text_length": len(text),
                "text_preview": text[:500],
                "text_full": text,
                "nQuestions": nQuestions,
                "nOptions": nOptions,
                "difficulty": difficulty,
                "instructions": instructions,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/instructions", response_model=CreateTestResponse)
async def create_test_from_instructions(
    language: Annotated[str, Form()],
    nQuestions: Annotated[int, Form()],
    nOptions: Annotated[int, Form()],
    instructions: Annotated[str, Form()],
    difficulty: Annotated[str, Form()] = "not-specified",
    skills: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Create a test from instructions.

    Generates questions based on the provided instructions and parameters.
    """
    try:
        skills_list = json.loads(skills) if skills else []
        result = await ai_service.generate_from_instructions(
            language=language,
            n_questions=nQuestions,
            n_options=nOptions,
            difficulty=difficulty,
            instructions=instructions,
            skills=skills_list,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="instructions",
            inputs={
                "language": language,
                "nQuestions": nQuestions,
                "nOptions": nOptions,
                "difficulty": difficulty,
                "instructions": instructions,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/personality", response_model=CreateTestResponse)
async def create_personality_test(
    language: Annotated[str, Form()],
    nQuestions: Annotated[int, Form()],
    nOptions: Annotated[int, Form()],
    instructions: Annotated[str, Form()],
    skills: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Create a personality test.

    Generates personality test questions based on the provided instructions.
    """
    try:
        skills_list = json.loads(skills) if skills else []
        result = await ai_service.generate_personality_test(
            language=language,
            n_questions=nQuestions,
            n_options=nOptions,
            instructions=instructions,
            skills=skills_list,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="personality",
            inputs={
                "language": language,
                "nQuestions": nQuestions,
                "nOptions": nOptions,
                "instructions": instructions,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/flashcards", response_model=CreateTestResponse)
async def create_flashcards(
    text: Annotated[str, Form()],
    nCards: Annotated[int, Form()],
    language: Annotated[str, Form()] = "",
    instructions: Annotated[str, Form()] = "",
    skills: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Create a set of flashcards from study material.

    Generates front/back flashcard pairs based on the provided text.
    """
    try:
        skills_list = json.loads(skills) if skills else []
        result = await ai_service.generate_flashcards(
            text=text,
            n_cards=nCards,
            language=language,
            instructions=instructions,
            skills=skills_list,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="flashcards",
            inputs={
                "text_length": len(text),
                "text_preview": text[:500],
                "text_full": text,
                "nCards": nCards,
                "language": language,
                "instructions": instructions,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/quiz-edit", response_model=CreateTestResponse)
async def edit_quiz_question(
    question: Annotated[str, Form()],
    instruction: Annotated[str, Form()],
    language: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Edit a single quiz question using AI.

    Applies the given natural-language instruction to exactly one question.
    """
    try:
        question_dict = json.loads(question)
        result = await ai_service.edit_quiz(
            question=question_dict,
            instruction=instruction,
            language=language,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="quiz-edit",
            inputs={
                "question": question[:2000],
                "instruction": instruction,
                "language": language,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/flashcard-edit", response_model=CreateTestResponse)
async def edit_flashcard_endpoint(
    front: Annotated[str, Form()],
    back: Annotated[str, Form()],
    instruction: Annotated[str, Form()],
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Edit a single flashcard using AI.

    Applies the given natural-language instruction to exactly one flashcard.
    """
    try:
        result = await ai_service.edit_flashcard(
            front=front,
            back=back,
            instruction=instruction,
        )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="flashcard-edit",
            inputs={
                "front": front[:1000],
                "back": back[:1000],
                "instruction": instruction,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )


@router.post("/general-edit", response_model=CreateTestResponse)
async def edit_test_general(
    test_type: Annotated[str, Form()],
    test_meta: Annotated[str, Form()],
    items: Annotated[str, Form()],
    instruction: Annotated[str, Form()],
    language: Annotated[str, Form()] = "",
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Apply a general, whole-test/deck AI edit (e.g. "add 2 more questions",
    "remove question 3", "change the description").

    Unlike /quiz-edit and /flashcard-edit (which touch exactly one item), this
    endpoint can add, remove and update multiple items in one instruction, plus
    the test's own name/topic/description. `test_type` selects the schema/prompt:
    "flashcards" for a flashcard deck, anything else for a knowledge test.
    """
    items_list = []
    try:
        test_meta_dict = json.loads(test_meta)
        items_list = json.loads(items)

        if test_type == "flashcards":
            result = await ai_service.edit_test_flashcards(
                test_meta=test_meta_dict,
                cards=items_list,
                instruction=instruction,
                language=language,
            )
        else:
            result = await ai_service.edit_test_quiz(
                test_meta=test_meta_dict,
                quizzes=items_list,
                instruction=instruction,
                language=language,
            )

        return CreateTestResponse(
            success=True,
            completion=CompletionData(
                content=result["content"],
                finish_reason=result["finish_reason"],
                tokens=CompletionTokens(**result["tokens"]),
                model=result.get("model_used"),
                costUsd=ai_service.cost_usd,
                outcome=ai_service.outcome,
            ),
        )
    except BrowserAIPlan as plan:
        return JSONResponse({"browserAIPlan": plan.plan})
    except Exception as e:
        error_id = _log_error(
            endpoint="general-edit",
            inputs={
                "test_type": test_type,
                "test_meta": test_meta[:1000],
                "n_items": len(items_list),
                "instruction": instruction,
                "language": language,
            },
            error=e,
        )
        return CreateTestResponse(
            success=False, error=f"AI request failed. Reference: {error_id}", usage=_usage(ai_service)
        )
