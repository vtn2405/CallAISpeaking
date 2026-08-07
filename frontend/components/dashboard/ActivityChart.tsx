'use client';

import { useMemo, useState } from 'react';
import type { DayPoint } from '@/lib/progress/types';
import { niceMax } from '@/lib/progress/computeProgressStats';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Gradient để nguyên inline style -> không cần sửa tailwind.config
const FILL_NORMAL = 'linear-gradient(180deg,#93b1d8 0%,#3f6ba6 100%)';
const FILL_TODAY = 'linear-gradient(180deg,#5d86bd 0%,#284b7d 100%)';

type Props = {
  series: DayPoint[];
  /** 7 -> hiện nhãn thứ + số phút trên đỉnh cột; 30 -> gọn hơn */
  range: 7 | 30;
};

export default function ActivityChart({ series, range }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null); // tooltip khi tap trên mobile

  const max = useMemo(() => niceMax(Math.max(...series.map((d) => d.minutes), 1)), [series]);

  // trục Y: <=10 phút thì mốc 0/5/10, còn lại 0 / giữa / max
  const ticks = useMemo(
    () => (max <= 10 ? [0, 5, 10].filter((t) => t <= max) : [0, max / 2, max]),
    [max],
  );

  const gap = range === 7 ? 'gap-2' : 'gap-[3px]';

  return (
    <div>
      <div className="mt-7 flex">
        {/* ==== trục Y ==== */}
        <div className="relative mr-2 h-[150px] w-7 shrink-0">
          <span className="absolute -top-5 right-0 text-[10px] font-medium text-slate-400">phút</span>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums text-slate-400"
              style={{ bottom: `${(t / max) * 100}%` }}
            >
              {Math.round(t)}
            </span>
          ))}
        </div>

        {/* ==== vùng vẽ ==== */}
        <div className="relative h-[150px] min-w-0 flex-1">
          {/* đường gióng — z-[5] để đọc được XUYÊN QUA rail (nếu để dưới sẽ bị rail che) */}
          <div className="pointer-events-none absolute inset-0 z-[5]">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-dashed border-slate-500/30"
                style={{ bottom: `${(t / max) * 100}%` }}
              />
            ))}
          </div>

          <div className={`relative flex h-full items-stretch ${gap}`}>
            {series.map((d, i) => {
              const pct = d.minutes === 0 ? 0 : Math.max(6, (d.minutes / max) * 100);
              const label =
                range === 7
                  ? DAY_LABELS[d.date.getDay()]
                  : d.date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

              return (
                <div
                  key={d.key}
                  className="group relative min-w-0 flex-1"
                  tabIndex={0}
                  role="img"
                  aria-label={`${label}: ${d.minutes} phút, ${d.sessions} buổi`}
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                >
                  {/* tooltip pill */}
                  <span
                    className={`pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#141a24] px-2 py-1 text-[11px] font-semibold text-white shadow transition
                      ${openIdx === i ? 'opacity-100' : 'opacity-0 translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 group-focus:opacity-100'}`}
                  >
                    {d.minutes === 0 ? 'Chưa luyện' : `${d.minutes} phút`}
                  </span>

                  {/* rail mờ full chiều cao — cột xanh "lấp đầy" rail */}
                  <div className="relative h-full overflow-hidden rounded-[10px] bg-slate-100/90">
                    {d.minutes > 0 && (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-lg transition-[height] duration-500 ease-out group-hover:brightness-110 motion-reduce:transition-none"
                        style={{ height: `${pct}%`, background: d.isToday ? FILL_TODAY : FILL_NORMAL }}
                      />
                    )}
                  </div>

                  {/* số phút ngay trên đỉnh cột (chỉ ở chế độ 7 ngày cho đỡ rối) */}
                  {range === 7 && d.minutes > 0 && (
                    <span
                      className={`pointer-events-none absolute inset-x-0 text-center text-[10px] font-semibold ${
                        d.isToday ? 'text-[#284b7d]' : 'text-slate-500'
                      }`}
                      style={{ bottom: `calc(${pct}% + 5px)` }}
                    >
                      {d.minutes}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==== nhãn ngày: hôm nay = chữ đậm navy + chấm tròn (KHÔNG dùng ring quanh cột) ==== */}
      <div className="mt-2.5 flex">
        <div className="mr-2 w-7 shrink-0" />
        {range === 7 ? (
          <div className={`flex min-w-0 flex-1 ${gap}`}>
            {series.map((d) => (
              <div key={d.key} className="min-w-0 flex-1 text-center">
                <span
                  className={`text-[11.5px] ${
                    d.isToday ? 'font-bold text-[#284b7d]' : 'text-slate-500'
                  }`}
                >
                  {DAY_LABELS[d.date.getDay()]}
                </span>
                {d.isToday && (
                  <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#315D9A]" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between text-[11px] text-slate-500">
            <span>30 ngày trước</span>
            <span className="font-bold text-[#284b7d]">Hôm nay ●</span>
          </div>
        )}
      </div>
    </div>
  );
}
