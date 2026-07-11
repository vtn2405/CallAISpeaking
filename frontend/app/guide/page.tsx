import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hướng dẫn',
  description: 'Hướng dẫn sử dụng AI Speaking Coach Phase 1.',
};

const STEPS = [
  {
    id: 'step1',
    gradient: ['#4338ca', '#06b6d4'],
    label: 'BƯỚC 1',
    title: 'Chọn video YouTube',
    desc: 'Dán link YouTube có phụ đề (thường là TED Talk, Vlog, khóa học). AI sẽ đọc toàn bộ nội dung video để trò chuyện cùng bạn.',
    locked: false,
  },
  {
    id: 'step2',
    gradient: ['#7c3aed', '#2563eb'],
    label: 'BƯỚC 2',
    title: 'Bắt đầu nói chuyện',
    desc: 'Nhấn nút mic và bắt đầu nói bằng tiếng Anh. AI sẽ lắng nghe, hiểu và trả lời ngắn gọn theo chủ đề video. Bạn có thể ngắt lời AI bất cứ lúc nào.',
    locked: false,
  },
  {
    id: 'step3',
    gradient: ['#0891b2', '#0f766e'],
    label: 'MẸO',
    title: 'Duy trì cuộc hội thoại',
    desc: 'Đặt câu hỏi mở, chia sẻ ý kiến, hoặc yêu cầu AI giải thích thêm. Mục tiêu là nói nhiều nhất có thể — không sợ sai!',
    locked: false,
  },
  {
    id: 'phase2',
    gradient: null,
    label: 'PHASE 2 – SẮP RA MẮT',
    title: 'Chấm điểm & Thi thử',
    desc: 'Mock test IELTS Part 1/2/3 và chấm band score tự động sẽ có ở phiên bản tiếp theo.',
    locked: true,
  },
];

export default function GuidePage() {
  return (
    <main className="main-content">
      <header className="topbar">
        <h1 className="greeting" style={{ fontSize: '24px' }}>Hướng dẫn sử dụng</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 860 }}>
        {STEPS.map((step) => (
          <div
            key={step.id}
            className="hero-card"
            style={step.locked ? { border: '1.5px dashed var(--border)', background: 'var(--surface-alt)' } : {}}
          >
            <div
              style={{
                width: 48, height: 48,
                background: step.gradient
                  ? `linear-gradient(135deg, ${step.gradient[0]}, ${step.gradient[1]})`
                  : 'var(--primary-pale)',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}
              aria-hidden="true"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                {step.id === 'step1' && (
                  <><rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.8" /><path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.8" strokeLinejoin="round" /></>
                )}
                {step.id === 'step2' && (
                  <><path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="white" strokeWidth="1.8" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></>
                )}
                {step.id === 'step3' && (
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                )}
                {step.id === 'phase2' && (
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="var(--primary)" strokeWidth="1.6" strokeLinejoin="round" />
                )}
              </svg>
            </div>
            <div className="section-label" style={{ marginBottom: 8, color: step.locked ? 'var(--text-muted)' : undefined }}>
              {step.label}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: step.locked ? 'var(--text-muted)' : undefined }}>
              {step.title}
            </h3>
            <p style={{ fontSize: 13.5, color: step.locked ? 'var(--text-muted)' : 'var(--text-secondary)', lineHeight: 1.6 }}>
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="hero-card" style={{ maxWidth: 860 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>PHÍM TẮT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[
            { key: 'Space', desc: 'Bật/tắt microphone' },
            { key: 'Esc',   desc: 'Đóng hộp thoại' },
          ].map(({ key, desc }) => (
            <div
              key={key}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              <kbd
                style={{
                  background: '#fff',
                  border: '1.5px solid var(--border)',
                  borderRadius: 6,
                  padding: '3px 9px',
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: '0 2px 0 var(--border)',
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
