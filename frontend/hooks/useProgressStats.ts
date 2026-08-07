'use client';

import { useCallback, useEffect, useState } from 'react';
import { computeProgressStats } from '@/lib/progress/computeProgressStats';
import type { PracticeSession, ProgressStats } from '@/lib/progress/types';
import { getAllSessions } from '@/lib/historyRepository';
import { getUserIdentity } from '@/lib/identity';
import { getDb } from '@/lib/db';

export function useProgressStats() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const guestId = await getUserIdentity();
      if (!guestId) {
        setStats(null);
        setLoading(false);
        return;
      }

      const rawSessions = await getAllSessions(guestId);

      const sessions: PracticeSession[] = rawSessions
        .map((r) => ({
          id: r.id,
          startedAt: new Date(r.created_at).getTime(),
          durationSec: Number(
            r.duration_seconds ??
              Math.max(0, Math.round((new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 1000)),
          ),
          videoTitle: r.title,
          videoId: r.video_id,
          thumbnailUrl: r.video_id ? `https://img.youtube.com/vi/${r.video_id}/0.jpg` : undefined,
        }))
        .filter((s) => s.startedAt > 0);

      // Get vocabulary count by counting lookups for each session
      let vocabCount = 0;
      const db = await getDb();
      if (db) {
        const tx = db.transaction('lookups', 'readonly');
        const index = tx.store.index('by_session_id');
        for (const s of sessions) {
          const keys = await index.getAllKeys(s.id);
          vocabCount += keys.length;
        }
      }

      setStats(
        computeProgressStats(sessions, vocabCount, {
          graceToday: false,
        }),
      );
    } catch (err) {
      console.error('Failed to load progress stats:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, refresh: load };
}
