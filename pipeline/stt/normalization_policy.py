"""
normalization_policy.py — Final llm_input_text selection policy.

Moved from context/normalization_policy.py into stt/.
Logic kept intact, with one improvement:
  - Now respects should_preserve_verbatim_for_llm from LanguageRouter routing
    (was previously ignored by stt.py's orchestration).
"""
from typing import Dict, Any, Optional


class NormalizationPolicy:
    @staticmethod
    def apply(
        routing: Dict[str, Any],
        verbatim_text: str,
        translated_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Determine the final llm_input_text and status based on routing and translation results."""

        if not verbatim_text.strip():
            return {
                "llm_input_text": "",
                "normalization_status": "clarification_needed",
                "normalization_applied": False,
                "mode_used": "transcription",
            }

        mode_used = "transcription"
        normalization_status = "ok"
        normalization_applied = False
        llm_input_text = verbatim_text

        # 1. Explicit word help
        if routing["explicit_word_help"]:
            # Use translated_text if available (intent-preserving English form).
            # If both LLM translation and Whisper audio-translate fail, fall back
            # to verbatim_text with a clear normalization_status so prompt_builder
            # can handle the raw Vietnamese cautiously.
            if translated_text:
                llm_input_text = translated_text
                normalization_applied = True
                mode_used = "transcription+translation"
            else:
                llm_input_text = verbatim_text
                normalization_status = "fallback_used"
                normalization_applied = False

        # 2. Should preserve verbatim (router asked for it)
        elif routing.get("should_preserve_verbatim_for_llm"):
            llm_input_text = verbatim_text
            normalization_applied = False

        # 3. Standard translation requested
        elif routing["should_translate_full_utterance"]:
            if translated_text:
                llm_input_text = translated_text
                normalization_applied = (llm_input_text.strip().lower() != verbatim_text.strip().lower())
                mode_used = "transcription+translation"
            else:
                # Both LLM translation and audio fallback failed.
                # normalization_status must be explicit — caller / prompt_builder must
                # NOT silently treat raw Vietnamese as normalized English.
                llm_input_text = verbatim_text
                normalization_status = "fallback_used"
                normalization_applied = False

        # 4. English dominant mixed or pure English
        elif routing["english_dominant_mixed"] or routing["language_mode"] == "english":
            llm_input_text = verbatim_text
            normalization_applied = False

        # 5. Residual fallback
        else:
            if translated_text:
                llm_input_text = translated_text
                normalization_applied = True
                mode_used = "transcription+translation"
            else:
                llm_input_text = verbatim_text
                normalization_applied = False

        return {
            "llm_input_text": llm_input_text,
            "normalization_status": normalization_status,
            "normalization_applied": normalization_applied,
            "mode_used": mode_used,
        }
