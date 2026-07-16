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
        className="relative flex flex-col p-4 bg-canvas border border-hairline rounded-[12px] hover:border-hairline-strong cursor-pointer group overflow-hidden transition-all duration-300"
        role="button"
        tabIndex={0}
        aria-label={`${feature.name} – Phase 2, chưa mở khoá`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-surface border border-hairline text-stone group-hover:text-charcoal transition-colors">
            {feature.icon}
          </div>
          <span
            className={`text-[11px] font-medium tracking-wide px-2 py-0.5 rounded-[6px] ${
              feature.tag.type === 'soon' 
                ? 'bg-amber-50 text-amber-700 border border-amber-200/50' 
                : 'bg-surface text-stone border border-hairline'
            }`}
          >
            {feature.tag.label}
          </span>
        </div>
        <div className="flex flex-col">
          <h4 className="text-[14px] font-medium text-ink mb-0.5">{feature.name}</h4>
          <p className="text-[12px] text-steel leading-relaxed">{feature.desc}</p>
        </div>

        {/* Lock Overlay on Hover */}
        <div className="absolute inset-0 bg-canvas/90 backdrop-blur-[1px] flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <LockKey size={24} weight="fill" className="text-charcoal" />
          <p className="text-[12px] font-medium text-charcoal">Tính năng Phase 2</p>
        </div>
      </motion.div>
      {open && <LockedNavModal onClose={() => setOpen(false)} />}
    </>
  );
}
