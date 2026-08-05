'use client';

import { useEffect, useRef, useState } from 'react';
import { SpeakerHigh, StopCircle } from '@phosphor-icons/react';
import { Message } from '@/types/call';
import { useAzureTTS } from '@/hooks/useAzureTTS';
import styles from '@/styles/Transcript.module.css';

interface Props {
  messages: Message[];
  isTyping: boolean;
  onClear: () => void;
  prompts: string[];
  onPrompt: (text: string) => void;
  /** In-progress speech text from a non-final transcript.update event */
  liveSubtitle?: string | null;
}


export default function Transcript({ messages, isTyping, onClear, prompts, onPrompt, liveSubtitle }: Props) {

  const scrollRef = useRef<HTMLDivElement>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { speakText, stop, isSpeaking } = useAzureTTS({
    onEnd: (_text, turnId) => {
      setPlayingId((prev) => (prev === turnId ? null : prev));
    },
  });

  // Auto-scroll to bottom when messages or live subtitle change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isTyping, liveSubtitle]);

  const handleReplay = (msg: Message) => {
    if (isSpeaking && playingId === msg.id) {
      stop();
      setPlayingId(null);
    } else {
      speakText(msg.text, 1.0, msg.id);
      setPlayingId(msg.id);
    }
  };


  return (
    <div className={styles.transcriptCol}>
      {/* Header */}
      <div className={styles.transcriptHeader}>
        <h2 className={styles.transcriptTitle}>Hội thoại</h2>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onClear}
          title="Xóa lịch sử"
          aria-label="Xóa lịch sử hội thoại"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className={styles.transcriptScroll} role="log" aria-live="polite" aria-label="Hội thoại">
        <div className={styles.transcriptMessages}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.sender === 'user' ? styles.msgUser : ''}`}
            >
              <div className={`${styles.msgAvatar} ${msg.sender === 'ai' ? styles.aiAvatar : styles.userMsgAvatar}`}>
                {msg.sender === 'ai' ? 'AI' : 'M'}
              </div>
              <div className={`${styles.msgBubble} ${msg.sender === 'ai' ? styles.aiBubble : styles.userBubble}`}>
                <p>{msg.text}</p>
                <div className={styles.msgFooter}>
                  <span className={styles.msgTime}>{msg.time}</span>
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      className={`${styles.replayBtn} ${isSpeaking && playingId === msg.id ? styles.playing : ''}`}
                      onClick={() => handleReplay(msg)}
                      title={isSpeaking && playingId === msg.id ? 'Dừng phát' : 'Nghe lại'}
                    >
                      {isSpeaking && playingId === msg.id ? (
                        <>
                          <StopCircle size={15} weight="fill" />
                          <span>Đang phát</span>
                        </>
                      ) : (
                        <>
                          <SpeakerHigh size={15} weight="bold" />
                          <span>Nghe lại</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live subtitle — non-final in-progress speech */}
      {liveSubtitle && (
        <div className={styles.typingIndicator} aria-live="polite" aria-label="Đang nhận giọng nói">
          <div className={`${styles.msgAvatar} ${styles.userMsgAvatar}`}>M</div>
          <div className={`${styles.msgBubble} ${styles.userBubble}`} style={{ opacity: 0.7, fontStyle: 'italic' }}>
            <p>{liveSubtitle}</p>
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {isTyping && (
        <div className={styles.typingIndicator} aria-label="AI đang gõ" aria-live="polite">
          <div className={`${styles.msgAvatar} ${styles.aiAvatar}`}>AI</div>
          <div className={styles.typingBubble}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        </div>
      )}


      {/* Suggested prompts */}
      <div className={styles.suggestedPrompts}>
        <p className={styles.promptsLabel}>Gợi ý:</p>
        <div className={styles.promptChips}>
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              className={styles.promptChip}
              onClick={() => onPrompt(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
