import { 
  SquaresFour, 
  MicrophoneStage, 
  PenNib, 
  Books, 
  Info,
  SignOut,
} from '@phosphor-icons/react';

export const MAIN_LINKS = [
  { href: '/dashboard', label: 'Trang chủ', icon: SquaresFour, locked: false },
  { href: '/practice', label: 'Luyện tập', icon: MicrophoneStage, locked: false },
  { href: '/mock-test', label: 'Thi thử', icon: PenNib, locked: true },
  { href: '/history', label: 'Lịch sử', icon: Books, locked: false },
];

export const SECONDARY_LINKS = [
  { href: '/guide', label: 'Hướng dẫn', icon: Info, locked: false },
  { href: '#sign-out', label: 'Đăng xuất', icon: SignOut, locked: false, isAction: true },
];
