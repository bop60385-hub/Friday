const appState = {
  recognition: null,
  listening: false,
  messages: [],
  briefingReady: false,
};

const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const formEl = document.getElementById('prompt-form');
const inputEl = document.getElementById('prompt');
const micButton = document.getElementById('mic-button');
const speakButton = document.getElementById('speak-button');
const briefingButton = document.getElementById('briefing-button');
const briefingText = document.getElementById('briefing-text');

const storageKey = 'friday-history-v1';

const assistantPersona =
  'Friday is professional, calm, intelligent, concise, and focused on actionable guidance.';

function setStatus(text) {
  statusEl.textContent = text;
}

function renderMessage(role, text) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  historyEl.prepend(div);
}

function persistHistory() {
  localStorage.setItem(storageKey, JSON.stringify(appState.messages.slice(-40)));
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    appState.messages = JSON.parse(raw);
    [...appState.messages].reverse().forEach((entry) => renderMessage(entry.role, entry.text));
  } catch {
    appState.messages = [];
  }
}

function addMessage(role, text) {
  appState.messages.push({ role, text, timestamp: Date.now() });
  renderMessage(role, text);
  persistHistory();
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    setStatus('Speech synthesis is not supported in this browser.');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function generateBriefing() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return `${greeting}. Strategic briefing: monitor risk-on sentiment versus inflation data, track major policy headlines for geopolitical spillover, review local weather alerts before travel, and prioritize one high-probability income opportunity today (consulting, digital product, or market research).`;
}

async function queryExternalAI(_prompt) {
  return null;
}

function buildLocalResponse(prompt) {
  const text = prompt.toLowerCase();
  const snippets = [];

  if (text.includes('market') || text.includes('stock') || text.includes('econom')) {
    snippets.push('Market lens: watch trend strength, rate expectations, and earnings revisions before acting.');
  }

  if (text.includes('geo') || text.includes('war') || text.includes('policy') || text.includes('global')) {
    snippets.push('Geopolitical lens: focus on policy shifts, energy routes, and supply-chain exposure.');
  }

  if (text.includes('income') || text.includes('side') || text.includes('opportunit')) {
    snippets.push('Opportunity scan: pick one niche problem, validate demand quickly, then offer a paid solution.');
  }

  if (text.includes('weather') || text.includes('alert')) {
    snippets.push('Weather note: keep local alerts enabled; adjust travel, logistics, and scheduling based on advisories.');
  }

  if (text.includes('productiv') || text.includes('organize') || text.includes('plan')) {
    snippets.push('Productivity action: define top 3 outcomes, block execution windows, and defer low-value tasks.');
  }

  if (snippets.length === 0) {
    snippets.push('I can help with market trends, geopolitical analysis, opportunity scouting, weather awareness, and execution planning.');
  }

  return `${assistantPersona} ${snippets.join(' ')}`;
}

async function generateResponse(prompt) {
  const external = await queryExternalAI(prompt);
  return external || buildLocalResponse(prompt);
}

async function processPrompt(prompt, shouldSpeak = false) {
  if (!prompt.trim()) return;
  addMessage('user', prompt.trim());
  setStatus('Analyzing request...');

  const reply = await generateResponse(prompt.trim());
  addMessage('friday', reply);
  setStatus('Ready when you are.');

  if (shouldSpeak) {
    speak(reply);
  }
}

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('Voice recognition is unavailable in this browser.');
    micButton.disabled = true;
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    appState.listening = true;
    micButton.classList.add('listening');
    setStatus('Listening...');
  };

  recognition.onend = () => {
    appState.listening = false;
    micButton.classList.remove('listening');
    setStatus('Ready when you are.');
  };

  recognition.onerror = () => {
    setStatus('I did not catch that. Try again.');
  };

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    inputEl.value = transcript;
    processPrompt(transcript, true);
  };

  appState.recognition = recognition;
}

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  processPrompt(inputEl.value, false);
  inputEl.value = '';
});

micButton.addEventListener('click', () => {
  if (!appState.recognition) return;

  if (appState.listening) {
    appState.recognition.stop();
    return;
  }

  appState.recognition.start();
});

speakButton.addEventListener('click', () => {
  const latest = appState.messages.find((msg) => msg.role === 'friday');
  if (latest) speak(latest.text);
});

briefingButton.addEventListener('click', () => {
  const briefing = generateBriefing();
  briefingText.textContent = briefing;
  addMessage('friday', briefing);
  appState.briefingReady = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      setStatus('Offline mode is currently unavailable.');
    });
  });
}

loadHistory();
setupRecognition();
