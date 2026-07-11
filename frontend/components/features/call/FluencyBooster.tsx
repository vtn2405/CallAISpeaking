'use client';

/**
 * FluencyBooster — voice hint chips shown when user has been silent too long.
 *
 * Behavior contract:
 * - Appears with fade-in when silenceSeconds >= threshold (8s)
 * - Clicking a chip HIGHLIGHTS it (visual cue) — does NOT send text to AI
 * - When user starts speaking (onUserSpeaking called), resets silence timer
 *   and the parent unmounts this component (fade-out via CSS class)
 * - Hint words prompt the user's brain to continue speaking naturally
 */

import { useState } from 'react';
import styles from '@/styles/CallFullscreen.module.css';

const FLUENCY_HINTS = [
  { label: 'Where', category: 'question' },
  { label: 'When', category: 'question' },
  { label: 'Who', category: 'question' },
  { label: 'Why', category: 'question' },
  { label: 'How', category: 'question' },
  { label: 'First,', category: 'connector' },
  { label: 'However,', category: 'connector' },
  { label: 'For example,', category: 'connector' },
  { label: 'Because', category: 'connector' },
  { label: 'Also,', category: 'connector' },
];

interface FluencyBoosterProps {
  /** Called when user clicks a hint — hint is highlighted, no text sent */
  onHintClick?: (hint: string) => void;
  hiding?: boolean;
}

export default function FluencyBooster({ onHintClick, hiding }: FluencyBoosterProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const handleClick = (label: string) => {
    setHighlighted(label);
    onHintClick?.(label);
    // Clear highlight after 2.5s so user doesn't fixate on it
    setTimeout(() => setHighlighted((prev) => (prev === label ? null : prev)), 2500);
  };

  return (
    <div className={`${styles.fluencyBooster} ${hiding ? styles.hiding : ''}`}>
      <span className={styles.fluencyLabel}>💡 Tiếp tục bằng…</span>
      <div className={styles.fluencyChips}>
        {FLUENCY_HINTS.map(({ label }) => (
          <button
            key={label}
            type="button"
            className={`${styles.fluencyChip} ${highlighted === label ? styles.highlighted : ''}`}
            onClick={() => handleClick(label)}
            // No aria-label that says "send" — it's a visual hint only
            aria-label={`Gợi ý từ: ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
