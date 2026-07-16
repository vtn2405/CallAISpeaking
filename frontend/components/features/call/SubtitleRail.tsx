'use client';

/**
 * SubtitleRail — read-only visual overlay for real-time subtitles.
 *
 * DESIGN INTENT: pointer-events:none + user-select:none are applied via CSS.
 * Users CANNOT click, select, or interact with subtitle text.
 * This forces the brain into listen-and-speak mode (not read-and-type).
 *
 * Displays:
 *   - liveSubtitle (non-final, in-progress) — italic, slightly muted
 *   - last committed message text — normal weight
 *   - empty state hint when nothing is playing
 */

import styles from '@/styles/CallFullscreen.module.css';
import type { Message } from '@/types/call';

interface SubtitleRailProps {
  liveSubtitle: string | null;
  messages: Message[];
  isHidden?: boolean;
}

export default function SubtitleRail({ liveSubtitle, messages, isHidden = false }: SubtitleRailProps) {
  // Show live subtitle if present; else show last AI message as context
  const lastAiMessage = [...messages].reverse().find((m) => m.sender === 'ai');

  const getDynamicStyle = (text: string) => {
    let fontSize = '16px';
    if (text.length > 150) fontSize = '13px';
    else if (text.length > 80) fontSize = '14px';

    return {
      ...(isHidden ? { filter: 'blur(8px)', opacity: 0.4 } : {}),
      fontSize,
      transition: 'all 0.3s'
    };
  };

  if (liveSubtitle) {
    return (
      <div className={styles.subtitleRail} aria-live="polite" aria-label="Subtitle đang phát">
        <p className={`${styles.subtitleText} ${styles.subtitleLive}`} style={getDynamicStyle(liveSubtitle)}>
          {liveSubtitle}
        </p>
      </div>
    );
  }

  if (lastAiMessage) {
    return (
      <div className={styles.subtitleRail} aria-label="Câu vừa nói">
        <p className={styles.subtitleText} style={getDynamicStyle(lastAiMessage.text)}>
          {lastAiMessage.text}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.subtitleRail} aria-label="Chờ bắt đầu">
      <p className={styles.subtitleEmpty}>Nhấn mic để bắt đầu nói…</p>
    </div>
  );
}
