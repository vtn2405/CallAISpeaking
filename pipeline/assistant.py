"""
assistant.py — AI-powered beginner support layer.

Purpose:
    Two helper functions for the Beginner Mode UI:

    1. generate_hints(ai_sentence, history, summary)
       Called once when user taps either "Tôi nên nói gì?" or "Câu đó nghĩa là gì?".
       Returns a single JSON object that FEEDS BOTH BUTTONS (cached by caller).

    2. lookup_word(term, original_sentence, session_summary)
       Called when user taps a word/phrase in the subtitle rail.
       Tier 1 (Default): Uses Azure Translator for fast, cheap dictionary lookup.
       Tier 2 (force_llm=True): Uses Azure OpenAI for collocation and contextual meaning.

Design decisions:
    - LAZY only: neither function is called speculatively.
    - Runs against Azure OpenAI (HINTS_DEPLOYMENT) and Azure Translator.
    - On any failure: returns a safe fallback dict so the UI always gets a response.
"""
from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

# ── Global Caches ─────────────────────────────────────────────────────────────

_LOOKUP_CACHE: dict[str, dict] = {}

# ── Hints ─────────────────────────────────────────────────────────────────────

_HINTS_SYSTEM = """\
{system_role}
Your job is to help the user respond to an AI conversation partner after each AI turn.
Return ONLY a JSON object. No markdown fences, no extra text.
"""

_HINTS_PROMPT_TEMPLATE = """\
The AI conversation partner just said this sentence in English:
AI sentence: "{ai_sentence}"

Recent conversation context (last few turns):
{history_text}

Video topic summary (shared context between user and AI):
{summary}

Your task:
1. Write a short explanation in Vietnamese of what the AI just said (1–2 sentences max).
2. Generate 2–3 diverse suggestions for how the user could respond in English.
{mode_instructions}
   - Each suggestion must be a COMPLETE spoken sentence (not a fragment).
   - Vary the types: include at least one direct answer, one follow-up question, and one reaction/comment.
   - Provide a Vietnamese translation for each suggestion.

Return this exact JSON structure:
{{
  "sentence_vi": "<Vietnamese explanation of what the AI said>",
  "suggestions": [
    {{"type": "answer", "en": "<English suggestion>", "vi": "<Vietnamese translation>"}},
    {{"type": "question", "en": "<English suggestion>", "vi": "<Vietnamese translation>"}},
    {{"type": "reaction", "en": "<English suggestion>", "vi": "<Vietnamese translation>"}}
  ]
}}
"""

async def generate_hints(
    ai_sentence: str,
    history: list[dict],
    summary_digest: str,
    mode: str = "beginner",
) -> dict:
    api_key = os.getenv("AZURE_OPENAI_HINTS_KEY") or os.getenv("AZURE_OPENAI_API_KEY", "")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    deployment = os.getenv("AZURE_OPENAI_HINTS_NAME", "gpt-5-nano")
    api_version = os.getenv("AZURE_OPENAI_HINTS_VERSION") or os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not api_key or not endpoint:
        logger.warning("[assistant] Azure OpenAI credentials not set — returning fallback hints")
        return _fallback_hints(ai_sentence)

    recent = history[-6:] if len(history) > 6 else history
    history_lines = []
    for msg in recent:
        role_label = "User" if msg.get("role") == "user" else "AI"
        history_lines.append(f"{role_label}: {msg.get('content', '')}")
    history_text = "\n".join(history_lines) if history_lines else "(no prior turns)"

    if mode == "beginner":
        system_role = "You are a language-learning assistant for a Vietnamese user who is a beginner in English (A1–A2 level)."
        mode_instructions = "   - Keep each English suggestion under 10 words (A1-A2 level). Use simple vocabulary, but ensure the expressions are natural, practical, and diverse (avoid being overly robotic or excessively simplified)."
    else:
        system_role = "You are a conversational assistant for a Vietnamese user who is practicing fluent English (B1–B2 level)."
        mode_instructions = "   - Make the English suggestions natural and conversational (B1-B2 level). Idioms and natural phrases are encouraged."

    system_prompt = _HINTS_SYSTEM.format(system_role=system_role)
    prompt = _HINTS_PROMPT_TEMPLATE.format(
        ai_sentence=ai_sentence,
        history_text=history_text,
        summary=summary_digest or "(no topic available)",
        mode_instructions=mode_instructions,
    )

    try:
        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=endpoint, api_version=api_version)
        
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=2500,
        )

        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            logger.warning("[assistant] generate_hints returned empty content")
            return _fallback_hints(ai_sentence)

        if raw.startswith("```json"):
            raw = raw.removeprefix("```json").strip()
            if raw.endswith("```"):
                raw = raw.removesuffix("```").strip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("[assistant] JSON parsing failed: %s | Raw content: %r", e, raw)
            return _fallback_hints(ai_sentence)

        if "sentence_vi" not in data or "suggestions" not in data:
            raise ValueError("Missing expected keys in Azure OpenAI hints response")

        logger.info(
            "[assistant] generate_hints ok | %d suggestions | sentence_vi=%r",
            len(data.get("suggestions", [])),
            (data.get("sentence_vi") or "")[:60],
        )
        return data

    except Exception as exc:
        logger.warning("[assistant] generate_hints failed: %s — using fallback", exc)
        return _fallback_hints(ai_sentence)


