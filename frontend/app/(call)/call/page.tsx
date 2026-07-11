// Call page — Server Component shell inside (call) route group.
// Sidebar and navigation shell are absent — see (call)/layout.tsx.
import type { Metadata } from 'next';
import CallInterface from '@/components/features/CallInterface';
import Toast from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Hội thoại',
  description: 'Màn hình hội thoại giọng nói với AI theo ngữ cảnh video YouTube.',
};

interface Props {
  searchParams: Promise<{
    url?:       string;
    vid?:       string;
    sessionId?: string;
    mode?:      string;
  }>;
}

export default async function CallPage({ searchParams }: Props) {
  const params    = await searchParams;
  const videoUrl  = params.url       ? decodeURIComponent(params.url) : null;
  const videoId   = params.vid       ?? null;
  const sessionId = params.sessionId ?? null;
  const mode      = params.mode === 'beginner' ? 'beginner' : 'video_chat';

  return (
    <>
      <CallInterface
        videoUrl={videoUrl}
        videoId={videoId}
        sessionId={sessionId}
        mode={mode}
      />
      <Toast />
    </>
  );
}
