"""
context/retrieval.py — TF-IDF retrieval with window expansion and confidence scoring.

Strategy:
  1. Build a retrieval query from the current user utterance + recent history.
  2. TF-IDF cosine similarity to find the top-N most relevant chunks.
  3. Window expansion: for each top-N chunk index i, also include i-1 and i+1
     (clamped to valid range) to provide narrative continuity.
  4. Confidence check: if the best TF-IDF score is below LOW_CONFIDENCE_THRESHOLD,
     return the "low_confidence" signal instead of silently falling back to the
     first N chunks. The caller uses this to inject a conservative answering
     instruction into the prompt.

Public API:
    chunks, confidence = find_relevant_chunks(query, chunks, visited_indices, force_progression=False, top_n=3)
        → (list[Chunk], "ok" | "low_confidence" | "progression" | "exhausted")

    query = build_retrieval_query(user_text, history, lookback=3)
        → str  (combined recent history + current user text for better semantic match)
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .chunker import Chunk

logger = logging.getLogger(__name__)

# Number of chunks to retrieve per user turn (before window expansion)
DEFAULT_TOP_N = 3

# TF-IDF score below this → low_confidence branch (no silent first-N fallback)
LOW_CONFIDENCE_THRESHOLD = 0.05


def build_retrieval_query(
    user_text: str,
    history: list[dict],
    lookback: int = 3,
) -> str:
    """
    Combine the last `lookback` history messages with the current user text
    to create a richer retrieval query that reflects conversation momentum.

    Short/referential queries (≤4 words, e.g. "Why?", "Tell me more", "How?")
    signal that the user is referring to something just said, not introducing a
    new topic. In this case we boost the last AI turn explicitly so TF-IDF
    anchors to the actual referent rather than a near-empty token.
    Doubling the bare user token ("Why? Why?") would boost nothing meaningful
    on TF-IDF — the AI context is the real signal.

    Args:
        user_text: Current user utterance.
        history:   Conversation history [{role, content}, ...] in OpenAI format.
        lookback:  How many recent history entries to include.

    Returns:
        A single concatenated query string.
    """
    recent = history[-lookback:] if len(history) > lookback else history
    parts = [msg["content"] for msg in recent if msg.get("content")]

    # For short/referential queries, surface the last AI turn explicitly so the
    # retrieval anchors to what the user is actually referring to.
    user_words = user_text.split()
    if len(user_words) <= 4 and history:
        last_ai = next(
            (m["content"] for m in reversed(history) if m.get("role") == "assistant"),
            "",
        )
        # Only add if not already present in the lookback window
        if last_ai and last_ai not in parts:
            parts.append(last_ai)

    parts.append(user_text)
    return " ".join(parts)


def find_relevant_chunks(
    query: str,
    chunks: list["Chunk"],
    visited_indices: set[int] | list[int] | None = None,
    force_progression: bool = False,
    top_n: int = DEFAULT_TOP_N,
) -> tuple[list["Chunk"], str]:
    """
    Return the top-N transcript chunks most relevant to query, with window expansion.

    Confidence levels:
        "ok"              — max TF-IDF score >= LOW_CONFIDENCE_THRESHOLD
        "low_confidence"  — max score < threshold; caller should respond conservatively
        "progression"     — force_progression=True and found a new chunk to introduce
        "exhausted"       — force_progression=True but all chunks have been visited

    Window expansion:
        For each selected chunk index i, also include i-1 and i+1 (clamped).
        Results are sorted chronologically (by chunk id) for narrative flow.

    Args:
        query:             Combined retrieval query.
        chunks:            All fixed-time chunks for this session.
        visited_indices:   Indices of chunks that have already been retrieved in this session.
        force_progression: If True, bypass TF-IDF and return the next unvisited chronological chunk.
        top_n:             Maximum number of base chunks to retrieve via TF-IDF.

    Returns:
        Tuple of (list[Chunk], confidence_str).
        Returns ([], "low_confidence") if chunks is empty.
    """
    if not chunks:
        return [], "low_confidence"

    if force_progression:
        visited = set(visited_indices) if visited_indices else set()
        for i, chunk in enumerate(chunks):
            if i not in visited:
                expanded = {i}
                if i > 0:
                    expanded.add(i - 1)
                if i < len(chunks) - 1:
                    expanded.add(i + 1)
                
                result = [chunks[idx] for idx in sorted(expanded)]
                logger.info("[retrieval] progression | next_index=%d | expanded=%s", i, sorted(expanded))
                return result, "progression"
                
        logger.info("[retrieval] exhausted | no unvisited chunks left for progression")
        return [], "exhausted"

    if len(chunks) <= top_n:
        # Small video — return all chunks, no retrieval needed
        indices = list(range(len(chunks)))
        logger.debug("[retrieval] Small corpus (%d chunks) — returning all", len(chunks))
        return list(chunks), "ok"

    try:
        return _tfidf_retrieve(query, chunks, top_n)
    except Exception as exc:
        logger.warning(
            "[retrieval] TF-IDF failed (%s) — returning low_confidence with no chunks",
            exc,
        )
        return [], "low_confidence"


# ── Internal helpers ──────────────────────────────────────────────────────────

def _tfidf_retrieve(
    query: str,
    chunks: list["Chunk"],
    top_n: int,
) -> tuple[list["Chunk"], str]:
    """TF-IDF cosine similarity retrieval with window expansion and confidence check."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    corpus = [c["text"] for c in chunks]

    vectorizer = TfidfVectorizer(
        lowercase=True,
        ngram_range=(1, 2),   # unigrams + bigrams for better phrase matching
        min_df=1,
    )
    all_docs = corpus + [query]
    tfidf_matrix = vectorizer.fit_transform(all_docs)

    chunk_vectors = tfidf_matrix[:-1]
    query_vector  = tfidf_matrix[-1]

    scores = cosine_similarity(query_vector, chunk_vectors).flatten()
    max_score = float(np.max(scores))

    # Confidence check — low score means no good lexical match
    if max_score < LOW_CONFIDENCE_THRESHOLD:
        logger.info(
            "[retrieval] low_confidence | query=%r | max_score=%.4f | threshold=%.4f",
            query[:60], max_score, LOW_CONFIDENCE_THRESHOLD,
        )
        return [], "low_confidence"

    # Get top-N base indices (descending score)
    top_indices = list(np.argsort(scores)[::-1][:top_n])
    top_indices = [i for i in top_indices if scores[i] > 0.0]

    # Window expansion: include i-1 and i+1 for each selected index
    expanded: set[int] = set()
    for i in top_indices:
        expanded.add(i)
        if i > 0:
            expanded.add(i - 1)
        if i < len(chunks) - 1:
            expanded.add(i + 1)

    # Sort chronologically for narrative flow
    sorted_indices = sorted(expanded)
    result = [chunks[i] for i in sorted_indices]

    logger.info(
        "[retrieval] ok | query=%r | max_score=%.4f | top_base=%s | expanded_indices=%s",
        query[:60],
        max_score,
        top_indices,
        sorted_indices,
    )
    return result, "ok"
