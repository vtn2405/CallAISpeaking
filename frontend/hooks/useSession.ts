import { useState, useRef, useCallback, useEffect } from 'react';

export type MicState = 'idle' | 'listening' | 'muted';
export type AiState  = 'idle' | 'thinking' | 'speaking';

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

// --- Mock AI responses (replace with real Pipecat/WS integration) ---
const AI_RESPONSES = [
  "That's a great point! In the video, the speaker mentions how small habits can compound over time. What do you think about starting with just 2 minutes a day?",
  "Interesting! The video explains this concept really well. Can you tell me more about your own experience with this topic?",
  "Exactly! The key idea here is consistency. The video talks about how our brain forms neural pathways through repetition. Have you tried any of these techniques yourself?",
  "Good observation! I think what's most fascinating is how this applies to everyday life. What surprised you most in the video?",
  "You're expressing these ideas really clearly! Let's go deeper — what does the speaker say about the role of environment in shaping behavior?",
];

const USER_PHRASES = [
  "I think the main idea of the video is about building good habits gradually.",
  "The speaker mentions that environment plays a huge role in our behavior.",
  "I find it interesting how small changes can lead to big results over time.",
  "Can you tell me more about the 2-minute rule mentioned in the video?",
  "I agree that consistency is more important than intensity when forming habits.",
];

let responseIdx = 0;

function getTime() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * useSession — manages the full call lifecycle:
 *   mic state, AI state, messages, and simulated STT/TTS.
 *
 * Replace the setTimeout simulation with:
 *   - Real VAD via AudioWorklet or @ricky0123/vad-web
 *   - Real STT via Azure Speech SDK (socket events: stt.final)
 *   - Real TTS via Azure Speech SDK (assistant.start / assistant.stop)
 *   - Socket.IO events from the Pipecat backend
 */
export function useSession() {
  const [micState, setMicState] = useState<MicState>('idle');
  const [aiState,  setAiState]  = useState<AiState>('idle');
  const [messages, setMessages]  = useState<Message[]>([
    {
      id: makeId(),
      sender: 'ai',
      text: 'Xin chào! Tôi đã đọc xong nội dung video của bạn. Hãy bắt đầu nói chuyện về chủ đề này nhé. Bạn có thể hỏi bất cứ điều gì liên quan đến video! 🎙️',
      time: getTime(),
    },
  ]);

  // Tracks in-flight simulation so we can abort on unmount
  const abortRef = useRef(false);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const appendMessage = useCallback((sender: 'user' | 'ai', text: string) => {
    setMessages((prev) => [...prev, { id: makeId(), sender, text, time: getTime() }]);
  }, []);

  const simulateAIResponse = useCallback(async () => {
    setAiState('thinking');

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 800));
    if (abortRef.current) return;

    const response = AI_RESPONSES[responseIdx % AI_RESPONSES.length];
    responseIdx++;

    setAiState('speaking');
    appendMessage('ai', response);

    const speakMs = 1200 + response.length * 38;
    await new Promise((r) => setTimeout(r, speakMs));
    if (abortRef.current) return;

    setAiState('idle');
  }, [appendMessage]);

  const toggleMic = useCallback(() => {
    if (micState === 'muted') return;

    if (micState === 'idle') {
      setMicState('listening');

      // Simulate VAD detecting speech end after 3–5s
      const listenMs = 3000 + Math.random() * 2000;
      setTimeout(async () => {
        if (abortRef.current) return;
        setMicState('idle');

        // Simulate STT result
        const phrase = USER_PHRASES[Math.floor(Math.random() * USER_PHRASES.length)];
        appendMessage('user', phrase);

        await simulateAIResponse();
      }, listenMs);
    } else {
      setMicState('idle');
    }
  }, [micState, appendMessage, simulateAIResponse]);

  const toggleMute = useCallback(() => {
    setMicState((prev) => {
      if (prev === 'muted') return 'idle';
      if (prev === 'listening') return 'muted'; // stop listening + mute
      return 'muted';
    });
  }, []);

  const sendPrompt = useCallback((text: string) => {
    if (aiState !== 'idle') return;
    appendMessage('user', text);
    simulateAIResponse();
  }, [aiState, appendMessage, simulateAIResponse]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    appendMessage('ai', 'Lịch sử đã được xóa. Hãy tiếp tục luyện tập! 🎙️');
  }, [appendMessage]);

  return {
    micState,
    aiState,
    messages,
    toggleMic,
    toggleMute,
    sendPrompt,
    clearMessages,
  };
}
