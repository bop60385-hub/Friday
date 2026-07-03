const appState = {
  recognition: null,
  listening: false,
  messages: [],
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
  'Friday is a sophisticated British intelligence assistant — warm, intelligent, slightly witty, and direct. She speaks naturally, avoids repeating herself, and addresses the user as Benny when appropriate.';

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
  const greeting = hour < 12 ? 'Good morning, Benny' : hour < 18 ? 'Good afternoon, Benny' : 'Good evening, Benny';

  return `${greeting}. Here's your briefing: risk-on sentiment is competing with inflation data — worth watching the spread. There are a couple of policy headlines with geopolitical spillover potential, so I'd keep an eye on those. Check local weather alerts if you're travelling today. And there's at least one high-probability income opportunity worth a look — consulting, a digital product, or a quick market research play. I'll flag anything that moves.`;
}

async function queryExternalAI(_prompt) {
  return null;
}

function buildLocalResponse(prompt) {
  const text = prompt.toLowerCase();
  const snippets = [];

  if (text.includes('market') || text.includes('stock') || text.includes('econom')) {
    snippets.push('On markets: watch trend strength, rate expectations, and earnings revisions before committing.');
  }

  if (text.includes('geo') || text.includes('war') || text.includes('policy') || text.includes('global')) {
    snippets.push('Geopolitically: the ones worth tracking are policy shifts, energy routes, and supply-chain exposure.');
  }

  if (text.includes('income') || text.includes('side') || text.includes('opportunit')) {
    snippets.push('For opportunities: pick one niche problem, validate demand quickly, then offer a paid solution — keep it tight.');
  }

  if (text.includes('weather') || text.includes('alert')) {
    snippets.push("Weather-wise: keep local alerts enabled and factor them into any travel or logistics decisions today.");
  }

  if (text.includes('productiv') || text.includes('organize') || text.includes('plan')) {
    snippets.push('Productivity: lock in your top three outcomes, block execution time, and push low-value tasks to the end of the queue.');
  }

  if (snippets.length === 0) {
    snippets.push("I can help with markets, geopolitical analysis, opportunity scouting, weather, and planning. What's on your mind, Benny?");
  }

  return snippets.join(' ');
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
