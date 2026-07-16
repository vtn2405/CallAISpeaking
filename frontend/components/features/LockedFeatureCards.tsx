import LockedFeatureCardClient from '@/components/features/LockedFeatureCardClient';
import { TrendUp, Target, PresentationChart } from '@phosphor-icons/react/dist/ssr';

const LOCKED_FEATURES = [
  {
    id: 'skill-test',
    tag: { type: 'soon' as const, label: 'Sắp ra mắt' },
    name: 'Luyện kỹ năng & thi thử',
    desc: 'Part 1, 2, 3 và Mock Test',
    icon: <TrendUp size={20} weight="regular" />,
  },
  {
    id: 'scoring',
    tag: { type: 'locked' as const, label: 'Chưa mở khóa' },
    name: 'Chấm điểm IELTS AI',
    desc: 'Đánh giá band score theo tiêu chí chính thức',
    icon: <Target size={20} weight="regular" />,
  },
  {
    id: 'pronunciation',
    tag: { type: 'locked' as const, label: 'Chưa mở khóa' },
    name: 'Phát âm chi tiết',
    desc: 'Đánh giá phát âm chuẩn từng từ',
    icon: <PresentationChart size={20} weight="regular" />,
  },
];

export default function LockedFeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {LOCKED_FEATURES.map((f) => (
        <LockedFeatureCardClient key={f.id} feature={f} />
      ))}
    </div>
  );
}
