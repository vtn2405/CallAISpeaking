import Link from 'next/link';
import { Play, ArrowRight } from '@phosphor-icons/react/dist/ssr';

interface Session {
  id: string;
  title: string;
  time: string;
  tag: string;
  thumbGradient: [string, string];
}

const MOCK_SESSIONS: Session[] = [
  { id: 'ses_001', title: 'Review: Modern Architecture', time: '12 PHÚT TRƯỚC', tag: 'Hội thoại tự do', thumbGradient: ['#18181b', '#3f3f46'] }, // Zinc 900 to 700
  { id: 'ses_002', title: 'Travel Vlog: Tokyo Night',    time: 'HÔM QUA',       tag: 'Hội thoại tự do', thumbGradient: ['#27272a', '#52525b'] },
  { id: 'ses_003', title: 'TED Talk: Power of Habits',   time: '2 NGÀY TRƯỚC',  tag: 'Hội thoại tự do', thumbGradient: ['#3f3f46', '#71717a'] },
  { id: 'ses_004', title: 'Science: Black Holes',        time: '3 NGÀY TRƯỚC',  tag: 'Hội thoại tự do', thumbGradient: ['#09090b', '#27272a'] },
];

export default function RecentSessions() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="recent-sessions-title">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-extrabold tracking-widest text-zinc-400 uppercase" id="recent-sessions-title">
          Buổi luyện gần đây
        </h3>
        <Link href="/library" className="flex items-center gap-1 text-[13px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
          <span>Xem tất cả</span>
          <ArrowRight weight="bold" size={14} />
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_SESSIONS.map((s) => (
          <Link
            key={s.id}
            href={`/call?sessionId=${s.id}`}
            className="group relative flex items-center gap-4 p-4 bg-white border border-zinc-200/60 rounded-3xl shadow-[0_8px_30px_rgba(136,135,128,0.08)] hover:shadow-[0_12px_40px_rgba(136,135,128,0.12)] hover:border-zinc-300 transition-all duration-300 overflow-hidden"
            aria-label={`Mở buổi luyện: ${s.title}`}
          >
            <div
              className="flex items-center justify-center w-[46px] h-[46px] rounded-2xl shrink-0 text-white shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${s.thumbGradient[0]}, ${s.thumbGradient[1]})`,
              }}
              aria-hidden="true"
            >
              <Play weight="fill" size={20} />
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <h4 className="text-[15px] font-bold text-zinc-900 truncate mb-1 group-hover:text-black transition-colors">{s.title}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">{s.time}</span>
              </div>
            </div>

            <span className="shrink-0 px-3 py-1 bg-zinc-100 text-zinc-600 text-[11px] font-bold tracking-wide rounded-full group-hover:bg-zinc-200 transition-colors">
              {s.tag}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
