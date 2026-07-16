'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, Clock, ChatCircleDots, Trash, DotsThree, YoutubeLogo } from '@phosphor-icons/react';
import { getAllSessions, deleteSession } from '@/lib/historyRepository';
import { getOrCreateGuestId } from '@/lib/identity';
import type { ArchivedSession } from '@/types/history';

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

function statusLabel(status: ArchivedSession['status']): string | null {
  if (status === 'abandoned') return 'Bị gián đoạn';
  return null;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [loading, setLoading] = useState(true);

  // States for delete action
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ArchivedSession | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const guestId = getOrCreateGuestId();
      if (!guestId) {
        setLoading(false);
        return;
      }
      const results = await getAllSessions(guestId);
      if (!cancelled) {
        setSessions(results);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      if (menuOpenId) setMenuOpenId(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpenId]);

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  };

  const confirmDelete = (e: React.MouseEvent, session: ArchivedSession) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(null);
    setSessionToDelete(session);
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    setSessionToDelete(null);
    setDeletingId(id);

    try {
      await deleteSession(id);
      // Wait for shrink/fade animation to complete before removing from state
      setTimeout(() => {
        setSessions(prev => prev.filter(s => s.id !== id));
        setDeletingId(null);
      }, 300);
    } catch (err) {
      console.error('Failed to delete session', err);
      setDeletingId(null);
      alert('Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
    }
  };

  return (
    <main className="p-8 lg:p-12 xl:p-16 flex flex-col gap-10 max-w-6xl mx-auto w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Lịch sử trò chuyện
          </h1>
          <p className="text-[15px] text-zinc-500 mt-1">Toàn bộ lịch sử các cuộc gọi gần đây của bạn.</p>
        </div>
        <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-sm shrink-0 w-fit">
          <Plus weight="bold" size={16} />
          <span>Cuộc trò chuyện mới</span>
        </Link>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-surface animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center bg-surface-soft rounded-3xl border border-hairline">
          <ChatCircleDots size={48} className="text-muted" weight="light" />
          <h3 className="text-lg font-medium text-charcoal">Chưa có cuộc trò chuyện nào</h3>
          <p className="text-[14px] text-stone max-w-sm">
            Bạn chưa bắt đầu bất kỳ cuộc gọi nào. Các phiên trò chuyện sẽ được lưu tự động tại đây.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => {
            const badge = statusLabel(s.status);
            const isDeleting = deletingId === s.id;
            const modeVal = s.mode || 'video_chat';

            return (
              <li
                key={s.id}
                className={`relative group bg-white border border-zinc-200/60 rounded-3xl p-5 shadow-[0_8px_30px_rgba(136,135,128,0.08)] hover:shadow-[0_12px_40px_rgba(136,135,128,0.12)] hover:border-zinc-300 transition-all duration-300 ${
                  isDeleting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
                }`}
              >
                <Link
                  href={`/history/${s.id}`}
                  className="absolute inset-0 z-0 rounded-3xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={`Mở bản ghi: ${s.title}`}
                />

                <div className="relative z-10 pointer-events-none flex flex-col h-full">
                  {/* Thumbnail */}
                  <div className="w-full aspect-video rounded-2xl bg-surface-soft mb-4 overflow-hidden relative border border-hairline/50">
                    {s.video_id ? (
                      <img
                        src={`https://img.youtube.com/vi/${s.video_id}/0.jpg`}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-2 bg-gradient-to-br from-zinc-800 to-zinc-900">
                        <YoutubeLogo size={32} weight="fill" className="text-zinc-500" />
                      </div>
                    )}
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    
                    {/* Status Badge */}
                    {badge && (
                      <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm font-semibold text-charcoal shadow-sm">
                        {badge}
                      </span>
                    )}
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-base font-bold text-zinc-900 mb-2 group-hover:text-black transition-colors line-clamp-2 leading-snug" title={s.title}>
                    {s.title}
                  </h2>
                  
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-[13px] font-medium text-zinc-500 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Clock weight="bold" size={16} className="text-zinc-400" />
                      <span>{s.duration_seconds ? formatDuration(s.duration_seconds) : '---'}</span>
                    </div>
                    <div className="ml-auto flex items-center">
                      <span className="px-2 py-0.5 bg-surface-soft border border-hairline rounded text-[11px] uppercase tracking-wider text-charcoal font-semibold">
                        {modeVal === 'beginner' ? 'Người mới' : 'Tự nhiên'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between relative z-20">
                    <a
                      href={s.video_id ? `https://www.youtube.com/watch?v=${s.video_id}` : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { if (!s.video_id) e.preventDefault(); e.stopPropagation(); }}
                      className="text-[12px] font-semibold text-zinc-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
                      aria-label="Xem nguồn video trên YouTube"
                    >
                      <YoutubeLogo size={14} weight="fill" className={s.video_id ? "text-red-500" : "text-muted"} />
                      {s.channel_name || 'YouTube'}
                    </a>
                  </div>
                </div>

                {/* ── Action Menu ────────────────────────────────────────── */}
                <div className="absolute top-7 right-7 z-20">
                  <button
                    onClick={(e) => toggleMenu(e, s.id)}
                    className="p-1.5 rounded-full bg-white/90 backdrop-blur text-stone hover:text-charcoal shadow-sm border border-hairline opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    aria-label="Tùy chọn"
                    aria-haspopup="true"
                    aria-expanded={menuOpenId === s.id}
                  >
                    <DotsThree size={18} weight="bold" />
                  </button>

                  {menuOpenId === s.id && (
                    <div className="absolute top-10 right-0 w-36 bg-white rounded-xl shadow-lg border border-hairline overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                      <button
                        onClick={(e) => confirmDelete(e, s)}
                        className="w-full text-left px-4 py-2.5 text-[13.5px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash size={16} />
                        Xóa
                      </button>
                    </div>
                  )}
                </div>

              </li>
            );
          })}
        </ul>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 mx-4">
            <h2 className="text-lg font-bold text-charcoal mb-2">Xóa lịch sử cuộc gọi?</h2>
            <p className="text-[14px] text-stone leading-relaxed mb-6">
              Bạn có chắc chắn muốn xóa cuộc trò chuyện <strong>"{sessionToDelete.title}"</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                autoFocus
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl text-[14px] font-semibold text-stone bg-surface hover:bg-surface-soft transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-[14px] font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
