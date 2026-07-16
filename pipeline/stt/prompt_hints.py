"""
prompt_hints.py — Generate LLM turn-handling directives from routing.

Moved from context/prompt_hints.py into stt/.
Logic kept intact. embedded_phrase_source now comes from LanguageRouter.route()
instead of being generated here as a placeholder.
"""
from typing import Dict, Any


class PromptHintsGenerator:
    @staticmethod
    def generate(routing: Dict[str, Any]) -> Dict[str, str]:
        """Generate explicit hints for the LLM prompt based on STT routing."""
        hints = {
            "user_intent": "general_chat",
            "turn_handling_mode": "natural_followup",
            "embedded_phrase_source": routing.get("embedded_phrase_source", ""),
        }

        # 1. Explicit Word Help
        if routing.get("explicit_word_help"):
            hints["user_intent"] = "ask_for_phrase_help"
            hints["turn_handling_mode"] = "answer_word_help_briefly"
            # embedded_phrase_source already set from routing (real extraction, not placeholder)

        # 2. Confirm Topic
        elif routing.get("confirm_topic"):
            hints["user_intent"] = "confirm_topic"
            hints["turn_handling_mode"] = "confirm_and_continue"

        # 3. Mostly Vietnamese but not explicit help
        elif routing.get("language_mode") == "mostly_vietnamese":
            hints["user_intent"] = "ask_for_phrase_help"
            hints["turn_handling_mode"] = "answer_word_help_briefly"

        # 4. Mixed English/Vietnamese (not explicit help)
        elif routing.get("language_mode") == "mixed_vi_en":
            hints["user_intent"] = "general_chat"
            hints["turn_handling_mode"] = "natural_followup"

        return hints
