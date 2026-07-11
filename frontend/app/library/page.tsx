import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Play, Clock, ChatTeardropText } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'History',
  description: 'Lịch sử các cuộc trò chuyện và buổi luyện speaking IELTS.',
};

interface Session {
  id: string;
  title: string;
  date: string;
  duration: string;
  turns: number;
  gradient: [string, string];
}

const MOCK_SESSIONS: Session[] = [
  { id: 'ses_001', title: 'Review: Modern Architecture', date: '4 Thg 7, 2026', duration: '12 phút', turns: 8,  gradient: ['#18181b', '#3f3f46'] },
  { id: 'ses_002', title: 'Travel Vlog: Tokyo Night',    date: '3 Thg 7, 2026', duration: '9 phút',  turns: 6,  gradient: ['#27272a', '#52525b'] },
  { id: 'ses_003', title: 'TED Talk: Power of Habits',   date: '2 Thg 7, 2026', duration: '15 phút', turns: 11, gradient: ['#3f3f46', '#71717a'] },
  { id: 'ses_004', title: 'Science: Black Holes',        date: '1 Thg 7, 2026', duration: '8 phút',  turns: 5,  gradient: ['#09090b', '#27272a'] },
];

export default function LibraryPage() {
  return (
    <main className="p-8 lg:p-12 xl:p-16 flex flex-col gap-10 max-w-6xl mx-auto w-full min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Lịch sử trò chuyện
          </h1>
          <p className="text-[15px] text-zinc-500 mt-1">Lịch sử và tiến trình học tập của bạn.</p>
        </div>
        <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors shadow-sm shrink-0 w-fit">
          <Plus weight="bold" size={16} />
          <span>Cuộc trò chuyện mới</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_SESSIONS.map((s) => (
          <Link
            key={s.id}
            href={`/call?sessionId=${s.id}`}
            className="group flex flex-col bg-white border border-zinc-200/60 rounded-3xl p-5 shadow-[0_8px_30px_rgba(136,135,128,0.08)] hover:shadow-[0_12px_40px_rgba(136,135,128,0.12)] hover:border-zinc-300 transition-all duration-300"
          >
            <div
              className="w-full h-32 rounded-2xl flex items-center justify-center text-white mb-5 shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})`,
              }}
              aria-hidden="true"
            >
              <Play weight="fill" size={32} className="opacity-90 group-hover:scale-110 transition-transform duration-300" />
            </div>
            
            <h2 className="text-lg font-bold text-zinc-900 mb-2 group-hover:text-black transition-colors line-clamp-1">{s.title}</h2>
            
            <div className="flex items-center gap-4 text-[13px] font-medium text-zinc-500 mb-4">
              <div className="flex items-center gap-1.5">
                <Clock weight="bold" size={16} className="text-zinc-400" />
                <span>{s.duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ChatTeardropText weight="bold" size={16} className="text-zinc-400" />
                <span>{s.turns} lượt</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100">
              <span className="text-[12px] font-semibold text-zinc-400">{s.date}</span>
              <span className="text-[13px] font-bold text-primary-600 group-hover:text-primary-700 transition-colors">
                Tiếp tục →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
