import type { Metadata } from 'next';
import Toast from '@/components/ui/Toast';
import YoutubeInput from '@/components/features/YoutubeInput';
import LockedFeatureCards from '@/components/features/LockedFeatureCards';
import RecentSessions from '@/components/features/RecentSessions';

export const metadata: Metadata = {
  title: 'AI Speaking Coach',
  description: 'Luyện speaking IELTS qua video YouTube với AI Speaking Coach.',
};

export default function DashboardPage() {
  return (
    <main className="flex flex-col max-w-[640px] mx-auto w-full min-w-0 px-6 pt-12 pb-24 lg:pt-16">

      {/* ── Greeting ── */}
      <header className="mb-8">
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.5px] leading-tight">
          Trò chuyện với AI
        </h1>
        <p className="text-[15px] text-steel mt-2 leading-relaxed">
          Dán link YouTube có phụ đề để AI chuẩn bị ngữ cảnh và bắt đầu nói chuyện cùng bạn.
        </p>
      </header>

      {/* ── PRIMARY: Conversation Entry — sits directly on page, no outer card ── */}
      <section aria-labelledby="entry-title" className="mb-5">
        <h2 id="entry-title" className="sr-only">Nhập link YouTube</h2>
        <YoutubeInput />
      </section>

      {/* ── Divider ── */}
      <div className="border-t border-hairline my-8" />

      {/* ── TERTIARY: Recent sessions ── */}
      <div className="mb-10">
        <RecentSessions />
      </div>

      {/* ── LOW PRIORITY: Phase 2 locked features ── */}
      <section aria-labelledby="coming-soon-label">
        <p
          id="coming-soon-label"
          className="text-[11px] font-medium tracking-[0.08em] text-stone uppercase mb-3"
        >
          Tính năng sắp ra mắt
        </p>
        <LockedFeatureCards />
      </section>

      <Toast />
    </main>
  );
}
