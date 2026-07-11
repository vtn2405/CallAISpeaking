# API Routes — Phase 1

## 1. Create video context
**POST** `/api/videos/context`

### Input
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

### Output
```json
{
  "videoId": "vid_123",
  "youtubeId": "abc123",
  "title": "TED Talk: Power of Habits",
  "status": "READY",
  "summaryReady": true,
  "chunkCount": 24
}
```

### Flow
1. Parse YouTube URL.
2. Extract subtitle transcript.
3. Build summary.
4. Chunk entire transcript using fixed-time chunking.
5. Store minimal context in DB.

## 2. Start speaking session
**POST** `/api/sessions`

### Input
```json
{
  "videoId": "vid_123"
}
```

### Output
```json
{
  "sessionId": "ses_123",
  "status": "READY"
}
```

### Flow
- Create session record.
- Prepare latest summary and top chunks.
- Return session for voice UI.

## 3. Send user text turn
**POST** `/api/sessions/{sessionId}/turns`

### Input
```json
{
  "text": "I think this video is about habits..."
}
```

### Output
```json
{
  "assistantText": "Yes, and the main idea is...",
  "usedChunkIds": ["chk_1", "chk_2"]
}
```

### Flow
1. Load session and video context.
2. Retrieve relevant chunks.
3. Build prompt with summary + chunks + recent turns.
4. Generate short reply.
5. Store both user and assistant messages.

## 4. Stream audio input
**WS** `/ws/sessions/{sessionId}/audio`

### Purpose
- Receive mic audio from frontend.
- Push STT partial and final results.
- Support interruption when user speaks while AI is talking.

### Events
- `audio.chunk`
- `stt.partial`
- `stt.final`
- `assistant.start`
- `assistant.stop`
- `barge.in`

## 5. Get session state
**GET** `/api/sessions/{sessionId}`

### Output
```json
{
  "sessionId": "ses_123",
  "status": "ACTIVE",
  "videoTitle": "TED Talk: Power of Habits",
  "messageCount": 8
}
```

## 6. End session
**POST** `/api/sessions/{sessionId}/end`

### Flow
- Mark session as ended.
- Persist minimal metadata.
- Release in-memory buffers.
- Keep summary/chunks only as long as TTL allows.
