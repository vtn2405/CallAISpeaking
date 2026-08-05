'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { showToast } from '@/components/ui/Toast';
import { SettingsCard } from './SettingsCard';
import { Check } from '@phosphor-icons/react';

const AVATAR_COLORS = [
  '#F87171', // Red
  '#FB923C', // Orange
  '#FBBF24', // Amber
  '#34D399', // Emerald
  '#38BDF8', // Sky
  '#818CF8', // Indigo
  '#C084FC', // Purple
  '#F472B6', // Pink
];

export function ProfileSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.user_metadata) {
      if (user.user_metadata.displayName) {
        setDisplayName(user.user_metadata.displayName);
      }
      if (user.user_metadata.avatar_color) {
        setAvatarColor(user.user_metadata.avatar_color);
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: {
          displayName: displayName.trim() || null, // null if empty
          avatar_color: avatarColor,
        }
      });
      
      if (error) throw error;
      
      showToast('Đã lưu hồ sơ', { type: 'success' });
    } catch (err) {
      console.error('Error updating profile:', err);
      showToast('Lỗi khi lưu', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const displayInitial = displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <SettingsCard 
      title="Hồ sơ" 
      description="Quản lý thông tin cá nhân và hình đại diện của bạn."
    >
      <div className="flex flex-col gap-6">
        
        {/* Avatar Section */}
        <div className="flex items-start gap-5">
          <div 
            className="w-16 h-16 rounded-full text-white flex items-center justify-center font-medium text-2xl shrink-0 transition-colors duration-300"
            style={{ backgroundColor: avatarColor }}
          >
            {displayInitial}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-charcoal mb-2">Màu hình đại diện</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    avatarColor === color ? 'ring-2 ring-offset-2 ring-primary-600 scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                >
                  {avatarColor === color && <Check weight="bold" size={14} className="text-white drop-shadow-sm" />}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-steel mt-2">Chọn màu nền cho hình đại diện mặc định của bạn.</p>
          </div>
        </div>

        {/* Display Name Section */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-charcoal mb-1.5">
            Tên hiển thị
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user?.email || "Nhập tên của bạn..."}
            className="w-full px-3 py-2 bg-white border border-hairline rounded-md text-[14px] text-charcoal placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>
        
        {/* Save Button */}
        <div className="flex justify-end pt-2 border-t border-hairline mt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#315D9A] hover:bg-[#25497B] text-white rounded-md text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#315D9A] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </SettingsCard>
  );
}
