import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // No Tailwind — we use vanilla CSS from styles/globals.css
  // Images: allow external YouTube thumbnails in future
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
};

export default nextConfig;
