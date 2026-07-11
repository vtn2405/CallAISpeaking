import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Library',
  description: 'Lịch sử các buổi luyện speaking IELTS.',
};

interface Session {
  id: string;
  title: string;
  date: string;
  duration: string;
  turns: number;
  gradient: [string, string];
}

const MOCK_SESSIONS: Session[] = [
  { id: 'ses_001', title: 'Review: Modern Architecture', date: '2026-07-04', duration: '12 phút', turns: 8,  gradient: ['#4338ca', '#06b6d4'] },
  { id: 'ses_002', title: 'Travel Vlog: Tokyo Night',    date: '2026-07-03', duration: '9 phút',  turns: 6,  gradient: ['#0891b2', '#6366f1'] },
  { id: 'ses_003', title: 'TED Talk: Power of Habits',   date: '2026-07-02', duration: '15 phút', turns: 11, gradient: ['#7c3aed', '#2563eb'] },
  { id: 'ses_004', title: 'Science: Black Holes',        date: '2026-07-01', duration: '8 phút',  turns: 5,  gradient: ['#0f766e', '#0891b2'] },
];

const VideoIcon = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
    <rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.8" />
    <path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export default function LibraryPage() {
  return (
    <main className="main-content">
      <header className="topbar">
        <h1 className="greeting" style={{ fontSize: '24px' }}>Thư viện buổi luyện</h1>
        <Link href="/" className="btn-primary" style={{ fontSize: '13.5px', padding: '10px 20px' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Buổi luyện mới
        </Link>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        {MOCK_SESSIONS.map((s) => (
          <Link
            key={s.id}
            href={`/call?sessionId=${s.id}`}
            className="hero-card"
            style={{ cursor: 'pointer', display: 'block' }}
          >
            <div
              style={{
                width: '100%',
                height: 80,
                background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
              aria-hidden="true"
            >
              <VideoIcon />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {s.date} · {s.duration} · {s.turns} lượt nói
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="session-tag">Hội thoại tự do</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary-light)', fontWeight: 600 }}>
                Tiếp tục →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
