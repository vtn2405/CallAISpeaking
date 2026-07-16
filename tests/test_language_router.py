import pytest
from pipeline.context.language_router import LanguageRouter

def test_english_dominant():
    routing = LanguageRouter.route("I think the video was very good, but hơi dài")
    assert routing["language_mode"] == "mixed_vi_en"
    assert routing["english_dominant_mixed"] is True
    assert routing["explicit_word_help"] is False
    assert routing["should_translate_full_utterance"] is False

def test_explicit_word_help_vietnamese():
    routing = LanguageRouter.route("I like eating at quán ăn đường phố nên nói thế nào")
    assert routing["explicit_word_help"] is True
    assert routing["should_translate_full_utterance"] is False
    assert routing["should_preserve_verbatim_for_llm"] is True
    assert "explicit_word_help" in routing["detected_patterns"]

def test_explicit_word_help_english():
    routing = LanguageRouter.route("how do i say cửa hàng tiện lợi")
    assert routing["explicit_word_help"] is True
    assert routing["should_translate_full_utterance"] is False
    assert routing["should_preserve_verbatim_for_llm"] is True
    assert "explicit_word_help" in routing["detected_patterns"]

def test_confirm_topic():
    routing = LanguageRouter.route("topic này đang nói về roleplay đúng không")
    assert routing["confirm_topic"] is True
    assert routing["should_translate_full_utterance"] is True
    assert routing["should_preserve_verbatim_for_llm"] is False
    assert "confirm_topic" in routing["detected_patterns"]

def test_mostly_vietnamese():
    routing = LanguageRouter.route("hôm nay tôi thấy video này rất hay và thú vị")
    assert routing["language_mode"] == "mostly_vietnamese"
    assert routing["should_translate_full_utterance"] is True

def test_mixed_leaning_vietnamese():
    routing = LanguageRouter.route("I was rất angry yesterday vì chuyện đó")
    assert routing["language_mode"] == "mixed_vi_en"
    assert routing["english_dominant_mixed"] is False
    assert routing["should_translate_full_utterance"] is True

def test_pure_english():
    routing = LanguageRouter.route("I think this is a great idea")
    assert routing["language_mode"] == "english"
    assert routing["should_translate_full_utterance"] is False
