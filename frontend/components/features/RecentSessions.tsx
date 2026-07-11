// Server Component — renders mock recent sessions list.
// In production, replace MOCK_SESSIONS with a real DB/API call here
// (this is RSC, so async fetch is fine).
import Link from 'next/link';

interface Session {
  id: string;
  title: string;
  time: string;
  tag: string;
  thumbGradient: [string, string];
}

const MOCK_SESSIONS: Session[] = [
  { id: 'ses_001', title: 'Review: Modern Architecture', time: '12 PHÚT TRƯỚC', tag: 'Hội thoại tự do', thumbGradient: ['#4338ca', '#06b6d4'] },
  { id: 'ses_002', title: 'Travel Vlog: Tokyo Night',    time: 'HÔM QUA',       tag: 'Hội thoại tự do', thumbGradient: ['#0891b2', '#6366f1'] },
  { id: 'ses_003', title: 'TED Talk: Power of Habits',   time: '2 NGÀY TRƯỚC',  tag: 'Hội thoại tự do', thumbGradient: ['#7c3aed', '#2563eb'] },
  { id: 'ses_004', title: 'Science: Black Holes',        time: '3 NGÀY TRƯỚC',  tag: 'Hội thoại tự do', thumbGradient: ['#0f766e', '#0891b2'] },
];

const VideoIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
    <rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.8" />
    <path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export default function RecentSessions() {
  return (
    <section className="recent-section" aria-labelledby="recent-sessions-title">
      <div className="section-header-row">
        <h3 className="section-title" id="recent-sessions-title">
          BUỔI LUYỆN GẦN ĐÂY (VIDEO TALK)
        </h3>
        <Link href="/library" className="see-all-link">
          Xem tất cả →
        </Link>
      </div>

      <div className="session-list">
        {MOCK_SESSIONS.map((s) => (
          <Link
            key={s.id}
            href={`/call?sessionId=${s.id}`}
            className="session-item"
            aria-label={`Mở buổi luyện: ${s.title}`}
          >
            <div
              className="session-thumb"
              style={{
                background: `linear-gradient(135deg, ${s.thumbGradient[0]}, ${s.thumbGradient[1]})`,
              }}
              aria-hidden="true"
            >
              <VideoIcon />
            </div>
            <div className="session-meta">
              <div className="session-title">{s.title}</div>
              <div className="session-time">{s.time}</div>
            </div>
            <span className="session-tag">{s.tag}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
