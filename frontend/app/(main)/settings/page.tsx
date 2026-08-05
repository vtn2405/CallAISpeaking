import { Metadata } from 'next';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { DangerZone } from '@/components/settings/DangerZone';
import Toast from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Cài đặt',
  description: 'Quản lý tài khoản và cài đặt của bạn',
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-canvas p-4 md:p-8 lg:p-12 pb-24 overflow-y-auto w-full">
      <div className="max-w-[720px] mx-auto w-full">
        <div className="mb-8">
          <h1 className="font-space text-3xl font-medium tracking-tight text-ink mb-2">Cài đặt</h1>
          <p className="text-stone">Quản lý hồ sơ, tài khoản và lịch sử luyện tập của bạn.</p>
        </div>
        
        <div className="flex flex-col gap-8">
          <ProfileSettings />
          <AccountSettings />
          <DangerZone />
        </div>
      </div>
      <Toast />
    </div>
  );
}
