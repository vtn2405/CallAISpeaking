'use client';

/**
 * CallInterface — fullscreen voice-first call coordinator (CallFullscreenShell).
 *
 * Architecture:
 *   CallInterface (this — coordinator only, no business logic)
 *     ├── CallHeaderMinimal  (timer, title, mute only)
 *     ├── split panel
 *     │     ├── MicStageLeft  (mic hero, halo, user STT display)
 *     │     └── AiPanelRight  (AI avatar, status, SubtitleRail)
 *     ├── CallFooterControls (single end-call button)
 *     └── EndSessionModal    (confirmation dialog)
 *
 * Voice-first rules enforced here:
 *   - No chat input / text composer
 *   - No auto-send of any text
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCallTimer } from '@/hooks/useCallTimer';
import { useCallSession } from '@/hooks/useCallSession';
import { fetchHints } from '@/lib/sessionApi';
import type { HintResult } from '@/types/call';
import { AnimatePresence, motion } from 'motion/react';

import CallHeaderMinimal from './call/CallHeaderMinimal';
import MicStageLeft from './call/MicStageLeft';
import AiPanelRight from './call/AiPanelRight';
import CallFooterControls from './call/CallFooterControls';
import EndSessionModal from './call/EndSessionModal';
import HintsOverlay from './call/HintsOverlay';

import { showToast } from '@/components/ui/Toast';
import styles from '@/styles/CallFullscreen.module.css';

interface Props {
  videoUrl: string | null;
  videoId:  string | null;
  sessionId: string | null;
  /** "video_chat" (default) or "beginner" */
  mode?: 'video_chat' | 'beginner';
}

