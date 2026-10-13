"""Prompt management for AI services."""

from functools import lru_cache
from pathlib import Path


class PromptManager:
    """Manages loading and caching of system prompts."""

    def __init__(self, prompts_dir: str = "prompts"):
        self.prompts_dir = Path(__file__).resolve().parents[2] / prompts_dir

    @lru_cache(maxsize=10)
    def get_prompt(self, prompt_name: str) -> str:
        """Load a prompt from file with caching."""
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_file}")
        return prompt_file.read_text(encoding="utf-8")

    @property
    def old_exam_prompt(self) -> str:
        return self.get_prompt("from_old_exam_system")

    @property
    def notes_prompt(self) -> str:
        return self.get_prompt("from_notes_system")

    @property
    def instructions_prompt(self) -> str:
        return self.get_prompt("from_instructions_system")

    @property
    def personality_prompt(self) -> str:
        return self.get_prompt("personality_system")

    @property
    def flashcards_prompt(self) -> str:
        return self.get_prompt("flashcards_system")

    @property
    def quiz_edit_prompt(self) -> str:
        return self.get_prompt("quiz_edit_system")

    @property
    def flashcard_edit_prompt(self) -> str:
        return self.get_prompt("flashcard_edit_system")

    @property
    def test_edit_quiz_prompt(self) -> str:
        return self.get_prompt("test_edit_quiz_system")

    @property
    def test_edit_flashcards_prompt(self) -> str:
        return self.get_prompt("test_edit_flashcards_system")


# Global instance
prompt_manager = PromptManager()
