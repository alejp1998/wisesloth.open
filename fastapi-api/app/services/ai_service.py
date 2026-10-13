"""Generate and validate study material with the configured AI provider."""

import json
import random
import re
from typing import Any

import jsonschema
import litellm
from litellm import JSONSchemaValidationError, acompletion
from litellm.exceptions import APIError, RateLimitError, ServiceUnavailableError

from app.api.v1.schemas.tests import TestCategory
from app.config import load_output_schema, settings
from app.core.constants import CHARACTERS_LIMIT, DIFFICULTY_LEVELS
from app.core.exceptions import AIServiceError
from app.core.prompts import prompt_manager
from app.services.browser_ai import BrowserAIPlan, validate_browser_completion, validate_browser_config

# Parsing and metering are explicit so charged malformed responses are counted.
litellm.enable_json_schema_validation = False

# Map TestCategory to config endpoint names
CATEGORY_TO_ENDPOINT = {
    TestCategory.OLD_EXAM: "old_exam",
    TestCategory.NOTES: "notes",
    TestCategory.INSTRUCTIONS: "instructions",
    TestCategory.PERSONALITY: "personality",
}

# Map TestCategory to output schema names
CATEGORY_TO_SCHEMA = {
    TestCategory.OLD_EXAM: "quiz",
    TestCategory.NOTES: "quiz",
    TestCategory.INSTRUCTIONS: "quiz",
    TestCategory.PERSONALITY: "personality",
}


def _prepare_json_schema_for_api(schema: dict) -> dict:
    """Prepare a JSON schema for use with LLM APIs.

    Removes unsupported fields that cause API errors:
    - $schema, $id (meta fields)
    - pattern, minLength, maxLength (not supported by all providers)
    - Resolves $ref references inline
    - Converts additionalProperties with schemas to proper format

    Args:
        schema: The original JSON schema

    Returns:
        A cleaned schema suitable for API use
    """
    if not schema:
        return schema

    # Create a deep copy to avoid modifying the original
    import copy

    cleaned = copy.deepcopy(schema)

    # Store $defs for reference resolution
    defs = cleaned.pop("$defs", {})
    definitions = cleaned.pop("definitions", {})
    all_defs = {**definitions, **defs}

    # Remove meta fields not supported by most LLM APIs
    fields_to_remove = ["$schema", "$id", "title", "examples"]
    for field in fields_to_remove:
        cleaned.pop(field, None)

    def resolve_ref(ref: str) -> dict:
        """Resolve a $ref to its definition."""
        if ref.startswith("#/$defs/"):
            def_name = ref.replace("#/$defs/", "")
            return copy.deepcopy(all_defs.get(def_name, {}))
        elif ref.startswith("#/definitions/"):
            def_name = ref.replace("#/definitions/", "")
            return copy.deepcopy(all_defs.get(def_name, {}))
        return {}

    def clean_properties(obj: dict) -> dict:
        """Recursively clean properties in the schema."""
        if not isinstance(obj, dict):
            return obj

        # Resolve $ref first
        if "$ref" in obj:
            resolved = resolve_ref(obj["$ref"])
            obj.pop("$ref")
            obj.update(resolved)

        # Remove unsupported constraints from this level
        unsupported = ["minLength", "maxLength", "minimum", "maximum", "pattern", "examples", "default", "title"]
        for field in unsupported:
            obj.pop(field, None)

        # Handle additionalProperties - Anthropic only supports false, not schema objects
        if "additionalProperties" in obj:
            additional = obj["additionalProperties"]
            if isinstance(additional, dict):
                # If additionalProperties is a schema (e.g., with $ref),
                # we need to handle this differently
                # For now, remove it and let the LLM figure out the structure from description
                # This is a limitation of Anthropic's structured outputs
                obj.pop("additionalProperties")
                # Don't add additionalProperties: false for objects with dynamic keys
            elif additional is not False:
                obj["additionalProperties"] = False
        elif obj.get("type") == "object" and "properties" in obj:
            # Only add additionalProperties: false for objects with defined properties
            obj["additionalProperties"] = False

        # Recursively clean nested properties
        if "properties" in obj:
            # Strict structured outputs require every declared property. Optional
            # quiz options are represented as empty strings by the provider.
            obj["required"] = list(obj["properties"])
            for key, value in obj["properties"].items():
                obj["properties"][key] = clean_properties(value)

        # Clean items in arrays
        if "items" in obj:
            if isinstance(obj["items"], dict):
                obj["items"] = clean_properties(obj["items"])
            elif isinstance(obj["items"], list):
                obj["items"] = [clean_properties(item) for item in obj["items"]]

        # Handle anyOf, oneOf, allOf
        for keyword in ["anyOf", "oneOf", "allOf"]:
            if keyword in obj:
                obj[keyword] = [clean_properties(item) for item in obj[keyword]]

        return obj

    return clean_properties(cleaned)


