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
    <header className={`${styles.header} pt-[max(14px,env(safe-area-inset-top))]`}>
      {/* Left: back button */}
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => router.push('/dashboard')}
          aria-label="Quay về trang chủ"
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quay lại
        </button>
      </div>

      {/* Center: live badge + timer */}
      <div className={`${styles.headerCenter} static transform-none md:absolute md:left-1/2 md:-translate-x-1/2 flex items-center gap-3`}>
        <span className={`${styles.liveBadge} ${badgeType === 'pending' ? styles.liveBadgePending : ''}`} aria-label="Trạng thái">
          <span className={`${styles.liveDot} ${badgeType === 'pending' ? styles.liveDotPending : ''}`} aria-hidden="true" />
          {badgeText}
        </span>
        <span className={styles.timer} aria-label={`Thời gian: ${timer}`}>
          {timer}
        </span>
        <span className={`${styles.videoTitle} hidden md:block max-w-[260px] truncate`}>
          {videoTitle}
        </span>
      </div>

      {/* Right: Empty placeholder to keep center balanced if needed */}
      <div className={styles.headerRight} />
    </header>
  );
}
