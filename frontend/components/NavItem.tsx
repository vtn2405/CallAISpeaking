'use client';

// NavItem is a Client Component so it can call usePathname() to
// derive active state. The parent Sidebar stays as a Server Component.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import LockedNavModal from './ui/LockedNavModal';
import { useState } from 'react';

interface Props {
  href: string;
  label: string;
  icon: ReactNode;
  locked: boolean;
}

export default function NavItem({ href, label, icon, locked }: Props) {
  const pathname = usePathname();
  const [showLockModal, setShowLockModal] = useState(false);

  // Dashboard active only at root; others match by prefix
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (locked) {
    return (
      <>
        <button
          className="nav-item nav-item-locked"
          onClick={() => setShowLockModal(true)}
          aria-label={`${label} – Phase 2, chưa mở khoá`}
          type="button"
        >
          <span className="nav-icon">{icon}</span>
          <span>{label}</span>
          <span className="nav-badge-lock" aria-hidden="true">🔒</span>
        </button>
        {showLockModal && <LockedNavModal onClose={() => setShowLockModal(false)} />}
      </>
    );
  }

  return (
    <Link
      href={href}
      className={`nav-item${isActive ? ' active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
