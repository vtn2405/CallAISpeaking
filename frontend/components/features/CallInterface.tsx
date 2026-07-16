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
  } = useCallSession({ videoUrl, mode, initialSessionId: sessionIdProp });

  const [showEndModal, setShowEndModal] = useState(false);

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
    setTimeout(() => router.push('/'), 1200);
  }, [endSession, router]);

  // micState drives both the visual appearance and disabled state of the mic button.
  // 'listening' → user is actively speaking (recording or in silence window)
  // 'locked'    → the full "Đang phản hồi…" phase (speech_processing + thinking + speaking)
  //               mic is completely blocked — no accidental activation mid-response
  // 'idle'      → ready to accept a new turn
  const micState: 'idle' | 'listening' | 'muted' | 'locked' =
    isMuted ? 'muted'
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

  // Last user message
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
      <div className={styles.split}>
        {/* LEFT: Mic stage */}
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
