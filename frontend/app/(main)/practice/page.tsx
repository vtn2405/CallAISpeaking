import type { Metadata } from 'next';
import Link from 'next/link';
import LockedFeatureCardClient from '@/components/features/LockedFeatureCardClient';
import { Plus, PlayCircle, VideoCamera } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'Practice',
  description: 'Luyện tập speaking IELTS với AI Speaking Coach.',
};

const PHASE2_FEATURES = [
  {
    id: 'part1',
    tag: { type: 'soon' as const, label: 'SẮP RA MẮT' },
    name: 'IELTS Part 1 – Câu hỏi cá nhân',
    desc: 'Luyện trả lời câu hỏi Part 1 theo chủ đề IELTS',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'part2',
    tag: { type: 'locked' as const, label: 'CHƯA MỞ KHÓA' },
    name: 'IELTS Part 2 – Cue Card',
    desc: 'Nói liên tục 2 phút về một chủ đề cho sẵn',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'part3',
    tag: { type: 'locked' as const, label: 'CHƯA MỞ KHÓA' },
    name: 'IELTS Part 3 – Thảo luận',
    desc: 'Tranh luận và trình bày quan điểm sâu hơn',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
];

export default function PracticePage() {
  return (
    <main className="p-5 sm:p-8 lg:p-12 xl:p-16 flex flex-col gap-10 max-w-6xl mx-auto w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Luyện tập
        </h1>
      </header>



      {/* Phase 2 locked grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PHASE2_FEATURES.map((f) => (
          <LockedFeatureCardClient key={f.id} feature={f} />
        ))}
      </div>
    </main>
  );
}
