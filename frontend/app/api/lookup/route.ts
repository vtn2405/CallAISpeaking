/**
 * POST /api/lookup
 *
 * Contextual word/phrase lookup for the subtitle rail.
 * Triggered when a user taps a word in subtitles (both Beginner and Video Chat
 * modes when subtitles are visible).
 *
 * Key behaviour:
 * - Detects collocations: the returned `term` may be WIDER than `tappedTerm`
 *   (e.g. user taps "run" but the term is "run out of"). The UI must use the
 *   returned `term` string to compute startChar/endChar for highlighting —
 *   not the original tapped string.
 * - startChar/endChar are byte offsets into `originalSentence`. The backend
 *   (assistant.lookup_word) computes them; they are passed through here.
 * - Also saves a LookupEvent record server-side so the vocabulary list and
 *   inline highlights are persistent.
 *
 * Request body:
 *   {
 *     sessionId: string,
 *     messageId: string,         // IDB message UUID — for LookupEvent relation
 *     tappedTerm: string,
 *     originalSentence: string,
 *   }
 *
 * Response:
 *   {
 *     term: string,
 *     type: "WORD" | "COLLOCATION",
 *     meaning_vi: string,
 *     collocation_note: string,
 *     startChar: number | null,
 *     endChar: number | null,
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';

const SHIM_URL = process.env.PIPECAT_SHIM_URL ?? '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionId?: string;
    messageId?: string;
    tappedTerm?: string;
    originalSentence?: string;
    forceLlm?: boolean;
  };

  const { sessionId, messageId, tappedTerm, originalSentence, forceLlm } = body;

  if (!tappedTerm?.trim() || !originalSentence?.trim()) {
    return NextResponse.json(
      { error: 'tappedTerm and originalSentence are required' },
      { status: 400 },
    );
  }

  // Mock mode fallback (no shim configured)
  if (!SHIM_URL) {
    const idx = originalSentence.toLowerCase().indexOf(tappedTerm.toLowerCase());
    return NextResponse.json({
      term: tappedTerm,
      type: 'WORD',
      meaning_vi: `"${tappedTerm}" — tra nghĩa (chế độ offline, không có backend).`,
      collocation_note: '',
      startChar: idx >= 0 ? idx : null,
      endChar: idx >= 0 ? idx + tappedTerm.length : null,
    });
  }

  try {
    const res = await fetch(`${SHIM_URL}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PIPELINE_SECRET || 'dev-pipeline-secret'}`,
      },
      body: JSON.stringify({ sessionId, messageId, tappedTerm, originalSentence, forceLlm }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[lookup] Shim returned ${res.status}: ${text}`);
      return NextResponse.json({ error: 'Backend lookup failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[lookup] Failed to fetch lookup from shim:', err);
    const idx = originalSentence.toLowerCase().indexOf(tappedTerm.toLowerCase());
    return NextResponse.json({
      term: tappedTerm,
      type: 'WORD',
      meaning_vi: `Không thể tra nghĩa lúc này. Vui lòng thử lại.`,
      collocation_note: '',
      startChar: idx >= 0 ? idx : null,
      endChar: idx >= 0 ? idx + tappedTerm.length : null,
    });
  }
}
