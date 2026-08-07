'use client';

import { useProgressStats } from '@/hooks/useProgressStats';
import ProgressSection from './ProgressSection';

export default function DashboardProgressWrapper() {
  const { stats, loading } = useProgressStats();

  return <ProgressSection stats={stats} loading={loading} historyHref="/history" />;
}