def _fallback_hints(ai_sentence: str) -> dict:
    return {
        "sentence_vi": "AI vừa nói một câu. Bạn có thể thử trả lời đơn giản bằng tiếng Anh.",
        "suggestions": [
            {"type": "answer", "en": "I see.", "vi": "Tôi hiểu rồi."},
            {"type": "question", "en": "Really?", "vi": "Thật sao?"},
            {"type": "reaction", "en": "That's cool!", "vi": "Hay thật!"},
        ],
    }


# ── Word Lookup ───────────────────────────────────────────────────────────────

_LOOKUP_SYSTEM = """\
You are a vocabulary assistant for a Vietnamese beginner learning English.
When given a word or phrase and the sentence it appears in, you explain its meaning in Vietnamese.
You also detect if the word is part of a common collocation or fixed phrase, and if so, return the full phrase.
Return ONLY a JSON object. No markdown fences, no extra text.
"""

_LOOKUP_PROMPT_TEMPLATE = """\
The user tapped on the word or phrase: "{tapped_term}"

It appears in this sentence:
"{original_sentence}"

Video context (for disambiguation):
{summary}

Your task:
1. Determine the contextual meaning of the tapped word in the sentence above.
2. Check if the tapped word is part of a common English collocation or fixed expression (e.g. "run out of", "make up your mind", "break a record"). If yes, return the FULL collocation as the term \u2014 not just the tapped word.
3. Provide a clear, simple Vietnamese meaning for the term as used in this context. 1\u20132 sentences.
4. If you found a collocation, add a brief collocation note in Vietnamese (what the full expression means as a whole). Otherwise use an empty string.

Return this exact JSON structure:
{{
  "term": "<the word or full collocation/phrase, as it appears in the sentence>",
  "type": "WORD" | "COLLOCATION",
  "meaning_vi": "<contextual Vietnamese meaning>",
  "collocation_note": "<Vietnamese note about the collocation, or empty string>"
}}
"""

async def _translate_with_azure(text: str) -> str | None:
    api_key = os.getenv("AZURE_TRANSLATOR_KEY", "")
    region = os.getenv("AZURE_TRANSLATOR_REGION", "")
    if not api_key or not region:
        return None
    url = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=vi"
    headers = {
        "Ocp-Apim-Subscription-Key": api_key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-type": "application/json",
    }
    body = [{"Text": text}]
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data[0]["translations"][0]["text"]
    except Exception as exc:
        logger.warning("[assistant] Azure Translator failed: %s", exc)
        return None


