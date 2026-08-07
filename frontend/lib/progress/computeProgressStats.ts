import type { DayPoint, PracticeSession, ProgressStats } from './types';

// ============================================================
// TÍNH TOÁN THỐNG KÊ TIẾN ĐỘ
// Toàn bộ logic thuần (pure) -> dễ unit test, không phụ thuộc React
// ============================================================

/**
 * Khoá ngày theo GIỜ ĐỊA PHƯƠNG (không dùng UTC).
 * Quan trọng: dùng UTC sẽ lệch múi giờ VN (+7) -> buổi luyện lúc 1h sáng
 * bị tính sang ngày hôm trước.
 */
export function localDayKey(input: number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Trả về Date 00:00:00 local của ngày cách hôm nay `offset` ngày (offset âm = quá khứ) */
function startOfDayOffset(now: Date, offset: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}

type DayAgg = { seconds: number; sessions: number };

/** Gom nhóm session theo ngày local */
function aggregateByDay(sessions: PracticeSession[]): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  for (const s of sessions) {
    const key = localDayKey(s.startedAt);
    const cur = map.get(key) ?? { seconds: 0, sessions: 0 };
    cur.seconds += Math.max(0, s.durationSec || 0);
    cur.sessions += 1;
    map.set(key, cur);
  }
  return map;
}

/**
 * Dựng chuỗi `days` ngày gần nhất, phần tử CUỐI = hôm nay.
 * Ngày không có buổi -> minutes = 0 (vẫn có phần tử, để biểu đồ giữ đủ 7/30 cột).
 */
function buildSeries(byDay: Map<string, DayAgg>, days: number, now: Date): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDayOffset(now, -i);
    const key = localDayKey(date);
    const agg = byDay.get(key);
    out.push({
      key,
      date,
      // làm tròn TỔNG giây của ngày (đừng làm tròn từng session rồi cộng -> sai số dồn)
      minutes: agg ? Math.round(agg.seconds / 60) : 0,
      sessions: agg?.sessions ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

/**
 * Chuỗi ngày liên tiếp tính từ hôm nay đi lùi.
 *
 * @param graceToday - nếu true: hôm nay chưa luyện nhưng hôm qua có thì VẪN giữ chuỗi
 *   (tránh việc 0h sáng chuỗi tụt về 0 dù tối qua vừa luyện — nhân văn hơn với người học).
 *   Mặc định false = reset ngay khi hôm nay chưa luyện.
 */
export function computeCurrentStreak(
  byDay: Map<string, DayAgg>,
  now: Date,
  graceToday = false,
): number {
  const has = (offset: number) => (byDay.get(localDayKey(startOfDayOffset(now, offset)))?.seconds ?? 0) > 0;

  let start = 0;
  if (!has(0)) {
    if (!graceToday) return 0;
    if (!has(-1)) return 0;
    start = -1; // bắt đầu đếm từ hôm qua
  }

  let streak = 0;
  for (let i = start; ; i--) {
    if (has(i)) streak++;
    else break;
  }
  return streak;
}

/** Chuỗi dài nhất trong toàn bộ lịch sử */
export function computeBestStreak(byDay: Map<string, DayAgg>): number {
  const keys = [...byDay.entries()]
    .filter(([, v]) => v.seconds > 0)
    .map(([k]) => k)
    .sort();
  if (keys.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1] + 'T00:00:00');
    const cur = new Date(keys[i] + 'T00:00:00');
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    run = diffDays === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Làm tròn trục Y lên mốc "đẹp" để biểu đồ dễ đọc */
export function niceMax(value: number): number {
  const steps = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
  return steps.find((s) => value <= s) ?? Math.ceil(value / 60) * 60;
}

export type ComputeOptions = {
  /** cho phép giữ chuỗi khi hôm nay chưa luyện nhưng hôm qua có */
  graceToday?: boolean;
  /** override thời điểm hiện tại (dùng cho test) */
  now?: Date;
};

/**
 * Hàm chính: nhận toàn bộ session + số từ đã lưu -> trả về mọi số liệu UI cần.
 */
export function computeProgressStats(
  sessions: PracticeSession[],
  savedWords: number,
  options: ComputeOptions = {},
): ProgressStats {
  const now = options.now ?? new Date();
  const byDay = aggregateByDay(sessions);

  const last7 = buildSeries(byDay, 7, now);
  const last30 = buildSeries(byDay, 30, now);

  const totalSeconds = sessions.reduce((sum, s) => sum + Math.max(0, s.durationSec || 0), 0);
  const thisWeekMinutes = last7.reduce((a, d) => a + d.minutes, 0);

  // 7 ngày TRƯỚC tuần này (offset -13..-7)
  let prevWeekSeconds = 0;
  for (let i = 13; i >= 7; i--) {
    prevWeekSeconds += byDay.get(localDayKey(startOfDayOffset(now, -i)))?.seconds ?? 0;
  }
  const prevWeekMinutes = Math.round(prevWeekSeconds / 60);

  const lastSession =
    sessions.length > 0
      ? sessions.reduce((a, b) => (a.startedAt >= b.startedAt ? a : b))
      : null;

  return {
    isEmpty: sessions.length === 0,
    last7,
    last30,
    totalSessions: sessions.length,
    totalMinutes: Math.round(totalSeconds / 60),
    savedWords,
    currentStreak: computeCurrentStreak(byDay, now, options.graceToday ?? false),
    bestStreak: computeBestStreak(byDay),
    thisWeekMinutes,
    prevWeekMinutes,
    weekDeltaPercent:
      prevWeekMinutes > 0
        ? Math.round(((thisWeekMinutes - prevWeekMinutes) / prevWeekMinutes) * 100)
        : null,
    lastSession,
  };
}

/** Mốc chuỗi ngày để hiện thanh tiến độ trong StreakCard */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function nextMilestone(streak: number): number {
  return STREAK_MILESTONES.find((m) => m > streak) ?? streak + 1;
}
