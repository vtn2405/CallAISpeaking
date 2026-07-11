import type { Metadata } from 'next';
import Link from 'next/link';
import LockedFeatureCardClient from '@/components/features/LockedFeatureCardClient';

export const metadata: Metadata = {
  title: 'Practice',
  description: 'Luyện tập speaking IELTS với AI Speaking Coach.',
};

const PHASE2_FEATURES = [
  {
    id: 'part1',
    tag: { type: 'soon' as const, label: '🚀 SẮP RA MẮT' },
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
    tag: { type: 'locked' as const, label: '🔒 CHƯA MỞ KHÓA' },
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
    tag: { type: 'locked' as const, label: '🔒 CHƯA MỞ KHÓA' },
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
    <main className="main-content">
      <header className="topbar">
        <h1 className="greeting" style={{ fontSize: '24px' }}>
          Luyện tập
        </h1>
        <Link href="/" className="btn-primary" style={{ fontSize: '13.5px', padding: '10px 20px' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Buổi luyện mới
        </Link>
      </header>

      {/* Phase 1 active feature */}
      <section className="hero-card" style={{ maxWidth: 640 }} aria-labelledby="practice-phase1-title">
        <div className="hero-card-header">
          <span className="section-label">TÍNH NĂNG PHASE 1</span>
        </div>
        <h2 className="hero-title" id="practice-phase1-title">
          Hội thoại qua video YouTube
        </h2>
        <p className="hero-desc">Dán link YouTube có phụ đề để bắt đầu luyện tập ngay</p>
        <Link href="/" className="btn-primary">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.8" />
            <path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Bắt đầu ngay
        </Link>
      </section>

      {/* Phase 2 locked grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
          maxWidth: '860px',
        }}
      >
        {PHASE2_FEATURES.map((f) => (
          <LockedFeatureCardClient key={f.id} feature={f} />
        ))}
      </div>
    </main>
  );
}
