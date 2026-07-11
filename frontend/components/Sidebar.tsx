'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'motion/react';
import LockedNavModal from './ui/LockedNavModal';
import { 
  SquaresFour, 
  MicrophoneStage, 
  PenNib, 
  Books, 
  Info,
  LockKey
} from '@phosphor-icons/react';

const MAIN_LINKS = [
  { href: '/', label: 'Dashboard', icon: SquaresFour, locked: false },
  { href: '/practice', label: 'Practice', icon: MicrophoneStage, locked: false },
  { href: '/mock-test', label: 'Mock test', icon: PenNib, locked: true },
  { href: '/library', label: 'History', icon: Books, locked: false },
];

const SECONDARY_LINKS = [
  { href: '/guide', label: 'Hướng dẫn', icon: Info, locked: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);

  const renderNavLink = (link: typeof MAIN_LINKS[0], isSecondary: boolean = false) => {
    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
    const isHovered = hoveredHref === link.href;
    const Icon = link.icon;

    const content = (
      <>
        {!isSecondary && isHovered && !isActive && (
          <motion.div
            layoutId="sidebar-hover"
            className="absolute inset-0 rounded-xl bg-zinc-100/60"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
        {!isSecondary && isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl bg-primary-50"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
        
        <span className={`relative z-10 w-5 flex items-center justify-center shrink-0 ${isActive ? 'text-primary-600' : link.locked ? 'text-zinc-400' : 'text-zinc-500 group-hover:text-zinc-900'}`}>
          <Icon weight={isActive ? 'fill' : 'regular'} size={20} />
        </span>
        <span className={`relative z-10 text-sm font-medium transition-colors duration-200 ${isActive ? 'text-primary-600 font-bold' : link.locked ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-900'}`}>
          {link.label}
        </span>
        {link.locked && (
          <span className="relative z-10 ml-auto text-zinc-400">
            <LockKey weight="bold" size={14} />
          </span>
        )}
      </>
    );

    const className = "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group cursor-pointer";

    if (link.locked) {
      return (
        <button
          key={link.href}
          className={className}
          onMouseEnter={() => setHoveredHref(link.href)}
          onClick={() => setShowLockModal(true)}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href}
        className={className}
        onMouseEnter={() => setHoveredHref(link.href)}
      >
        {content}
      </Link>
    );
  };

  return (
    <aside className="w-[220px] bg-white border-r border-zinc-200 min-h-[100dvh] flex flex-col fixed left-0 top-0 bottom-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-zinc-100">
        <div className="relative w-9 h-9 rounded-xl overflow-hidden shrink-0">
          <Image src="/logo.png" alt="Logo" fill className="object-cover" priority />
        </div>
        <div className="flex flex-col leading-[1.15]">
          <span className="text-[11px] font-extrabold tracking-widest text-zinc-900">AI SPEAKING</span>
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500">COACH</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav 
        className="flex-1 px-3 py-4 flex flex-col gap-1"
        onMouseLeave={() => setHoveredHref(null)}
      >
        {MAIN_LINKS.map(link => renderNavLink(link, false))}
      </nav>

      {/* Secondary Navigation */}
      <nav 
        className="px-3 pb-3 flex flex-col gap-1"
        onMouseLeave={() => setHoveredHref(null)}
      >
        {SECONDARY_LINKS.map(link => renderNavLink(link, true))}
      </nav>

      {/* User section */}
      <div className="flex items-center gap-3 p-4 border-t border-zinc-100 cursor-pointer hover:bg-zinc-50 transition-colors group">
        <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
          M
        </div>
        <div className="flex-1 flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-zinc-900 group-hover:text-black">Minh</span>
          <span className="text-[11px] text-zinc-500">Tài khoản của tôi</span>
        </div>
        <span className="text-zinc-400 text-lg leading-none group-hover:text-zinc-600 transition-colors">›</span>
      </div>

      {showLockModal && <LockedNavModal onClose={() => setShowLockModal(false)} />}
    </aside>
  );
}
