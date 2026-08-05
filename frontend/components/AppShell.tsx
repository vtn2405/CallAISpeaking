'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileTopBar from '@/components/MobileTopBar';
import MobileDrawer from '@/components/MobileDrawer';
import LockedNavModal from '@/components/ui/LockedNavModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <Sidebar setShowLockModal={setShowLockModal} />
      
      {/* Mobile Drawer */}
      <MobileDrawer 
        isOpen={isMobileDrawerOpen} 
        onClose={() => setIsMobileDrawerOpen(false)} 
        setShowLockModal={setShowLockModal}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Bar (hidden on desktop) */}
        <MobileTopBar onOpenDrawer={() => setIsMobileDrawerOpen(true)} />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col relative z-0">
          {children}
        </main>
      </div>

      {showLockModal && <LockedNavModal onClose={() => setShowLockModal(false)} />}
    </>
  );
}
