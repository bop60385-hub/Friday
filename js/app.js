/* ============================================================
   FRIDAY — app.js
   Live clock, conversation history, interactive behaviours
   ============================================================ */

'use strict';

/* ── Shared helpers ─────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');

/* ── Clock ─────────────────────────────────────────────────── */
function updateClock() {
  const now  = new Date();
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const h = pad(now.getHours());
  const m = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  const dayName  = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateStr  = `${dayName} · ${pad(now.getDate())} ${monthName} ${now.getFullYear()}`;

  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (timeEl) timeEl.textContent = `${h}:${m}:${s}`;
  if (dateEl) dateEl.textContent = dateStr;
}

updateClock();
setInterval(updateClock, 1000);

/* ── Uptime counter ─────────────────────────────────────────── */
let uptimeSeconds = 0;
function updateUptime() {
  uptimeSeconds++;
  const h = Math.floor(uptimeSeconds / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = uptimeSeconds % 60;
  const el = document.getElementById('uptime');
  if (el) el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}
setInterval(updateUptime, 1000);

/* ── System metrics (simulated) ─────────────────────────────── */
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateMetrics() {
  const cpu    = randomBetween(12, 48);
  const mem    = randomBetween(34, 72);
  const net    = randomBetween(1, 98);
  const ai     = randomBetween(40, 95);

  setMetric('metric-cpu', cpu + '%', cpu);
  setMetric('metric-mem', mem + '%', mem);
  setMetric('metric-net', net + ' ms', null);
  setMetric('metric-ai',  ai  + '%', ai);
}

function setMetric(id, text, barPct) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (barPct !== null) {
    const bar = el.closest('.sys-metric')?.querySelector('.progress-bar');
    if (bar) bar.style.width = barPct + '%';
  }
}

updateMetrics();
setInterval(updateMetrics, 3500);

/* ── Conversation ───────────────────────────────────────────── */
const DEMO_RESPONSES = [
  'Scanning for opportunities in your target sectors. Found 3 high-probability matches in the last 24 hours.',
  'Your briefing is ready. Key highlights: AI sector up 2.1%, two new grant opportunities in fintech, and your watchlist is showing unusual volume.',
  'I can help you analyse that. Running a deep scan now — results in approximately 15 seconds.',
  'Connecting to live data sources. Market intelligence module is online.',
  'Acknowledged. I\'ve flagged that for follow-up and added a reminder to your agenda at 09:00.',
  'Based on current trends, the probability of this opportunity window remaining open is 78% over the next 48 hours.',
];

let demoIdx = 0;

const convList   = document.getElementById('conv-list');
const convInput  = document.getElementById('conv-input');
const btnSend    = document.getElementById('btn-send');

function appendMessage({ role, text, time }) {
  if (!convList) return;
  const isAI = role === 'ai';

  const msg = document.createElement('div');
  msg.className = 'conv-msg';

  const avatar = document.createElement('div');
  avatar.className = `conv-avatar ${isAI ? 'ai' : 'user'}`;
  avatar.textContent = isAI ? 'F' : 'U';

  const bubble = document.createElement('div');
  bubble.className = 'conv-bubble';

  const meta = document.createElement('div');
  meta.className = 'conv-meta';
  const who = document.createElement('span');
  who.textContent = isAI ? 'FRIDAY' : 'YOU';
  meta.append(who, ` · ${time}`);

  const body = document.createElement('div');
  body.className = 'conv-text';
  body.textContent = text;

  bubble.append(meta, body);
  msg.append(avatar, bubble);
  convList.appendChild(msg);
  convList.scrollTop = convList.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function currentTimeStr() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sendMessage() {
  if (!convInput) return;
  const text = convInput.value.trim();
  if (!text) return;

  appendMessage({ role: 'user', text, time: currentTimeStr() });
  convInput.value = '';

  // Simulate AI thinking delay
  setTimeout(() => {
    const reply = DEMO_RESPONSES[demoIdx % DEMO_RESPONSES.length];
    demoIdx++;
    appendMessage({ role: 'ai', text: reply, time: currentTimeStr() });
  }, 900 + Math.random() * 600);
}

if (btnSend)   btnSend.addEventListener('click', sendMessage);
if (convInput) convInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

/* ── Voice orb toggle ────────────────────────────────────────── */
const voiceOrb   = document.getElementById('voice-orb');
const voiceLabel = document.getElementById('voice-state-label');
let voiceActive  = false;

if (voiceOrb) {
  voiceOrb.addEventListener('click', () => {
    voiceActive = !voiceActive;
    voiceOrb.classList.toggle('listening', voiceActive);
    if (voiceLabel) {
      voiceLabel.innerHTML = voiceActive
        ? 'STATUS: <span>LISTENING</span>'
        : 'STATUS: <span>STANDBY</span>';
    }
    if (voiceActive) {
      const waveEl = document.querySelector('.waveform');
      if (waveEl) waveEl.style.opacity = '1';
    } else {
      const waveEl = document.querySelector('.waveform');
      if (waveEl) waveEl.style.opacity = '0.35';
    }
  });
}

/* ── Briefing timestamp ──────────────────────────────────────── */
const briefingEl = document.getElementById('briefing-time');
if (briefingEl) {
  const d = new Date();
  briefingEl.textContent = `Generated ${pad(d.getHours())}:${pad(d.getMinutes())} local`;
}

/* ── Service Worker registration ─────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/js/service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}
