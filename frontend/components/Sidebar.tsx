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
  LockKey,
  CaretLeft,
  CaretRight
} from '@phosphor-icons/react';

const MAIN_LINKS = [
  { href: '/', label: 'Trang chủ', icon: SquaresFour, locked: false },
  { href: '/practice', label: 'Luyện tập', icon: MicrophoneStage, locked: false },
  { href: '/mock-test', label: 'Thi thử', icon: PenNib, locked: true },
  { href: '/history', label: 'Lịch sử', icon: Books, locked: false },
];

const SECONDARY_LINKS = [
  { href: '/guide', label: 'Hướng dẫn', icon: Info, locked: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const renderNavLink = (link: typeof MAIN_LINKS[0], isSecondary: boolean = false) => {
    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
    const isHovered = hoveredHref === link.href;
    const Icon = link.icon;

    const content = (
      <>
        {!isSecondary && isHovered && !isActive && (
          <motion.div
            layoutId="sidebar-hover"
            className="absolute inset-0 rounded-[6px] bg-surface"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
        {!isSecondary && isActive && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-[6px] bg-surface border border-hairline"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
        
        <span className={`relative z-10 w-5 flex items-center justify-center shrink-0 ${isActive ? 'text-charcoal' : link.locked ? 'text-muted' : 'text-stone group-hover:text-charcoal'}`}>
          <Icon weight={isActive ? 'fill' : 'regular'} size={16} />
        </span>
        
        <span 
          className={`relative z-10 text-[13px] whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-0'
          } ${isActive ? 'text-charcoal font-medium' : link.locked ? 'text-muted' : 'text-steel font-normal group-hover:text-charcoal'}`}
        >
          {link.label}
        </span>
        
        {!isCollapsed && link.locked && (
          <span className="relative z-10 ml-auto text-zinc-400">
            <LockKey weight="bold" size={14} />
          </span>
        )}
      </>
    );

    const className = `relative flex items-center gap-2.5 ${isCollapsed ? 'px-0 justify-center w-8 h-8 mx-auto' : 'px-2.5'} py-1.5 rounded-[6px] transition-colors group cursor-pointer`;

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
    <aside 
      className={`${
        isCollapsed ? 'w-[68px]' : 'w-[220px]'
      } bg-canvas border-r border-hairline sticky top-0 h-[100dvh] flex flex-col shrink-0 z-50 transition-[width] duration-300 ease-in-out`}
    >
      {/* Logo & Toggle */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'gap-3'} px-4 pt-5 pb-4 border-b border-hairline`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-[8px] overflow-hidden shrink-0">
              <Image src="/logo.png" alt="Logo" fill className="object-cover" sizes="32px" priority />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col leading-[1.2] whitespace-nowrap overflow-hidden transition-all duration-300">
                <span className="text-[12px] font-semibold tracking-wide text-ink">AI Speaking</span>
                <span className="text-[11px] tracking-wide text-steel">Coach</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors ${isCollapsed ? 'hidden' : ''}`}
            aria-label="Toggle sidebar"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
        </div>

        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors"
            aria-label="Toggle sidebar"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        )}
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
      <div className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 p-4'} border-t border-hairline cursor-pointer hover:bg-surface transition-colors group`}>
        <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center font-medium text-sm shrink-0">
          M
        </div>
        {!isCollapsed && (
          <>
            <div className="flex-1 flex flex-col leading-tight whitespace-nowrap overflow-hidden transition-all duration-300">
              <span className="text-[13px] font-medium text-ink">Minh</span>
              <span className="text-[11px] text-steel">Tài khoản của tôi</span>
            </div>
            <span className="text-stone text-lg leading-none transition-colors">›</span>
          </>
        )}
      </div>

      {showLockModal && <LockedNavModal onClose={() => setShowLockModal(false)} />}
    </aside>
  );
}
