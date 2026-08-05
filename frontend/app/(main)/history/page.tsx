import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from '@phosphor-icons/react/dist/ssr';
import HistoryListClient from './HistoryList.client';

export const metadata: Metadata = {
  title: 'Lịch sử trò chuyện',
  description: 'Toàn bộ lịch sử các cuộc gọi gần đây của bạn.',
};

export default function HistoryPage() {
  return (
    <main className="p-8 lg:p-12 xl:p-16 flex flex-col gap-10 max-w-6xl mx-auto w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Lịch sử trò chuyện
          </h1>
          <p className="text-[15px] text-zinc-500 mt-1">Toàn bộ lịch sử các cuộc gọi gần đây của bạn.</p>
        </div>
        <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-sm shrink-0 w-fit">
          <Plus weight="bold" size={16} />
          <span>Cuộc trò chuyện mới</span>
        </Link>
      </header>

      <HistoryListClient />
    </main>
  );
}
