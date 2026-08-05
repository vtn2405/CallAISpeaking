'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { sanitizeRedirectUrl } from '@/lib/sanitizeRedirectUrl';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

const EyeOpenIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosedIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 2l20 20" />
    <path d="M6.7 6.7C4 8.4 2 12 2 12s3.6 7 10 7c2 0 3.7-.7 5.1-1.6" />
    <path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3" />
  </svg>
);

const GoogleLogo = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.4-.2-2H12v3.9h5.9c-.1 1-.8 2.4-1.7 3.3l3.4 2.6c2-1.8 2.9-4.5 2.9-7.8z" />
    <path fill="#34A853" d="M12 23c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.5 2.7C4.5 20.6 8 23 12 23z" />
    <path fill="#FBBC05" d="M6.2 14.6a6.6 6.6 0 0 1 0-4.2L2.7 7.7a11 11 0 0 0 0 9.6l3.5-2.7z" />
    <path fill="#EA4335" d="M12 5.5c1.5 0 2.9.5 4 1.5l3-3C17.1 2.2 14.7 1 12 1 8 1 4.5 3.4 2.7 7.7l3.5 2.7C7 7.3 9.3 5.5 12 5.5z" />
  </svg>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeRedirectUrl(searchParams.get('next'), '/dashboard');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failCountRef = useRef(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setCountdown(0);
        clearInterval(interval);
      } else {
        setCountdown(remaining);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }

    if (isLocked) {
      setError(`Quá nhiều lần thử sai. Vui lòng đợi ${countdown} giây.`);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      failCountRef.current += 1;
      if (failCountRef.current >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockedUntil(until);
        setCountdown(LOCKOUT_SECONDS);
        failCountRef.current = 0;
        setError(`Đăng nhập sai quá ${MAX_ATTEMPTS} lần. Vui lòng đợi ${LOCKOUT_SECONDS} giây trước khi thử lại.`);
        setLoading(false);
        return;
      }

      if (authError.message === 'Email not confirmed') {
        setError('Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác nhận.');
      } else if (authError.status === 400 || authError.message.toLowerCase().includes('invalid login credentials')) {
        const remaining = MAX_ATTEMPTS - failCountRef.current;
        setError(
          remaining > 0
            ? `Email hoặc mật khẩu không chính xác. Còn ${remaining} lần thử trước khi bị khóa tạm thời.`
            : 'Email hoặc mật khẩu không chính xác.'
        );
      } else if (authError.status === 429) {
        setError('Quá nhiều yêu cầu. Vui lòng đợi một lúc rồi thử lại.');
      } else {
        setError('Đăng nhập không thành công. Vui lòng thử lại sau.');
      }
      setLoading(false);
    } else {
      failCountRef.current = 0;
      router.push(next);
    }
  };

  return (
    <>
      {/* Heading */}
      <h1 className="auth-heading">Chào mừng trở lại</h1>
      <p className="auth-subheading">Đăng nhập để tiếp tục luyện nói.</p>

      {/* Error banner */}
      <div aria-live="polite">
        {error && (
          <div className="auth-error-banner">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <p>{error}</p>
          </div>
        )}
        {isLocked && (
          <div className="auth-warning-banner">
            Tài khoản tạm thời bị khóa. Thử lại sau <strong>{countdown}s</strong>.
          </div>
        )}
      </div>

      {/* Form */}
      <form className="auth-form" onSubmit={handleLogin} noValidate>
        {/* Email */}
        <div>
          <label htmlFor="lgEmail" className="auth-label">Địa chỉ email</label>
          <input
            id="lgEmail"
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />
        </div>

        {/* Password */}
        <div>
          <div className="auth-label-row">
            <label htmlFor="lgPass" className="auth-label">Mật khẩu</label>
            <Link href="/forgot-password" className="auth-link-sm">Quên mật khẩu?</Link>
          </div>
          <div className="auth-input-wrap">
            <input
              id="lgPass"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-11"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((v) => !v)}
              className="auth-eye-btn"
            >
              {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || isLocked}
          className="auth-submit-btn"
        >
          {loading ? (
            <>
              <svg className="auth-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.2-8.6" strokeLinecap="round" />
              </svg>
              Đang đăng nhập...
            </>
          ) : isLocked ? `Đợi ${countdown}s...` : 'Đăng nhập'}
        </button>
      </form>

      {/* Divider */}
      <div className="auth-divider">
        <span className="auth-divider-line" />
        <span className="auth-divider-text">hoặc</span>
        <span className="auth-divider-line" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={() => alert('TODO: Social login (Google)')}
        className="auth-social-btn"
      >
        <GoogleLogo />
        Tiếp tục với Google
      </button>

      {/* Switch to Register */}
      <p className="auth-switch">
        Chưa có tài khoản?{' '}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="auth-switch-link">
          Tạo tài khoản mới
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
        .auth-warning-banner {
          margin-top: 0.5rem;
          border-radius: 0.75rem;
          border: 1px solid #fde68a;
          background: #fffbeb;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          color: #92400e;
          text-align: center;
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
        .auth-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.375rem;
        }
        .auth-link-sm {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #315D9A;
          text-decoration: none;
          transition: text-decoration 0.1s;
        }
        .auth-link-sm:hover { text-decoration: underline; }
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
        .auth-input-wrap { position: relative; }
        .auth-eye-btn {
          position: absolute;
          right: 0.375rem;
          top: 50%;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          height: 2rem;
          width: 2rem;
          border-radius: 0.5rem;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .auth-eye-btn:hover { background: #f1f5f9; color: #5b6472; }
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
        .auth-divider {
          margin: 1.25rem 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .auth-divider-line {
          height: 1px;
          flex: 1;
          background: #e5e3df;
        }
        .auth-divider-text {
          font-size: 0.75rem;
          font-weight: 500;
          color: #9ca3af;
        }
        .auth-social-btn {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          border-radius: 0.75rem;
          border: 1px solid #e2e0db;
          background: #fff;
          padding: 0.75rem 1rem;
          font-size: 0.90625rem;
          font-weight: 600;
          color: #141a24;
          cursor: pointer;
          transition: background 0.15s;
        }
        .auth-social-btn:hover { background: #f8fafc; }
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: '#9ca3af' }}>Đang tải...</div>}>
      <LoginContent />
    </Suspense>
  );
}