async def lookup_word(
    tapped_term: str,
    original_sentence: str,
    summary: str = "",
    force_llm: bool = False,
    session_id: str = "",
) -> dict:
    cache_key = f"{session_id}:{tapped_term.lower().strip()}:{force_llm}"
    if cache_key in _LOOKUP_CACHE:
        logger.info("[assistant] lookup_word cache hit | term=%r | force_llm=%s", tapped_term, force_llm)
        return _LOOKUP_CACHE[cache_key]

    # Clean the word just in case
    cleaned_term = tapped_term.strip(".,;:!?'\"()")

    # Tier 1: Azure Translator (if not forcing LLM)
    if not force_llm:
        translated = await _translate_with_azure(cleaned_term)
        if translated:
            idx = original_sentence.lower().find(cleaned_term.lower())
            start_char = idx if idx >= 0 else None
            end_char = (idx + len(cleaned_term)) if idx >= 0 else None
            result = {
                "term": cleaned_term,
                "type": "WORD",
                "meaning_vi": translated,
                "collocation_note": "",
                "startChar": start_char,
                "endChar": end_char,
                "is_offline": True, # Keep field for UI compatibility
            }
            _LOOKUP_CACHE[cache_key] = result
            logger.info("[assistant] lookup_word Tier 1 (Translator) hit | term=%r", cleaned_term)
            return result

    # Tier 2: Azure OpenAI (LLM)
    api_key = os.getenv("AZURE_OPENAI_HINTS_KEY") or os.getenv("AZURE_OPENAI_API_KEY", "")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    deployment = os.getenv("AZURE_OPENAI_HINTS_NAME", "gpt-5-nano")
    api_version = os.getenv("AZURE_OPENAI_HINTS_VERSION") or os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not api_key or not endpoint:
        logger.warning("[assistant] AZURE_OPENAI_API_KEY not set — returning fallback lookup")
        return _fallback_lookup(cleaned_term)

    prompt = _LOOKUP_PROMPT_TEMPLATE.format(
        tapped_term=cleaned_term,
        original_sentence=original_sentence,
        summary=summary or "(no video summary available)",
    )

    try:
        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=endpoint, api_version=api_version)
        
        response = await client.chat.completions.create(
            model=deployment,
            messages=[
                {"role": "system", "content": _LOOKUP_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=2500,
        )

        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            logger.warning("[assistant] lookup_word returned empty content")
            return _fallback_lookup(cleaned_term)

        if raw.startswith("```json"):
            raw = raw.removeprefix("```json").strip()
            if raw.endswith("```"):
                raw = raw.removesuffix("```").strip()

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("[assistant] JSON parsing failed: %s | Raw content: %r", e, raw)
            return _fallback_lookup(cleaned_term)

        required = {"term", "type", "meaning_vi", "collocation_note"}
        if not required.issubset(data.keys()):
            raise ValueError(f"Missing keys in lookup response: {required - set(data.keys())}")

        returned_term: str = data.get("term", cleaned_term)
        idx = original_sentence.lower().find(returned_term.lower())
        data["startChar"] = idx if idx >= 0 else None
        data["endChar"] = (idx + len(returned_term)) if idx >= 0 else None
        data["is_offline"] = False

        logger.info(
            "[assistant] lookup_word Tier 2 (LLM) ok | term=%r | type=%s | startChar=%s",
            returned_term, data.get("type"), data.get("startChar"),
        )
        _LOOKUP_CACHE[cache_key] = data
        return data

    except Exception as exc:
        logger.warning("[assistant] lookup_word Tier 2 failed: %s — using fallback", exc)
        return _fallback_lookup(cleaned_term)


def _fallback_lookup(term: str) -> dict:
    return {
        "term": term,
        "type": "WORD",
        "meaning_vi": f'Không thể tra nghĩa cho "{term}" lúc này. Vui lòng thử lại.',
        "collocation_note": "",
        "startChar": None,
        "endChar": None,
        "is_offline": False,
    }
