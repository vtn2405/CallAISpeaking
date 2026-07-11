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
 *
 * FluencyBooster appears below after silenceThreshold seconds of silence.
 */

import styles from '@/styles/CallFullscreen.module.css';
import FluencyBooster from './FluencyBooster';
import type { CallSessionState, MicState } from '@/types/call';

interface MicStageLeftProps {
  mode?: 'video_chat' | 'beginner';
  micState: MicState;
  sessionState: CallSessionState;
  silenceSeconds: number;
  silenceThreshold?: number;
  onToggleMic: () => void;
  /** Called when a fluency hint is clicked — no text sent, just highlight UX */
  onHintClick?: (hint: string) => void;
  boosterHiding?: boolean;
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
  silenceSeconds,
  silenceThreshold = 8,
  onToggleMic,
  onHintClick,
  boosterHiding = false,
}: MicStageLeftProps) {
  const isListening = micState === 'listening';
  const isMuted = micState === 'muted';
  const isThinking = sessionState === 'thinking';
  const isSpeaking = sessionState === 'speaking';

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

  // Status text — describes the USER's mic state only, not AI state.
  // AI states (thinking / speaking) are shown in AiPanelRight, not here.
  const statusText =
    isMuted      ? 'Mic đang tắt'
    : isListening ? 'Đang lắng nghe…'
    : isThinking  ? 'Đang chờ AI…'
    : isSpeaking  ? 'Đang chờ AI…'
    : sessionState === 'initializing' ? 'Đang kết nối…'
    : 'Nhấn để nói';

  const statusClass = [
    styles.micStatus,
    isListening ? styles.listening : '',
    // Do NOT add speaking/thinking classes here — those belong to AiPanelRight
  ].filter(Boolean).join(' ');

  // Show FluencyBooster only when user is idle and has been silent long enough
  const showBooster =
    !isListening && !isThinking && !isSpeaking &&
    !isMuted && sessionState === 'idle' &&
    silenceSeconds >= silenceThreshold;

  const micLabel =
    isMuted      ? 'Mic đang tắt'
    : isListening ? 'Dừng nói'
    : 'Nhấn để bắt đầu nói (hoặc nhấn Space)';

  return (
    <div className={styles.leftPanel}>
      <div className={styles.micStage}>
        {/* Halo rings + Mic button */}
        <div className={haloClass} aria-hidden="true">
          <div className={styles.haloRing} />
          <div className={styles.haloRing} />
          <div className={styles.haloRing} />

          <button
            id="mic-btn"
            data-testid="mic-toggle-button"
            type="button"
            className={micBtnClass}
            onClick={onToggleMic}
            aria-label={micLabel}
            aria-pressed={isListening}
            disabled={isThinking || isSpeaking || sessionState === 'initializing'}
          >
            {isMuted ? <MicMutedIcon size={40} /> : <MicIcon size={40} />}
          </button>
        </div>

        {/* Status */}
        <p className={statusClass}>{statusText}</p>
        {!isListening && !isThinking && !isSpeaking && !isMuted && (
          <p className={styles.spaceHint}>Space hoặc nhấn mic</p>
        )}

        {/* Beginner Pill Buttons (Scratchpad equivalent) */}
        {mode === 'beginner' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
            {['Where', 'When', 'Because', 'Also...'].map(word => (
              <button
                key={word}
                type="button"
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onClick={() => {
                  if (onHintClick) onHintClick(word);
                }}
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fluency Booster — only when idle & silent too long */}
      {(showBooster || boosterHiding) && (
        <FluencyBooster
          onHintClick={onHintClick}
          hiding={boosterHiding}
        />
      )}
    </div>
  );
}
