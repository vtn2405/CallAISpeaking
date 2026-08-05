/**
 * POST /api/sessions/[id]/hints
 *
 * Lazy-loads beginner hints for the most recent AI turn.
 * Called only when the user explicitly taps "Tôi nên nói gì?" or "Câu đó nghĩa là gì?"
 * — NEVER called automatically or on silence detection.
 *
 * The backend Python assistant.generate_hints() produces ONE JSON result that
 * feeds BOTH buttons — the frontend caches it per AI turn to avoid double billing.
 *
 * Request body:
 *   { aiSentence: string, sessionId: string }
 *
 * Response:
 *   {
 *     sentence_vi: string,              // Vietnamese explanation of the AI's sentence
 *     suggestions: Array<{             // 2-3 diverse response ideas
 *       type: "answer" | "question" | "reaction",
 *       en: string,
 *       vi: string
 *     }>
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';

const SHIM_URL = process.env.PIPECAT_SHIM_URL ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const body = await req.json().catch(() => ({})) as { aiSentence?: string, mode?: string };
  const { aiSentence = '', mode = 'beginner' } = body;

  if (!aiSentence.trim()) {
    return NextResponse.json({ error: 'aiSentence is required' }, { status: 400 });
  }

  // In mock mode (no shim), return a static fallback so dev works without backend
  if (!SHIM_URL) {
    return NextResponse.json({
      sentence_vi: 'AI vừa nói một câu. Bạn có thể thử trả lời đơn giản.',
      suggestions: [
        { type: 'answer',   en: 'I think so.',      vi: 'Tôi nghĩ vậy.' },
        { type: 'question', en: 'Why?',              vi: 'Tại sao?' },
        { type: 'reaction', en: 'That\'s cool!',     vi: 'Hay thật!' },
      ],
    });
  }

  try {
    const res = await fetch(`${SHIM_URL}/api/sessions/${sessionId}/hints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PIPELINE_SECRET || 'dev-pipeline-secret'}`,
      },
      body: JSON.stringify({ aiSentence, mode }),
      signal: AbortSignal.timeout(25000), // Azure OpenAI / Gemini can take a moment
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[hints] Shim returned ${res.status}: ${text}`);
      return NextResponse.json({ error: 'Backend hints call failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[hints] Failed to fetch hints from shim:', err);
    // Degrade gracefully — return fallback hints so UI doesn't break
    return NextResponse.json({
      sentence_vi: 'Không thể tải gợi ý lúc này. Thử lại sau.',
      suggestions: [
        { type: 'answer',   en: 'I see.',    vi: 'Tôi hiểu.' },
        { type: 'question', en: 'Really?',   vi: 'Thật sao?' },
        { type: 'reaction', en: 'Okay!',     vi: 'Được thôi!' },
      ],
    });
  }
}
