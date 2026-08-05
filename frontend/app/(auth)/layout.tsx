'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function ArrowLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

function RightPanel({ view }: { view: 'quiet' | 'register' }) {
  return (
    <div className="auth-panel relative hidden overflow-hidden lg:flex">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-[#6366f1]/30 blur-3xl" />

      <div className="relative flex h-full w-full flex-col justify-center px-12 py-16 xl:px-16">
        {/* QUIET – for login & forgot */}
        {view !== 'register' && (
          <div>
            <h2 className="max-w-sm font-display text-[32px] font-bold leading-[1.15] text-white xl:text-[36px]">
              Buổi luyện nói tiếp theo đang chờ bạn.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-blue-200">
              Đăng nhập để tiếp tục lịch sử hội thoại và những từ vựng bạn đã lưu.
            </p>
            <div className="mt-10 flex max-w-sm items-center gap-2.5 border-t border-white/15 pt-6 text-[13.5px] text-blue-200">
              <svg className="h-4 w-4 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Chỉ cần một link YouTube để bắt đầu buổi mới
            </div>
          </div>
        )}

        {/* REGISTER STEPS */}
        {view === 'register' && (
          <div>
            <h2 className="max-w-md font-display text-[32px] font-bold leading-[1.15] text-white xl:text-[36px]">
              Chỉ còn một bước là bắt đầu nói.
            </h2>
            <p className="mt-3.5 max-w-md text-[15px] leading-relaxed text-blue-200">
              Sau khi tạo tài khoản, bạn sẽ:
            </p>
            <ol className="mt-8 max-w-md space-y-6">
              {[
                { num: '01', title: 'Chọn chế độ luyện', desc: 'Tự nhiên để rèn phản xạ, hoặc Người mới với tốc độ 0.8x và gợi ý khi bí' },
                { num: '02', title: 'Dán link YouTube bạn thích', desc: 'Bất kỳ video có phụ đề — AI đọc transcript làm ngữ cảnh' },
                { num: '03', title: 'Bấm để nói', desc: 'AI mở lời từ chính nội dung video, bạn trả lời tự nhiên bằng tiếng Anh' },
              ].map((step) => (
                <li key={step.num} className="flex items-start gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 font-display text-[13px] font-bold text-white">
                    {step.num}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{step.title}</p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-blue-200">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 max-w-md space-y-3 border-t border-white/15 pt-6">
              {[
                'Miễn phí để bắt đầu — không cần thẻ',
                'Lịch sử & từ vựng chỉ bạn xem được',
                'Không cần cài gì — dùng ngay trên trình duyệt',
              ].map((item) => (
                <p key={item} className="flex items-center gap-2.5 text-[13.5px] text-blue-200">
                  <svg className="h-4 w-4 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {item}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname?.includes('/register');

  return (
    <div className="auth-root">
      {/* Two-column grid */}
      <div className="auth-grid">
        {/* ── LEFT: form side ── */}
        <div className="auth-left grain">
          {/* Header */}
          <header className="auth-header">
            {/* Logo */}
            <Link href="/" className="auth-logo">
              <span className="auth-logo-badge">AI</span>
              <span className="auth-logo-name">Speaking Coach</span>
            </Link>

            {/* ← Trang chủ — improved clickable button */}
            <Link href="/" className="auth-home-btn" title="Quay về trang chủ">
              <ArrowLeftIcon />
              <span>Trang chủ</span>
            </Link>
          </header>

          {/* Card */}
          <div className="auth-card-wrap">
            <div className="auth-card">
              {children}
            </div>
          </div>

          <p className="auth-footer">© 2026 AI Speaking Coach</p>
        </div>

        {/* ── RIGHT: decorative panel ── */}
        <RightPanel view={isRegister ? 'register' : 'quiet'} />
      </div>

      {/* Auth-scoped styles */}
      <style>{`
        /* ── Reset: no scroll on auth pages ── */
        .auth-root {
          position: fixed;
          inset: 0;
          overflow: hidden;
        }

        .auth-grid {
          display: grid;
          grid-template-columns: 1fr;
          height: 100%;
          width: 100%;
        }

        @media (min-width: 1024px) {
          .auth-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1.02fr);
          }
        }

        /* ── Left side ── */
        .auth-left {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.75rem 1.5rem;
          scrollbar-width: none; /* Firefox */
        }
        .auth-left::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }

        @media (min-width: 640px) {
          .auth-left { padding: 1.75rem 2.5rem; }
        }
        @media (min-width: 1024px) {
          .auth-left { padding: 1.75rem 3.5rem; }
        }

        /* ── Header ── */
        .auth-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        /* Logo */
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          text-decoration: none;
        }
        .auth-logo-badge {
          display: grid;
          place-items: center;
          height: 2.5rem;
          width: 2.5rem;
          border-radius: 50%;
          background: #315D9A;
          font-family: var(--font-display, "Space Grotesk", sans-serif);
          font-size: 0.875rem;
          font-weight: 700;
          color: #fff;
          box-shadow: 0 2px 12px rgba(22,41,74,0.18);
          letter-spacing: -0.02em;
        }
        .auth-logo-name {
          font-family: var(--font-display, "Space Grotesk", sans-serif);
          font-size: 1.0625rem;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: -0.02em;
        }

        /* ← Trang chủ button — pill with border, icon + text */
        .auth-home-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.4375rem 0.875rem 0.4375rem 0.625rem;
          border-radius: 0.625rem;
          border: 1px solid #e5e3df;
          background: #fff;
          font-size: 0.84375rem;
          font-weight: 500;
          color: #5b6472;
          text-decoration: none;
          transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
          box-shadow: 0 1px 3px rgba(22,41,74,0.06);
          cursor: pointer;
          white-space: nowrap;
        }
        .auth-home-btn:hover {
          background: #eff4fa;
          color: #315D9A;
          border-color: #bacfe8;
          box-shadow: 0 2px 8px rgba(49,93,154,0.12);
        }
        .auth-home-btn:focus-visible {
          outline: 2px solid #315D9A;
          outline-offset: 2px;
        }

        /* ── Card wrap: fills remaining height, centers content ── */
        .auth-card-wrap {
          display: flex;
          flex: 1;
          align-items: center;
          justify-content: center;
          padding: 2rem 0;
        }

        .auth-card {
          width: 100%;
          max-width: 26.25rem;
          border-radius: 1.5rem;
          border: 1px solid rgba(226,224,219,0.7);
          background: #fff;
          padding: 1.75rem;
          box-shadow: 0 18px 44px -18px rgba(22,41,74,0.22), 0 2px 10px rgba(22,41,74,0.05);
        }

        @media (min-width: 640px) {
          .auth-card { padding: 2rem; }
        }

        /* ── Footer ── */
        .auth-footer {
          flex-shrink: 0;
          text-align: center;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        /* ── Right panel ── */
        .auth-panel {
          background: #315D9A;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
