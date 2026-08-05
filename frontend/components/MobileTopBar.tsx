'use client';

import Image from 'next/image';
import { List, User } from '@phosphor-icons/react';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';

interface MobileTopBarProps {
  onOpenDrawer: () => void;
}

export default function MobileTopBar({ onOpenDrawer }: MobileTopBarProps) {
  const { user } = useAuth();

  return (
    <div 
      className="md:hidden sticky top-0 z-10 w-full bg-canvas/80 backdrop-blur-md border-b border-hairline flex items-center justify-between px-4 py-3"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenDrawer}
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-md hover:bg-surface text-stone hover:text-charcoal transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100"
          aria-label="Open menu"
          aria-expanded="false"
          aria-controls="mobile-drawer"
        >
          <List size={24} weight="bold" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-[6px] overflow-hidden shrink-0">
            <Image src="/logo.png" alt="Logo" fill className="object-cover" sizes="28px" priority />
          </div>
          <span className="text-[14px] font-semibold tracking-wide text-ink">AI Speaking</span>
        </div>
      </div>
      
      {/* Account Avatar */}
      {user ? (
        <button 
          onClick={onOpenDrawer}
          className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center font-medium text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:ring-offset-2"
          aria-label="Tài khoản của tôi"
        >
          {user.email?.[0].toUpperCase() || 'U'}
        </button>
      ) : (
        <Link 
          href="/login"
          className="w-8 h-8 rounded-full bg-surface border border-hairline text-stone flex items-center justify-center font-medium text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:ring-offset-2 hover:bg-surface-soft transition-colors"
          aria-label="Đăng nhập"
        >
          <User size={16} weight="bold" />
        </Link>
      )}
    </div>
  );
}
