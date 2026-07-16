import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const videoUrl = body.videoUrl ?? '';

    // Basic regex for youtube URLs (v=... or youtu.be/... or /shorts/...)
    const match = videoUrl.match(/(?:v=|\/shorts\/|\/)([0-9A-Za-z_-]{11})/);
    if (!match) {
      return NextResponse.json({ error: 'Link YouTube không hợp lệ' }, { status: 400 });
    }

    const videoId = match[1];
    
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      signal: AbortSignal.timeout(3000)
    });
    
    if (!oembedRes.ok) {
      if (oembedRes.status === 404 || oembedRes.status === 401 || oembedRes.status === 403 || oembedRes.status === 400) {
        return NextResponse.json({ error: 'Video không tồn tại hoặc ở chế độ riêng tư' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Không thể xác thực video lúc này' }, { status: oembedRes.status });
    }
    
    const data = await oembedRes.json();
    
    // Heuristics to detect music videos
    const title = data.title || '';
    const author = data.author_name || '';
    const isMusicVideo = 
      author.endsWith('VEVO') || 
      author.endsWith(' - Topic') ||
      /official (music )?video/i.test(title) ||
      /\bmv\b/i.test(title) ||
      /\blyrics?\b/i.test(title) ||
      /\bft\./i.test(title) ||
      /\bfeat\.\b/i.test(title);

    if (isMusicVideo) {
      return NextResponse.json({ error: 'Video âm nhạc (Music Video) không được hỗ trợ' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, videoId });
  } catch (err) {
    console.error('[videos/verify] Error:', err);
    return NextResponse.json({ error: 'Lỗi kết nối khi xác thực video' }, { status: 500 });
  }
}
