'use client';

/**
 * AiPanelRight — the right half of the voice-first call UI.
 *
 * Shows:
 *   - AI Avatar (animated circle) with state rings
 *   - Connection/session status badge
 *   - SubtitleRail (read-only, pointer-events:none)
 *
 * The avatar animates differently per state:
 *   speaking → scale pulse with cyan glow
 *   thinking → opacity pulse with amber rings
 *   idle/listening → calm breathing
 */

import styles from '@/styles/CallFullscreen.module.css';
import SubtitleRail from './SubtitleRail';
import type { CallSessionState, Message } from '@/types/call';

interface AiPanelRightProps {
  mode?: 'video_chat' | 'beginner';
  sessionState: CallSessionState;
  messages: Message[];
  liveSubtitle: string | null;
  speedRate?: number;
  onSpeedToggle?: () => void;
  isSubtitleHidden?: boolean;
  onSubtitleToggle?: () => void;
}

const STATUS_MAP: Record<CallSessionState, { label: string; dotClass: string }> = {
  initializing: { label: 'Đang kết nối…',   dotClass: '' },
  idle:         { label: 'Sẵn sàng',         dotClass: styles.ready },
  listening:    { label: 'Đang lắng nghe',   dotClass: styles.listening },
  thinking:     { label: 'Đang xử lý…',      dotClass: styles.thinking },
  speaking:     { label: 'Đang trả lời',     dotClass: styles.speaking },
  ended:        { label: 'Đã kết thúc',      dotClass: styles.ended },
};

export default function AiPanelRight({ 
  mode, 
  sessionState, 
  messages, 
  liveSubtitle,
  speedRate = 1.0,
  onSpeedToggle,
  isSubtitleHidden = false,
  onSubtitleToggle
}: AiPanelRightProps) {
  const { label, dotClass } = STATUS_MAP[sessionState] ?? STATUS_MAP.idle;

  const avatarClass = [
    styles.aiAvatarWrapper,
    sessionState === 'speaking' ? styles.speaking : '',
    sessionState === 'thinking' ? styles.thinking : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.rightPanel}>
      {/* ── Beginner Controls (Top Right) ── */}
      {mode === 'beginner' && (
        <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8, zIndex: 10 }}>
          <button 
            onClick={onSpeedToggle}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, cursor: 'pointer',
              fontWeight: 600, fontFamily: 'inherit'
            }}
          >
            {speedRate === 1.0 ? '1.0x' : '0.8x'}
          </button>
          <button 
            onClick={onSubtitleToggle}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
              background: isSubtitleHidden ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)', 
              color: isSubtitleHidden ? 'rgba(255,255,255,0.5)' : 'white', 
              fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit'
            }}
          >
            {isSubtitleHidden ? 'Phụ đề: Tắt' : 'Phụ đề: Bật'}
          </button>
        </div>
      )}

      {/* AI Avatar */}
      <div className={avatarClass}>
        <div className={styles.aiAvatarRings} aria-hidden="true">
          <div className={styles.aiAvatarRing} />
          <div className={styles.aiAvatarRing} />
          <div className={styles.aiAvatarRing} />
        </div>
        <div className={styles.aiAvatar} role="img" aria-label="AI Speaking Coach">
          🤖
        </div>
      </div>

      {/* Connection status */}
      <div
        className={styles.connectionStatus}
        aria-live="polite"
        aria-atomic="true"
        data-testid={`ai-status-${sessionState}`}
      >
        <span className={`${styles.statusDot} ${dotClass}`} aria-hidden="true" />
        {label}
      </div>

      {/* Subtitle rail — pointer-events:none, read-only visual */}
      <SubtitleRail messages={messages} liveSubtitle={liveSubtitle} isHidden={isSubtitleHidden} />
    </div>
  );
}
