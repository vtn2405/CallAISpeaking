import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    <html lang="vi" className={inter.variable}>
      <body>
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
