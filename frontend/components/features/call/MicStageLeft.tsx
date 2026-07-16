'use client';

/**
 * MicStageLeft — the left half of the voice-first call UI.
 *
 * Mic is the hero element. The halo rings around it communicate state:
 *   idle       → slow subtle pulse
 *   listening  → active red pulse (user is speaking)
 *   thinking   → amber slow wave (AI processing)
 *   speaking   → cyan fast pulse (AI responding)
 *   muted      → grey, no animation
 */

import { useState, useEffect } from 'react';
import styles from '@/styles/CallFullscreen.module.css';
import type { CallSessionState, MicState } from '@/types/call';

interface MicStageLeftProps {
  mode?: 'video_chat' | 'beginner';
  micState: MicState;
  sessionState: CallSessionState;
  onToggleMic: () => void;
  liveUserSubtitle?: string | null;
  lastUserMessage?: string | null;
  /** Normalized English from Groq — shown as 'AI hiểu là' when differs from verbatim. */
  aiUnderstood?: string | null;
}

const MicIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const MicMutedIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 1a3 3 0 013 3v4M9 9v3a3 3 0 005.12 2.12M4 4l16 16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M17.73 12A7 7 0 0112 19H12a7 7 0 01-7-7v-2M12 19v4M8 23h8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export default function MicStageLeft({
  mode,
  micState,
  sessionState,
  onToggleMic,
  liveUserSubtitle,
  lastUserMessage,
  aiUnderstood,
}: MicStageLeftProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    if (micState === 'listening') {
      setHasInteracted(true);
    }
  }, [micState]);

  const isListening = micState === 'listening';
  const isMuted     = micState === 'muted';
  const isLocked    = micState === 'locked'; // AI is responding — full phase block
  const isThinking  = sessionState === 'thinking' || sessionState === 'speech_processing';
  const isSpeaking  = sessionState === 'speaking';

  // Halo wrapper class reflects the dominant state
  const haloClass = [
    styles.micHaloWrapper,
    isListening ? styles.listening : '',
    isSpeaking  ? styles.speaking  : '',
    isThinking  ? styles.thinking  : '',
  ].filter(Boolean).join(' ');

  // Mic button class
  const micBtnClass = [
    styles.micBtn,
    isListening ? styles.listening : '',
    isMuted     ? styles.muted     : '',
  ].filter(Boolean).join(' ');

  // Status text on the LEFT panel (user mic side only).
  // During the full "locked" phase, show a single consistent label.
  const statusText =
    isMuted    ? 'Mic đang tắt'
    : isListening ? 'Đang ghi âm…'
    : isLocked    ? 'Đang phản hồi…'
    : sessionState === 'initializing' ? 'Đang kết nối…'
    : 'Nhấn để nói';

  const statusClass = [
    styles.micStatus,
    isListening ? styles.listening : '',
  ].filter(Boolean).join(' ');

  const micLabel =
    isMuted      ? 'Mic đang tắt'
    : isListening ? 'Nhấn để kết thúc câu nói'
    : isMobile    ? 'Nhấn để bắt đầu nói'
    : 'Nhấn để bắt đầu nói (hoặc nhấn Space)';

  return (
    <div className={styles.leftPanel}>
      <div className={styles.micStage}>
        {/* Halo wrapper for diffused glow + Mic button */}
        <div className={haloClass} aria-hidden="true">
          <button
            id="mic-btn"
            data-testid="mic-toggle-button"
            type="button"
            className={micBtnClass}
            onClick={(e) => {
              console.log(`[gstack] mic button onClick. t=${performance.now().toFixed(1)}ms state=${sessionState}`);
              onToggleMic();
            }}
            aria-label={micLabel}
            aria-pressed={isListening}
            disabled={
              isLocked ||
              isMuted  ||
              sessionState === 'initializing' ||
              sessionState === 'listening'
            }
          >
            {isMuted ? <MicMutedIcon size={40} /> : <MicIcon size={40} />}
          </button>
        </div>

        {/* Status */}
        <p className={statusClass}>{statusText}</p>
        {!isListening && !isThinking && !isSpeaking && !isMuted && !hasInteracted && (
          <p className={styles.spaceHint}>{isMobile ? 'Nhấn mic để bắt đầu' : 'Space hoặc nhấn mic'}</p>
        )}

        {/* User STT Display */}
        {(liveUserSubtitle || lastUserMessage) && (
          <div className={styles.userSubtitleBox}>
             <p className={styles.userSubtitleLabel}>Bạn nói</p>
             <p className={`${styles.userSubtitleText} ${liveUserSubtitle ? styles.live : ''}`}>
               {liveUserSubtitle || lastUserMessage}
             </p>
             {aiUnderstood && !liveUserSubtitle && (
               <p className={styles.userSubtitleUnderstood}>
                 AI hiểu là: {aiUnderstood}
               </p>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
