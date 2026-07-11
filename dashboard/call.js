/* =============================================
   AI Speaking Coach – Call Page Logic (Phase 1)
   ============================================= */

// ---- State ----
let isMicOn     = false;
let isMuted     = false;
let isAISpeaking = false;
let sessionTimer = null;
let timerSeconds = 0;
let vadInterval  = null;
let streamRef    = null;   // MediaStream placeholder
const VAD_BAR_COUNT = 18;

// ---- URL params ----
const params    = new URLSearchParams(window.location.search);
const videoUrl  = params.get('url')   ? decodeURIComponent(params.get('url')) : null;
const videoIdP  = params.get('vid')   || null;
const sessionId = params.get('sessionId') || null;

// ---- Mock AI responses (Phase 1 demo) ----
const AI_RESPONSES = [
  "That's a great point! In the video, the speaker mentions how small habits can compound over time. What do you think about starting with just 2 minutes a day?",
  "Interesting! The video explains this concept really well. Can you tell me more about your own experience with this topic?",
  "Exactly! The key idea here is consistency. The video talks about how our brain forms neural pathways through repetition. Have you tried any of these techniques yourself?",
  "Good observation! I think what's most fascinating is how this applies to everyday life. What surprised you most in the video?",
  "You're getting better at expressing these ideas! Let's go deeper — what does the speaker say about the role of environment in shaping behavior?",
  "Nice! Your English is flowing really naturally. Let's talk about the part where they discuss rewards and motivation. What's your take on that?",
];

let responseIndex = 0;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initVideoInfo();
  initVAD();
  startTimer();
  initTranscript();
  setupKeyboardShortcuts();
  initSuggestedPrompts();
});

// ---- Video info ----
function initVideoInfo() {
  const titleEl = document.getElementById('video-title');
  const metaEl  = document.getElementById('video-meta');
  const ytLink  = document.getElementById('video-yt-link');

  if (sessionId) {
    // Returning to an old session
    const sessionMap = {
      ses_001: { title: 'Review: Modern Architecture', meta: '24 đoạn · ~18 phút' },
      ses_002: { title: 'Travel Vlog: Tokyo Night',    meta: '16 đoạn · ~12 phút' },
      ses_003: { title: 'TED Talk: Power of Habits',   meta: '28 đoạn · ~22 phút' },
      ses_004: { title: 'Science Explained: Black Holes', meta: '20 đoạn · ~15 phút' },
    };
    const info = sessionMap[sessionId] || { title: 'Video session', meta: 'Đã lưu' };
    titleEl.textContent = info.title;
    metaEl.textContent  = info.meta;
    if (ytLink) ytLink.href = '#';
    updateSuggestedPrompts(info.title);
  } else if (videoUrl) {
    // New session from dashboard
    // In production: call POST /api/videos/context → POST /api/sessions
    // Here we demo with a derived title
    const ytId = videoIdP || 'demo';
    titleEl.textContent = 'Đang phân tích video…';
    metaEl.textContent  = 'Chuẩn bị ngữ cảnh AI';
    if (ytLink) ytLink.href = videoUrl;

    // Simulate API returning video info
    setTimeout(() => {
      titleEl.textContent = 'YouTube Video – ' + (ytId.slice(0, 8) || 'custom');
      metaEl.textContent  = 'Sẵn sàng · transcript đã tải';
      showToast('✅ Video đã sẵn sàng! Bắt đầu nói nhé.', 'success');
      updateSuggestedPrompts('video này');
    }, 1800);
  } else {
    titleEl.textContent = 'Demo Session';
    metaEl.textContent  = 'Không có video URL';
  }
}

// ---- VAD visualizer (mock) ----
function initVAD() {
  const bar = document.getElementById('vad-bar');
  if (!bar) return;
  bar.innerHTML = Array.from({ length: VAD_BAR_COUNT }, (_, i) =>
    `<div class="vad-bar-item" id="vb-${i}" style="height:4px"></div>`
  ).join('');
}

