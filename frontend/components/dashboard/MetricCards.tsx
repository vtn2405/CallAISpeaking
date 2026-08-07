'use client';

type Props = {
  totalMinutes: number;
  totalSessions: number;
  savedWords: number;
  /** % so với tuần trước; null = chưa có dữ liệu tuần trước */
  weekDeltaPercent: number | null;
  /** Ẩn badge tăng trưởng (dùng khi xem 30 ngày) */
  hideBadge?: boolean;
};

const ClockIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const MicIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
  </svg>
);
const BookmarkIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </svg>
);

/**
 * 3 Metric Cards, cấu trúc mỗi card: icon trong ô tròn -> số lớn bold -> nhãn xám nhỏ.
 * Card đầu là HERO METRIC (nền gradient + badge) để tạo phân cấp thị giác.
 */
export default function MetricCards({ totalMinutes, totalSessions, savedWords, weekDeltaPercent, hideBadge }: Props) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* ===== HERO: Phút đã nói ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-[#bacfe8]/70 bg-gradient-to-br from-[#eff4fa] via-white to-white p-4 flex flex-col justify-between">
        <div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#dce7f4] text-[#315D9A]">
            <ClockIcon />
          </span>
          <p className="mt-3 font-display text-[30px] font-bold leading-none text-[#141a24]">{totalMinutes}</p>
          <p className="mt-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Phút đã nói</p>
        </div>
        
        {!hideBadge && (
          <div className="mt-4 border-t border-slate-200 pt-3">
            {weekDeltaPercent === null ? (
              <span className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5">
                🌱 Mới bắt đầu
              </span>
            ) : (
              <span className={`text-[12px] font-medium flex items-center gap-1.5 ${weekDeltaPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {weekDeltaPercent >= 0 ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                )}
                {Math.abs(weekDeltaPercent)}% so với tuần trước
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== Buổi đã luyện ===== */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500">
          <MicIcon />
        </span>
        <p className="mt-3 font-display text-[26px] font-bold leading-none text-[#141a24]">{totalSessions}</p>
        <p className="mt-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Buổi đã luyện</p>
      </div>

      {/* ===== Từ đã lưu — có empty state riêng ===== */}
      {savedWords === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-4 text-center">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-slate-300 text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <p className="mt-2.5 text-[12.5px] font-semibold leading-snug text-slate-500">Chưa lưu từ nào</p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">Chạm vào từ lạ khi gọi để lưu</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500">
            <BookmarkIcon />
          </span>
          <p className="mt-3 font-display text-[26px] font-bold leading-none text-[#141a24]">{savedWords}</p>
          <p className="mt-1.5 text-[11.5px] uppercase tracking-wide text-slate-500">Từ đã lưu</p>
        </div>
      )}
    </div>
  );
}
