import pytest
from pipeline.context.prompt_hints import PromptHintsGenerator

def test_explicit_word_help():
    routing = {"explicit_word_help": True, "confirm_topic": False, "language_mode": "mixed_vi_en"}
    hints = PromptHintsGenerator.generate(routing)
    assert hints["user_intent"] == "ask_for_phrase_help"
    assert hints["turn_handling_mode"] == "answer_word_help_briefly"
    assert hints["embedded_phrase_source"] == "the highlighted phrase"

def test_confirm_topic():
    routing = {"explicit_word_help": False, "confirm_topic": True, "language_mode": "mixed_vi_en"}
    hints = PromptHintsGenerator.generate(routing)
    assert hints["user_intent"] == "confirm_topic"
    assert hints["turn_handling_mode"] == "confirm_and_continue"

def test_mostly_vietnamese():
    routing = {"explicit_word_help": False, "confirm_topic": False, "language_mode": "mostly_vietnamese"}
    hints = PromptHintsGenerator.generate(routing)
    assert hints["user_intent"] == "general_chat"
    assert hints["turn_handling_mode"] == "natural_followup_english_only"

def test_mixed_vi_en():
    routing = {"explicit_word_help": False, "confirm_topic": False, "language_mode": "mixed_vi_en", "english_dominant_mixed": False}
    hints = PromptHintsGenerator.generate(routing)
    assert hints["user_intent"] == "general_chat"
    assert hints["turn_handling_mode"] == "natural_followup"

def test_english_dominant_mixed():
    routing = {"explicit_word_help": False, "confirm_topic": False, "language_mode": "mixed_vi_en", "english_dominant_mixed": True}
    hints = PromptHintsGenerator.generate(routing)
    assert hints["user_intent"] == "general_chat"
    assert hints["turn_handling_mode"] == "natural_followup"
