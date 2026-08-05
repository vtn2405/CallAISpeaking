import type { Metadata } from 'next';
import { Geist, Space_Grotesk } from 'next/font/google';
import '../styles/globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | AI Speaking Coach',
    default: 'AI Speaking Coach | Luyện giao tiếp tiếng Anh mọi lúc',
  },
  description:
    'Luyện giao tiếp tiếng Anh mọi lúc cùng AI Speaking Coach. Trò chuyện bằng giọng nói qua video YouTube, nhận phản hồi thông minh tức thì.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${geist.variable} ${spaceGrotesk.variable}`} data-scroll-behavior="smooth">
      <body className="flex min-h-[100dvh] bg-bg text-ink">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
