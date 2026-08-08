'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/ui/Toast';
import { SettingsCard } from './SettingsCard';
import { clearAllHistory } from '@/lib/historyRepository';
import { getGuestId } from '@/lib/identity';
import { Warning, Trash } from '@phosphor-icons/react';

export function DangerZone() {
  const { user } = useAuth();
  const [isClearing, setIsClearing] = useState(false);
  
  // Modal state for delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClearHistory = async () => {
    if (!confirm('Bạn có chắc chắn muốn xoá toàn bộ lịch sử luyện tập? Hành động này không thể hoàn tác.')) {
      return;
    }
    
    setIsClearing(true);
    try {
      // Clear history using either the user's ID or the guest ID if not logged in
      const targetId = user?.id || getGuestId();
      if (targetId) {
        await clearAllHistory(targetId);
        showToast('Đã xoá lịch sử luyện tập', { type: 'success' });
      }
    } catch (err) {
      console.error('Error clearing history:', err);
      showToast('Lỗi khi xoá lịch sử', { type: 'error' });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmEmail !== user?.email) {
      showToast('Email xác nhận không khớp', { type: 'error' });
      return;
    }
    
    setIsDeleting(true);
    try {
      const supabase = createClient();
      
      // Note: Calling delete_user RPC. 
      // This requires you to create a Postgres function in Supabase.
      // If it doesn't exist, we will catch the error and fallback to just signing out.
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        console.warn('RPC delete_user failed or not found. Falling back to sign out.', error);
        // Fallback: Clear local data and sign out if RPC fails
      }
      
      const targetId = user?.id || getGuestId();
      if (targetId) {
        await clearAllHistory(targetId);
      }
      
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error('Error deleting account:', err);
      showToast('Lỗi khi xoá tài khoản', { type: 'error' });
      setIsDeleting(false);
    }
  };

  return (
    <SettingsCard 
      title="Vùng nguy hiểm" 
      isDangerZone
    >
      <div className="flex flex-col gap-5">
        
        {/* Clear History */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-medium text-charcoal">Xoá toàn bộ lịch sử luyện tập</h3>
            <p className="text-[12px] text-steel mt-1">
              Xoá vĩnh viễn tất cả các buổi luyện tập và từ vựng đã lưu trên thiết bị này.
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            disabled={isClearing}
            className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-md text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-70 disabled:cursor-not-allowed shrink-0 ml-4"
          >
            {isClearing ? 'Đang xoá...' : 'Xoá lịch sử'}
          </button>
        </div>

        {/* Delete Account (Only if logged in) */}
        {user && (
          <div className="pt-5 border-t border-red-100 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-medium text-red-600">Xoá tài khoản</h3>
              <p className="text-[12px] text-steel mt-1 max-w-md">
                Xoá vĩnh viễn tài khoản của bạn cùng với tất cả dữ liệu liên quan. Hành động này không thể hoàn tác.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 shrink-0 ml-4"
            >
              Xoá tài khoản
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <Warning size={24} weight="bold" />
              </div>
              <h2 className="text-xl font-space font-medium text-charcoal mb-2">
                Xoá tài khoản?
              </h2>
              <p className="text-[13px] text-steel mb-6 leading-relaxed">
                Hành động này sẽ xoá vĩnh viễn tài khoản của bạn và mọi dữ liệu liên quan. Vui lòng gõ lại email <strong>{user?.email}</strong> để xác nhận.
              </p>
              
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email}
                className="w-full px-3 py-2 bg-white border border-hairline rounded-md text-[14px] text-charcoal placeholder:text-muted focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors mb-6"
              />
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-white border border-hairline text-stone hover:bg-surface hover:text-charcoal rounded-md text-[13px] font-medium transition-colors disabled:opacity-70"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || confirmEmail !== user?.email}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Đang xoá...' : (
                    <>
                      <Trash weight="bold" /> Xoá tài khoản
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
