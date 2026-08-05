'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/ui/Toast';
import { SettingsCard } from './SettingsCard';

export function AccountSettings() {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Check if user is logged in with email
  const isEmailProvider = user?.app_metadata?.providers?.includes('email');
  const isGoogleProvider = user?.app_metadata?.providers?.includes('google');

  const handleSavePassword = async () => {
    if (!password.trim()) return;
    setIsSaving(true);
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      showToast('Đã cập nhật mật khẩu', { type: 'success' });
      setPassword(''); // clear after success
    } catch (err) {
      console.error('Error updating password:', err);
      showToast('Lỗi khi đổi mật khẩu', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard 
      title="Tài khoản & Bảo mật" 
      description="Quản lý phương thức đăng nhập và bảo mật tài khoản."
    >
      <div className="flex flex-col gap-6">
        
        {/* Linked Accounts Status */}
        <div>
          <h3 className="text-[13px] font-medium text-charcoal mb-3 uppercase tracking-wider">Trạng thái liên kết</h3>
          <div className="flex flex-col gap-3">
            {isEmailProvider && (
              <div className="flex items-center justify-between p-3 rounded-md bg-surface border border-hairline">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white border border-hairline flex items-center justify-center text-charcoal font-bold text-[14px]">
                    @
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-charcoal">Email & Mật khẩu</div>
                    <div className="text-[12px] text-steel">{user?.email}</div>
                  </div>
                </div>
                <div className="text-[12px] text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                  Đã liên kết
                </div>
              </div>
            )}
            
            {isGoogleProvider && (
              <div className="flex items-center justify-between p-3 rounded-md bg-surface border border-hairline">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white border border-hairline flex items-center justify-center text-charcoal font-bold text-[14px]">
                    G
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-charcoal">Google</div>
                    <div className="text-[12px] text-steel">Đăng nhập qua Google</div>
                  </div>
                </div>
                <div className="text-[12px] text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                  Đã liên kết
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password (Only if email provider) */}
        {isEmailProvider && (
          <div className="pt-4 border-t border-hairline">
            <h3 className="text-[13px] font-medium text-charcoal mb-3 uppercase tracking-wider">Đổi mật khẩu</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-charcoal mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3 py-2 bg-white border border-hairline rounded-md text-[14px] text-charcoal placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleSavePassword}
                  disabled={isSaving || !password.trim()}
                  className="px-4 py-2 bg-[#315D9A] hover:bg-[#25497B] text-white rounded-md text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#315D9A] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu mật khẩu'}
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </SettingsCard>
  );
}
