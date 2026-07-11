import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import '../styles/globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s – AI Speaking Coach',
    default: 'AI Speaking Coach',
  },
  description:
    'Luyện speaking IELTS bằng AI thông qua video YouTube. Trò chuyện bằng giọng nói, nhận phản hồi thông minh.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={geist.variable}>
      <body className="flex min-h-[100dvh] bg-offwhite text-zinc-900">
        <Sidebar />
        <div className="flex-1 ml-[220px] w-full min-w-0 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
