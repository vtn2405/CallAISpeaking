import { useRef, useCallback, useEffect } from 'react';

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

interface MockAIProps {
  onAiThinking: () => void;
  onAiSpeaking: (text: string) => void;
  onAiIdle: () => void;
  onUserSpeak: (text: string) => void;
}

export function useMockAI({ onAiThinking, onAiSpeaking, onAiIdle, onUserSpeak }: MockAIProps) {
  const abortRef = useRef(false);

  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

  const simulateAIResponse = useCallback(async () => {
    onAiThinking();

    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 800));
    if (abortRef.current) return;

    const response = AI_RESPONSES[responseIdx % AI_RESPONSES.length];
    responseIdx++;

    onAiSpeaking(response);

    const speakMs = 1200 + response.length * 38;
    await new Promise((r) => setTimeout(r, speakMs));
    if (abortRef.current) return;

    onAiIdle();
  }, [onAiThinking, onAiSpeaking, onAiIdle]);

  const simulateUserSpeaking = useCallback(async () => {
    const listenMs = 3000 + Math.random() * 2000;
    setTimeout(async () => {
      if (abortRef.current) return;
      const phrase = USER_PHRASES[Math.floor(Math.random() * USER_PHRASES.length)];
      onUserSpeak(phrase);
      await simulateAIResponse();
    }, listenMs);
  }, [onUserSpeak, simulateAIResponse]);

  const simulatePrompt = useCallback(async (text: string) => {
    onUserSpeak(text);
    await simulateAIResponse();
  }, [onUserSpeak, simulateAIResponse]);

  return {
    simulateUserSpeaking,
    simulatePrompt
  };
}
