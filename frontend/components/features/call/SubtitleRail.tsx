'use client';

/**
 * SubtitleRail — real-time subtitle display with optional word lookup.
 *
 * Modes:
 *   - Lookup disabled (default, video_chat with subtitles off): read-only, no pointer events.
 *   - Lookup enabled (subtitles visible in either mode): each word in committed AI messages
 *     is wrapped in a clickable <span>. Tapping a word calls onWordTap(word, fullSentence).
 *     Words already looked up in this session get a subtle underline.
 *
 * Live subtitle (non-final) is never clickable — only committed messages are tappable.
 *
 * startChar/endChar for inline highlighting are provided externally via the
 * lookedUpTerms map (keyed by message text, value is array of {startChar, endChar}).
 * The parent component manages lookup state; this component is display-only.
 */

import { useRef } from 'react';
import styles from '@/styles/CallFullscreen.module.css';
import type { Message } from '@/types/call';

interface LookupSpan {
  startChar: number;
  endChar: number;
}

interface SubtitleRailProps {
  liveSubtitle: string | null;
  messages: Message[];
  isHidden?: boolean;
  /** Enable word-tap lookup. When true, committed AI messages become clickable. */
  lookupEnabled?: boolean;
  /** Set of terms already looked up this session (lower-cased). Shows underline. */
  lookedUpTerms?: Set<string>;
  /** Called when user taps a word. Parent handles the API call + tooltip. */
  onWordTap?: (word: string, sentence: string, wordIndex: number) => void;
  /** Highlight spans for inline lookup result (keyed by message id). */
  highlightSpans?: Map<string, LookupSpan[]>;
}

/** Split a sentence into word tokens preserving surrounding punctuation as separate tokens. */
function tokenize(text: string): string[] {
  // Split on word boundaries while keeping punctuation attached to words
  return text.split(/(\s+)/);
}

/** Render committed AI text with clickable word spans. */
function ClickableText({
  messageId,
  text,
  lookedUpTerms,
  highlightSpans,
  onWordTap,
}: {
  messageId: string;
  text: string;
  lookedUpTerms: Set<string>;
  highlightSpans: Map<string, LookupSpan[]>;
  onWordTap: (word: string, sentence: string, wordIndex: number) => void;
}) {
  const spans = highlightSpans.get(messageId) ?? [];

  // Build a per-character highlight set from LookupSpans
  // This lets us highlight collocation-wide spans returned by Gemini
  const isHighlighted = (charIdx: number): boolean =>
    spans.some(s => charIdx >= s.startChar && charIdx < s.endChar);

  // Walk character by character to build rendered output.
  // We group consecutive characters with the same highlight status into spans.
  const parts: { text: string; highlighted: boolean; charStart: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const highlighted = isHighlighted(i);
    const start = i;
    while (i < text.length && isHighlighted(i) === highlighted) i++;
    parts.push({ text: text.slice(start, i), highlighted, charStart: start });
  }

  return (
    <>
      {parts.map((part, pi) => {
        if (part.highlighted) {
          return (
            <span key={pi} className={styles.inlineHighlight}>
              {part.text}
            </span>
          );
        }
        // For non-highlighted parts, render word-by-word for tap support
        const tokens = tokenize(part.text);
        let charCursor = part.charStart;
        return (
          <span key={pi}>
            {tokens.map((token, ti) => {
              const tokenStart = charCursor;
              charCursor += token.length;
              const trimmed = token.trim();
              if (!trimmed) return <span key={ti}>{token}</span>;
              const termLower = trimmed.toLowerCase().replace(/[.,!?;:'"()]/g, '');
              const alreadyLooked = termLower.length > 1 && lookedUpTerms.has(termLower);
              return (
                <span
                  key={ti}
                  className={[
                    styles.subtitleWord,
                    alreadyLooked ? styles.subtitleWordLooked : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onWordTap(trimmed, text, tokenStart)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') onWordTap(trimmed, text, tokenStart); }}
                >
                  {token}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

export default function SubtitleRail({
  liveSubtitle,
  messages,
  isHidden = false,
  lookupEnabled = false,
  lookedUpTerms = new Set(),
  onWordTap,
  highlightSpans = new Map(),
}: SubtitleRailProps) {
  const lastAiMessage = [...messages].reverse().find((m) => m.sender === 'ai');

  const getDynamicStyle = (text: string) => {
    let fontSize = '16px';
    if (text.length > 150) fontSize = '13px';
    else if (text.length > 80) fontSize = '14px';

    return {
      ...(isHidden ? { filter: 'blur(8px)', opacity: 0.4 } : {}),
      fontSize,
      transition: 'all 0.3s',
    };
  };

  if (liveSubtitle) {
    return (
      <div className={styles.subtitleRail} aria-live="polite" aria-label="Subtitle đang phát">
        <p
          className={`${styles.subtitleText} ${styles.subtitleLive}`}
          style={getDynamicStyle(liveSubtitle)}
        >
          {liveSubtitle}
        </p>
      </div>
    );
  }

  if (lastAiMessage) {
    return (
      <div
        className={`${styles.subtitleRail} ${lookupEnabled ? styles.subtitleClickable : ''}`}
        aria-label="Câu vừa nói"
      >
        <p className={styles.subtitleText} style={getDynamicStyle(lastAiMessage.text)}>
          {lookupEnabled && onWordTap ? (
            <ClickableText
              messageId={lastAiMessage.id}
              text={lastAiMessage.text}
              lookedUpTerms={lookedUpTerms}
              highlightSpans={highlightSpans}
              onWordTap={onWordTap}
            />
          ) : (
            lastAiMessage.text
          )}
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
