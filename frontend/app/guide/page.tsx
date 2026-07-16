import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  VideoCamera, 
  MicrophoneStage, 
  ChatTeardropText, 
  Lightbulb, 
  WarningCircle, 
  PlayCircle,
  CaretRight,
  CheckCircle,
  CaretDown
} from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'Hướng dẫn',
  description: 'Hướng dẫn bắt đầu nhanh AI Speaking Coach.',
};

export default function GuidePage() {
  return (
    <main className="p-8 lg:p-12 xl:p-16 flex flex-col gap-8 max-w-4xl mx-auto w-full min-w-0">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          Hướng dẫn bắt đầu
        </h1>
        <p className="text-[15px] text-zinc-500">Chỉ mất 1 phút để bắt đầu cuộc trò chuyện tiếng Anh đầu tiên của bạn.</p>
      </header>

      {/* Quick Start Flow */}
      <section className="flex flex-col bg-white border border-zinc-200/60 rounded-[32px] p-8 md:p-10 shadow-[0_8px_30px_rgba(136,135,128,0.06)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,rgba(27,75,160,0.04)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="px-3 py-1 bg-primary-50 text-primary-600 text-[11px] font-extrabold tracking-widest uppercase rounded-full">
            Quick Start
          </div>
        </div>

        <div className="flex flex-col gap-8 relative z-10">
          {/* Step 1 */}
          <div className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 shrink-0 z-10">
                <VideoCamera weight="fill" size={24} />
              </div>
              <div className="w-[2px] h-full bg-zinc-100 mt-2 rounded-full" />
            </div>
            <div className="pt-2 pb-6">
              <h3 className="text-lg font-bold text-zinc-900 mb-2">1. Chọn video YouTube</h3>
              <p className="text-[15px] text-zinc-500 leading-relaxed">
                Copy link một video YouTube tiếng Anh có phụ đề (VD: TED Talk, Vlog du lịch, Podcast). Dán vào ô tìm kiếm ở trang chủ.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 shrink-0 z-10">
                <MicrophoneStage weight="fill" size={24} />
              </div>
              <div className="w-[2px] h-full bg-zinc-100 mt-2 rounded-full" />
            </div>
            <div className="pt-2 pb-6">
              <h3 className="text-lg font-bold text-zinc-900 mb-2">2. Bắt đầu hội thoại</h3>
              <p className="text-[15px] text-zinc-500 leading-relaxed">
                Sau khi AI phân tích video xong, hãy bấm nút Micro (hoặc phím <kbd className="font-sans px-1.5 py-0.5 border border-zinc-200 rounded text-xs mx-1 bg-zinc-50 font-bold">Space</kbd>) để bắt đầu nói, sau đó bấm lại một lần nữa để kết thúc và chờ AI phản hồi.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-5">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shrink-0 z-10 shadow-[0_4px_12px_rgba(24,24,27,0.2)]">
                <ChatTeardropText weight="fill" size={24} />
              </div>
            </div>
            <div className="pt-2">
              <h3 className="text-lg font-bold text-zinc-900 mb-2">3. Tương tác tự nhiên</h3>
              <p className="text-[15px] text-zinc-500 leading-relaxed">
                AI sẽ cùng bạn thảo luận và đào sâu vào chủ đề của video đó. Bạn có thể thoải mái bày tỏ quan điểm, đặt câu hỏi hoặc tranh luận tự nhiên bằng tiếng Anh.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-zinc-100 flex justify-start">
          <Link href="/" className="inline-flex items-center justify-center gap-2 px-8 h-14 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-[0_4px_16px_rgba(27,75,160,0.3)] hover:shadow-[0_6px_24px_rgba(27,75,160,0.4)] group">
            <PlayCircle size={22} weight="fill" />
            <span>Thử với video đầu tiên</span>
            <CaretRight weight="bold" className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tips */}
        <section className="bg-amber-50/50 border border-amber-200/50 rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5 text-amber-700">
            <Lightbulb weight="fill" size={24} />
            <h3 className="text-lg font-bold">Mẹo học hiệu quả</h3>
          </div>
          <ul className="flex flex-col gap-3.5 text-[14.5px] text-zinc-700 leading-relaxed">
            <li className="flex gap-2.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span><strong>Không cần nói đúng 100%</strong>, hãy ưu tiên phản xạ trước! Mục tiêu chính là duy trì luồng giao tiếp trơn tru.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span>Dùng các câu hỏi mở như <i className="text-amber-900">"What do you think about..."</i> để chủ động kéo dài hội thoại.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span>Đừng quên nhấn lại nút Micro (hoặc phím <strong>Space</strong>) khi bạn đã nói xong để AI bắt đầu xử lý nhé.</span>
            </li>
          </ul>
        </section>

        {/* Troubleshooting */}
        <section className="bg-red-50/50 border border-red-200/50 rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-5 text-red-600">
            <WarningCircle weight="fill" size={24} />
            <h3 className="text-lg font-bold">Lỗi thường gặp</h3>
          </div>
          <div className="flex flex-col gap-5 text-[14.5px] text-zinc-700">
            <div>
              <p className="font-bold text-zinc-900 mb-2">Micro không nhận diện</p>
              <ul className="flex flex-col gap-1.5 text-zinc-600">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-red-400 shrink-0" /> Cho phép quyền Micro trên trình duyệt</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-red-400 shrink-0" /> Tải lại (Reload) trang web</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-zinc-900 mb-2">Video báo lỗi "Không tìm thấy"</p>
              <ul className="flex flex-col gap-1.5 text-zinc-600">
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-red-400 shrink-0" /> Video ở trạng thái Công khai (Public)</li>
                <li className="flex items-center gap-2"><CheckCircle size={16} className="text-red-400 shrink-0" /> Video có sẵn Phụ đề (CC) tiếng Anh</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Keyboard shortcuts - Accordion for secondary info */}
      <details className="group bg-zinc-50 border border-zinc-200/60 rounded-2xl [&_summary::-webkit-details-marker]:hidden shadow-sm">
        <summary className="flex items-center justify-between cursor-pointer p-4 select-none">
          <div className="flex items-center gap-3 text-zinc-500 font-semibold text-sm">
            <span>Phím tắt thao tác nhanh (Nâng cao)</span>
          </div>
          <CaretDown size={16} className="text-zinc-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-4 pb-4 pt-2 border-t border-zinc-200/40">
          <div className="flex flex-wrap gap-4 mt-2">
            {[
              { key: 'Space', desc: 'Bật/tắt microphone' },
              { key: 'Esc',   desc: 'Đóng hộp thoại / Hủy' },
            ].map(({ key, desc }) => (
              <div
                key={key}
                className="flex items-center gap-3 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl"
              >
                <kbd
                  className="bg-white border-b-2 border-x border-t border-zinc-200 rounded-md px-2 py-0.5 text-[11px] font-bold text-zinc-700 font-sans shadow-sm"
                >
                  {key}
                </kbd>
                <span className="text-[13px] font-medium text-zinc-600">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </main>
  );
}
