/**
 * Mock POST /api/sessions/:id/end
 *
 * Returns a synthetic SessionEndResponse so the frontend can call
 * sessionApi.endSession() in dev without a real Pipecat backend.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { SessionEndResponse } from '@/types/call';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { durationSeconds?: number };

  const durationSeconds = body.durationSeconds ?? 0;
  const minutes = Math.round(durationSeconds / 60);

  const response: SessionEndResponse = {
    success: true,
    report: {
      summary: `Phiên ${id} đã kết thúc sau ${minutes} phút. Tiếp tục luyện tập để đạt kết quả tốt nhất! 🎉`,
    },
  };

  return NextResponse.json(response, { status: 200 });
}
