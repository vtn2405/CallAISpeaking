'use client';

import { useEffect } from 'react';
import { LockKey, X } from '@phosphor-icons/react/dist/ssr';
import { motion } from 'motion/react';

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="relative w-full max-w-sm bg-white rounded-[16px] p-6 border border-hairline shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          aria-label="Đóng"
        >
          <X weight="bold" size={16} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-500 mb-5">
          <LockKey weight="fill" size={24} />
        </div>
        
        <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2" id="lock-modal-title">Tính năng Phase 2</h3>
        <p className="text-[15px] text-zinc-500 mb-8 leading-relaxed">
          Tính năng này sẽ được mở khoá ở phiên bản tiếp theo. Hiện tại hãy trải nghiệm
          hội thoại video YouTube nhé!
        </p>
        
        <button
          className="w-full flex items-center justify-center h-11 bg-primary-600 text-white font-medium rounded-[8px] hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          onClick={onClose}
          type="button"
        >
          Đã hiểu
        </button>
      </motion.div>
    </div>
  );
}