export default function CallInterface({ videoUrl, videoId, sessionId: sessionIdProp, mode = 'video_chat' }: Props) {
  const router = useRouter();
  const timer  = useCallTimer();

  const {
    sessionState,
    metadata,
    initError,
    messages,
    liveSubtitle,
    liveUserSubtitle,
    aiUnderstood,
    isMuted,
    speedRate,
    setSpeedRate,
    isSubtitleHidden,
    setIsSubtitleHidden,
    toggleMute,
    handleToggleMic,
    endSession,
    wsSessionId,
    idbSessionId,
  } = useCallSession({ videoUrl, mode, initialSessionId: sessionIdProp });

  const [showEndModal, setShowEndModal] = useState(false);

  // ── Overlay State ────────────────────────────────────────────────────────
  const [activeOverlay, setActiveOverlay] = useState<'hints' | 'lookup' | 'vocab' | null>(null);

  // ── Hints Logic ────────────────────────────────────────────────────────
  const lastAiMessage = [...messages].reverse().find(m => m.sender === 'ai');
  const lastAiMessageId = lastAiMessage?.id ?? null;
  const hintsCache = useRef<{ messageId: string | null; result: HintResult | null }>({
    messageId: null,
    result: null,
  });

  const [hintsPanel, setHintsPanel] = useState<HintResult | null>(null);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [hintsView, setHintsView] = useState<'suggestions' | 'sentence'>('suggestions');

  useEffect(() => {
    if (lastAiMessageId !== hintsCache.current.messageId) {
      hintsCache.current = { messageId: lastAiMessageId, result: null };
      if (activeOverlay === 'hints') {
        setActiveOverlay(null);
      }
      setHintsPanel(null);
      setHintsLoading(false);
    }
  }, [lastAiMessageId, activeOverlay]);

  useEffect(() => {
    if (activeOverlay !== 'hints') setHintsPanel(null);
  }, [activeOverlay]);

  const loadHints = useCallback(async (view: 'suggestions' | 'sentence') => {
    const sessionIdToUse = wsSessionId ?? sessionIdProp;
    if (!sessionIdToUse || !lastAiMessage) return;

    if (hintsCache.current.result) {
      setHintsPanel(hintsCache.current.result);
      setHintsView(view);
      setActiveOverlay('hints');
      return;
    }

    setHintsLoading(true);
    setHintsPanel(null);
    setHintsView(view);
    setActiveOverlay('hints');

    try {
      const result = await fetchHints(sessionIdToUse, lastAiMessage.text, mode);
      hintsCache.current.result = result;
      setHintsPanel(result);
    } catch (err) {
      console.warn('[CallInterface] fetchHints failed:', err);
      setHintsPanel({
        sentence_vi: 'Không thể tải gợi ý. Vui lòng thử lại.',
        suggestions: [],
      });
    } finally {
      setHintsLoading(false);
    }
  }, [wsSessionId, sessionIdProp, lastAiMessage, hintsLoading, mode]);

  // ── Video title — never show raw URL ────────────────────────────────────
  const videoTitle = metadata?.title
    ?? (videoId ? `Video Session` : 'Đang tải…');

  // Friendly display title for header
  let displayTitle = 'Video Session';
  if (sessionState === 'initializing') {
    displayTitle = 'Đang chuẩn bị...';
  } else if (metadata?.title) {
    displayTitle = `Đang trò chuyện: ${metadata.title}`;
  } else {
    displayTitle = 'Đang trò chuyện';
  }

  // ── Notifications ────────────────────────────────────────────────────────
  const hasShownReadyToastRef = useRef(false);
  useEffect(() => {
    if (sessionState === 'idle' && !initError && !hasShownReadyToastRef.current) {
      hasShownReadyToastRef.current = true;
      showToast('✨ Đã sẵn sàng trò chuyện! Nhấn mic để bắt đầu.', { type: 'success' });
    }
  }, [sessionState, initError]);

  useEffect(() => {
    if (initError) {
      showToast(`❌ Không thể khởi tạo phiên: ${initError}`, { type: 'error' });
    }
  }, [initError]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleToggleMic();
      }
      if (e.key === 'Escape') setShowEndModal(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggleMic]);

  // ── End session ───────────────────────────────────────────────────────────
  const confirmEndSession = useCallback(async () => {
    await endSession();
    showToast('✨ Cuộc trò chuyện đã lưu!', { type: 'success', duration: 2000 });
    setTimeout(() => router.push('/dashboard'), 1200);
  }, [endSession, router]);

  const micState: 'idle' | 'listening' | 'muted' | 'locked' =
    isMuted ? 'muted'
    : sessionState === 'countdown' ? 'locked'
    : ['listening', 'recording', 'turn_candidate_end'].includes(sessionState) ? 'listening'
    : ['speech_processing', 'thinking', 'speaking'].includes(sessionState) ? 'locked'
    : 'idle';

  let badgeText = 'ĐANG TRÒ CHUYỆN';
  let badgeType: 'pending' | 'active' = 'active';

  const hasUserInteracted = messages.some((m) => m.sender === 'user');

  if (sessionState === 'initializing') {
    badgeText = 'ĐANG CHUẨN BỊ';
    badgeType = 'pending';
  } else if (sessionState === 'idle' && !hasUserInteracted) {
    badgeText = 'SẴN SÀNG';
    badgeType = 'pending';
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user')?.text;

  return (
    <div className={styles.shell}>
      {/* ── Header ── */}
      <CallHeaderMinimal
        timer={timer}
        videoTitle={videoTitle}
        micState={micState}
        badgeText={badgeText}
        badgeType={badgeType}
        onToggleMute={() => {
          toggleMute();
          showToast(isMuted ? '🎙️ Mic đã bật lại' : '🔇 Đã tắt mic', { duration: 2000 });
        }}
      />

      {/* ── Split panel ── */}
      <div className={`${styles.split} flex-1 grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1 w-full max-w-6xl mx-auto min-h-0`}>
        {/* LEFT: Mic stage */}
        <div className="flex flex-col overflow-y-auto min-h-0">
          <MicStageLeft
          mode={mode}
          micState={micState}
          sessionState={sessionState}
          liveUserSubtitle={liveUserSubtitle}
          lastUserMessage={lastUserMessage}
          aiUnderstood={aiUnderstood}
          onToggleMic={() => {
            if (isMuted) {
              showToast('Vui lòng bật lại micro ở góc màn hình để tiếp tục luyện nói', { type: 'error' });
            } else {
              handleToggleMic();
            }
          }}
          messages={messages}
          sessionId={(wsSessionId ?? sessionIdProp) || null}
          activeOverlay={activeOverlay}
          setActiveOverlay={setActiveOverlay}
          onWhatToSay={() => loadHints('suggestions')}
          onWhatItMeans={() => loadHints('sentence')}
          hintsLoading={hintsLoading}
          canUseHints={!!lastAiMessage && sessionState !== 'speaking' && sessionState !== 'thinking'}
        />
        </div>

        {/* RIGHT: AI panel */}
        <div className="flex flex-col overflow-y-auto min-h-0">
          <AiPanelRight
          mode={mode}
          sessionState={sessionState}
          messages={messages}
          liveSubtitle={liveSubtitle}
          speedRate={speedRate}
          onSpeedToggle={() => setSpeedRate(prev => prev === 1.0 ? 0.8 : 1.0)}
          isSubtitleHidden={isSubtitleHidden}
          onSubtitleToggle={() => setIsSubtitleHidden(prev => !prev)}
          sessionId={(wsSessionId ?? sessionIdProp) || null}
          idbSessionId={idbSessionId ?? null}
          activeOverlay={activeOverlay}
          setActiveOverlay={setActiveOverlay}
        />
        </div>
      </div>

      {/* ── Footer ── */}
      <CallFooterControls onEndCall={() => setShowEndModal(true)} />

      {/* ── Hints Overlay (Beginner) ── */}
      <AnimatePresence>
        {(hintsLoading || hintsPanel) && activeOverlay === 'hints' && (
          <HintsOverlay
            hintsLoading={hintsLoading}
            hintsPanel={hintsPanel}
            hintsView={hintsView}
            isOpen={true}
            onClose={() => {
              setHintsPanel(null);
              setHintsLoading(false);
              setActiveOverlay(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Countdown Overlay ── */}
      <AnimatePresence>
        {sessionState === 'countdown' && (
          <CountdownOverlay key="countdown-overlay" />
        )}
      </AnimatePresence>

      {/* ── End session modal ── */}
      {showEndModal && (
        <EndSessionModal
          onConfirm={confirmEndSession}
          onCancel={() => setShowEndModal(false)}
        />
      )}
    </div>
  );
}

// ── Internal Component ────────────────────────────────────────────────────────
function CountdownOverlay() {
  const [count, setCount] = useState(3);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (count > 0) {
      timer = setTimeout(() => setCount(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas/80 backdrop-blur-md pointer-events-none"
    >
      <motion.div
        key={count}
        initial={{ opacity: 0, scale: 0.5, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.5 }}
        transition={{ type: 'spring', duration: 0.8, bounce: 0.5 }}
        className="text-[120px] font-black text-primary-600 drop-shadow-2xl tabular-nums leading-none"
      >
        {count > 0 ? count : 'GO'}
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-[18px] font-medium text-charcoal tracking-tight"
      >
        AI đã sẵn sàng trò chuyện
      </motion.p>
    </motion.div>
  );
}
