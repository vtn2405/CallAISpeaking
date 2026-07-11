// Server Component — static locked feature cards.
// No interactivity needed; the lock modal is handled by the client
// wrapper LockedFeatureCardClient.
import LockedFeatureCardClient from '@/components/features/LockedFeatureCardClient';

const LOCKED_FEATURES = [
  {
    id: 'skill-test',
    tag: { type: 'soon' as const, label: '🚀 SẮP RA MẮT' },
    name: 'Luyện kỹ năng & thi thử',
    desc: 'Part 1, 2, 3 và Mock Test',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'scoring',
    tag: { type: 'locked' as const, label: '🔒 CHƯA MỞ KHÓA' },
    name: 'Chấm điểm IELTS AI',
    desc: 'Đánh giá band score theo tiêu chí chính thức',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'pronunciation',
    tag: { type: 'locked' as const, label: '🔒 CHƯA MỞ KHÓA' },
    name: 'Pronunciation Assessment',
    desc: 'Đánh giá phát âm chi tiết từng từ',
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
        <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function LockedFeatureCards() {
  return (
    <section className="feature-grid" aria-labelledby="other-features-title">
      <h3 className="section-title" id="other-features-title">
        CÁC TÍNH NĂNG KHÁC
      </h3>
      {LOCKED_FEATURES.map((f) => (
        <LockedFeatureCardClient key={f.id} feature={f} />
      ))}
    </section>
  );
}
