'use client';

import { useState, useEffect } from 'react';
import { getAllSessions, getLookupsBySession } from '@/lib/historyRepository';
import { useAuth } from '@/components/auth/AuthProvider';
import { getGuestId } from '@/lib/identity';
import { Fire, Clock, BookmarkSimple, MicrophoneStage } from '@phosphor-icons/react';

export default function DashboardStats() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState({
    sessionsCount: 0,
    wordsSaved: 0,
    minutesSpoken: 0,
    streakDays: 0,
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    async function loadStats() {
      const targetId = user?.id || getGuestId();
      if (!targetId) return;

      try {
        const sessions = await getAllSessions(targetId);
        
        // 1. Buổi đã luyện (Completed sessions)
        const completedSessions = sessions.filter(s => s.status === 'completed');
        const sessionsCount = completedSessions.length;

        // 2. Phút đã nói
        const totalSeconds = completedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
        const minutesSpoken = Math.round(totalSeconds / 60);

        // 3. Từ đã lưu (Unique terms across all sessions)
        const allLookupsNested = await Promise.all(sessions.map(s => getLookupsBySession(s.id)));
        const allLookups = allLookupsNested.flat();
        const uniqueWords = new Set(allLookups.map(l => l.term.toLowerCase()));
        const wordsSaved = uniqueWords.size;

        // 4. Chuỗi ngày (Streak based on created_at)
        // Group sessions by local date string (YYYY-MM-DD)
        const dates = sessions.map(s => new Date(s.created_at).toLocaleDateString('en-CA'));
        const uniqueDates = [...new Set(dates)].sort((a, b) => b.localeCompare(a)); // desc
        
        let streak = 0;
        const today = new Date().toLocaleDateString('en-CA');
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toLocaleDateString('en-CA');

        if (uniqueDates.length > 0) {
          if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
            streak = 1;
            let currentCheckDate = new Date(uniqueDates[0]);
            
            for (let i = 1; i < uniqueDates.length; i++) {
              currentCheckDate.setDate(currentCheckDate.getDate() - 1);
              const expectedDate = currentCheckDate.toLocaleDateString('en-CA');
              
              if (uniqueDates[i] === expectedDate) {
                streak++;
              } else {
                break;
              }
            }
          }
        }

        setStats({
          sessionsCount,
          wordsSaved,
          minutesSpoken,
          streakDays: streak,
        });
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setIsLoaded(true);
      }
    }

    loadStats();
  }, [user, isLoading]);

  // If no sessions yet, don't show the stats section to avoid empty 0s
  if (!isLoaded || (stats.sessionsCount === 0 && stats.wordsSaved === 0)) {
    return null;
  }

  const statItems = [
    { label: 'Buổi đã luyện', value: stats.sessionsCount, icon: MicrophoneStage, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Từ đã lưu', value: stats.wordsSaved, icon: BookmarkSimple, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Phút đã nói', value: stats.minutesSpoken, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Chuỗi ngày', value: stats.streakDays, icon: Fire, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div key={idx} className="bg-white rounded-[10px] p-3 border border-hairline shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col">
            <div className={`w-7 h-7 rounded-md ${item.bg} flex items-center justify-center mb-2`}>
              <Icon weight="fill" size={16} className={item.color} />
            </div>
            <div className="text-[20px] font-space font-medium text-ink leading-tight mb-0.5">
              {item.value}
            </div>
            <div className="text-[11px] font-medium text-stone uppercase tracking-wide">
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
