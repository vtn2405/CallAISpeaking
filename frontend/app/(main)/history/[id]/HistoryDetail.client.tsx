'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Clock, WarningCircle, CheckCircle, ChatCircleDots, Robot, YoutubeLogo, SpeakerHigh, StopCircle } from '@phosphor-icons/react';
import { getDb } from '@/lib/db';
import { getSessionMessages, getLookupsBySession } from '@/lib/historyRepository';
import { useAzureTTS } from '@/hooks/useAzureTTS';
import { formatDuration, formatDate, formatMessageTime } from '@/lib/formatUtils';
import type { ArchivedSession, ArchivedMessage, ArchivedLookupEvent } from '@/types/history';

function HighlightedMessageText({ text, messageLookups }: { text: string, messageLookups: ArchivedLookupEvent[] }) {
  const [activePopover, setActivePopover] = useState<string | null>(null);

  if (!messageLookups || messageLookups.length === 0) {
    return <>{text}</>;
  }

  // Deduplicate and sort spans
  const spans = new Map<string, ArchivedLookupEvent>();
  for (const lk of messageLookups) {
    if (lk.start_char != null && lk.end_char != null) {
      spans.set(`${lk.start_char}-${lk.end_char}`, lk);
    }
  }
  const sortedSpans = Array.from(spans.values()).sort((a, b) => a.start_char! - b.start_char!);

  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  sortedSpans.forEach((lk, i) => {
    if (lk.start_char! >= currentIndex) {
      // Add text before the span
      elements.push(<span key={`text-${i}`}>{text.slice(currentIndex, lk.start_char!)}</span>);
      // Add the highlighted span
      const id = `lookup-${lk.start_char}-${lk.end_char}`;
      elements.push(
        <span key={`hl-${i}`} className="relative inline-block">
          <span 
            className="border-b-[1.5px] border-dotted border-blue-400 bg-blue-50/50 cursor-pointer text-charcoal hover:bg-blue-100 transition-colors"
            onClick={(e) => { e.stopPropagation(); setActivePopover(activePopover === id ? null : id); }}
          >
            {text.slice(lk.start_char!, lk.end_char!)}
          </span>
          {activePopover === id && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[240px] bg-charcoal text-white text-[13px] p-3 rounded-lg shadow-lg z-50 animate-in fade-in zoom-in-95">
              <div className="font-bold text-blue-300 mb-1 flex items-center justify-between gap-2">
                {lk.term}
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/20 uppercase tracking-wider">{lk.type === 'COLLOCATION' ? 'Cụm từ' : 'Từ'}</span>
              </div>
              <div className="leading-snug text-white/90">{lk.meaning_vi}</div>
              {lk.collocation_note && <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px] text-white/60 italic leading-snug">{lk.collocation_note}</div>}
              {/* Triangle pointer */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-charcoal" />
            </div>
          )}
        </span>
      );
      currentIndex = lk.end_char!;
    }
  });

  // Add remaining text
  if (currentIndex < text.length) {
    elements.push(<span key="text-end">{text.slice(currentIndex)}</span>);
  }

  // Click outside to close
  useEffect(() => {
    if (!activePopover) return;
    const clickHandler = () => setActivePopover(null);
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, [activePopover]);

  return <>{elements}</>;
}

export default function HistoryDetailClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [session, setSession] = useState<ArchivedSession | null>(null);
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [lookups, setLookups] = useState<ArchivedLookupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVocabExpanded, setIsVocabExpanded] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { speakText, stop, isSpeaking } = useAzureTTS({
    onEnd: (_text, turnId) => {
      setPlayingId((prev) => (prev === turnId ? null : prev));
    },
  });

  const handleReplay = (id: string, text: string) => {
    if (isSpeaking && playingId === id) {
      stop();
      setPlayingId(null);
    } else {
      speakText(text, 1.0, id);
      setPlayingId(id);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      try {
        const db = await getDb();
        if (!db) {
          setLoading(false);
          return;
        }

        const sess = await db.get('sessions', sessionId);
        const msgs = await getSessionMessages(sessionId);
        const lks = await getLookupsBySession(sessionId);

        if (!cancelled) {
          setSession(sess || null);
          setMessages(msgs);
          setLookups(lks);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-3xl flex flex-col gap-8">
          <div className="w-full h-24 bg-surface animate-pulse rounded-2xl" />
          <div className="self-end w-2/3 h-16 bg-surface animate-pulse rounded-2xl" />
          <div className="self-start w-2/3 h-24 bg-surface animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <WarningCircle size={48} className="text-muted mb-4" />
        <h2 className="text-xl font-bold text-charcoal mb-2">Không tìm thấy cuộc trò chuyện</h2>
        <p className="text-stone mb-6">Cuộc trò chuyện này có thể đã bị xoá hoặc không tồn tại trên thiết bị này.</p>
        <button onClick={() => router.push('/history')} className="px-6 py-2 bg-primary-600 text-white font-medium rounded-full hover:bg-primary-700 transition-colors">
          Quay lại Lịch sử
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-12">
        
        {/* ── Horizontal Context Card ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row bg-white border border-hairline rounded-2xl p-4 sm:p-5 shadow-sm gap-4 sm:gap-6 items-start sm:items-center">
          {/* Thumbnail */}
          <div className="w-full sm:w-40 aspect-video rounded-lg bg-surface-soft shrink-0 overflow-hidden relative border border-hairline/50">
            {session.video_id ? (
              <Image
                src={`https://img.youtube.com/vi/${session.video_id}/0.jpg`}
                alt="YouTube Thumbnail"
                fill
                sizes="(max-width: 640px) 100vw, 160px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <YoutubeLogo size={28} weight="fill" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 min-w-0 flex flex-col gap-2 w-full">
            <h1 className="text-base sm:text-lg font-bold text-charcoal line-clamp-2 leading-tight" title={session.title}>
              {session.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-stone">
              <a
                href={session.video_id ? `https://www.youtube.com/watch?v=${session.video_id}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-medium text-charcoal hover:text-red-600 transition-colors"
              >
                <YoutubeLogo size={16} className={session.video_id ? "text-red-500" : "text-muted"} weight="fill" />
                {session.channel_name || 'YouTube'}
              </a>
              
              {session.duration_seconds ? (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {formatDuration(session.duration_seconds)}
                </span>
              ) : null}

              <span className="text-muted">•</span>
              <span>{formatDate(session.created_at)}</span>

              {session.status === 'abandoned' ? (
                <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase tracking-wide">
                  Gián đoạn
                </span>
              ) : session.status === 'completed' ? (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle size={12} weight="fill" />
                  Hoàn thành
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <hr className="border-hairline" />

        {/* ── Chat Messages ──────────────────────────────────────────────── */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <ChatCircleDots size={48} className="mb-4" weight="light" />
            <p>Không có tin nhắn nào được lưu trong phiên này.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              
              // Grouping logic
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role;
              const isLastInGroup = !nextMsg || nextMsg.role !== msg.role;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${
                    !isFirstInGroup ? 'mt-[-1.5rem]' : ''
                  }`}
                >
                  {/* User Label / Avatar */}
                  {isFirstInGroup && (
                    <div className={`flex items-center gap-2 mb-2 ${isUser ? 'flex-row-reverse mr-1' : 'ml-1'}`}>
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                          <Robot size={14} weight="fill" />
                        </div>
                      )}
                      <span className="text-[12px] font-semibold text-stone">
                        {isUser ? 'Bạn' : 'AI Coach'}
                      </span>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[90%] sm:max-w-[70%] px-5 py-4 text-[15px] leading-[1.7] shadow-sm break-words ${
                      isUser
                        ? 'bg-emerald-50/80 text-emerald-950 rounded-2xl rounded-tr-none border border-emerald-100/50'
                        : 'bg-white text-charcoal border border-hairline rounded-2xl rounded-tl-none'
                    } ${
                      !isFirstInGroup && isUser ? 'rounded-tr-2xl' : ''
                    } ${
                      !isFirstInGroup && !isUser ? 'rounded-tl-2xl' : ''
                    } ${
                      !isLastInGroup && isUser ? 'rounded-br-md' : ''
                    } ${
                      !isLastInGroup && !isUser ? 'rounded-bl-md' : ''
                    }`}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <HighlightedMessageText 
                        text={msg.content} 
                        messageLookups={lookups.filter(l => l.message_id === msg.id)} 
                      />
                    )}
                  </div>
                  
                  {isLastInGroup && (
                    <div className={`flex items-center gap-2 mt-2 ${isUser ? 'mr-2' : 'ml-2'}`}>
                      <span className="text-[11px] text-muted">
                        {formatMessageTime(msg.created_at)}
                      </span>
                      {!isUser && (
                        <button
                          onClick={() => handleReplay(msg.id, msg.content)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all shadow-sm ml-2 ${
                            isSpeaking && playingId === msg.id 
                              ? 'bg-primary-50 border-primary-200 text-primary-700' 
                              : 'bg-white border-hairline text-stone hover:text-charcoal hover:bg-surface-soft hover:border-stone/30'
                          }`}
                          title={isSpeaking && playingId === msg.id ? 'Dừng phát' : 'Nghe lại'}
                        >
                          {isSpeaking && playingId === msg.id ? (
                            <>
                              <StopCircle size={15} weight="fill" className="animate-pulse" />
                              <span className="text-[11px] font-semibold tracking-wide">Đang phát</span>
                            </>
                          ) : (
                            <>
                              <SpeakerHigh size={15} weight="bold" />
                              <span className="text-[11px] font-medium">Nghe lại</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* End of transcript marker */}
        {messages.length > 0 && (
          <div className="flex justify-center mt-12 mb-8">
            <div className="px-5 py-2 rounded-full bg-surface-soft border border-hairline text-[11px] font-medium text-stone uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} className="text-muted" />
              Kết thúc transcript
            </div>
          </div>
        )}

        {/* ── Vocabulary Card ────────────────────────────────────────────── */}
        {lookups.length > 0 && (() => {
          const groups = new Map<string, ArchivedLookupEvent & { count: number }>();
          for (const lk of lookups) {
            const key = lk.term.toLowerCase();
            if (groups.has(key)) {
              groups.get(key)!.count++;
            } else {
              groups.set(key, { ...lk, count: 1 });
            }
          }
          const groupedLookups = Array.from(groups.values());

          return (
            <div className="bg-white border border-hairline rounded-2xl shadow-sm overflow-hidden mb-8">
              <button 
                onClick={() => setIsVocabExpanded(!isVocabExpanded)}
                className="w-full px-6 py-4 border-b border-hairline bg-surface-soft flex justify-between items-center hover:bg-surface-soft/80 transition-colors"
              >
                <h2 className="text-[14px] font-bold text-charcoal flex items-center gap-2">
                  <span className="text-[16px]">📓</span> Từ vựng trong buổi này
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full">
                    {groupedLookups.length} từ
                  </span>
                  <span className={`text-stone transition-transform duration-200 ${isVocabExpanded ? 'rotate-180' : ''}`}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </button>
              
              {isVocabExpanded && (
                <div className="flex flex-col animate-in slide-in-from-top-2 fade-in duration-200">
                  {groupedLookups.map((lk, i) => (
                    <div key={i} className="px-6 py-5 border-b border-hairline last:border-b-0 hover:bg-surface-soft/50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[16px] font-bold text-blue-600">{lk.term}</span>
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-100">
                            {lk.type === 'COLLOCATION' ? 'Cụm từ' : 'Từ'}
                          </span>
                        </div>
                        {lk.count > 1 && (
                          <span className="text-[12px] text-stone font-medium" title="Số lần tra trong buổi học">
                            {lk.count} lần tra
                          </span>
                        )}
                      </div>
                      <div className="text-[15px] font-medium text-charcoal mb-2">
                        {lk.meaning_vi}
                      </div>
                      {lk.collocation_note && (
                        <div className="text-[13px] text-stone italic border-l-2 border-surface pl-3 mb-3">
                          {lk.collocation_note}
                        </div>
                      )}
                      <div className="text-[14px] text-stone mt-3 pt-3 border-t border-hairline border-dashed">
                        <span className="opacity-50">"</span>{lk.original_sentence}<span className="opacity-50">"</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
