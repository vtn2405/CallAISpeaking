import type { Metadata } from 'next';
import HistoryDetailClient from './HistoryDetail.client';
import HistoryDetailHeader from './HistoryDetailHeader.client';

export const metadata: Metadata = {
  title: 'Chi tiết cuộc gọi',
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <main className="flex flex-col h-screen bg-sand">
      {/* ── Minimal Header ───────────────────────────────────────────────────────── */}
      <HistoryDetailHeader />

      {/* ── Transcript Area ──────────────────────────────────────────────── */}
      <HistoryDetailClient sessionId={id} />
    </main>
  );
}
