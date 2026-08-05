import type { NextConfig } from 'next';

const PIPELINE_URL = process.env.PIPECAT_SHIM_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  // No Tailwind — we use vanilla CSS from styles/globals.css
  // Images: allow external YouTube thumbnails in future
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },

  // Proxy /api/stt/* to the Python pipeline so browser never makes a
  // cross-origin request (avoids CORS preflight failure on multipart FormData).
  async rewrites() {
    return [
      {
        source: '/api/stt/:path*',
        destination: `${PIPELINE_URL}/api/stt/:path*`,
      },
    ];
  },
};

export default nextConfig;
