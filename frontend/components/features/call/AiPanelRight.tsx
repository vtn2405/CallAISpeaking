'use client';

/**
 * AiPanelRight — the right half of the voice-first call UI.
 *
 * Beginner mode additions (v2):
 *   - Two helper buttons rendered below the AI avatar, above the subtitle rail:
 *       💡 "Tôi nên nói gì?"  → fetches hints (lazy, one Gemini call per AI turn)
 *       ❓ "Câu đó nghĩa là gì?" → reads from the SAME cached hint result
 *   - Hints panel slides up from the bottom when either button is tapped.
 *   - Word lookup tooltip appears when user taps a word in SubtitleRail.
 *   - Subtitle lookup is available in BOTH modes when subtitles are visible
 *     (hints buttons are Beginner only).
 *
 * Pull-based design (no auto-trigger):
 *   - Buttons are always visible in Beginner mode. User taps when stuck.
 *   - Hints are fetched on first tap, cached for the entire AI turn.
 *   - Cache is invalidated when a new AI message arrives (lastAiMessageId changes).
 */

import { useState, useCallback, useEffect } from 'react';
import styles from '@/styles/CallFullscreen.module.css';
import SubtitleRail from './SubtitleRail';
import type { CallSessionState, Message, LookupResult } from '@/types/call';
import { fetchWordLookup } from '@/lib/sessionApi';
import { appendLookupEvent } from '@/lib/historyRepository';

interface AiPanelRightProps {
  mode?: 'video_chat' | 'beginner';
  sessionState: CallSessionState;
  messages: Message[];
  liveSubtitle: string | null;
  speedRate?: number;
  onSpeedToggle?: () => void;
  isSubtitleHidden?: boolean;
  onSubtitleToggle?: () => void;
  /** Session ID — needed for lookup API calls. */
  sessionId?: string | null;
  /** IDB session ID — needed for persisting LookupEvent to IndexedDB. */
  idbSessionId?: string | null;
  activeOverlay?: 'hints' | 'lookup' | 'vocab' | null;
  setActiveOverlay?: (overlay: 'hints' | 'lookup' | 'vocab' | null) => void;
}

const STATUS_MAP: Record<CallSessionState, { label: string; dotClass: string }> = {
  initializing:       { label: 'Đang kết nối…',   dotClass: '' },
  countdown:          { label: 'Chuẩn bị bắt đầu', dotClass: '' },
  idle:               { label: 'Sẵn sàng',         dotClass: styles.ready },
  listening:          { label: 'Đang lắng nghe',   dotClass: styles.listening },
  recording:          { label: 'Đang ghi âm',      dotClass: styles.listening },
  turn_candidate_end: { label: 'Đang lắng nghe',   dotClass: styles.listening },
  speech_processing:  { label: 'Đang xử lý',       dotClass: styles.processing },
  thinking:           { label: 'AI đang nghĩ',     dotClass: styles.processing },
  speaking:           { label: 'AI đang nói',      dotClass: styles.speaking },
  ended:              { label: 'Đã kết thúc',      dotClass: '' },
};

