'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message } from '@/types/call';

function getTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * useTranscript — owns transcript message list, live subtitle state,
 * and word-boundary highlight position for AI TTS sync.
 *
 * Groq Normalization Trust Label:
 *   When onNormalizationResult is called with a code-switched result,
 *   aiUnderstood is set to the normalized_english text so the UI can
 *   display "AI understood: …" before the AI reply arrives.
 *   It is cleared as soon as the AI reply commits (isFinal=True, sender="ai").
 *
 * Word Boundary Highlight:
 *   highlightedWordIndex tracks which word in liveSubtitle/AI reply text
 *   is currently being spoken, driven by wordBoundary events from useAzureTTS.
 *   The UI renders the text with words before the index in full opacity and
 *   words after in gray, advancing as each wordBoundary event fires.
 *
 * This hook has NO knowledge of transport or session state.
 */
export function useTranscript() {
  const [messages, setMessages]       = useState<Message[]>([]);
  const [liveSubtitle, setLiveSubtitle] = useState<string | null>(null);
  const [liveUserSubtitle, setLiveUserSubtitle] = useState<string | null>(null);

  /** Normalized English text from Groq — shown as "AI understood: …" trust label. */
  const [aiUnderstood, setAiUnderstood] = useState<string | null>(null);

  /**
   * Index of the currently-highlighted word in the live AI subtitle.
   * -1 means no word is being highlighted (TTS not active or no subtitle).
   */
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number>(-1);

  /** Full live AI text split into words for highlight rendering. */
  const liveWordsRef = useRef<string[]>([]);

  const appendMessage = useCallback((sender: 'user' | 'ai', text: string, id?: string) => {
    setMessages((prev) => [...prev, { id: id || makeId(), sender, text, time: getTime() }]);
  }, []);

  /**
   * Called by the parent for every transcript.update event.
   */
  const updateLiveSubtitle = useCallback(
    (text: string, isFinal: boolean, sender: 'user' | 'ai', id?: string) => {
      if (isFinal) {
        if (sender === 'ai') {
          setLiveSubtitle(null);
          setHighlightedWordIndex(-1);
          liveWordsRef.current = [];
          setAiUnderstood(null);
        } else {
          setLiveUserSubtitle(null);
        }
        setMessages((prev) => [...prev, { id: id || makeId(), sender, text, time: getTime() }]);
      } else {
        if (sender === 'ai') {
          setLiveSubtitle(text);
          liveWordsRef.current = text.split(/\s+/);
          setHighlightedWordIndex(-1);
        } else {
          setLiveUserSubtitle(text);
        }
      }
    },
    [],
  );

  /**
   * Called by useVoiceClient when Groq normalization completes.
   * Shows the trust label "AI hiểu là: …" only when notes.normalization_applied is true,
   * meaning the backend actually rewrote the text (verbatim ≠ normalized_english).
   * Simple English utterances will NOT trigger the label even if code_switch flag is set.
   */
  const onNormalizationResult = useCallback(
    (result: { normalized_english: string; notes: { contains_code_switch: boolean; normalization_applied: boolean } }) => {
      if (result.notes.normalization_applied && result.normalized_english) {
        setAiUnderstood(result.normalized_english);
      } else {
        setAiUnderstood(null);
      }
    },
    [],
  );

  /**
   * Called by useAzureTTS for each wordBoundary event.
   * Advances the highlighted word index so the subtitle syncs with audio.
   *
   * textOffset is a character offset in the original SSML-free text.
   * We derive the word index by counting how many words start before textOffset.
   */
  const onWordBoundary = useCallback(
    (_audioOffset: number, textOffset: number, _wordLength: number, _word: string) => {
      const words = liveWordsRef.current;
      if (!words.length) return;
      // Find which word index corresponds to this character offset
      let charCount = 0;
      let wordIdx = 0;
      for (let i = 0; i < words.length; i++) {
        if (charCount >= textOffset) { wordIdx = i; break; }
        charCount += words[i].length + 1; // +1 for space
        wordIdx = i + 1;
      }
      setHighlightedWordIndex(Math.min(wordIdx, words.length - 1));
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLiveSubtitle(null);
    setAiUnderstood(null);
    setHighlightedWordIndex(-1);
    liveWordsRef.current = [];
    setMessages([
      {
        id: makeId(),
        sender: 'ai',
        text: 'Lịch sử đã được xóa. Hãy tiếp tục luyện tập! 🎙️',
        time: getTime(),
      },
    ]);
  }, []);

  return {
    messages,
    liveSubtitle,
    liveUserSubtitle,
    aiUnderstood,
    highlightedWordIndex,
    appendMessage,
    updateLiveSubtitle,
    onNormalizationResult,
    onWordBoundary,
    clearMessages,
  };
}
