'use client';

import { useCallback, useEffect, useState } from 'react';
import { computeProgressStats } from '@/lib/progress/computeProgressStats';
import type { PracticeSession, ProgressStats } from '@/lib/progress/types';

// ⚠️ ĐỔI 3 hằng số này cho khớp IndexedDB hiện có của bạn
const DB_NAME = 'ai-speaking-coach';
const SESSION_STORE = 'sessions';
const VOCAB_STORE = 'vocabulary';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(store)) return resolve([]);
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as T[]);
    req.onerror = () => resolve([]);
  });
}

/**
 * Đọc IndexedDB -> tính stats.
 *
 * Nếu project đã có sẵn lớp truy cập DB (vd `db.sessions.toArray()` của Dexie),
 * hãy bỏ phần openDB/readAll và gọi trực tiếp hàm của bạn — chỉ cần trả về
 * mảng có `startedAt` (ms) và `durationSec`.
 */
export function useProgressStats() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const db = await openDB();

      // Map dữ liệu thật -> PracticeSession.
      // ⚠️ Đổi tên field cho khớp schema của bạn (vd endedAt - startedAt để ra duration).
      const rawSessions = await readAll<any>(db, SESSION_STORE);
      const sessions: PracticeSession[] = rawSessions
        .map((r) => ({
          id: String(r.id ?? r.sessionId ?? crypto.randomUUID()),
          startedAt: Number(r.startedAt ?? r.createdAt ?? r.timestamp ?? 0),
          durationSec: Number(
            r.durationSec ??
              (r.endedAt && r.startedAt ? Math.round((r.endedAt - r.startedAt) / 1000) : 0),
          ),
          videoTitle: r.videoTitle ?? r.title,
          videoId: r.videoId,
          thumbnailUrl: r.thumbnailUrl,
        }))
        .filter((s) => s.startedAt > 0);

      const vocab = await readAll<any>(db, VOCAB_STORE);

      setStats(
        computeProgressStats(sessions, vocab.length, {
          // Bật true nếu muốn: hôm nay chưa luyện nhưng hôm qua có -> vẫn giữ chuỗi
          // (tránh 0h sáng chuỗi tụt về 0). Mặc định false = giống hành vi hiện tại.
          graceToday: false,
        }),
      );
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** gọi sau khi kết thúc một buổi luyện để cập nhật ngay */
  return { stats, loading, refresh: load };
}