export default function AiPanelRight({
  mode,
  sessionState,
  messages,
  liveSubtitle,
  speedRate = 1.0,
  onSpeedToggle,
  isSubtitleHidden = false,
  onSubtitleToggle,
  sessionId,
  idbSessionId,
  activeOverlay,
  setActiveOverlay,
}: AiPanelRightProps) {
  const { label, dotClass } = STATUS_MAP[sessionState] ?? STATUS_MAP.idle;

  const hasUserInteracted = messages.some(m => m.sender === 'user');
  const displayLabel = (sessionState === 'idle' && hasUserInteracted)
    ? 'Đang trò chuyện'
    : label;

  const avatarClass = [
    styles.aiAvatarWrapper,
    sessionState === 'speaking' ? styles.speaking : '',
    sessionState === 'thinking' || sessionState === 'speech_processing' ? styles.thinking : '',
    sessionState === 'listening' || sessionState === 'recording' || sessionState === 'turn_candidate_end' ? styles.listening : '',
    sessionState === 'idle' ? styles.idle : '',
  ].filter(Boolean).join(' ');

  // Cache keyed by the last AI message id
  const lastAiMessage = [...messages].reverse().find(m => m.sender === 'ai');

  // ── Word lookup state ─────────────────────────────────────────────────────────
  const [lookupTooltip, setLookupTooltip] = useState<{
    result: LookupResult;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpTerms, setLookedUpTerms] = useState<Set<string>>(new Set());
  const [highlightSpans, setHighlightSpans] = useState<Map<string, { startChar: number; endChar: number }[]>>(new Map());

  // Sync lookup overlay with activeOverlay
  useEffect(() => {
    if (activeOverlay !== 'lookup') {
      setLookupTooltip(null);
    }
  }, [activeOverlay]);

  const handleWordTap = useCallback(async (
    word: string,
    sentence: string,
    _charOffset: number,
  ) => {
    if (!sessionId || !lastAiMessage) return;
    setLookupLoading(true);
    setLookupTooltip(null);
    setActiveOverlay?.('lookup');

    try {
      const result = await fetchWordLookup(
        sessionId,
        lastAiMessage.id,
        word,
        sentence,
      );

      setLookupTooltip({ result, anchorX: 0, anchorY: 0 }); // position handled by CSS

      // Mark term as looked up (for underline indicator)
      setLookedUpTerms(prev => new Set([...prev, result.term.toLowerCase()]));

      // Update inline highlight spans for this message
      if (result.startChar !== null && result.endChar !== null) {
        setHighlightSpans(prev => {
          const next = new Map(prev);
          const existing = next.get(lastAiMessage.id) ?? [];
          next.set(lastAiMessage.id, [
            ...existing,
            { startChar: result.startChar!, endChar: result.endChar! },
          ]);
          return next;
        });
      }

      // Persist to IndexedDB (fire and forget)
      if (idbSessionId) {
        appendLookupEvent(idbSessionId, {
          message_id: lastAiMessage.id,
          term: result.term,
          type: result.type,
          meaning_vi: result.meaning_vi,
          collocation_note: result.collocation_note,
          original_sentence: sentence,
          start_char: result.startChar,
          end_char: result.endChar,
        }).catch(err => console.warn('[AiPanelRight] appendLookupEvent failed:', err));
      }
    } catch (err) {
      console.warn('[AiPanelRight] fetchWordLookup failed:', err);
      // Fallback is handled by backend, but if fetch throws:
      setActiveOverlay?.(null);
    } finally {
      setLookupLoading(false);
    }
  }, [sessionId, lastAiMessage, setActiveOverlay, idbSessionId]);

  const handleForceLlmLookup = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sessionId || !lastAiMessage || !lookupTooltip) return;
    
    setLookupLoading(true);
    try {
      const result = await fetchWordLookup(
        sessionId,
        lastAiMessage.id,
        lookupTooltip.result.term, // use the term from the previous lookup
        lastAiMessage.text,
        true // forceLlm
      );

      setLookupTooltip({ result, anchorX: 0, anchorY: 0 });
      
      // Update inline highlight spans for this message if changed
      if (result.startChar !== null && result.endChar !== null) {
        setHighlightSpans(prev => {
          const next = new Map(prev);
          const existing = next.get(lastAiMessage.id) ?? [];
          next.set(lastAiMessage.id, [
            ...existing.filter(span => span.startChar !== result.startChar), // replace if overlap? simple append for now is fine since it's same word
            { startChar: result.startChar!, endChar: result.endChar! },
          ]);
          return next;
        });
      }
    } catch (err) {
      console.warn('[AiPanelRight] forceLlm lookup failed:', err);
    } finally {
      setLookupLoading(false);
    }
  }, [sessionId, lastAiMessage, lookupTooltip]);

  // Lookup is available whenever subtitles are visible (both modes)
  const subtitlesVisible = !isSubtitleHidden;
  const lookupEnabled = subtitlesVisible && !!sessionId;

  return (
    /* Pure flex column — NO absolute positioning for layout items */
    <div className={`${styles.rightPanel} flex flex-col items-center gap-5 w-full`}>

      {/* ── Controls row — sibling ABOVE orb in normal flow ── */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {mode === 'beginner' && (
          <button
            onClick={onSpeedToggle}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, cursor: 'pointer',
              fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            {speedRate === 1.0 ? '1.0x' : '0.8x'}
          </button>
        )}
        <button
          onClick={onSubtitleToggle}
          style={{
            padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
            background: isSubtitleHidden ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)',
            color: isSubtitleHidden ? 'rgba(255,255,255,0.5)' : 'white',
            fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          {isSubtitleHidden ? 'Phụ đề: Tắt' : 'Phụ đề: Bật'}
        </button>
      </div>

      {/* ── AI Orb — flex-shrink-0 keeps it fixed size always ── */}
      <div className={avatarClass} style={{ flexShrink: 0 }}>
        <div className={styles.aiAvatar} role="img" aria-label="AI Speaking Coach" />
      </div>

      {/* ── Connection status ── */}
      <div
        className={styles.connectionStatus}
        aria-live="polite"
        aria-atomic="true"
        data-testid={`ai-status-${sessionState}`}
        style={{ flexShrink: 0 }}
      >
        <span className={`${styles.statusDot} ${dotClass}`} aria-hidden="true" />
        {displayLabel}
      </div>

      {/* ── Subtitle rail ── */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
        <SubtitleRail
          messages={messages}
          liveSubtitle={liveSubtitle}
          isHidden={isSubtitleHidden}
          lookupEnabled={lookupEnabled}
          lookedUpTerms={lookedUpTerms}
          onWordTap={handleWordTap}
          highlightSpans={highlightSpans}
        />

        {/* Lookup tooltip */}
        {lookupLoading && activeOverlay === 'lookup' && (
          <div className={styles.lookupTooltip}>
            <div className={styles.lookupTooltipLoading}>
              <span className={styles.lookupSpinner} />
              Đang tra nghĩa…
            </div>
          </div>
        )}
        {lookupTooltip && !lookupLoading && activeOverlay === 'lookup' && (
          <div
            className={styles.lookupTooltip}
            onClick={() => {
              setLookupTooltip(null);
              setActiveOverlay?.(null);
            }}
            role="dialog"
            aria-label={`Nghĩa của ${lookupTooltip.result.term}`}
          >
            <div className={styles.lookupTooltipTerm}>{lookupTooltip.result.term}</div>
            <div className={styles.lookupTooltipBadge}>
              {lookupTooltip.result.type === 'COLLOCATION' ? 'Cụm từ' : 'Từ'}
            </div>
            <div className={styles.lookupTooltipMeaning}>{lookupTooltip.result.meaning_vi}</div>
            {lookupTooltip.result.collocation_note && (
              <div className={styles.lookupTooltipCollocation}>
                {lookupTooltip.result.collocation_note}
              </div>
            )}
            {lookupTooltip.result.is_offline && (
              <button
                className={styles.forceLlmBtn}
                onClick={handleForceLlmLookup}
              >
                ✨ Dịch theo ngữ cảnh
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
