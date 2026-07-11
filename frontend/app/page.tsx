import type { Metadata } from 'next';
import Toast from '@/components/ui/Toast';
import YoutubeInput from '@/components/features/YoutubeInput';
import LockedFeatureCards from '@/components/features/LockedFeatureCards';
import RecentSessions from '@/components/features/RecentSessions';
import { Lightning, Clock, CalendarCheck } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Luyện speaking IELTS qua video YouTube với AI Speaking Coach.',
};

export default function DashboardPage() {
  return (
    <main className="p-8 lg:p-12 xl:p-16 flex flex-col gap-10 max-w-6xl mx-auto w-full min-w-0">
      {/* Topbar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Chào Minh 👋
          </h1>
          <div className="flex items-center gap-1.5 px-3 py-1 border border-orange-200 bg-orange-50 text-orange-600 font-bold text-sm rounded-full">
            <Lightning weight="fill" size={16} />
            <span>Chuỗi 12 ngày</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-zinc-200 rounded-full text-sm font-semibold text-zinc-600 shadow-sm">
            <Clock weight="bold" size={16} className="text-zinc-400" />
            <span>48 phút tuần này</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-zinc-200 rounded-full text-sm font-semibold text-zinc-600 shadow-sm">
            <CalendarCheck weight="bold" size={16} className="text-zinc-400" />
            <span>7 buổi</span>
          </div>
        </div>
      </header>

      {/* Hero feature card — YouTube input */}
      <section 
        className="relative bg-white border border-zinc-200/60 rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgba(24,24,27,0.04)] overflow-hidden" 
        aria-labelledby="hero-title"
      >
        {/* Subtle decorative mesh or gradient at the corner */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,rgba(24,24,27,0.03)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 mb-8">
          <div className="mb-3">
            <span className="text-[11px] font-extrabold tracking-widest text-zinc-400 uppercase">TÍNH NĂNG CHÍNH</span>
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2" id="hero-title">
            Trò chuyện qua video YouTube
          </h2>
          <p className="text-[15px] text-zinc-500 max-w-[65ch]">
            Dán link YouTube có phụ đề để hệ thống AI tự động phân tích và bắt đầu luyện tập.
          </p>
        </div>

        {/* Client boundary: interactive Youtube input */}
        <div className="relative z-10">
          <YoutubeInput />
        </div>
      </section>

      {/* Bottom two-column grid (Bento Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        <LockedFeatureCards />
        <RecentSessions />
      </div>

      {/* Global toast */}
      <Toast />
    </main>
  );
}
