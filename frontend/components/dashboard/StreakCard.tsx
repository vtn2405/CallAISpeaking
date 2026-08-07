'use client';

import Link from 'next/link';
import { nextMilestone } from '@/lib/progress/computeProgressStats';

type Props = {
  currentStreak: number;
  bestStreak: number;
};

/**
 * Thẻ chuỗi ngày kiểu Habit Tracker:
 * icon lửa trong ô bo tròn -> số ngày cỡ lớn -> badge "dài nhất" -> thanh tiến độ tới mốc kế -> CTA
 */
export default function StreakCard({ currentStreak, bestStreak }: Props) {
  const next = nextMilestone(currentStreak);
  const progress = Math.min(100, Math.round((currentStreak / next) * 100));
  const isBroken = currentStreak === 0;

  return (
    <div className="mt-7 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-[#f9f8f6] to-white p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-[26px] ring-1 ring-amber-200/60">
          🔥
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-[28px] font-bold leading-none text-[#141a24]">
              {currentStreak}
            </span>
            <span className="text-[13px] text-slate-500">ngày liên tiếp</span>
            <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-500">
              Dài nhất <b className="text-[#141a24]">{bestStreak}</b> ngày
            </span>
          </div>

          {/* thanh tiến độ tới mốc tiếp theo */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#5d86bd] to-[#315D9A] transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-[12.5px] text-slate-500">
            {isBroken
              ? 'Luyện 1 buổi hôm nay là bắt đầu chuỗi mới'
              : `Còn ${next - currentStreak} ngày nữa để đạt mốc ${next} ngày`}
          </p>
        </div>
      </div>
    </div>
  );
}
