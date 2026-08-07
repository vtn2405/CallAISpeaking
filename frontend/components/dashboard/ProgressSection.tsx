'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProgressStats } from '@/lib/progress/types';
import ActivityChart from './ActivityChart';
import StreakCard from './StreakCard';
import MetricCards from './MetricCards';

type Props = {
  stats: ProgressStats | null;
  /** true khi đang đọc IndexedDB -> hiện skeleton */
  loading?: boolean;
  /** route xem lại buổi học, mặc định trang Lịch sử */
  historyHref?: string;
};

/**
 * Phần "Tiến độ của bạn" — đặt DƯỚI ô dán link YouTube.
 *
 * 3 trạng thái:
 *  1) loading  -> skeleton
 *  2) isEmpty  -> EmptyProgress (khung nét đứt mời gọi, KHÔNG hiện 4 số 0)
 *  3) có data  -> chart + streak + metric cards + buổi gần nhất
 */
export default function ProgressSection({ stats, loading = false, historyHref = '/history' }: Props) {
  const [range, setRange] = useState<7 | 30>(7);

  if (loading) return <ProgressSkeleton />;
  if (!stats || stats.isEmpty) return <EmptyProgress />;

  const series = range === 7 ? stats.last7 : stats.last30;
  const rangeTotal = series.reduce((a, d) => a + d.minutes, 0);

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-[0_2px_12px_rgba(22,41,74,0.06)]">
      {/* ==== header: chips trái · số lớn phải ==== */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Tiến độ của bạn
          </p>
          <div className="mt-2.5 inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  range === r
                    ? 'bg-white text-[#141a24] shadow-sm'
                    : 'text-slate-500 hover:text-[#141a24]'
                }`}
              >
                {r} ngày
              </button>
            ))}
          </div>
        </div>

        <div className="text-right">
          <p className="font-display text-[34px] font-bold leading-none text-[#141a24]">{rangeTotal}</p>
          <p className="mt-1 text-[12px] text-slate-500">
            {range === 7 ? 'phút tuần này' : 'phút 30 ngày qua'}
          </p>
        </div>
      </div>

      <ActivityChart series={series} range={range} />

      <StreakCard currentStreak={stats.currentStreak} bestStreak={stats.bestStreak} />

      <MetricCards
        totalMinutes={stats.totalMinutes}
        totalSessions={stats.totalSessions}
        savedWords={stats.savedWords}
        weekDeltaPercent={stats.weekDeltaPercent}
        hideBadge={range === 30}
      />

      {/* ==== buổi gần nhất — nút "Xem lại" (KHÔNG phải "Tiếp tục": cuộc gọi đã kết thúc không thể tiếp tục) ==== */}
      {stats.lastSession && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-2.5">
          <span className="grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#284b7d] to-[#315D9A] text-white">
            {stats.lastSession.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stats.lastSession.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-[#141a24]">
              {stats.lastSession.videoTitle ?? 'Buổi luyện nói'}
            </p>
            <p className="truncate text-[12.5px] text-slate-500">
              Buổi gần nhất · {formatRelativeDay(stats.lastSession.startedAt)} ·{' '}
              {Math.round(stats.lastSession.durationSec / 60)} phút
            </p>
          </div>
          <Link
            href={historyHref}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-semibold text-[#315D9A] transition hover:bg-[#eff4fa]"
          >
            Xem lại
          </Link>
        </div>
      )}
    </section>
  );
}

// ============================================================
// Trạng thái RỖNG — user chưa có buổi nào
// Nguyên tắc: KHÔNG hiện dãy số 0 (gây cảm giác app trống & mất động lực)
// ============================================================
export function EmptyProgress() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-9 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eff4fa] text-[#315D9A]">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 5-6" />
        </svg>
      </span>
      <p className="mt-3.5 text-[15px] font-semibold text-[#141a24]">
        Hoàn thành buổi đầu tiên để xem tiến độ
      </p>
      <p className="mt-1 text-[13px] text-slate-500">
        Dán một link YouTube phía trên để bắt đầu — chỉ mất khoảng 2 phút.
      </p>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <section className="animate-pulse rounded-3xl border border-slate-200/70 bg-white p-6">
      <div className="flex justify-between">
        <div className="space-y-2.5">
          <div className="h-3 w-28 rounded bg-slate-200" />
          <div className="h-8 w-40 rounded-xl bg-slate-100" />
        </div>
        <div className="h-10 w-16 rounded bg-slate-200" />
      </div>
      <div className="mt-7 flex h-[150px] items-end gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 rounded-[10px] bg-slate-100" style={{ height: `${30 + (i % 3) * 25}%` }} />
        ))}
      </div>
      <div className="mt-7 h-24 rounded-2xl bg-slate-100" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-100" />
        ))}
      </div>
    </section>
  );
}

function formatRelativeDay(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.floor((startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diffDays === 0) return 'hôm nay';
  if (diffDays === 1) return 'hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
