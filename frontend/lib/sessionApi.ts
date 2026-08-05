/**
 * sessionApi — typed fetch wrappers for the Pipecat REST API.
 *
 * Both functions throw an Error on non-2xx responses.
 * The base URL is /api/sessions so it works against both the Next.js mock
 * routes (dev) and a real Pipecat backend (via NEXT_PUBLIC_API_BASE_URL).
 */
import type {
  SessionInitRequest,
  SessionInitResponse,
  SessionEndRequest,
  SessionEndResponse,
  HintResult,
  LookupResult,
} from '@/types/call';

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[sessionApi] ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Initialise a new Pipecat session for the given video URL.
 * POST /api/sessions/init
 */
export async function initSession(
  videoUrl: string,
  mode?: 'video_chat' | 'beginner',
): Promise<SessionInitResponse> {
  const body: SessionInitRequest = { videoUrl, mode };
  const res = await fetch(`${API_BASE}/api/sessions/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<SessionInitResponse>(res);
}

/**
 * Signal that the session has ended and request a summary report.
 * POST /api/sessions/:id/end
 */
export async function endSession(
  sessionId: string,
  durationSeconds: number,
): Promise<SessionEndResponse> {
  const body: SessionEndRequest = { durationSeconds };
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<SessionEndResponse>(res);
}

/**
 * Lazily fetch beginner hints for the most recent AI turn.
 * POST /api/sessions/:id/hints
 *
 * Call this only when the user explicitly taps "Tôi nên nói gì?" or
 * "Câu đó nghĩa là gì?". Cache the result for one AI turn — both buttons
 * read from the SAME response (one Gemini call per turn).
 */
export async function fetchHints(
  sessionId: string,
  aiSentence: string,
  mode: string = 'beginner',
): Promise<HintResult> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/hints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiSentence, mode }),
  });
  return handleResponse<HintResult>(res);
}

/**
 * Look up contextual meaning of a tapped word/phrase in the subtitle rail.
 * POST /api/lookup
 *
 * Available in both Beginner and Video Chat modes when subtitles are visible.
 * The returned `term` and `startChar`/`endChar` must be used for highlighting
 * — NOT the original tapped string (Gemini may expand to a collocation).
 */
export async function fetchWordLookup(
  sessionId: string,
  messageId: string,
  tappedTerm: string,
  originalSentence: string,
  forceLlm: boolean = false
): Promise<LookupResult> {
  const res = await fetch(`${API_BASE}/api/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, messageId, tappedTerm, originalSentence, forceLlm }),
  });
  return handleResponse<LookupResult>(res);
}
