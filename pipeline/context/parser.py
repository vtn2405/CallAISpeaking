"""
context/parser.py — YouTube URL parser and videoId extractor.

Supports all common YouTube URL formats:
  - https://www.youtube.com/watch?v=VIDEO_ID
  - https://youtu.be/VIDEO_ID
  - https://youtube.com/watch?v=VIDEO_ID&t=120s
  - https://www.youtube.com/embed/VIDEO_ID
  - https://www.youtube.com/shorts/VIDEO_ID

Raises:
    ValueError: if the URL is not a valid YouTube URL or videoId cannot be found.
"""
from __future__ import annotations

import re
from urllib.parse import urlparse, parse_qs

# videoId is always 11 characters: letters, digits, hyphens, underscores
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

# Patterns for path-based videoIds (youtu.be, /embed/, /shorts/)
_PATH_PATTERNS = re.compile(
    r"(?:youtu\.be/|youtube\.com/(?:embed|shorts)/)"
    r"([A-Za-z0-9_-]{11})"
)


def parse_youtube_url(url: str) -> str:
    """
    Extract and return the YouTube videoId from a URL.

    Args:
        url: A raw YouTube URL string (may include query params, timestamps, etc.)

    Returns:
        An 11-character videoId string.

    Raises:
        ValueError: if url is not a valid YouTube URL or videoId is missing.
    """
    url = url.strip()
    if not url:
        raise ValueError("Empty URL provided")

    # If the input looks like a bare videoId (11 chars), accept it directly
    if _VIDEO_ID_RE.match(url):
        return url

    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise ValueError(f"Cannot parse URL: {url!r}") from exc

    hostname = parsed.hostname or ""

    # Validate host is YouTube
    if not _is_youtube_host(hostname):
        raise ValueError(
            f"Not a YouTube URL (host={hostname!r}). "
            "Supported: youtube.com, youtu.be, www.youtube.com"
        )

    # --- youtu.be/VIDEO_ID style ---
    if "youtu.be" in hostname:
        video_id = parsed.path.lstrip("/").split("/")[0]
        if _VIDEO_ID_RE.match(video_id):
            return video_id
        raise ValueError(f"Could not extract videoId from youtu.be URL: {url!r}")

    # --- /embed/VIDEO_ID or /shorts/VIDEO_ID ---
    path_match = _PATH_PATTERNS.search(url)
    if path_match:
        return path_match.group(1)

    # --- youtube.com/watch?v=VIDEO_ID ---
    qs = parse_qs(parsed.query)
    if "v" in qs:
        video_id = qs["v"][0]
        if _VIDEO_ID_RE.match(video_id):
            return video_id
        raise ValueError(f"Invalid videoId format in query param: {video_id!r}")

    raise ValueError(
        f"Could not extract videoId from URL: {url!r}. "
        "Expected a URL with ?v=VIDEO_ID or youtu.be/VIDEO_ID."
    )


def _is_youtube_host(hostname: str) -> bool:
    return hostname in {
        "youtube.com",
        "www.youtube.com",
        "youtu.be",
        "m.youtube.com",
    }