class AIService:
    """AI service using LiteLLM for unified multi-provider support."""

    # Category configurations
    CATEGORY_CONFIG = {
        TestCategory.OLD_EXAM: {"temperature": 0.0, "prompt_attr": "old_exam_prompt"},
        TestCategory.NOTES: {"temperature": 0.25, "prompt_attr": "notes_prompt"},
        TestCategory.INSTRUCTIONS: {"temperature": 0.35, "prompt_attr": "instructions_prompt"},
        TestCategory.PERSONALITY: {"temperature": 0.5, "prompt_attr": "personality_prompt"},
    }

    def __init__(
        self,
        api_key: str | None = None,
        browser_mode: str | None = None,
        browser_model: str | None = None,
        browser_completion: str | None = None,
    ):
        """Initialize AI service."""
        self.api_key = api_key
        self.browser_mode = browser_mode
        self.browser_model = browser_model
        self.browser_completion = browser_completion
        if browser_mode is not None:
            validate_browser_config(browser_mode, browser_model, browser_completion)
        self.cost_usd = 0.0
        self.outcome = "error"
        self.tokens = {"prompt": 0, "completion": 0, "total": 0}
        self.model_used = settings.llm_model
        self.fallback_models = settings.fallback_models
        # Pre-load and cache output schemas
        self._schemas: dict[str, dict | None] = {}
        for _, schema_name in CATEGORY_TO_SCHEMA.items():
            if schema_name not in self._schemas:
                raw_schema = load_output_schema(schema_name)
                self._schemas[schema_name] = _prepare_json_schema_for_api(raw_schema) if raw_schema else None

    def _get_output_schema(self, category: TestCategory) -> dict | None:
        """Get the output schema for a category."""
        schema_name = CATEGORY_TO_SCHEMA.get(category)
        return self._schemas.get(schema_name) if schema_name else None

    def _get_model_for_category(self, category: TestCategory) -> str:
        """Get the configured model for a category."""
        endpoint = CATEGORY_TO_ENDPOINT[category]
        return self.browser_model or settings.get_model_for_endpoint(endpoint)

    def _build_skills_prompt(self, skills) -> str:
        """Build a prompt section that tailors content to the user's skills/preferences."""
        if not skills:
            return ""
        items = "\n".join(f"- {str(s).strip()}" for s in skills if str(s).strip())
        if not items:
            return ""
        return f"\n\nTAILOR THE CONTENT TO THESE SKILLS/PREFERENCES OF THE USER:\n{items}"

    async def generate_from_exam(self, text: str, skills: list[str] | None = None) -> dict[str, Any]:
        """Generate a test from an old exam."""
        prompt = f'Questions and answers should be extracted from: \n"""{text}"""'
        prompt += self._build_skills_prompt(skills or [])
        return await self._generate(TestCategory.OLD_EXAM, prompt)

    async def generate_from_notes(
        self,
        text: str,
        n_questions: int,
        n_options: int,
        difficulty: str,
        instructions: str = "",
        skills: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate a test from notes."""
        # Truncate text if needed
        notes_text = self._truncate_text(text)

        # Build prompt
        prompt = f'From this text: \n"""{notes_text}"""\n\n'
        prompt += (
            f"Generate {n_questions} questions with {n_options} options per question "
            f"(in case of true/false questions, 2 options are enough).\n"
        )

        # Add difficulty if specified
        if difficulty != "not-specified" and difficulty in DIFFICULTY_LEVELS:
            prompt += self._build_difficulty_prompt(difficulty)

        # Add instructions
        if instructions:
            prompt += f"\nFOLLOW THESE GUIDELINES:\n{instructions}"

        # Add user skills/preferences
        prompt += self._build_skills_prompt(skills or [])

        return await self._generate(TestCategory.NOTES, prompt)

    async def generate_from_instructions(
        self,
        language: str,
        n_questions: int,
        n_options: int,
        difficulty: str,
        instructions: str,
        skills: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate a test from instructions."""
        prompt = (
            f"In {language}. Generate {n_questions} questions with {n_options} options "
            f"per question (in case of true/false questions, 2 options are enough).\n"
        )

        # Add difficulty if specified
        if difficulty != "not-specified" and difficulty in DIFFICULTY_LEVELS:
            prompt += self._build_difficulty_prompt(difficulty)

        prompt += f"\nFOLLOW THESE GUIDELINES:\n{instructions}"

        # Add user skills/preferences
        prompt += self._build_skills_prompt(skills or [])

        return await self._generate(TestCategory.INSTRUCTIONS, prompt)

    async def generate_personality_test(
        self,
        language: str,
        n_questions: int,
        n_options: int,
        instructions: str,
        skills: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate a personality test."""
        prompt = f"In {language}. Generate {n_questions} questions with {n_options} possible personalities.\n"
        prompt += f"\nFOLLOW THESE GUIDELINES:\n{instructions}"

        # Add user skills/preferences
        prompt += self._build_skills_prompt(skills or [])

        return await self._generate(TestCategory.PERSONALITY, prompt)

    async def _generate(
        self,
        category: TestCategory,
        prompt: str,
    ) -> dict[str, Any]:
        """Internal method to generate completion using LiteLLM."""
        config = self.CATEGORY_CONFIG[category]
        system_prompt = getattr(prompt_manager, config["prompt_attr"])

        # Get the output schema for this category
        output_schema = self._get_output_schema(category)

        # Get the model for this category from config
        primary_model = self._get_model_for_category(category)

        # Try primary model, then fallbacks if it fails
        models_to_try = [primary_model] + [m for m in self.fallback_models if m != primary_model]
        last_error = None
        max_tokens = settings.llm_max_output_tokens

        for attempt_model in models_to_try:
            try:
                result = await self._call_llm(
                    model=attempt_model,
                    system_prompt=system_prompt,
                    user_prompt=prompt,
                    temperature=config["temperature"],
                    output_schema=output_schema,
                    max_tokens=max_tokens,
                )

                return {
                    "content": result["content"],
                    "finish_reason": result["finish_reason"],
                    "tokens": result["tokens"],
                    "model_used": attempt_model,
                    "costUsd": self.cost_usd,
                }

            except JSONSchemaValidationError as e:
                # Response was truncated or malformed - try to extract partial content
                last_error = e
                if settings.is_development:
                    print(f"JSONSchemaValidationError on {attempt_model}: {str(e)[:200]}")

                # Try to extract partial valid JSON from the raw response
                raw_response = getattr(e, "raw_response", None) or str(e)
                try:
                    # Try to salvage partial content from truncated response
                    partial_content = self._try_salvage_truncated_json(raw_response)
                    if partial_content and partial_content.get("quizzes"):
                        if settings.is_development:
                            print(
                                f"Salvaged {len(partial_content.get('quizzes', []))} questions from truncated response"
                            )
                        return {
                            "content": partial_content,
                            "finish_reason": "length_truncated",
                            "tokens": {"completion": 0, "prompt": 0, "total": 0},
                            "model_used": attempt_model,
                            "costUsd": self.cost_usd,
                        }
                except Exception:
                    pass

                # Try next model
                continue

            except (RateLimitError, ServiceUnavailableError, APIError) as e:
                last_error = e
                if settings.is_development:
                    print(f"Model {attempt_model} failed, trying next: {e!s}")
                continue

        # All models failed
        raise AIServiceError(f"All models failed. Last error: {last_error!s}")

    async def _generate_with_fallback(
        self,
        model_key: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        output_schema: dict | None = None,
        max_tokens: int = 16384,
    ) -> dict[str, Any]:
        """Run a generation using the configured model + fallback chain.

        Args:
            model_key: Endpoint key in llm_models.yaml defaults (e.g. 'flashcards', 'quiz_edit')
            system_prompt: System prompt text
            user_prompt: User prompt text
            temperature: Sampling temperature
            output_schema: JSON schema for structured outputs (optional)
            max_tokens: Max tokens for the response

        Returns:
            Same result dict as _call_llm: {content, finish_reason, tokens, raw_response}
        """
        primary_model = self.browser_model or settings.get_model_for_endpoint(model_key)
        models_to_try = [primary_model] + [m for m in self.fallback_models if m != primary_model]
        last_error = None

        for attempt_model in models_to_try:
            try:
                result = await self._call_llm(
                    model=attempt_model,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    output_schema=output_schema,
                    max_tokens=max_tokens,
                )
                result["model_used"] = attempt_model
                return result
            except (JSONSchemaValidationError, RateLimitError, ServiceUnavailableError, APIError) as e:
                last_error = e
                if settings.is_development:
                    print(f"Model {attempt_model} failed for {model_key}, trying next: {e!s}")
                continue

        # All models failed
        raise AIServiceError(f"All models failed for {model_key}. Last error: {last_error!s}")

    async def generate_flashcards(
        self,
        text: str,
        n_cards: int,
        language: str = "",
        instructions: str = "",
        skills: list[str] | None = None,
    ) -> dict[str, Any]:
        """Generate a set of flashcards (front/back pairs) from provided text."""
        # Truncate text if needed
        notes_text = self._truncate_text(text)

        # Build prompt
        prompt = f'From this text: \n"""{notes_text}"""\n\n'
        prompt += f"Generate {n_cards} flashcards as front/back pairs.\n"
        if language:
            prompt += f"Language: {language}\n"
        if instructions:
            prompt += f"\nFOLLOW THESE GUIDELINES:\n{instructions}"

        # Add user skills/preferences
        prompt += self._build_skills_prompt(skills or [])

        output_schema = load_output_schema("flashcards")
        return await self._generate_with_fallback(
            model_key="flashcards",
            system_prompt=prompt_manager.flashcards_prompt,
            user_prompt=prompt,
            temperature=0.25,
            output_schema=output_schema,
            max_tokens=32768,
        )

    def _question_to_representation(self, question: dict[str, Any]) -> dict[str, Any]:
        """Convert a DB-shaped quiz dict {question, opt1..opt6, correct_opts} into the
        more LLM-friendly representation used in prompts: options keyed a..f, a separate
        explanation (unpacked from the [Exp]-prefixed opt6), and correct answers as letters.
        """
        options = {}
        for i in range(1, 7):
            value = str(question.get(f"opt{i}") or "").strip()
            if value:
                options[chr(96 + i)] = value  # a..f

        # Explanation is stored in opt6 with the [Exp] prefix
        explanation = ""
        if options.get("f", "").startswith("[Exp]"):
            explanation = options["f"][5:].strip()
            del options["f"]

        # Map correct_opts ("1,3") to letters ("a,c")
        correct_letters = []
        for num in str(question.get("correct_opts") or "").split(","):
            num = num.strip()
            if num.isdigit() and 1 <= int(num) <= 6:
                correct_letters.append(chr(96 + int(num)))

        return {
            "question": question.get("question", ""),
            "options": options,
            "correct_answers": correct_letters,
            "explanation": explanation,
        }

    async def edit_quiz(
        self,
        question: dict[str, Any],
        instruction: str,
        language: str = "",
    ) -> dict[str, Any]:
        """Edit exactly one quiz question according to a user instruction.

        Args:
            question: DB-shaped quiz dict {question, opt1..opt6, correct_opts}
            instruction: Natural language instruction describing the desired edit
            language: Optional language for the edited question

        Returns:
            Same result dict as _call_llm (content has {q, a..e, exp, correctOpts})
        """
        representation = self._question_to_representation(question)

        user_prompt = (
            f"Current question (JSON):\n{json.dumps(representation, ensure_ascii=False, indent=2)}\n\n"
            f'User\'s requested edit: "{instruction}"\n'
        )
        if language:
            user_prompt += f"\nKeep the edited question, options and explanation in this language: {language}\n"

        output_schema = load_output_schema("quiz_edit")
        return await self._generate_with_fallback(
            model_key="quiz_edit",
            system_prompt=prompt_manager.quiz_edit_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            output_schema=output_schema,
            max_tokens=8192,
        )

    async def edit_flashcard(
        self,
        front: str,
        back: str,
        instruction: str,
    ) -> dict[str, Any]:
        """Edit exactly one flashcard according to a user instruction."""
        user_prompt = (
            f'Current flashcard:\n- front: {front}\n- back: {back}\n\nUser\'s requested edit: "{instruction}"\n'
        )

        output_schema = load_output_schema("flashcard_edit")
        return await self._generate_with_fallback(
            model_key="flashcard_edit",
            system_prompt=prompt_manager.flashcard_edit_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            output_schema=output_schema,
            max_tokens=4096,
        )

    async def edit_test_quiz(
        self,
        test_meta: dict[str, Any],
        quizzes: list[dict[str, Any]],
        instruction: str,
        language: str = "",
    ) -> dict[str, Any]:
        """Apply a general (whole-test) edit to a knowledge test.

        Args:
            test_meta: {name, topic, desc}
            quizzes: Current questions, DB-shaped, each including its DB id:
                [{id, number, question, opt1..opt6, correct_opts}]
            instruction: Natural language instruction describing the desired edit
                (e.g. "add 2 more questions about X", "remove question 3", "change the description")
            language: Optional language for new/edited content

        Returns:
            Same result dict as _call_llm (content has
            {summary, test_updates, quizzes_to_add, quizzes_to_remove_ids, quizzes_to_update})
        """
        # Convert each DB-shaped question into the same LLM-friendly representation
        # used by edit_quiz (options a..f, explanation unpacked, correct answers as
        # letters), keeping id/number so the LLM can reference them back.
        current_questions = []
        for quiz in quizzes:
            representation = self._question_to_representation(quiz)
            representation["id"] = quiz.get("id")
            representation["number"] = quiz.get("number")
            current_questions.append(representation)

        payload = {
            "test": {
                "name": test_meta.get("name", ""),
                "topic": test_meta.get("topic", ""),
                "desc": test_meta.get("desc", ""),
            },
            "current_questions": current_questions,
        }
        user_prompt = (
            f"Current test (JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
            f'User\'s requested edit: "{instruction}"\n'
        )
        if language:
            user_prompt += f"\nWrite any new/edited content in this language: {language}\n"

        output_schema = load_output_schema("test_edit_quiz")
        return await self._generate_with_fallback(
            model_key="test_edit_quiz",
            system_prompt=prompt_manager.test_edit_quiz_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            output_schema=output_schema,
            max_tokens=16384,
        )

    async def edit_test_flashcards(
        self,
        test_meta: dict[str, Any],
        cards: list[dict[str, Any]],
        instruction: str,
        language: str = "",
    ) -> dict[str, Any]:
        """Apply a general (whole-deck) edit to a flashcard deck.

        Args:
            test_meta: {name, topic, desc}
            cards: Current cards, each including its DB id: [{id, number, front, back}]
            instruction: Natural language instruction describing the desired edit
            language: Optional language for new/edited content

        Returns:
            Same result dict as _call_llm (content has
            {summary, test_updates, cards_to_add, cards_to_remove_ids, cards_to_update})
        """
        payload = {
            "test": {
                "name": test_meta.get("name", ""),
                "topic": test_meta.get("topic", ""),
                "desc": test_meta.get("desc", ""),
            },
            "current_cards": cards,
        }
        user_prompt = (
            f"Current deck (JSON):\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
            f'User\'s requested edit: "{instruction}"\n'
        )
        if language:
            user_prompt += f"\nWrite any new/edited content in this language: {language}\n"

        output_schema = load_output_schema("test_edit_flashcards")
        return await self._generate_with_fallback(
            model_key="test_edit_flashcards",
            system_prompt=prompt_manager.test_edit_flashcards_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            output_schema=output_schema,
            max_tokens=16384,
        )

    def _try_salvage_truncated_json(self, raw: str) -> dict | None:
        """Try to salvage a truncated JSON response by extracting complete questions.

        When a response is cut off mid-JSON, we try to extract all the complete
        questions that were generated before the truncation.
        """
        if not raw:
            return None

        # Find the start of JSON
        start_idx = raw.find("{")
        if start_idx == -1:
            return None

        json_str = raw[start_idx:]

        # Try to find the quizzes array
        quizzes_match = re.search(r'"quizzes"\s*:\s*\[', json_str)
        if not quizzes_match:
            return None

        # Extract metadata before quizzes
        try:
            # Extract lang, name, topic, desc
            lang_match = re.search(r'"lang"\s*:\s*"([^"]+)"', json_str)
            name_match = re.search(r'"name"\s*:\s*"([^"]+)"', json_str)
            topic_match = re.search(r'"topic"\s*:\s*"([^"]+)"', json_str)
            desc_match = re.search(r'"desc"\s*:\s*"([^"]+)"', json_str)

            if not all([lang_match, name_match, topic_match, desc_match]):
                return None

            # Find complete quiz objects (each ends with "correctOpts":[...]}
            complete_quizzes = []

            # More robust approach: find all } that complete a quiz
            quizzes_start = quizzes_match.end()
            depth = 0
            current_quiz_start = None

            for i, char in enumerate(json_str[quizzes_start:], quizzes_start):
                if char == "{":
                    if depth == 0:
                        current_quiz_start = i
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0 and current_quiz_start is not None:
                        quiz_str = json_str[current_quiz_start : i + 1]
                        try:
                            quiz_obj = json.loads(quiz_str)
                            # Validate it has required fields
                            if all(k in quiz_obj for k in ["q", "a", "b", "exp", "correctOpts"]):
                                complete_quizzes.append(quiz_obj)
                        except json.JSONDecodeError:
                            pass
                        current_quiz_start = None

            if complete_quizzes:
                return {
                    "lang": lang_match.group(1),
                    "name": name_match.group(1),
                    "topic": topic_match.group(1),
                    "desc": desc_match.group(1),
                    "quizzes": complete_quizzes,
                }
        except Exception:
            pass

        return None

    async def _call_llm(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float,
        output_schema: dict | None = None,
        max_tokens: int = 16384,
    ) -> dict[str, Any]:
        """Make an async call to the LLM via LiteLLM with structured outputs.

        Uses JSON Schema-based structured outputs for guaranteed valid responses:
        - OpenAI/Azure: response_format with json_schema
        - Google Gemini: response_format with json_schema
        - Anthropic: Uses structured outputs beta with json_schema
        - Groq: response_format with json_schema
        - Others: Falls back to json_object mode with client-side validation

        Note: The model parameter is already the full LiteLLM path (e.g., 'anthropic/claude-sonnet-4-5-20250929')
        """
        try:
            if self.browser_mode:
                if self.browser_mode == "prepare":
                    raise BrowserAIPlan(
                        {
                            "model": self.browser_model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            "schema": output_schema,
                            "maxOutputTokens": min(max_tokens, settings.llm_max_output_tokens),
                        }
                    )
                content = validate_browser_completion(self.browser_completion, output_schema)
                self.model_used = self.browser_model
                self.outcome = "browser"
                return {
                    "content": content,
                    "finish_reason": "stop",
                    "tokens": self.tokens,
                    "raw_response": self.browser_completion,
                    "costUsd": 0,
                }
            # Build base parameters
            params = {
                "model": model,  # Already the full path from _get_model_for_category
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": temperature,
                "max_tokens": min(max_tokens, settings.llm_max_output_tokens),
                "timeout": 90,
                "num_retries": 0,
            }
            if model.startswith("openai/gpt-6"):
                params["max_completion_tokens"] = params.pop("max_tokens")
                params.pop("temperature")
                params["reasoning_effort"] = "none" if model == "openai/gpt-6-luna" else "low"

            # Configure response_format based on provider and schema availability
            if output_schema:
                # Use JSON schema for structured outputs (preferred)
                # LiteLLM handles provider-specific formatting
                params["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {"name": "quiz_response", "strict": True, "schema": output_schema},
                }
            else:
                # Fallback to basic JSON mode if no schema provided
                # Skip for providers that don't support it
                if not model.startswith("anthropic/"):
                    params["response_format"] = {"type": "json_object"}

            if self.api_key:
                params["api_key"] = self.api_key
            if settings.llm_api_base:
                params["api_base"] = settings.llm_api_base
            response = await acompletion(**params)

            # Extract response details
            choice = response.choices[0]
            usage = response.usage
            self.model_used = model
            self.tokens = {
                "prompt": usage.prompt_tokens if usage else 0,
                "completion": usage.completion_tokens if usage else 0,
                "total": usage.total_tokens if usage else 0,
            }
            try:
                cost = (
                    litellm.completion_cost(completion_response=response) if settings.llm_use_catalog_prices else None
                )
            except Exception:
                cost = None
            if cost is None:
                cost = (
                    self.tokens["prompt"] * settings.llm_input_usd_per_million
                    + self.tokens["completion"] * settings.llm_output_usd_per_million
                ) / 1_000_000
            self.cost_usd += max(0, float(cost))
            self.outcome = "success"
            if usage is None:
                self.cost_usd += settings.uncertain_request_cost_usd
                self.outcome = "uncertain"

            # Get the content, handling potential None
            raw_content = choice.message.content
            if not raw_content:
                raise AIServiceError(f"Model {model} returned empty response")

            # Parse JSON content
            # With structured outputs, this should always succeed
            # But we keep parsing logic for edge cases (refusals, max_tokens)
            content = self._parse_json_response(raw_content)
            if output_schema:
                jsonschema.validate(content, output_schema)

            return {
                "content": content,
                "finish_reason": str(choice.finish_reason),
                "tokens": {
                    "completion": usage.completion_tokens if usage else 0,
                    "prompt": usage.prompt_tokens if usage else 0,
                    "total": usage.total_tokens if usage else 0,
                },
                "raw_response": raw_content,
                "costUsd": self.cost_usd,
            }

        except json.JSONDecodeError as e:
            raise AIServiceError(f"Failed to parse AI response as JSON: {e!s}") from e
        except AIServiceError:
            raise
        except Exception as e:
            if isinstance(e, (litellm.Timeout, litellm.APIConnectionError)):
                self.cost_usd += settings.uncertain_request_cost_usd
                self.outcome = "uncertain"
            raise AIServiceError(f"LLM API error ({model}): {e!s}") from e

    def _parse_json_response(self, content: str) -> dict:
        """Parse JSON response, handling various edge cases.

        Handles:
        - Clean JSON responses
        - JSON wrapped in markdown code blocks
        - JSON with text before/after
        - Truncated JSON (tries to fix)
        """
        if not content or not content.strip():
            raise json.JSONDecodeError("Empty response", content or "", 0)

        content = content.strip()

        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code blocks
        # Pattern: ```json\n{...}\n``` or ```\n{...}\n```
        code_block_pattern = r"```(?:json)?\s*\n?([\s\S]*?)\n?```"
        matches = re.findall(code_block_pattern, content)
        for match in matches:
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue

        # Try to find JSON object in the response
        # Look for content between first { and last }
        first_brace = content.find("{")
        last_brace = content.rfind("}")

        if first_brace != -1 and last_brace > first_brace:
            json_str = content[first_brace : last_brace + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                # Try to fix truncated JSON (missing closing braces)
                # Count braces to estimate missing ones
                open_braces = json_str.count("{") - json_str.count("}")
                open_brackets = json_str.count("[") - json_str.count("]")

                if open_braces > 0 or open_brackets > 0:
                    fixed = json_str + ("]" * open_brackets) + ("}" * open_braces)
                    try:
                        return json.loads(fixed)
                    except json.JSONDecodeError:
                        pass

        # If all else fails, raise with helpful message
        preview = content[:200] + "..." if len(content) > 200 else content
        raise json.JSONDecodeError(f"Could not extract valid JSON from response. Preview: {preview}", content, 0)

    def _truncate_text(self, text: str) -> str:
        """Truncate text to fit within character limit."""
        if len(text) <= CHARACTERS_LIMIT:
            return text

        # Split into chunks and randomly remove until under limit
        chunks = [text[i : i + 1000] for i in range(0, len(text), 1000)]

        while len("".join(chunks)) > CHARACTERS_LIMIT and chunks:
            chunks.pop(random.randint(0, len(chunks) - 1))

        return "\n".join(chunks)

    def _build_difficulty_prompt(self, difficulty: str) -> str:
        """Build difficulty level prompt section."""
        level = DIFFICULTY_LEVELS[difficulty]
        prompt = f"\nDIFFICULTY LEVEL: {difficulty.upper()}\n"
        prompt += f"- Description: {level['description']}\n"
        prompt += "- Examples:\n"
        for example in level["examples"]:
            prompt += f"-> {example}\n"
        return prompt
