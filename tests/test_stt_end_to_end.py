import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from pipeline.stt import router

client = TestClient(router)

@pytest.fixture
def mock_groq_api():
    with patch("pipeline.stt._call_groq_transcriptions", new_callable=AsyncMock) as mock_transcribe, \
         patch("pipeline.stt._call_llm_translation", new_callable=AsyncMock) as mock_translate, \
         patch("pipeline.stt._call_groq_vi_asr_correction", new_callable=AsyncMock) as mock_asr_vi:
        yield {
            "transcribe": mock_transcribe,
            "translate": mock_translate,
            "asr_vi": mock_asr_vi
        }

def test_stt_explicit_word_help_translates(mock_groq_api):
    # User asks for help in Vietnamese
    mock_groq_api["transcribe"].return_value = "quán ăn đường phố nên nói thế nào"
    mock_groq_api["asr_vi"].return_value = "quán ăn đường phố nên nói thế nào"
    mock_groq_api["translate"].return_value = "How do I say street food stalls?"

    response = client.post(
        "/groq", 
        files={"file": ("test.webm", b"fake audio data", "audio/webm")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["verbatim_text"] == "quán ăn đường phố nên nói thế nào"
    assert data["normalized_english"] == "How do I say street food stalls?"
    assert data["notes"]["turn_handling_mode"] == "answer_word_help_briefly"
    assert data["notes"]["user_intent"] == "ask_for_phrase_help"
    assert data["notes"]["normalization_applied"] is True

def test_stt_mostly_vietnamese(mock_groq_api):
    mock_groq_api["transcribe"].return_value = "hôm nay tôi thấy video này rất hay"
    mock_groq_api["asr_vi"].return_value = "hôm nay tôi thấy video này rất hay"
    mock_groq_api["translate"].return_value = "I find this video very interesting today"

    response = client.post(
        "/groq", 
        files={"file": ("test.webm", b"fake audio data", "audio/webm")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["verbatim_text"] == "hôm nay tôi thấy video này rất hay"
    assert data["normalized_english"] == "I find this video very interesting today"
    assert data["notes"]["turn_handling_mode"] == "natural_followup_english_only"
    assert data["notes"]["user_intent"] == "general_chat"
    assert data["notes"]["normalization_applied"] is True

def test_stt_confirm_topic(mock_groq_api):
    mock_groq_api["transcribe"].return_value = "topic này đang nói về roleplay đúng không"
    mock_groq_api["asr_vi"].return_value = "topic này đang nói về roleplay đúng không"
    mock_groq_api["translate"].return_value = "This topic is about roleplay, right?"

    response = client.post(
        "/groq", 
        files={"file": ("test.webm", b"fake audio data", "audio/webm")}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["verbatim_text"] == "topic này đang nói về roleplay đúng không"
    assert data["normalized_english"] == "This topic is about roleplay, right?"
    assert data["notes"]["turn_handling_mode"] == "confirm_and_continue"
    assert data["notes"]["user_intent"] == "confirm_topic"
