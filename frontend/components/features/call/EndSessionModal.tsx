import styles from '@/styles/EndSessionModal.module.css';

interface EndSessionModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function EndSessionModal({ onConfirm, onCancel }: EndSessionModalProps) {
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-modal-title"
      onClick={onCancel}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>📋</div>
        <h3 className={styles.title} id="end-modal-title">Kết thúc cuộc trò chuyện?</h3>
        <p className={styles.desc}>
          Cuộc trò chuyện sẽ được lưu vào lịch sử. Bạn có thể bắt đầu lại bất cứ lúc nào!
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
          >
            Tiếp tục
          </button>
          <button
            type="button"
            data-testid="end-session-confirm"
            className={styles.btnDanger}
            onClick={onConfirm}
          >
            Kết thúc
          </button>
        </div>
      </div>
    </div>
  );
}
