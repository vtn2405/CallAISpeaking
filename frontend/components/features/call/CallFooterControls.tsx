'use client';

/**
 * CallFooterControls — single End Call button at the bottom.
 *
 * Design rules:
 * - ONLY one End Call button in the entire UI (this one)
 * - No chat input, no secondary prompts
 * - Clear, prominent, but not intrusive
 */

import styles from '@/styles/CallFullscreen.module.css';

interface CallFooterControlsProps {
  onEndCall: () => void;
}

export default function CallFooterControls({ onEndCall }: CallFooterControlsProps) {
  return (
    <footer className={styles.footer}>
      <button
        id="end-call-btn"
        data-testid="end-call-button"
        type="button"
        className={styles.endCallBtn}
        onClick={onEndCall}
        aria-label="Kết thúc buổi luyện"
        title="Kết thúc cuộc gọi"
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </footer>
  );
}
