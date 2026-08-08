'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MAIN_LINKS, SECONDARY_LINKS } from '@/config/navigation';
import { X, LockKey } from '@phosphor-icons/react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  setShowLockModal: (show: boolean) => void;
}

export default function MobileDrawer({ isOpen, onClose, setShowLockModal }: MobileDrawerProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  
  // Close on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Basic focus trap
      if (e.key === 'Tab') {
        const focusableElements = drawerRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      }
    };

    // Body scroll lock
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Initial focus
    setTimeout(() => {
      const closeButton = drawerRef.current?.querySelector('button');
      if (closeButton) closeButton.focus();
    }, 100);

    return () => {
      document.body.style.overflow = originalStyle;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const renderNavLink = (link: typeof MAIN_LINKS[0]) => {
    const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
    const Icon = link.icon;

    const content = (
      <>
        {isActive && (
          <motion.div
            layoutId="drawer-active"
            className="absolute inset-0 rounded-[6px] bg-surface border border-hairline"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
        
        <span className={`relative z-10 w-5 flex items-center justify-center shrink-0 ${isActive ? 'text-charcoal' : link.locked ? 'text-muted' : 'text-stone group-hover:text-charcoal'}`}>
          <Icon weight={isActive ? 'fill' : 'regular'} size={16} />
        </span>
        
        <span className={`relative z-10 text-[13px] whitespace-nowrap overflow-hidden transition-all duration-300 w-auto opacity-100 ml-0 ${isActive ? 'text-charcoal font-medium' : link.locked ? 'text-muted' : 'text-steel font-normal group-hover:text-charcoal'}`}>
          {link.label}
        </span>
        
        {link.locked && (
          <span className="relative z-10 ml-auto text-zinc-400">
            <LockKey weight="bold" size={14} />
          </span>
        )}
      </>
    );

    const className = "relative flex items-center gap-2.5 px-2.5 justify-start w-auto h-auto mx-0 py-1.5 rounded-[6px] transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-100";

    if (link.locked) {
      return (
        <button
          key={link.href}
          className={className}
          onClick={() => {
            onClose();
            setShowLockModal(true);
          }}
        >
          {content}
        </button>
      );
    }

    return (
      <Link key={link.href} href={link.href} className={className}>
        {content}
      </Link>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/20 z-40"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            ref={drawerRef}
            initial={{ x: shouldReduceMotion ? 0 : '-100%', opacity: shouldReduceMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: shouldReduceMotion ? 0 : '-100%', opacity: shouldReduceMotion ? 0 : 1 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            className="fixed top-0 left-0 h-[100dvh] w-[280px] bg-canvas z-40 flex flex-col shadow-2xl overflow-y-auto"
            style={{ paddingLeft: 'env(safe-area-inset-left)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-4 border-b border-hairline">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-[8px] overflow-hidden shrink-0">
                  <Image src="/logo.png" alt="Logo" fill className="object-cover" sizes="32px" priority />
                </div>
                <div className="flex flex-col leading-[1.2]">
                  <span className="text-[12px] font-semibold tracking-wide text-ink">AI Speaking</span>
                  <span className="text-[11px] tracking-wide text-steel">Coach</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100"
                aria-label="Close menu"
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
              {MAIN_LINKS.map(renderNavLink)}
            </nav>

            {/* Secondary Navigation */}
            <nav className="px-3 pb-3 flex flex-col gap-1">
              {SECONDARY_LINKS.map(renderNavLink)}
            </nav>

            {/* User section */}
            <div className="flex items-center justify-start p-4 gap-3 border-t border-hairline mt-auto group transition-colors hover:bg-surface">
              {user ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center font-medium text-sm shrink-0">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 flex-col leading-tight whitespace-nowrap overflow-hidden transition-all duration-300 flex">
                    <span className="text-[13px] font-medium text-ink truncate" title={user.email}>{user.email}</span>
                    <button 
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                      }}
                      className="text-[11px] text-steel hover:text-charcoal text-left mt-0.5"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </>
              ) : (
                <Link href="/login" onClick={onClose} className="flex items-center w-full">
                  <div className="w-8 h-8 rounded-full bg-surface border border-hairline text-stone flex items-center justify-center font-medium text-sm shrink-0">
                    ?
                  </div>
                  <div className="flex-1 flex-col leading-tight whitespace-nowrap overflow-hidden transition-all duration-300 flex ml-3">
                    <span className="text-[13px] font-medium text-ink">Khách</span>
                    <span className="text-[11px] text-primary-600 font-medium">Đăng nhập</span>
                  </div>
                </Link>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
