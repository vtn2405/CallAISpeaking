// ============================================================
// Kiểu dữ liệu cho phần "Tiến độ của bạn"
// ============================================================

/** Một buổi luyện nói đã lưu trong IndexedDB */
export type PracticeSession = {
  id: string;
  /** timestamp (ms) lúc bắt đầu buổi */
  startedAt: number;
  /** tổng số giây đã nói/hội thoại trong buổi */
  durationSec: number;
  /** thông tin video (dùng cho card "Buổi gần nhất") */
  videoTitle?: string;
  videoId?: string;
  thumbnailUrl?: string;
};

/** Một điểm dữ liệu = 1 ngày trên biểu đồ */
export type DayPoint = {
  /** khoá ngày local: "2026-08-07" */
  key: string;
  date: Date;
  /** số phút đã nói trong ngày (đã làm tròn) */
  minutes: number;
  /** số buổi trong ngày */
  sessions: number;
  isToday: boolean;
};

export type ProgressStats = {
  /** true khi user chưa có buổi nào -> hiện EmptyProgress */
  isEmpty: boolean;

  /** chuỗi 7 ngày gần nhất (phần tử cuối = hôm nay) */
  last7: DayPoint[];
  /** chuỗi 30 ngày gần nhất */
  last30: DayPoint[];

  /** tổng số buổi (toàn bộ lịch sử) */
  totalSessions: number;
  /** tổng số phút (toàn bộ lịch sử) */
  totalMinutes: number;
  /** số từ vựng đã lưu */
  savedWords: number;

  /** chuỗi ngày liên tiếp hiện tại */
  currentStreak: number;
  /** chuỗi ngày dài nhất từng đạt */
  bestStreak: number;

  /** tổng phút 7 ngày này */
  thisWeekMinutes: number;
  /** tổng phút 7 ngày trước đó (để so sánh) */
  prevWeekMinutes: number;
  /** % thay đổi so với tuần trước; null nếu chưa có dữ liệu tuần trước */
  weekDeltaPercent: number | null;

  /** buổi gần nhất (cho card "Xem lại") */
  lastSession: PracticeSession | null;
};
