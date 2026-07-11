'use client';

import { useState, useCallback } from 'react';
import type { Message } from '@/types/call';

function getTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * useTranscript — owns transcript message list and live subtitle state.
 *
 * Live subtitle: a non-final transcript.update event updates `liveSubtitle`.
 * When isFinal is true, the text is promoted to a permanent Message and
 * liveSubtitle is cleared.
 *
 * This hook has NO knowledge of transport or session state.
 */
export function useTranscript() {
  // Start with an empty transcript — the AI greeting arrives via the transport
  // event chain (MockTransport fires ai.thinking → ai.speaking → transcript.update)
  // so we never hardcode a static opening message here.
  const [messages, setMessages] = useState<Message[]>([]);

  /** In-progress speech text shown as a live subtitle (not yet committed). */
  const [liveSubtitle, setLiveSubtitle] = useState<string | null>(null);

  const appendMessage = useCallback((sender: 'user' | 'ai', text: string) => {
    setMessages((prev) => [...prev, { id: makeId(), sender, text, time: getTime() }]);
  }, []);

  /**
   * Called by useVoiceClient for every transcript.update event.
   *
   * - isFinal = false → update the live subtitle overlay
   * - isFinal = true  → commit to messages, clear live subtitle
   */
  const updateLiveSubtitle = useCallback(
    (text: string, isFinal: boolean, sender: 'user' | 'ai') => {
      if (isFinal) {
        setLiveSubtitle(null);
        setMessages((prev) => [...prev, { id: makeId(), sender, text, time: getTime() }]);
      } else {
        setLiveSubtitle(text);
      }
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLiveSubtitle(null);
    // Re-add greeting so the transcript panel is never empty
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
    appendMessage,
    updateLiveSubtitle,
    clearMessages,
  };
}
