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
import { MAIN_LINKS, SECONDARY_LINKS } from '@/config/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';

export default function Sidebar({ setShowLockModal }: { setShowLockModal: (show: boolean) => void }) {
  const pathname = usePathname();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  const renderNavLink = (link: typeof MAIN_LINKS[0], isSecondary: boolean = false) => {
    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
    const isHovered = hoveredHref === link.href;
    const Icon = link.icon;

    const isSignOut = link.href === '#sign-out';

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
        
        <span className={`relative z-10 w-5 flex items-center justify-center shrink-0 ${isActive ? 'text-charcoal' : link.locked ? 'text-muted' : isSignOut ? 'text-stone group-hover:text-red-500' : 'text-stone group-hover:text-charcoal'}`}>
          <Icon weight={isActive ? 'fill' : 'regular'} size={16} />
        </span>
        
        <span 
          className={`relative z-10 text-[13px] whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-0 lg:w-auto opacity-0 lg:opacity-100 ml-0'
          } ${isActive ? 'text-charcoal font-medium' : link.locked ? 'text-muted' : isSignOut ? 'text-steel font-normal group-hover:text-red-500' : 'text-steel font-normal group-hover:text-charcoal'}`}
        >
          {link.label}
        </span>
        
        {link.locked && (
          <span className={`relative z-10 ml-auto text-zinc-400 ${isCollapsed ? 'hidden' : 'hidden lg:block'}`}>
            <LockKey weight="bold" size={14} />
          </span>
        )}
      </>
    );

    const className = `relative flex items-center gap-2.5 ${isCollapsed ? 'px-0 justify-center w-8 h-8 mx-auto' : 'px-0 lg:px-2.5 justify-center lg:justify-start w-8 h-8 lg:w-auto lg:h-auto mx-auto lg:mx-0'} py-1.5 rounded-[6px] transition-colors group cursor-pointer`;

    if (link.href === '#sign-out') {
      return (
        <button
          key={link.href}
          className={className}
          onMouseEnter={() => setHoveredHref(link.href)}
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/dashboard';
          }}
        >
          {content}
        </button>
      );
    }

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
      className={`hidden md:flex ${
        isCollapsed ? 'w-[68px]' : 'w-[68px] lg:w-[220px]'
      } bg-canvas border-r border-hairline sticky top-0 h-[100dvh] flex-col shrink-0 z-50 transition-[width] duration-300 ease-in-out`}
    >
      {/* Logo & Toggle */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'gap-3'} px-4 pt-5 pb-4 border-b border-hairline`}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-[8px] overflow-hidden shrink-0">
              <Image src="/logo.png" alt="Logo" fill className="object-cover" sizes="32px" priority />
            </div>
            <div className={`flex flex-col leading-[1.2] whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'hidden' : 'hidden lg:flex'}`}>
              <span className="text-[12px] font-semibold tracking-wide text-ink">AI Speaking</span>
              <span className="text-[11px] tracking-wide text-steel">Coach</span>
            </div>
          </div>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors ${isCollapsed ? 'hidden' : 'hidden lg:flex'}`}
            aria-label="Toggle sidebar"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors ${isCollapsed ? 'flex' : 'flex lg:hidden'}`}
          aria-label="Toggle sidebar"
        >
          <CaretRight size={14} weight="bold" />
        </button>
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
      <div className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-center lg:justify-start p-3 lg:p-4 gap-0 lg:gap-3'} border-t border-hairline transition-colors group`}>
        {user ? (
          <Link href="/settings" className="flex items-center w-full cursor-pointer hover:bg-surface rounded p-1 -m-1 transition-colors">
            <div 
              className="w-8 h-8 rounded-full text-white flex items-center justify-center font-medium text-sm shrink-0"
              style={{ backgroundColor: user.user_metadata?.avatar_color || '#1A1A1A' }}
            >
              {user.user_metadata?.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className={`flex-1 flex-col leading-tight whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'hidden' : 'hidden lg:flex'} ml-3`}>
              <span className="text-[13px] font-medium text-ink truncate" title={user.user_metadata?.displayName || user.email}>
                {user.user_metadata?.displayName || user.email}
              </span>
              <span className="text-[11px] text-steel hover:text-charcoal text-left mt-0.5">
                Cài đặt
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/login" className="flex items-center w-full cursor-pointer hover:bg-surface rounded p-1 -m-1 transition-colors">
            <div className="w-8 h-8 rounded-full bg-surface border border-hairline text-stone flex items-center justify-center font-medium text-sm shrink-0">
              ?
            </div>
            <div className={`flex-1 flex-col leading-tight whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'hidden' : 'hidden lg:flex'} ml-3`}>
              <span className="text-[13px] font-medium text-ink">Khách</span>
              <span className="text-[11px] text-primary-600 font-medium">Đăng nhập</span>
            </div>
          </Link>
        )}
      </div>

    </aside>
  );
}
