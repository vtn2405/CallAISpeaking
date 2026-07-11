import styles from '@/styles/AudioControls.module.css';
import VadVisualizer from '../VadVisualizer';
import { MicState, AiState } from '@/types/call';

interface AudioControlsProps {
  micState: MicState;
  aiState: AiState;
  onToggleMic: () => void;
  onSendPrompt: (text: string) => void;
  onEndCall: () => void;
}

const MicIcon = () => (
  <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
    <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function AudioControls({ micState, aiState, onToggleMic, onSendPrompt, onEndCall }: AudioControlsProps) {
  const micClass = [
    styles.micBtn,
    micState === 'listening' ? styles.recording : '',
    micState === 'muted'     ? styles.muted     : '',
  ].filter(Boolean).join(' ');

  const micLabel =
    micState === 'listening' ? 'Đang lắng nghe…'
    : micState === 'muted'   ? 'Mic đang tắt'
    : 'Giữ để nói (Space)';

  const orbStatus =
    aiState === 'thinking' ? 'AI đang suy nghĩ…'
    : aiState === 'speaking' ? 'AI đang nói…'
    : micState === 'listening' ? 'Đang nghe…'
    : 'Nhấn mic để bắt đầu nói';

  const vadAnimating = micState === 'listening' || aiState !== 'idle';
  const vadSpeaking  = micState === 'listening';

  const vadLabel =
    micState === 'listening' ? 'Đang nhận giọng nói'
    : aiState !== 'idle'     ? 'AI đang phát âm'
    : 'Chờ giọng nói…';

  return (
    <>
      <div className={styles.orbSection}>
        <div className={styles.aiOrbWrapper} aria-hidden="true">
          <div className={styles.orbRing} />
          <div className={styles.orbRing} />
          <div className={styles.orbRing} />
          <div className={`${styles.aiOrb} ${aiState === 'speaking' ? styles.speaking : ''}`}>
            <MicIcon />
          </div>
        </div>
        <p className={styles.orbStatus}>{orbStatus}</p>
        <p className={styles.orbHint}>AI sẽ lắng nghe và trả lời theo chủ đề video</p>
      </div>

      {/* VAD uses global classes or we need to pass a prop. The VadVisualizer component handles its own CSS currently or uses globals. We'll leave it as is if it works. */}
      <VadVisualizer animating={vadAnimating} speaking={vadSpeaking} label={vadLabel} />

      <div className={styles.micControls}>
        <button
          type="button"
          className={micClass}
          id="mic-btn"
          onClick={onToggleMic}
          aria-label={micLabel}
          aria-pressed={micState === 'listening'}
          disabled={micState === 'muted'}
        >
          <MicIcon />
        </button>
        <span className={styles.micLabel}>{micLabel}</span>
      </div>

      <div className={styles.callActions}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onSendPrompt('Can you give me a hint or question?')}
          disabled={aiState !== 'idle'}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 8v1m0 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Gợi ý câu hỏi
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => onSendPrompt("Let's talk about a different aspect.")}
          disabled={aiState !== 'idle'}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Đổi chủ đề
        </button>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={onEndCall}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Kết thúc
        </button>
      </div>
    </>
  );
}
