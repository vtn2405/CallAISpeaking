'use client';

import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function LockedNavModal({ onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      onClick={onClose}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">🔒</div>
        <h3 className="modal-title" id="lock-modal-title">Tính năng Phase 2</h3>
        <p className="modal-desc">
          Tính năng này sẽ được mở khoá ở phiên bản tiếp theo. Hiện tại hãy trải nghiệm
          hội thoại video YouTube nhé!
        </p>
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onClose}
          type="button"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