function animateVAD(speaking) {
  for (let i = 0; i < VAD_BAR_COUNT; i++) {
    const el = document.getElementById(`vb-${i}`);
    if (!el) continue;
    if (speaking) {
      const h = 6 + Math.random() * 30;
      el.style.height = h + 'px';
      el.classList.toggle('speaking', true);
      el.classList.remove('active');
    } else if (isMicOn) {
      const h = 4 + Math.random() * 10;
      el.style.height = h + 'px';
      el.classList.add('active');
      el.classList.remove('speaking');
    } else {
      el.style.height = '4px';
      el.classList.remove('active', 'speaking');
    }
  }
}

// ---- Timer ----
function startTimer() {
  sessionTimer = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    const el = document.getElementById('call-timer');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

// ---- Transcript init ----
function initTranscript() {
  // Show intro message with slight delay
  setTimeout(() => {
    document.getElementById('intro-msg')?.classList.add('visible');
  }, 500);
}

// ---- Mic toggle ----
function toggleMic() {
  if (isMuted) {
    showToast('🔇 Mic đang bị tắt tiếng.', '', 2000);
    return;
  }

  isMicOn = !isMicOn;
  const micBtn   = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');
  const orbStatus = document.getElementById('orb-status');
  const vadLabel  = document.getElementById('vad-label');

  if (isMicOn) {
    micBtn?.classList.add('recording');
    if (micLabel) micLabel.textContent = 'Đang lắng nghe…';
    if (orbStatus) orbStatus.textContent = 'Đang nghe…';
    if (vadLabel) vadLabel.textContent = 'Đang nhận giọng nói';

    // Start VAD animation
    vadInterval = setInterval(() => animateVAD(true), 100);

    // Simulate STT → AI response after 3 seconds
    setTimeout(() => {
      if (!isMicOn) return;
      stopListening();
      const userText = getSimulatedUserText();
      appendMessage('user', userText);
      simulateAIResponse();
    }, 3000 + Math.random() * 2000);

  } else {
    stopListening();
  }
}

function stopListening() {
  isMicOn = false;
  clearInterval(vadInterval);
  const micBtn   = document.getElementById('mic-btn');
  const micLabel = document.getElementById('mic-label');

  micBtn?.classList.remove('recording');
  if (micLabel) micLabel.textContent = 'Giữ để nói';
  animateVAD(false);
  document.getElementById('vad-label').textContent = 'Chờ giọng nói…';
}

function getSimulatedUserText() {
  const phrases = [
    "I think the main idea of the video is about building good habits gradually.",
    "The speaker mentions that environment plays a huge role in our behavior.",
    "I find it interesting how small changes can lead to big results over time.",
    "Can you tell me more about the 2-minute rule mentioned in the video?",
    "I agree that consistency is more important than intensity when forming habits.",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// ---- Simulate AI response ----
function simulateAIResponse() {
  const typingEl = document.getElementById('typing-indicator');
  const orbEl    = document.getElementById('ai-orb');
  const orbStatus = document.getElementById('orb-status');

  // Show typing
  if (typingEl) typingEl.style.display = 'flex';
  if (orbStatus) orbStatus.textContent = 'AI đang suy nghĩ…';
  scrollTranscript();

  isAISpeaking = true;

  setTimeout(() => {
    if (typingEl) typingEl.style.display = 'none';
    const response = AI_RESPONSES[responseIndex % AI_RESPONSES.length];
    responseIndex++;
    appendMessage('ai', response);

    // Orb speaking animation
    orbEl?.classList.add('speaking');
    if (orbStatus) orbStatus.textContent = 'AI đang nói…';

    // Simulate TTS duration
    const speakDuration = 1200 + response.length * 40;
    setTimeout(() => {
      orbEl?.classList.remove('speaking');
      if (orbStatus) orbStatus.textContent = 'Nhấn mic để trả lời';
      isAISpeaking = false;
    }, speakDuration);

  }, 1500 + Math.random() * 800);
}

// ---- Append message ----
function appendMessage(sender, text) {
  const messagesEl = document.getElementById('transcript-messages');
  if (!messagesEl) return;

  const isUser   = sender === 'user';
  const timeStr  = getTimeStr();
  const avatarClass = isUser ? 'user-msg-avatar' : 'ai-avatar';
  const bubbleClass = isUser ? 'user-bubble'      : 'ai-bubble';
  const initial     = isUser ? 'M'                : 'AI';
  const rowClass    = isUser ? 'msg-row msg-user' : 'msg-row msg-ai';

  const div = document.createElement('div');
  div.className = rowClass;
  div.innerHTML = `
    <div class="msg-avatar ${avatarClass}">${initial}</div>
    <div class="msg-bubble ${bubbleClass}">
      <p>${escapeHtml(text)}</p>
      <span class="msg-time">${timeStr}</span>
    </div>
  `;
  messagesEl.appendChild(div);
  scrollTranscript();
}

function scrollTranscript() {
  const scrollEl = document.getElementById('transcript-scroll');
  if (scrollEl) setTimeout(() => { scrollEl.scrollTop = scrollEl.scrollHeight; }, 50);
}

// ---- Send prompt chip ----
function sendPrompt(btn) {
  if (isAISpeaking || isMicOn) return;
  const text = btn.textContent;
  appendMessage('user', text);
  simulateAIResponse();
}

// ---- Suggested prompts ----
function initSuggestedPrompts() {}

function updateSuggestedPrompts(topic) {
  const chips = document.getElementById('prompt-chips');
  if (!chips) return;
  chips.innerHTML = [
    `What's the main idea of ${topic}?`,
    `Can you explain the key concept?`,
    `What's your opinion on this?`,
    `Tell me more about the examples.`,
  ].map(t => `<button class="prompt-chip" onclick="sendPrompt(this)">${t}</button>`).join('');
}

// ---- Request hint ----
function requestHint() {
  if (isAISpeaking) return;
  showToast('💡 Đang tạo gợi ý câu hỏi…');
  setTimeout(() => {
    const hints = [
      "Try asking: 'What is the main argument of the video?'",
      "You could say: 'I found the part about X really interesting.'",
      "Ask: 'Could you explain the concept of Y in simpler terms?'",
    ];
    const hint = hints[Math.floor(Math.random() * hints.length)];
    appendMessage('ai', '💡 Gợi ý: ' + hint);
  }, 800);
}

// ---- Change topic ----
function changeTopic() {
  if (isAISpeaking) return;
  appendMessage('ai', "Sure! Let's talk about a different aspect of the video. What part interested you the most so far?");
}

// ---- Clear transcript ----
function clearTranscript() {
  const msgs = document.getElementById('transcript-messages');
  if (!msgs) return;
  if (!confirm('Xóa toàn bộ lịch sử hội thoại?')) return;
  msgs.innerHTML = '';
  appendMessage('ai', 'Lịch sử đã được xóa. Hãy tiếp tục luyện tập! 🎙️');
}

// ---- Mute toggle ----
function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById('mute-btn');
  const label = document.getElementById('mic-label');
  const micBtn = document.getElementById('mic-btn');

  if (isMuted) {
    btn?.classList.add('active');
    micBtn?.classList.add('muted');
    if (label) label.textContent = 'Mic đang tắt';
    showToast('🔇 Đã tắt mic', '', 2000);
    if (isMicOn) stopListening();
  } else {
    btn?.classList.remove('active');
    micBtn?.classList.remove('muted');
    if (label) label.textContent = 'Giữ để nói';
    showToast('🎙️ Mic đã bật lại', '', 2000);
  }
}

// ---- End session ----
function confirmEnd() {
  document.getElementById('end-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEndModal() {
  document.getElementById('end-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function endSession() {
  clearInterval(sessionTimer);
  clearInterval(vadInterval);
  showToast('✅ Buổi luyện đã lưu!', 'success', 2000);
  setTimeout(() => { window.location.href = 'index.html'; }, 1200);
}

// ---- Keyboard shortcuts ----
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEndModal();
    // Space bar → toggle mic (only when not typing in an input)
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      toggleMic();
    }
  });
}

// ---- Helpers ----
function getTimeStr() {
  const now = new Date();
  return now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ---- Toast ----
let toastTimer = null;
const toast = document.getElementById('toast');

function showToast(msg, type = '', duration = 2800) {
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}
