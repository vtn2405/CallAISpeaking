'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useDragControls, useReducedMotion, useAnimation } from 'motion/react';
import type { HintResult } from '@/types/call';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import styles from '@/styles/CallFullscreen.module.css';

interface HintsOverlayProps {
  hintsPanel: HintResult | null;
  hintsLoading: boolean;
  hintsView: 'suggestions' | 'sentence';
  onClose: () => void;
  isOpen: boolean;
}

export default function HintsOverlay({ hintsPanel, hintsLoading, hintsView, onClose, isOpen }: HintsOverlayProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const shouldReduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const controls = useAnimation();
  
  // Height states for mobile: simple 'visible' state with max-height
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      controls.start('visible');
    }
  }, [isOpen, controls]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
      {hintsLoading ? (
        <div className="flex items-center gap-3 text-white/50 text-sm italic">
          <span className={styles.lookupSpinner} />
          Đang phân tích...
        </div>
      ) : hintsPanel ? (
        <div className="flex flex-col gap-4">
          {/* View: Nghĩa câu (Sentence translation) */}
          {hintsView === 'sentence' && hintsPanel.sentence_vi && (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition">
              <p className="text-white font-medium text-[15px] leading-relaxed">{hintsPanel.sentence_vi}</p>
            </div>
          )}

          {/* View: Suggestions */}
          {hintsView === 'suggestions' && (
            <div className="flex flex-col gap-3">
              {hintsPanel.suggestions.map((s, i) => {
                let icon = '💡';
                let badgeColor = 'text-purple-300 bg-purple-500/20 border-purple-500/30';
                
                if (s.type === 'question') { 
                  icon = '❓'; 
                  badgeColor = 'text-cyan-300 bg-cyan-500/20 border-cyan-500/30'; 
                } else if (s.type === 'reaction') { 
                  icon = '💬'; 
                  badgeColor = 'text-amber-300 bg-amber-500/20 border-amber-500/30'; 
                }

                return (
                  <div key={i} 
                    className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-white/10 transition cursor-pointer flex flex-col gap-2 group"
                    onClick={() => {
                      // Action here
                      console.log('Tapped hint:', s.en);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        {s.type === 'answer' ? 'Trả lời' : s.type === 'question' ? 'Hỏi lại' : 'Phản ứng'}
                      </span>
                    </div>
                    <p className="text-white font-medium text-[15px] flex items-start gap-2.5 leading-snug">
                      <span className="opacity-70 text-sm mt-0.5">{icon}</span>
                      {s.en}
                    </p>
                    <p className="text-slate-400 text-[13px] italic ml-7 leading-snug">{s.vi}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  // Desktop Drawer
  if (isDesktop) {
    return (
      <>
        {/* Dim Backdrop for Desktop - covers everything behind drawer but below footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-[30] cursor-pointer"
          aria-hidden="true"
        />
        <motion.div 
          id="hints-overlay"
          initial={{ x: shouldReduceMotion ? 0 : '100%' }}
          animate={{ x: 0 }}
          exit={{ x: shouldReduceMotion ? 0 : '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className="fixed top-0 right-0 bottom-0 w-[420px] bg-black/60 backdrop-blur-2xl border-l border-white/10 z-[40] shadow-2xl flex flex-col min-h-0 pointer-events-auto"
          role="dialog" 
          aria-label="Gợi ý hội thoại"
          aria-modal="false"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
            <span className="text-xs font-bold tracking-wider text-white/50 uppercase">
              {hintsView === 'suggestions' ? 'Gợi ý trả lời' : 'Nghĩa câu vừa nói'}
            </span>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
              aria-label="Đóng gợi ý"
            >
              ✕
            </button>
          </div>
          {content}
        </motion.div>
      </>
    );
  }

  // Mobile Bottom Sheet
  // Container is max-h-[85dvh] and fixed bottom-0.
  const variants = {
    hidden: { y: '100%' },
    visible: { y: '0%' }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[30] cursor-pointer"
        aria-hidden="true"
      />
      <motion.div
        id="hints-overlay"
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 max-h-[85dvh] bg-black/70 backdrop-blur-3xl border-t border-white/10 z-[40] shadow-2xl flex flex-col min-h-0 pointer-events-auto rounded-t-3xl"
        role="dialog"
        aria-label="Gợi ý hội thoại"
        aria-modal="false"
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate={controls}
        exit="hidden"
        variants={variants}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false} // Only drag on handle
        dragConstraints={{ top: 0 }} // Prevent dragging higher than visible state natively
        dragElastic={0.1}
        onDragEnd={(e, info) => {
          const velocity = info.velocity.y;
          const offset = info.offset.y;
          
          if (velocity > 400 || offset > 80) {
            onClose();
          } else {
            controls.start('visible');
          }
        }}
      >
        <div 
          className="flex flex-col shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          {/* Drag Handle */}
          <div className="w-full pt-4 pb-2 flex justify-center">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between px-6 pb-4 border-b border-white/5">
            <span className="text-xs font-bold tracking-wider text-white/50 uppercase">
              {hintsView === 'suggestions' ? 'Gợi ý trả lời' : 'Nghĩa câu vừa nói'}
            </span>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
              aria-label="Đóng gợi ý"
            >
              ✕
            </button>
          </div>
        </div>
        
        {content}
      </motion.div>
    </>
  );
}
