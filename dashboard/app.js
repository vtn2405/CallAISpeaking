/* =============================================
   AI Speaking Coach – App Logic (Phase 1)
   ============================================= */

// ---- Mock data ----
const MOCK_SESSIONS = [
  {
    id: 'ses_001',
    title: 'Review: Modern Architecture',
    time: '12 PHÚT TRƯỚC',
    tag: 'Hội thoại tự do',
    thumbColor: ['#4338ca', '#06b6d4'],
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="2" stroke="white" stroke-width="1.8"/><path d="M17 9l5-3v12l-5-3" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'ses_002',
    title: 'Travel Vlog: Tokyo Night',
    time: 'HÔM QUA',
    tag: 'Hội thoại tự do',
    thumbColor: ['#0891b2', '#6366f1'],
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="2" stroke="white" stroke-width="1.8"/><path d="M17 9l5-3v12l-5-3" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'ses_003',
    title: 'TED Talk: Power of Habits',
    time: '2 NGÀY TRƯỚC',
    tag: 'Hội thoại tự do',
    thumbColor: ['#7c3aed', '#2563eb'],
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="2" stroke="white" stroke-width="1.8"/><path d="M17 9l5-3v12l-5-3" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'ses_004',
    title: 'Science Explained: Black Holes',
    time: '3 NGÀY TRƯỚC',
    tag: 'Hội thoại tự do',
    thumbColor: ['#0f766e', '#0891b2'],
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="2" y="7" width="15" height="10" rx="2" stroke="white" stroke-width="1.8"/><path d="M17 9l5-3v12l-5-3" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  },
];

// ---- DOM refs ----
const youtubeInput   = document.getElementById('youtube-url');
const startBtn       = document.getElementById('start-btn');
const startBtnText   = document.getElementById('start-btn-text');
const urlClearBtn    = document.getElementById('url-clear-btn');
const urlInputGroup  = document.getElementById('url-input-group');
const processingState = document.getElementById('processing-state');
const sessionList    = document.getElementById('session-list');
const toast          = document.getElementById('toast');
const lockModal      = document.getElementById('lock-modal');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  renderSessions();
  setupInputListeners();
  setupLockedFeatures();
  setupLockedNavItem();
  animateStatsOnLoad();
});

// ---- Render recent sessions ----
function renderSessions() {
  if (!sessionList) return;

  if (MOCK_SESSIONS.length === 0) {
    sessionList.innerHTML = `
      <div class="session-empty">
        <p>Chưa có buổi luyện nào.</p>
        <p style="margin-top:4px;font-size:12px;">Hãy dán link YouTube để bắt đầu!</p>
      </div>`;
    return;
  }

  sessionList.innerHTML = MOCK_SESSIONS.map((s, i) => `
    <div
      class="session-item"
      id="session-${s.id}"
      role="button"
      tabindex="0"
      onclick="openSession('${s.id}')"
      onkeydown="if(event.key==='Enter') openSession('${s.id}')"
      style="animation: slide-up ${0.08 + i * 0.06}s ease both; animation-delay:${i * 0.05}s;"
    >
      <div class="session-thumb" style="background: linear-gradient(135deg, ${s.thumbColor[0]}, ${s.thumbColor[1]})">
        ${s.icon}
      </div>
      <div class="session-meta">
        <div class="session-title" title="${s.title}">${s.title}</div>
        <div class="session-time">${s.time}</div>
      </div>
      <span class="session-tag">${s.tag}</span>
    </div>
  `).join('');
}

// ---- Input handling ----
function setupInputListeners() {
  if (!youtubeInput) return;

  youtubeInput.addEventListener('input', () => {
    urlClearBtn.style.display = youtubeInput.value ? 'block' : 'none';
  });

  urlClearBtn.addEventListener('click', () => {
    youtubeInput.value = '';
    urlClearBtn.style.display = 'none';
    youtubeInput.focus();
  });

  youtubeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleStartSession();
  });

  // Paste validation
  youtubeInput.addEventListener('paste', () => {
    setTimeout(() => {
      const val = youtubeInput.value.trim();
      if (val && !isValidYouTubeUrl(val)) {
        showToast('⚠️ URL có vẻ không phải YouTube. Vui lòng kiểm tra lại.', 'error', 3000);
      }
    }, 50);
  });
}

