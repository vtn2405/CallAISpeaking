'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'motion/react';
import * as Popover from '@radix-ui/react-popover';
import { 
  ClipboardText, 
  Check, 
  Faders, 
  PlayCircle, 
  VideoCamera, 
  UserPlus, 
  Info,
  YoutubeLogo,
  X
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

export default function YoutubeInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<ChatMode>('video_chat');
  const [processing, setProcessing] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    transcript: 'idle', chunk: 'idle', summary: 'idle', ready: 'idle',
  });
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentSub, setCurrentSub] = useState('');
  
  const [pasted, setPasted] = useState(false);
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

        if (i > 0) {
          const prevKey = STEPS[i - 1].key;
          setStepStatuses((s) => ({ ...s, [prevKey]: 'done' }));
        }
        setStepStatuses((s) => ({ ...s, [step.key]: 'active' }));
        setCurrentTitle(step.title);
        setCurrentSub(step.sub);

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setPasted(true);
        setTimeout(() => setPasted(false), 1500);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      showToast('❌ Không thể truy cập clipboard.', { type: 'error' });
    }
  };

  if (processing) {
    return (
      <div className="flex flex-col items-center gap-6 py-6" role="status" aria-live="polite">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-zinc-200"
            animate={{ scale: [1, 1.2], opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
          />
          <YoutubeLogo weight="duotone" size={36} className="text-zinc-800 z-10" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-zinc-900">{currentTitle}</h3>
          <p className="text-sm text-zinc-500 mt-1">{currentSub}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 mt-2">
          {STEPS.map((step) => {
            const status = stepStatuses[step.key];
            return (
              <div key={step.key} className={`flex items-center gap-2 text-sm transition-colors duration-300 ${status === 'active' ? 'text-zinc-900 font-semibold' : status === 'done' ? 'text-emerald-600 font-semibold' : 'text-zinc-400'}`}>
                <div className="relative flex items-center justify-center w-5 h-5">
                  {status === 'done' ? (
                    <Check weight="bold" size={16} />
                  ) : (
                    <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-zinc-900' : 'bg-zinc-300'}`} />
                  )}
                  {status === 'active' && (
                    <motion.div
                      className="absolute inset-0 border border-zinc-900 rounded-full"
                      animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                  )}
                </div>
                {step.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Input Group */}
      <div className="flex flex-col sm:flex-row gap-3 min-w-0">
        <div className="relative flex-1 min-w-0 group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <YoutubeLogo size={20} className="text-zinc-400 group-focus-within:text-zinc-800 transition-colors" />
          </div>
          <input
            ref={inputRef}
            type="url"
            className="w-full h-14 pl-12 pr-28 bg-zinc-50 border-2 border-zinc-200 rounded-2xl text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors duration-300 focus:bg-white focus:border-zinc-800"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {url && (
            <button
              type="button"
              className="absolute inset-y-0 right-14 flex items-center px-2 text-zinc-400 hover:text-zinc-800 transition-colors"
              onClick={() => { setUrl(''); inputRef.current?.focus(); }}
              aria-label="Xóa URL"
            >
              <X size={18} weight="bold" />
            </button>
          )}
          
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePaste}
              className="flex items-center gap-1.5 h-11 px-3.5 bg-white border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
              aria-label="Dán từ bộ nhớ tạm"
            >
              {pasted ? <Check size={16} weight="bold" className="text-emerald-600" /> : <ClipboardText size={16} weight="bold" />}
              <span>Dán</span>
            </motion.button>
          </div>
        </div>


      </div>

      {/* Bento Switch for Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 bg-zinc-100/80 rounded-3xl">
        {[
          {
            id: 'video_chat' as ChatMode,
            title: 'Tự nhiên',
            desc: 'Hội thoại tự nhiên 1.0x, phản hồi nhanh.',
            icon: VideoCamera
          },
          {
            id: 'beginner' as ChatMode,
            title: 'Người mới',
            desc: 'Tốc độ 0.8x, có gợi ý từ và giải thích.',
            icon: UserPlus
          }
        ].map((item) => {
          const isActive = mode === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className="relative flex flex-col items-start p-4 rounded-2xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 group"
            >
              {isActive && (
                <motion.div
                  layoutId="mode-switch-active"
                  className="absolute inset-0 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-zinc-200/50"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className="relative z-10 flex items-center gap-3 mb-1.5">
                <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors duration-300 ${isActive ? 'bg-primary-50 text-primary-600' : 'bg-zinc-200 text-zinc-500 group-hover:bg-zinc-300'}`}>
                  <Icon size={16} weight={isActive ? "fill" : "bold"} />
                </div>
                <span className={`font-bold transition-colors duration-300 ${isActive ? 'text-zinc-900' : 'text-zinc-600 group-hover:text-zinc-900'}`}>
                  {item.title}
                </span>
              </div>
              <span className={`relative z-10 text-[13px] leading-relaxed transition-colors duration-300 ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>
                {item.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 h-14 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-colors shadow-[0_4px_16px_rgba(27,75,160,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-600"
        >
          <PlayCircle size={22} weight="fill" />
          <span>Bắt đầu hội thoại</span>
        </motion.button>
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Info size={16} weight="bold" />
          AI sẽ tự động tạo ngữ cảnh từ transcript.
        </p>
      </div>
    </div>
  );
}
