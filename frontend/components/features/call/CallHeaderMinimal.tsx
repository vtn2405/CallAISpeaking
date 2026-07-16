'use client';

/**
 * CallHeaderMinimal — minimal top bar for voice-first call.
 *
 * Design rules:
 * - ONE source of End Call: only in the footer (CallFooterControls)
 * - No duplicate end-call button here
 * - Video title shows friendly label, never raw URL
 * - Mute toggle is icon-only (small, out of the way)
 */

import { useRouter } from 'next/navigation';
import styles from '@/styles/CallFullscreen.module.css';
import type { MicState } from '@/types/call';

interface CallHeaderMinimalProps {
  timer: string;
  videoTitle: string;
  micState: MicState;
  onToggleMute: () => void;
  badgeText?: string;
  badgeType?: 'pending' | 'active';
}

export default function CallHeaderMinimal({
  timer,
  videoTitle,
  micState,
  onToggleMute,
  badgeText = 'ĐANG TRÒ CHUYỆN',
  badgeType = 'active',
}: CallHeaderMinimalProps) {
  const router = useRouter();

  return (
    <header className={styles.header}>
      {/* Left: back button */}
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push('/')}
          aria-label="Quay về trang chủ"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quay lại
        </button>
      </div>

      {/* Center: live badge + timer */}
      <div className={styles.headerCenter}>
        <span className={`${styles.liveBadge} ${badgeType === 'pending' ? styles.liveBadgePending : ''}`} aria-label="Trạng thái">
          <span className={`${styles.liveDot} ${badgeType === 'pending' ? styles.liveDotPending : ''}`} aria-hidden="true" />
          {badgeText}
        </span>
        <span className={styles.timer} aria-label={`Thời gian: ${timer}`}>
          {timer}
        </span>
      </div>

      {/* Right: mute icon only (no end call — that's in the footer) */}
      <div className={styles.headerRight}>
        <button
          type="button"
          className={`${styles.muteBtn} ${micState === 'muted' ? styles.muteBtnActive : ''}`}
          title={micState === 'muted' ? 'Bật tiếng' : 'Tắt tiếng'}
          aria-label={micState === 'muted' ? 'Bật tiếng mic' : 'Tắt tiếng mic'}
          aria-pressed={micState === 'muted'}
          onClick={onToggleMute}
        >
          {micState === 'muted' ? (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1a3 3 0 013 3v4M9 9v3a3 3 0 005.12 2.12M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M17.73 12A7 7 0 0112 19a7 7 0 01-7-7v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
