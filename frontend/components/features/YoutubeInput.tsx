'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { initSession } from '@/lib/sessionApi';
import { showToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardText, 
  Check, 
  PlayCircle, 
  VideoCamera, 
  UserPlus, 
  YoutubeLogo,
  X,
  BellRinging
} from '@phosphor-icons/react';

const STEPS = [
  { key: 'transcript', label: 'Trích transcript', title: 'Đang lấy transcript…', sub: 'Kết nối tới YouTube API', ms: 1200 },
  { key: 'chunk', label: 'Chunking nội dung', title: 'Đang chunk nội dung…', sub: 'Phân tách video thành các đoạn', ms: 900 },
  { key: 'summary', label: 'Tạo summary', title: 'Đang tạo summary…', sub: 'AI đang tóm tắt nội dung video', ms: 1100 },
  { key: 'ready', label: 'Sẵn sàng hội thoại', title: 'Sẵn sàng hội thoại!', sub: 'Đang mở màn hội thoại…', ms: 700 },
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

const MODES: { id: ChatMode; label: string; desc: string; icon: typeof VideoCamera }[] = [
  { id: 'video_chat', label: 'Tự nhiên', desc: '1.0x, phản hồi nhanh', icon: VideoCamera },
  { id: 'beginner',   label: 'Người mới', desc: '0.8x, có gợi ý từ', icon: UserPlus },
];

export default function YoutubeInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<ChatMode>('video_chat');
  const [processing, setProcessing] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    transcript: 'idle', chunk: 'idle', summary: 'idle', ready: 'idle',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentSub, setCurrentSub] = useState('');
  const [pasted, setPasted] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ videoId: string; title: string; author: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handlePrepare = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      setErrorMsg('Vui lòng dán link YouTube trước.');
      return;
    }
    if (!isValidYouTubeUrl(trimmed)) {
      setErrorMsg('Link không hợp lệ. Vui lòng dán đúng link YouTube.');
      return;
    }

    abortRef.current = false;
    setProcessing(true);
    setCurrentTitle('Đang kiểm tra link...');
    setCurrentSub('Kết nối tới YouTube');

    try {
      // 1. Verify video validity and fetch title
      const verifyRes = await fetch('/api/videos/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: trimmed }),
      });
      
      if (!verifyRes.ok) {
        setProcessing(false);
        const data = await verifyRes.json().catch(() => ({}));
        setErrorMsg(data.error || 'Video không hợp lệ hoặc không tìm thấy.');
        return;
      }

      const { videoId, title, author } = await verifyRes.json();
      
      // 2. Fire and forget prefetch
      fetch('/api/sessions/prefetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: trimmed }),
      }).catch(console.error);

      // Show preview
      setPreviewVideo({ videoId, title: title || 'Video không tên', author: author || 'Unknown' });
      setProcessing(false);

    } catch (err: any) {
      setProcessing(false);
      setErrorMsg('Lỗi kết nối. Vui lòng thử lại.');
    }
  }, [url]);

  const handleStart = useCallback(async () => {
    const trimmed = url.trim();
    abortRef.current = false;
    setProcessing(true);
    setCurrentTitle('Đang chuẩn bị dữ liệu...');
    setCurrentSub('AI đang đọc phụ đề, quá trình này mất khoảng 5-15s');

    try {
      // Start a simulated progress updater
      let progressTimer: NodeJS.Timeout;
      const startProgress = () => {
        let step = 0;
        progressTimer = setInterval(() => {
          if (abortRef.current) return clearInterval(progressTimer);
          step++;
          if (step === 1) {
            setCurrentTitle('Đang xử lý nội dung...');
            setCurrentSub('Đang chia nhỏ và phân tích các đoạn hội thoại');
          } else if (step === 3) {
            setCurrentTitle('Đang tóm tắt...');
            setCurrentSub('AI đang tóm tắt nội dung video');
          } else if (step === 5) {
            setCurrentTitle('Sắp xong...');
            setCurrentSub('Đang hoàn thiện ngữ cảnh');
          }
        }, 4000);
      };
      
      startProgress();

      const res = await initSession(trimmed, mode);
      clearInterval(progressTimer!);

      if (!abortRef.current) {
        setCurrentTitle('Sẵn sàng hội thoại!');
        setCurrentSub('Đang mở màn hội thoại…');
        setIsTransitioning(true);
        await delay(500); // Give time for the zoom-in transition
        const ytId = extractYouTubeId(trimmed) ?? '';
        
        // Save metadata temporarily in sessionStorage
        if (typeof window !== 'undefined' && res.metadata) {
          sessionStorage.setItem(`meta-${res.sessionId}`, JSON.stringify(res.metadata));
        }

        router.push(`/call?url=${encodeURIComponent(trimmed)}&vid=${ytId}&mode=${mode}&sessionId=${res.sessionId}`);
      }
    } catch (err: any) {
      abortRef.current = true;
      setProcessing(false);
      setErrorMsg('Video không hợp lệ hoặc không có phụ đề (CC). Vui lòng thử video khác.');
    }
  }, [url, mode, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePrepare();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch {
      showToast('❌ Không thể truy cập clipboard.', { type: 'error' });
    }
  };

  /* ── Processing State ── */
  let pulseDuration = 1.6;
  if (currentStepIndex === 1) pulseDuration = 0.9;
  if (currentStepIndex >= 2) pulseDuration = 0.3;

  if (processing) {
    return (
      <motion.div 
        className="flex flex-col items-center gap-6 py-10" role="status" aria-live="polite"
        animate={isTransitioning ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative w-16 h-16 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-hairline"
            animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
            transition={{ repeat: Infinity, duration: pulseDuration, ease: 'easeOut' }}
          />
          <YoutubeLogo weight="duotone" size={28} className="text-charcoal z-10" />
        </div>
        <div className="text-center relative z-10">
          <p className="text-[15px] font-medium text-ink">{currentTitle}</p>
          <p className="text-[13px] text-steel mt-1">{currentSub}</p>
        </div>
      </motion.div>
    );
  }

  /* ── Entry Form ── */
  if (previewVideo) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex gap-4 p-4 bg-surface border border-hairline rounded-[12px]">
          <div className="w-[120px] shrink-0 rounded-lg overflow-hidden bg-black/5 aspect-video border border-hairline">
            <img src={`https://img.youtube.com/vi/${previewVideo.videoId}/0.jpg`} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0 py-1">
            <h3 className="text-[15px] font-semibold text-charcoal leading-tight line-clamp-2">{previewVideo.title}</h3>
            <p className="text-[13px] text-steel mt-1 truncate">{previewVideo.author}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 p-1 bg-surface rounded-[8px] border border-hairline w-fit">
          {MODES.map((item) => {
            const isActive = mode === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-pill-active"
                    className="absolute inset-0 bg-canvas rounded-[6px] border border-hairline"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className={`relative z-10 transition-colors duration-150 ${isActive ? 'text-charcoal' : 'text-steel'}`}>
                  <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
                </span>
                <span className={`relative z-10 font-medium transition-colors duration-150 ${isActive ? 'text-charcoal' : 'text-steel'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-stone leading-relaxed -mt-1">
          {mode === 'video_chat'
            ? 'Hội thoại tự nhiên 1.0x, AI phản hồi nhanh và bám sát video.'
            : 'Tốc độ 0.8x, AI có gợi ý từ và giải thích — phù hợp người mới bắt đầu.'}
        </p>
        
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => setPreviewVideo(null)}
            className="flex-1 h-11 bg-surface text-charcoal border border-hairline rounded-[8px] text-[14px] font-medium hover:bg-hairline-soft transition-colors"
          >
            Quay lại
          </button>
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={handleStart}
            className="flex-[2] flex items-center justify-center gap-2 h-11 bg-primary-600 text-white rounded-[8px] text-[14px] font-medium hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-600"
          >
            <PlayCircle size={18} weight="fill" />
            <span>Bắt đầu</span>
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* URL Input */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          <YoutubeLogo size={18} className="text-stone group-focus-within:text-charcoal transition-colors" />
        </div>
        <input
          ref={inputRef}
          type="url"
          className="w-full h-11 pl-10 pr-[100px] bg-canvas border border-hairline-strong rounded-[8px] text-ink placeholder:text-stone text-[14px] outline-none transition-all duration-200 focus:border-primary-600 focus:ring-2 focus:ring-primary-50"
          placeholder="Dán link YouTube có phụ đề vào đây…"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setErrorMsg(null); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {url && (
          <button
            type="button"
            className="absolute inset-y-0 right-[68px] flex items-center px-2 text-stone hover:text-charcoal transition-colors"
            onClick={() => { setUrl(''); inputRef.current?.focus(); }}
            aria-label="Xóa URL"
          >
            <X size={15} weight="bold" />
          </button>
        )}
        <div className="absolute inset-y-0 right-1.5 flex items-center">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handlePaste}
            className="flex items-center gap-1 h-8 px-2.5 bg-surface border border-hairline rounded-[6px] text-[12px] font-medium text-charcoal hover:bg-hairline-soft transition-colors"
            aria-label="Dán từ bộ nhớ tạm"
          >
            {pasted ? <Check size={13} weight="bold" className="text-success-text" /> : <ClipboardText size={13} weight="regular" />}
            <span>Dán</span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 mt-0.5 px-4 py-3 bg-rose-50/90 backdrop-blur-md border border-rose-100 rounded-[8px]">
              <div className="mt-0.5 shrink-0">
                <BellRinging size={16} className="text-rose-500" weight="regular" />
              </div>
              <span className="text-[13px] text-rose-950 font-medium leading-relaxed">{errorMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Picker — pill-tab style */}
      <div className="flex items-center gap-1 p-1 bg-surface rounded-[8px] border border-hairline w-fit">
        {MODES.map((item) => {
          const isActive = mode === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              {isActive && (
                <motion.div
                  layoutId="mode-pill-active"
                  className="absolute inset-0 bg-canvas rounded-[6px] border border-hairline"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className={`relative z-10 transition-colors duration-150 ${isActive ? 'text-charcoal' : 'text-steel'}`}>
                <Icon size={13} weight={isActive ? 'fill' : 'regular'} />
              </span>
              <span className={`relative z-10 font-medium transition-colors duration-150 ${isActive ? 'text-charcoal' : 'text-steel'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode description */}
      <p className="text-[12px] text-stone leading-relaxed -mt-1">
        {mode === 'video_chat'
          ? 'Hội thoại tự nhiên 1.0x, AI phản hồi nhanh và bám sát video.'
          : 'Tốc độ 0.8x, AI có gợi ý từ và giải thích — phù hợp người mới bắt đầu.'}
      </p>

      {/* CTA Button — full width, premium weight */}
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={handlePrepare}
        className="w-full flex items-center justify-center gap-2 h-11 mt-1 bg-primary-600 text-white rounded-[8px] text-[14px] font-medium hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-600"
      >
        <span>Chuẩn bị video</span>
      </motion.button>

      {/* Inline reassurance */}
      <p className="text-[12px] text-stone text-center leading-relaxed">
        Thoải mái trò chuyện như với bạn bè · AI sẽ dựa vào video để mở lời
      </p>
    </div>
  );
}
