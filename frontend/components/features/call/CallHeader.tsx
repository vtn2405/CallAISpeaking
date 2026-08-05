import { useRouter } from 'next/navigation';
import styles from '@/styles/CallHeader.module.css';
import { MicState } from '@/types/call';

interface CallHeaderProps {
  timer: string;
  micState: MicState;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export default function CallHeader({ timer, micState, onToggleMute, onEndCall }: CallHeaderProps) {
  const router = useRouter();

  return (
    <div className={styles.callHeader}>
      <button type="button" className={styles.backBtn} onClick={() => router.push('/dashboard')}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
          <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quay lại
      </button>

      <div className={styles.callHeaderCenter}>
        <span className={styles.callHeaderBadge}>
          <span className={styles.liveDot} aria-hidden="true" />
          ĐANG HỌC
        </span>
        <span className={styles.callTimer} aria-label={`Thời gian: ${timer}`}>
          {timer}
        </span>
      </div>

      <div className={styles.callHeaderRight}>
        <button
          type="button"
          className={`${styles.iconBtn} ${micState === 'muted' ? styles.iconBtnActive : ''}`}
          title={micState === 'muted' ? 'Bật tiếng' : 'Tắt tiếng'}
          aria-label={micState === 'muted' ? 'Bật tiếng' : 'Tắt tiếng'}
          onClick={onToggleMute}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
          title="Kết thúc buổi"
          aria-label="Kết thúc buổi luyện"
          onClick={onEndCall}
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
