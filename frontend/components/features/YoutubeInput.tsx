'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';

// ---- Processing step configuration ----
const STEPS = [
  { key: 'transcript', label: 'Trích transcript',   title: 'Đang lấy transcript…',  sub: 'Kết nối tới YouTube API',               ms: 1200 },
  { key: 'chunk',      label: 'Chunking nội dung',  title: 'Đang chunk nội dung…',  sub: 'Phân tách video thành các đoạn',       ms: 900 },
  { key: 'summary',    label: 'Tạo summary',        title: 'Đang tạo summary…',     sub: 'AI đang tóm tắt nội dung video',       ms: 1100 },
  { key: 'ready',      label: 'Sẵn sàng hội thoại', title: 'Sẵn sàng hội thoại!',  sub: 'Đang mở màn hội thoại…',               ms: 700 },
] as const;

type StepKey = (typeof STEPS)[number]['key'];
type StepStatus = 'idle' | 'active' | 'done';
type ChatMode = 'video_chat' | 'beginner';

function isValidYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url);
}

function extractYouTubeId(url: string): string | null {
  const patterns = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#]+)/, /\/shorts\/([^?&#]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function YoutubeInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<ChatMode>('video_chat');
  const [processing, setProcessing] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    transcript: 'idle',
    chunk: 'idle',
    summary: 'idle',
    ready: 'idle',
  });
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentSub, setCurrentSub]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      showToast('⚠️ Vui lòng dán link YouTube trước.', { type: 'error' });
      return;
    }
    if (!isValidYouTubeUrl(trimmed)) {
      showToast('❌ Link không hợp lệ. Vui lòng dán đúng link YouTube.', { type: 'error' });
      return;
    }

    abortRef.current = false;
    setProcessing(true);

    try {
      for (let i = 0; i < STEPS.length; i++) {
        if (abortRef.current) break;
        const step = STEPS[i];

        // Mark previous step done
        if (i > 0) {
          const prevKey = STEPS[i - 1].key;
          setStepStatuses((s) => ({ ...s, [prevKey]: 'done' }));
        }
        // Mark current step active
        setStepStatuses((s) => ({ ...s, [step.key]: 'active' }));
        setCurrentTitle(step.title);
        setCurrentSub(step.sub);

        // In production: call real API here
        // e.g. await fetch('/api/videos/context', { method: 'POST', body: JSON.stringify({ url: trimmed }) })
        await delay(step.ms);
      }

      if (!abortRef.current) {
        const ytId = extractYouTubeId(trimmed) ?? '';
        router.push(`/call?url=${encodeURIComponent(trimmed)}&vid=${ytId}&mode=${mode}`);
      }
    } catch {
      showToast('❌ Có lỗi xảy ra. Vui lòng thử lại.', { type: 'error' });
      setProcessing(false);
      setStepStatuses({ transcript: 'idle', chunk: 'idle', summary: 'idle', ready: 'idle' });
    }
  }, [url, mode, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Input form state
  if (!processing) {
    return (
      <div className="url-input-group">
        <div className="url-input-wrapper">
          <span className="url-icon" aria-hidden="true">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="url"
            id="youtube-url"
            className="url-input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="YouTube URL"
          />
          {url && (
            <button
              type="button"
              className="url-clear"
              aria-label="Xóa URL"
              onClick={() => { setUrl(''); inputRef.current?.focus(); }}
            >
              ×
            </button>
          )}
        </div>

        {/* Mode selector */}
        <div className="mode-selector" role="group" aria-label="Chọn chế độ luyện tập">
          <button
            type="button"
            id="mode-video-chat"
            className={`mode-btn${mode === 'video_chat' ? ' mode-btn--active' : ''}`}
            onClick={() => setMode('video_chat')}
            aria-pressed={mode === 'video_chat'}
          >
            <span className="mode-btn-icon" aria-hidden="true">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="2" y="7" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M17 9l5-3v12l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <strong>Video Chat</strong>
              <span className="mode-btn-sub">Hội thoại tự nhiên theo video</span>
            </span>
          </button>

          <button
            type="button"
            id="mode-beginner"
            className={`mode-btn${mode === 'beginner' ? ' mode-btn--active' : ''}`}
            onClick={() => setMode('beginner')}
            aria-pressed={mode === 'beginner'}
          >
            <span className="mode-btn-icon" aria-hidden="true">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <strong>Người mới</strong>
              <span className="mode-btn-sub">Câu hỏi đơn giản, có gợi ý câu</span>
            </span>
          </button>
        </div>

        <div className="input-actions">
          <button
            type="button"
            className="btn-primary"
            id="start-session-btn"
            onClick={handleSubmit}
          >
            <span className="btn-icon" aria-hidden="true">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.8" />
                <path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </span>
            Bắt đầu hội thoại
          </button>
          <p className="input-hint">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8v1m0 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            AI sẽ tạo ngữ cảnh từ transcript video để trò chuyện cùng bạn.
          </p>
        </div>
      </div>
    );
  }

  // Processing state
  return (
    <div className="processing-state" role="status" aria-live="polite">
      <div className="processing-animation" aria-hidden="true">
        <div className="pulse-ring" />
        <div className="pulse-ring delay-1" />
        <div className="pulse-ring delay-2" />
        <svg className="processing-icon" width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect x="2" y="7" width="15" height="10" rx="2" fill="#4f46e5" opacity=".15" />
          <rect x="2" y="7" width="15" height="10" rx="2" stroke="#4f46e5" strokeWidth="1.8" />
          <path d="M17 9l5-3v12l-5-3" stroke="#4f46e5" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="processing-text">
        <p className="processing-title">{currentTitle}</p>
        <p className="processing-sub">{currentSub}</p>
      </div>
      <div className="processing-steps">
        {STEPS.map((step) => {
          const status = stepStatuses[step.key];
          return (
            <div key={step.key} className={`step-item ${status}`}>
              <div className="step-dot" aria-hidden="true">
                {status === 'done' && '✓'}
              </div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
