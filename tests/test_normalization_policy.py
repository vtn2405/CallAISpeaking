import pytest
from pipeline.context.normalization_policy import NormalizationPolicy

def test_clarification_needed():
    routing = {"explicit_word_help": False, "should_translate_full_utterance": False, "language_mode": "english", "english_dominant_mixed": False}
    result = NormalizationPolicy.apply(routing, verbatim_text="   ", translated_text=None)
    assert result["normalization_status"] == "clarification_needed"
    assert result["llm_input_text"] == ""

def test_explicit_word_help_without_translation():
    routing = {"explicit_word_help": True, "should_translate_full_utterance": False, "language_mode": "mixed_vi_en", "english_dominant_mixed": False}
    result = NormalizationPolicy.apply(routing, verbatim_text="quán ăn đường phố nên nói thế nào", translated_text=None)
    assert result["llm_input_text"] == "quán ăn đường phố nên nói thế nào"
    assert result["mode_used"] == "transcription"
    assert result["normalization_applied"] is False

def test_explicit_word_help_with_translation():
    routing = {"explicit_word_help": True, "should_translate_full_utterance": False, "language_mode": "mixed_vi_en", "english_dominant_mixed": False}
    # STT pipeline decided to translate it anyway to provide an intent-preserving English string
    result = NormalizationPolicy.apply(
        routing, 
        verbatim_text="quán ăn đường phố nên nói thế nào", 
        translated_text="How do I say street food stalls?"
    )
    assert result["llm_input_text"] == "How do I say street food stalls?"
    assert result["mode_used"] == "transcription+translation"
    assert result["normalization_applied"] is True

def test_standard_translation():
    routing = {"explicit_word_help": False, "should_translate_full_utterance": True, "language_mode": "mostly_vietnamese", "english_dominant_mixed": False}
    result = NormalizationPolicy.apply(
        routing, 
        verbatim_text="hôm nay tôi rất vui", 
        translated_text="I am very happy today"
    )
    assert result["llm_input_text"] == "I am very happy today"
    assert result["mode_used"] == "transcription+translation"
    assert result["normalization_applied"] is True

def test_standard_translation_fallback():
    routing = {"explicit_word_help": False, "should_translate_full_utterance": True, "language_mode": "mostly_vietnamese", "english_dominant_mixed": False}
    result = NormalizationPolicy.apply(
        routing, 
        verbatim_text="hôm nay tôi rất vui", 
        translated_text=None
    )
    assert result["llm_input_text"] == "hôm nay tôi rất vui"
    assert result["normalization_status"] == "fallback_used"
    assert result["normalization_applied"] is False

def test_english_dominant_mixed():
    routing = {"explicit_word_help": False, "should_translate_full_utterance": False, "language_mode": "mixed_vi_en", "english_dominant_mixed": True}
    result = NormalizationPolicy.apply(
        routing, 
        verbatim_text="I think the video was very good, but hơi dài", 
        translated_text=None
    )
    assert result["llm_input_text"] == "I think the video was very good, but hơi dài"
    assert result["normalization_applied"] is False
