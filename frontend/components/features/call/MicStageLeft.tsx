'use client';

/**
 * MicStageLeft — the left half of the voice-first call UI.
 *
 * Layout: pure flex column, normal document flow.
 * Order: mic button → status → "Bạn nói" box → beginner hint pills.
 * Nothing is absolutely positioned. flex gap does all spacing.
 */

import { useState, useEffect } from 'react';
import styles from '@/styles/CallFullscreen.module.css';
import type { CallSessionState, MicState, Message } from '@/types/call';

const LightbulbIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" />
    <path d="M15 18a3 3 0 0 0 3-3c0-3-2.5-4-3-6a4 4 0 1 0-8 0c-.5 2-3 3-3 6a3 3 0 0 0 3 3" />
  </svg>
);

const QuestionIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

const MicIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MicMutedIcon = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1a3 3 0 013 3v4M9 9v3a3 3 0 005.12 2.12M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17.73 12A7 7 0 0112 19H12a7 7 0 01-7-7v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

interface MicStageLeftProps {
  mode?: 'video_chat' | 'beginner';
  micState: MicState;
  sessionState: CallSessionState;
  onToggleMic: () => void;
  liveUserSubtitle?: string | null;
  lastUserMessage?: string | null;
  aiUnderstood?: string | null;
  messages?: Message[];
  sessionId?: string | null;
  activeOverlay?: 'hints' | 'lookup' | 'vocab' | null;
  setActiveOverlay?: (overlay: 'hints' | 'lookup' | 'vocab' | null) => void;
  onWhatToSay?: () => void;
  onWhatItMeans?: () => void;
  hintsLoading?: boolean;
  canUseHints?: boolean;
}

export default function MicStageLeft({
  mode,
  micState,
  sessionState,
  onToggleMic,
  liveUserSubtitle,
  lastUserMessage,
  aiUnderstood,
  activeOverlay,
  onWhatToSay,
  onWhatItMeans,
  hintsLoading,
  canUseHints,
}: MicStageLeftProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  const isListening = micState === 'listening';
  const isMuted     = micState === 'muted';
  const isLocked    = micState === 'locked';

  const micBtnClass = [
    styles.micBtn,
    isListening ? styles.listening : '',
    isMuted     ? styles.muted     : '',
  ].filter(Boolean).join(' ');

  const statusText =
    isMuted       ? 'Mic đang tắt'
    : isListening ? 'Đang ghi âm…'
    : isLocked    ? 'Đang phản hồi…'
    : sessionState === 'initializing' ? 'Đang kết nối…'
    : 'Nhấn để nói';

  const statusClass = [
    styles.micStatus,
    isListening ? styles.listening : '',
  ].filter(Boolean).join(' ');

  const micLabel =
    isMuted       ? 'Mic đang tắt'
    : isListening ? 'Nhấn để kết thúc câu nói'
    : isMobile    ? 'Nhấn để bắt đầu nói'
    : 'Nhấn để bắt đầu nói (hoặc nhấn Space)';

  return (
    /* Pure flex column — NO absolute positioning for layout items */
    <div className={styles.leftPanel}>

      {/* ── Mic button ── flex-shrink-0 keeps it fixed size always */}
      <button
        id="mic-btn"
        data-testid="mic-toggle-button"
        type="button"
        className={micBtnClass}
        style={{ flexShrink: 0 }}
        onClick={() => {
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

      {/* ── Status label ── */}
      <p className={statusClass}>{statusText}</p>

      {/* ── "Bạn nói" box — appears in flow below status ── */}
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

      {/* ── Beginner hint pills — stacked siblings below the box ── */}
      {mode === 'beginner' && (
        <div className={styles.beginnerButtons}>
          <button
            id="btn-what-to-say"
            className={styles.helperBtn}
            onClick={onWhatToSay}
            disabled={hintsLoading || !canUseHints}
            aria-label="Gợi ý tôi nên nói gì"
            aria-controls="hints-overlay"
            aria-expanded={activeOverlay === 'hints'}
          >
            <span className={styles.helperBtnIcon}><LightbulbIcon /></span>
            Tôi nên nói gì?
          </button>
          <button
            id="btn-what-means"
            className={styles.helperBtn}
            onClick={onWhatItMeans}
            disabled={hintsLoading || !canUseHints}
            aria-label="Câu đó nghĩa là gì"
            aria-controls="hints-overlay"
            aria-expanded={activeOverlay === 'hints'}
          >
            <span className={styles.helperBtnIcon}><QuestionIcon /></span>
            Câu đó nghĩa là gì?
          </button>
        </div>
      )}

    </div>
  );
}
