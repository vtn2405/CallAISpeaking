// Dashboard — Server Component shell.
// All static markup renders on the server.
// Only YoutubeInput (URL state + processing animation) is a Client Component.
import type { Metadata } from 'next';
import Toast from '@/components/ui/Toast';
import YoutubeInput from '@/components/features/YoutubeInput';
import LockedFeatureCards from '@/components/features/LockedFeatureCards';
import RecentSessions from '@/components/features/RecentSessions';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Luyện speaking IELTS qua video YouTube với AI Speaking Coach.',
};

export default function DashboardPage() {
  return (
    <main className="main-content">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-left">
          <h1 className="greeting">Chào Minh 👋</h1>
          <div className="streak-badge">
            <span className="streak-icon">⚡</span>
            <span>
              Chuỗi <strong>12</strong> ngày
            </span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="topbar-stats">
            <div className="stat-pill">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l3 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>48 phút tuần này</span>
            </div>
            <div className="stat-pill">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                <path
                  d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>7 buổi</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero feature card — YouTube input */}
      <section className="hero-card" aria-labelledby="hero-title">
        <div className="hero-card-header">
          <span className="section-label">TÍNH NĂNG CHÍNH</span>
        </div>
        <h2 className="hero-title" id="hero-title">
          Trò chuyện qua video YouTube
        </h2>
        <p className="hero-desc">Dán link YouTube có phụ đề để bắt đầu luyện tập</p>

        {/* Client boundary: only this interactive piece */}
        <YoutubeInput />
      </section>

      {/* Bottom two-column grid */}
      <div className="bottom-grid">
        <LockedFeatureCards />
        <RecentSessions />
      </div>

      {/* Global toast — rendered in DOM, driven by event bus */}
      <Toast />
    </main>
  );
}
