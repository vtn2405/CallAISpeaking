// Server Component — no interactivity needed here.
// Active state is derived per-page using Next.js `usePathname` inside
// the client wrapper NavItem, keeping the outer Sidebar as a Server Component.
import Image from 'next/image';
import Link from 'next/link';
import NavItem from './NavItem';

const NAV_LINKS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity=".9" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity=".5" />
      </svg>
    ),
    locked: false,
  },
  {
    href: '/practice',
    label: 'Practice',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    ),
    locked: false,
  },
  {
    href: '/mock-test',
    label: 'Mock test',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    locked: true, // Phase 2
  },
  {
    href: '/library',
    label: 'Library',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    locked: false,
  },
  {
    href: '/guide',
    label: 'Hướng dẫn',
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v1m0 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    locked: false,
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Image
          src="/logo.png"
          alt="AI Speaking Coach Logo"
          width={38}
          height={38}
          className="logo-img"
          priority
        />
        <div className="logo-text">
          <span className="logo-title">AI SPEAKING</span>
          <span className="logo-subtitle">COACH</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_LINKS.map((link) => (
          <NavItem key={link.href} {...link} />
        ))}
      </nav>

      {/* User section */}
      <div className="sidebar-user" role="button" tabIndex={0} aria-label="Account settings">
        <div className="user-avatar" aria-hidden="true">M</div>
        <div className="user-info">
          <span className="user-name">Minh</span>
          <span className="user-role">Tài khoản của tôi</span>
        </div>
        <span className="user-chevron" aria-hidden="true">›</span>
      </div>
    </aside>
  );
}