// ---- Locked feature cards ----
function setupLockedFeatures() {
  const locked = document.querySelectorAll('.feature-card-locked');
  locked.forEach(card => {
    card.addEventListener('click', () => openLockModal());
    card.addEventListener('keydown', (e) => { if(e.key==='Enter') openLockModal(); });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Tính năng Phase 2 – chưa mở khoá');
  });
}

function setupLockedNavItem() {
  const lockedNav = document.getElementById('nav-mocktest');
  if (lockedNav) {
    lockedNav.addEventListener('click', (e) => {
      e.preventDefault();
      openLockModal();
    });
  }
}

// ---- URL validation ----
function isValidYouTubeUrl(url) {
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url);
}

function extractYouTubeId(url) {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /\/shorts\/([^?&#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ---- Start session flow ----
async function handleStartSession() {
  const url = youtubeInput?.value.trim();

  if (!url) {
    youtubeInput?.focus();
    showToast('⚠️ Vui lòng dán link YouTube trước.', 'error');
    youtubeInput?.classList.add('shake');
    setTimeout(() => youtubeInput?.classList.remove('shake'), 500);
    return;
  }

  if (!isValidYouTubeUrl(url)) {
    showToast('❌ Link không hợp lệ. Vui lòng dán đúng link YouTube.', 'error');
    return;
  }

  // Show processing state
  urlInputGroup.style.display = 'none';
  processingState.style.display = 'flex';
  startBtn.disabled = true;

  // Simulate processing steps
  const steps = [
    { stepId: 'step-transcript', title: 'Đang lấy transcript…',  sub: 'Kết nối tới YouTube API' },
    { stepId: 'step-chunk',      title: 'Đang chunk nội dung…',  sub: 'Phân tách video thành các đoạn' },
    { stepId: 'step-summary',    title: 'Đang tạo summary…',     sub: 'AI đang tóm tắt nội dung video' },
    { stepId: 'step-ready',      title: 'Sẵn sàng hội thoại!',  sub: 'Đang mở màn hội thoại…' },
  ];

  try {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      // Mark previous as done
      if (i > 0) {
        const prev = document.getElementById(steps[i-1].stepId);
        prev?.classList.remove('active');
        prev?.classList.add('done');
        const dot = prev?.querySelector('.step-dot');
        if (dot) dot.innerHTML = '✓';
      }
      // Mark current as active
      const current = document.getElementById(s.stepId);
      current?.classList.add('active');
      document.getElementById('processing-title').textContent = s.title;
      document.getElementById('processing-sub').textContent   = s.sub;

      // Simulate API delay
      await delay(i === 0 ? 1200 : i === 1 ? 900 : i === 2 ? 1100 : 700);
    }

    // Redirect to call page
    const videoId = extractYouTubeId(url);
    const params  = new URLSearchParams({ url: encodeURIComponent(url), vid: videoId || '' });
    window.location.href = `call.html?${params.toString()}`;

  } catch (err) {
    console.error(err);
    showToast('❌ Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    urlInputGroup.style.display = 'flex';
    processingState.style.display = 'none';
    startBtn.disabled = false;
  }
}

// ---- Open existing session ----
function openSession(sessionId) {
  showToast('🔄 Đang mở lại buổi luyện…');
  setTimeout(() => {
    window.location.href = `call.html?sessionId=${sessionId}`;
  }, 600);
}

// ---- Lock modal ----
function openLockModal() {
  lockModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeLockModal() {
  lockModal.style.display = 'none';
  document.body.style.overflow = '';
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLockModal();
});

// ---- Toast ----
let toastTimer = null;

function showToast(msg, type = '', duration = 2800) {
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  // Force reflow for re-animation
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ---- Utilities ----
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateStatsOnLoad() {
  // Subtle entrance animation for cards
  const cards = document.querySelectorAll('.hero-card, .feature-card, .session-item');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(12px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, 60 + i * 40);
  });
}

// Input shake animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes shake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-6px); }
    40%    { transform:translateX(6px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
  .shake { animation: shake 0.4s ease; }
`;
document.head.appendChild(styleSheet);
