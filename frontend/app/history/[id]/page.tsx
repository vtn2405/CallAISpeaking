'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, WarningCircle, CheckCircle, ChatCircleDots, Robot, YoutubeLogo } from '@phosphor-icons/react';
import { getDb } from '@/lib/db';
import { getSessionMessages } from '@/lib/historyRepository';
import type { ArchivedSession, ArchivedMessage } from '@/types/history';

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMessageTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TranscriptPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.id === 'string' ? params.id : '';

  const [session, setSession] = useState<ArchivedSession | null>(null);
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(true);

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

        if (!cancelled) {
          setSession(sess || null);
          setMessages(msgs);
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
      <main className="flex flex-col h-screen bg-sand">
        <header className="px-6 py-4 bg-white border-b border-hairline flex items-center">
          <div className="w-8 h-8 rounded-full bg-surface animate-pulse mr-4" />
          <div className="flex flex-col gap-2">
            <div className="w-48 h-4 bg-surface rounded animate-pulse" />
          </div>
        </header>
        <div className="flex-1 p-6 flex justify-center">
          <div className="w-full max-w-3xl flex flex-col gap-8">
            <div className="w-full h-24 bg-surface animate-pulse rounded-2xl" />
            <div className="self-end w-2/3 h-16 bg-surface animate-pulse rounded-2xl" />
            <div className="self-start w-2/3 h-24 bg-surface animate-pulse rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex flex-col h-screen bg-sand items-center justify-center p-6 text-center">
        <WarningCircle size={48} className="text-muted mb-4" />
        <h1 className="text-xl font-bold text-charcoal mb-2">Không tìm thấy cuộc trò chuyện</h1>
        <p className="text-stone mb-6">Cuộc trò chuyện này có thể đã bị xoá hoặc không tồn tại trên thiết bị này.</p>
        <Link href="/history" className="px-6 py-2 bg-primary-600 text-white font-medium rounded-full hover:bg-primary-700 transition-colors">
          Quay lại Lịch sử
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-sand">
      {/* ── Minimal Header ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 px-4 py-3 sm:px-6 bg-white/80 backdrop-blur-md border-b border-hairline flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-surface-soft transition-colors text-stone hover:text-charcoal flex items-center gap-2"
          aria-label="Quay lại"
        >
          <ArrowLeft size={18} weight="bold" />
          <span className="text-[13px] font-medium hidden sm:inline">Quay lại</span>
        </button>
      </header>

      {/* ── Transcript Area ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-12">
          
          {/* ── Horizontal Context Card ─────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row bg-white border border-hairline rounded-2xl p-4 sm:p-5 shadow-sm gap-4 sm:gap-6 items-start sm:items-center">
            {/* Thumbnail */}
            <div className="w-full sm:w-40 aspect-video rounded-lg bg-surface-soft shrink-0 overflow-hidden relative border border-hairline/50">
              {session.video_id ? (
                <img
                  src={`https://img.youtube.com/vi/${session.video_id}/0.jpg`}
                  alt="YouTube Thumbnail"
                  className="w-full h-full object-cover"
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
                      className={`max-w-[90%] sm:max-w-[70%] px-5 py-4 text-[15px] leading-[1.7] shadow-sm ${
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
                      {msg.content}
                    </div>
                    
                    {isLastInGroup && (
                      <span className={`text-[11px] text-muted mt-2 ${isUser ? 'mr-2' : 'ml-2'}`}>
                        {formatMessageTime(msg.created_at)}
                      </span>
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

        </div>
      </div>
    </main>
  );
}
