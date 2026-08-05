'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from '@phosphor-icons/react';

export default function HistoryDetailHeader() {
  const router = useRouter();
  
  return (
    <header className="shrink-0 px-4 py-3 sm:px-6 bg-white/80 backdrop-blur-md border-b border-hairline flex items-center gap-4 sticky top-0 z-10">
      <button
        onClick={() => router.back()}
        className="p-2 -ml-2 rounded-full hover:bg-surface-soft transition-colors text-stone hover:text-charcoal flex items-center gap-2"
        aria-label="Quay lại"
      >
        <ArrowLeft size={18} weight="bold" />
        <span className="text-[13px] font-medium hidden sm:inline">Quay lại</span>
      </button>
    </header>
  );
}
