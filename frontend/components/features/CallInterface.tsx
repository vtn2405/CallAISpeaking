'use client';

/**
 * CallInterface — fullscreen voice-first call coordinator (CallFullscreenShell).
 *
 * Architecture:
 *   CallInterface (this — coordinator only, no business logic)
 *     ├── CallHeaderMinimal  (timer, title, mute only)
 *     ├── split panel
 *     │     ├── MicStageLeft  (mic hero, halo, FluencyBooster)
 *     │     └── AiPanelRight  (AI avatar, status, SubtitleRail)
 *     ├── CallFooterControls (single end-call button)
 *     └── EndSessionModal    (confirmation dialog)
 *
 * Voice-first rules enforced here:
 *   - No chat input / text composer
 *   - No auto-send of any text
 *   - FluencyBooster hints are visual-only (no sendPrompt)
 *   - silenceSeconds tracked to show/hide FluencyBooster
 *   - When user starts speaking, silenceSeconds resets → booster fades out
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCallTimer } from '@/hooks/useCallTimer';
import { useCallSession } from '@/hooks/useCallSession';

import CallHeaderMinimal from './call/CallHeaderMinimal';
import MicStageLeft from './call/MicStageLeft';
import AiPanelRight from './call/AiPanelRight';
import CallFooterControls from './call/CallFooterControls';
import EndSessionModal from './call/EndSessionModal';

import { showToast } from '@/components/ui/Toast';
import styles from '@/styles/CallFullscreen.module.css';

interface Props {
  videoUrl: string | null;
  videoId:  string | null;
  sessionId: string | null;
  /** "video_chat" (default) or "beginner" */
  mode?: 'video_chat' | 'beginner';
}

/** How many seconds of silence before FluencyBooster appears */
const SILENCE_THRESHOLD = 8;

export default function CallInterface({ videoUrl, videoId, sessionId: sessionIdProp, mode = 'video_chat' }: Props) {
  const router = useRouter();
  const timer  = useCallTimer();

  const {
    sessionState,
    metadata,
    initError,
    messages,
    liveSubtitle,
    isMuted,
    speedRate,
    setSpeedRate,
    isSubtitleHidden,
    setIsSubtitleHidden,
    toggleMute,
    handleToggleMic,
    endSession,
  } = useCallSession({ videoUrl, mode });

  const [showEndModal, setShowEndModal] = useState(false);

  // ── Silence timer for FluencyBooster ─────────────────────────────────────
  const [silenceSeconds, setSilenceSeconds] = useState(0);
  const [boosterHiding, setBoosterHiding] = useState(false);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Count silence only when user is idle (not speaking, not AI turn)
  useEffect(() => {
    const isUserIdle =
      sessionState === 'idle' && !isMuted;

    if (isUserIdle) {
      silenceIntervalRef.current = setInterval(() => {
        setSilenceSeconds((s) => s + 1);
      }, 1000);
    } else {
      // Reset silence timer when user or AI is active
      if (silenceIntervalRef.current) {
        clearInterval(silenceIntervalRef.current);
        silenceIntervalRef.current = null;
      }

      // When user starts speaking → trigger booster fade-out then hide
      if (sessionState === 'listening') {
        if (silenceSeconds >= SILENCE_THRESHOLD) {
          setBoosterHiding(true);
          setTimeout(() => {
            setSilenceSeconds(0);
            setBoosterHiding(false);
          }, 380); // match CSS animation duration
        } else {
          setSilenceSeconds(0);
        }
      }
    }

    return () => {
      if (silenceIntervalRef.current) {
        clearInterval(silenceIntervalRef.current);
        silenceIntervalRef.current = null;
      }
    };
  }, [sessionState, isMuted, silenceSeconds]);

  // ── Video title — never show raw URL ────────────────────────────────────
  const videoTitle = metadata?.title
    ?? (videoId ? `Video Session` : 'Đang tải…');

  // Friendly display title for header
  const displayTitle = metadata?.title
    ? `Đang học: ${metadata.title}`
    : 'Video Session';

  // ── Notifications ────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === 'idle' && !initError) {
      showToast('✨ Sẵn sàng! Nhấn mic để bắt đầu.', { type: 'success' });
    }
  }, [sessionState, initError]);

  useEffect(() => {
    if (initError) {
      showToast(`❌ Không thể khởi tạo phiên: ${initError}`, { type: 'error' });
    }
  }, [initError]);

  // ── Space bar → toggle mic ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        if (isMuted) {
          showToast('Vui lòng bật lại micro ở góc màn hình để tiếp tục luyện nói', { type: 'error' });
        } else {
          handleToggleMic();
        }
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
    setTimeout(() => router.push('/'), 1200);
  }, [endSession, router]);

  // ── Mic state for sub-components ─────────────────────────────────────────
  const micState =
    isMuted ? 'muted'
    : sessionState === 'listening' ? 'listening'
    : 'idle';

  return (
    <div className={styles.shell}>
      {/* ── Header ── */}
      <CallHeaderMinimal
        timer={timer}
        videoTitle={displayTitle}
        micState={micState}
        onToggleMute={() => {
          toggleMute();
          showToast(isMuted ? '🎙️ Mic đã bật lại' : '🔇 Đã tắt mic', { duration: 2000 });
        }}
      />

      {/* ── Split panel ── */}
      <div className={styles.split}>
        {/* LEFT: Mic stage */}
        <MicStageLeft
          mode={mode}
          micState={micState}
          sessionState={sessionState}
          silenceSeconds={silenceSeconds}
          silenceThreshold={SILENCE_THRESHOLD}
          boosterHiding={boosterHiding}
          onToggleMic={() => {
            if (isMuted) {
              showToast('Vui lòng bật lại micro ở góc màn hình để tiếp tục luyện nói', { type: 'error' });
            } else {
              handleToggleMic();
            }
          }}
          onHintClick={(_hint) => {
            // Hint clicked — do NOT send text.
            // The highlight UX is handled inside FluencyBooster itself.
            // This callback intentionally does nothing (voice-first principle).
          }}
        />

        {/* RIGHT: AI panel */}
        <AiPanelRight
          mode={mode}
          sessionState={sessionState}
          messages={messages}
          liveSubtitle={liveSubtitle}
          speedRate={speedRate}
          onSpeedToggle={() => setSpeedRate(prev => prev === 1.0 ? 0.8 : 1.0)}
          isSubtitleHidden={isSubtitleHidden}
          onSubtitleToggle={() => setIsSubtitleHidden(prev => !prev)}
        />
      </div>

      {/* ── Footer ── */}
      <CallFooterControls onEndCall={() => setShowEndModal(true)} />

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
