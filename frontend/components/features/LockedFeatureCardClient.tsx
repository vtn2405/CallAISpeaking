'use client';

import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import LockedNavModal from '@/components/ui/LockedNavModal';
import { LockKey } from '@phosphor-icons/react';

interface Feature {
  id: string;
  tag: { type: 'soon' | 'locked'; label: string };
  name: string;
  desc: string;
  icon: ReactNode;
}

export default function LockedFeatureCardClient({ feature }: { feature: Feature }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="relative flex flex-col p-5 bg-white border border-zinc-200/60 rounded-3xl shadow-[0_8px_30px_rgba(136,135,128,0.08)] hover:shadow-[0_12px_40px_rgba(136,135,128,0.12)] hover:border-zinc-300 cursor-pointer group overflow-hidden transition-all duration-300"
        role="button"
        tabIndex={0}
        aria-label={`${feature.name} – Phase 2, chưa mở khoá`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-400 group-hover:text-zinc-600 transition-colors">
            {feature.icon}
          </div>
          <span
            className={`text-[10px] font-bold tracking-wider px-3 py-1 rounded-full ${
              feature.tag.type === 'soon' 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {feature.tag.label}
          </span>
        </div>
        <div className="flex flex-col">
          <h4 className="text-[15px] font-bold text-zinc-800 mb-1">{feature.name}</h4>
          <p className="text-[13px] text-zinc-500">{feature.desc}</p>
        </div>

        {/* Lock Overlay on Hover */}
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <LockKey size={28} weight="bold" className="text-zinc-900" />
          <p className="text-[13px] font-bold text-zinc-800 tracking-tight">Tính năng Phase 2</p>
        </div>
      </motion.div>
      {open && <LockedNavModal onClose={() => setOpen(false)} />}
    </>
  );
}
