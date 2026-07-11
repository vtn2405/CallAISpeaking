import LockedFeatureCardClient from '@/components/features/LockedFeatureCardClient';
import { TrendUp, Target, PresentationChart } from '@phosphor-icons/react/dist/ssr';

const LOCKED_FEATURES = [
  {
    id: 'skill-test',
    tag: { type: 'soon' as const, label: 'SẮP RA MẮT' },
    name: 'Luyện kỹ năng & thi thử',
    desc: 'Part 1, 2, 3 và Mock Test',
    icon: <TrendUp size={24} weight="bold" />,
  },
  {
    id: 'scoring',
    tag: { type: 'locked' as const, label: 'CHƯA MỞ KHÓA' },
    name: 'Chấm điểm IELTS AI',
    desc: 'Đánh giá band score theo tiêu chí chính thức',
    icon: <Target size={24} weight="bold" />,
  },
  {
    id: 'pronunciation',
    tag: { type: 'locked' as const, label: 'CHƯA MỞ KHÓA' },
    name: 'Phát âm chi tiết',
    desc: 'Đánh giá phát âm chuẩn từng từ',
    icon: <PresentationChart size={24} weight="bold" />,
  },
];

export default function LockedFeatureCards() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="other-features-title">
      <h3 className="text-[11px] font-extrabold tracking-widest text-zinc-400 uppercase" id="other-features-title">
        Các tính năng khác
      </h3>
      <div className="flex flex-col gap-3">
        {LOCKED_FEATURES.map((f) => (
          <LockedFeatureCardClient key={f.id} feature={f} />
        ))}
      </div>
    </section>
  );
}
