'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmail(email)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      });

      if (authError) {
        // Never reveal whether email exists — generic success
        console.error('Reset password error:', authError);
      }

      // Always show success to prevent email enumeration
      setDone(true);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Có lỗi xảy ra. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-heading">Đặt lại mật khẩu</h1>
      <p className="auth-subheading">
        Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
      </p>

      {/* Error */}
      {error && (
        <div className="auth-error-banner">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      {/* Success state */}
      {done ? (
        <div className="fg-done-banner">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p>
            Nếu email tồn tại trong hệ thống, liên kết đặt lại đã được gửi.
            Kiểm tra cả hộp thư spam nhé.
          </p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="fgEmail" className="auth-label">Địa chỉ email</label>
            <input
              id="fgEmail"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading ? (
              <>
                <svg className="auth-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
                </svg>
                Đang gửi...
              </>
            ) : 'Gửi liên kết đặt lại'}
          </button>
        </form>
      )}

      <p className="auth-switch">
        Nhớ ra mật khẩu?{' '}
        <Link href="/login" className="auth-switch-link">
          Quay lại đăng nhập
        </Link>
      </p>

      <style>{`
        .auth-heading {
          font-family: var(--font-display, "Space Grotesk", sans-serif);
          font-size: 1.625rem;
          font-weight: 700;
          line-height: 1.2;
          color: #141a24;
          letter-spacing: -0.02em;
        }
        .auth-subheading {
          margin-top: 0.375rem;
          font-size: 0.875rem;
          line-height: 1.6;
          color: #5b6472;
        }
        .auth-error-banner {
          margin-top: 1.25rem;
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          border-radius: 0.75rem;
          border: 1px solid #fecaca;
          background: #fef2f2;
          padding: 0.75rem;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: #b91c1c;
        }
        .fg-done-banner {
          margin-top: 1.25rem;
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          border-radius: 0.75rem;
          border: 1px solid #a7f3d0;
          background: #ecfdf5;
          padding: 0.875rem;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #065f46;
        }
        .auth-form {
          margin-top: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .auth-label {
          display: block;
          margin-bottom: 0.375rem;
          font-size: 0.84375rem;
          font-weight: 500;
          color: #141a24;
        }
        .auth-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e0db;
          background: #fff;
          padding: 0.75rem 0.875rem;
          font-size: 0.9375rem;
          color: #141a24;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .auth-input::placeholder { color: #9ca3af; }
        .auth-input:focus {
          border-color: #315D9A;
          box-shadow: 0 0 0 4px rgba(49,93,154,0.14);
        }
        .auth-submit-btn {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-radius: 0.75rem;
          border: none;
          background: #315D9A;
          padding: 0.875rem 1rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: background 0.18s, opacity 0.18s;
          box-shadow: 0 2px 12px rgba(22,41,74,0.18);
        }
        .auth-submit-btn:hover:not(:disabled) { background: #25497A; }
        .auth-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-spinner {
          height: 1rem;
          width: 1rem;
          animation: auth-spin 0.8s linear infinite;
        }
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        .auth-switch {
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid #f1f0ec;
          text-align: center;
          font-size: 0.84375rem;
          color: #5b6472;
        }
        .auth-switch-link {
          font-weight: 600;
          color: #315D9A;
          text-decoration: none;
        }
        .auth-switch-link:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordContent />;
}
