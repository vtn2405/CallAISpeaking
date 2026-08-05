'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Play, DotsThree, Trash, YoutubeLogo } from '@phosphor-icons/react';
import { getRecentSessions, deleteSession } from '@/lib/historyRepository';
import { getUserIdentity } from '@/lib/identity';
import type { ArchivedSession } from '@/types/history';

function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function statusLabel(status: ArchivedSession['status']): string | null {
  if (status === 'abandoned') return 'Gián đoạn';
  return null;
}

export default function RecentSessions() {
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [loading, setLoading] = useState(true);

  // States for delete action
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ArchivedSession | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const guestId = await getUserIdentity();
      if (!guestId) {
        setLoading(false);
        return;
      }
      // Fetch up to 5 most recent
      const results = await getRecentSessions(guestId, 5);
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

  if (loading) {
    return (
      <section className="flex flex-col gap-3">
        <div className="h-4 w-32 bg-surface animate-pulse rounded" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-surface animate-pulse rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (sessions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="recent-sessions-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3
          className="text-[11px] font-medium tracking-[0.08em] text-stone uppercase"
          id="recent-sessions-title"
        >
          Trò chuyện gần đây
        </h3>
        <Link
          href="/history"
          className="flex items-center gap-1 text-[12px] text-steel hover:text-charcoal transition-colors"
        >
          <span>Xem tất cả</span>
          <ArrowRight weight="bold" size={11} />
        </Link>
      </div>

      {/* Semantic list */}
      <ul className="flex flex-col">
        {sessions.map((s, i) => {
          const badge = statusLabel(s.status);
          const isDeleting = deletingId === s.id;
          const modeVal = s.mode || 'video_chat';

          return (
            <li
              key={s.id}
              className={`relative group flex items-center gap-3 py-3 hover:bg-surface-soft -mx-2 px-2 rounded-[6px] transition-all duration-300 ${
                i < sessions.length - 1 ? 'border-b border-hairline' : ''
              } ${isDeleting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
            >
              <Link
                href={`/history/${s.id}`}
                className="absolute inset-0 z-0 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={`Mở bản ghi: ${s.title}`}
              />

              {/* Icon / Thumbnail */}
              <div className="relative z-10 flex items-center justify-center w-10 h-7 rounded-[4px] overflow-hidden bg-surface border border-hairline shrink-0 pointer-events-none">
                {s.video_id ? (
                  <img
                    src={`https://img.youtube.com/vi/${s.video_id}/0.jpg`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <YoutubeLogo size={14} weight="fill" className="text-muted" />
                )}
              </div>

              {/* Title + meta */}
              <div className="relative z-10 flex-1 min-w-0 pointer-events-none">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[14px] font-medium text-charcoal truncate group-hover:text-ink transition-colors">
                    {s.title}
                  </p>
                  {badge && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-surface border border-hairline text-muted">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-stone mt-0.5 flex items-center gap-1">
                  <Clock size={10} weight="regular" className="shrink-0" />
                  <span>{formatRelativeTime(s.updated_at)}</span>
                  {s.duration_seconds != null && s.duration_seconds > 0 && (
                    <>
                      <span className="text-muted">·</span>
                      <span>{formatDuration(s.duration_seconds)}</span>
                    </>
                  )}
                  <span className="text-muted">·</span>
                  <span className="text-charcoal font-medium">{modeVal === 'beginner' ? 'Người mới' : 'Tự nhiên'}</span>
                </p>
              </div>

              {/* Action Menu */}
              <div className="relative z-20 flex-shrink-0">
                <button
                  onClick={(e) => toggleMenu(e, s.id)}
                  className="p-1 rounded bg-transparent text-stone hover:text-charcoal opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  aria-label="Tùy chọn"
                >
                  <DotsThree size={20} weight="bold" />
                </button>

                {menuOpenId === s.id && (
                  <div className="absolute top-8 right-0 w-32 bg-white rounded-lg shadow-md border border-hairline overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    <button
                      onClick={(e) => confirmDelete(e, s)}
                      className="w-full text-left px-3 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <Trash size={14} />
                      Xóa
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

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
    </section>
  );
}
