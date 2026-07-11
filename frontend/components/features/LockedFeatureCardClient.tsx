'use client';

import { useState, type ReactNode } from 'react';
import LockedNavModal from '@/components/ui/LockedNavModal';

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
      <div
        className="feature-card feature-card-locked"
        role="button"
        tabIndex={0}
        aria-label={`${feature.name} – Phase 2, chưa mở khoá`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        <div className="feature-card-top">
          <div className="feature-icon feature-icon-locked" aria-hidden="true">
            {feature.icon}
          </div>
          <span
            className={`feature-tag ${
              feature.tag.type === 'soon' ? 'feature-tag-soon' : 'feature-tag-locked'
            }`}
          >
            {feature.tag.label}
          </span>
        </div>
        <div className="feature-card-body">
          <h4 className="feature-name">{feature.name}</h4>
          <p className="feature-desc">{feature.desc}</p>
        </div>
        <div className="feature-lock-overlay" aria-hidden="true">
          <div className="lock-icon">🔒</div>
          <p className="lock-text">Tính năng Phase 2</p>
        </div>
      </div>
      {open && <LockedNavModal onClose={() => setOpen(false)} />}
    </>
  );
}
