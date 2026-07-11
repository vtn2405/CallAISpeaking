import styles from '@/styles/CallInterface.module.css';

interface VideoContextProps {
  title: string;
  meta: string;
  videoUrl: string | null;
}

export default function VideoContext({ title, meta, videoUrl }: VideoContextProps) {
  return (
    <div className={styles.videoContextCard}>
      <div className={styles.videoThumb} aria-hidden="true">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
          <rect x="2" y="7" width="15" height="10" rx="2" fill="white" opacity=".2" />
          <rect x="2" y="7" width="15" height="10" rx="2" stroke="white" strokeWidth="1.6" />
          <path d="M17 9l5-3v12l-5-3" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={styles.videoContextInfo}>
        <span className={styles.videoContextLabel}>Đang luyện theo video</span>
        <span className={styles.videoContextTitle}>{title}</span>
        <span className={styles.videoContextMeta}>{meta}</span>
      </div>
      {videoUrl && (
        <a
          className={styles.videoYtLink}
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Xem trên YouTube"
          aria-label="Xem video trên YouTube"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </a>
      )}
    </div>
  );
}
