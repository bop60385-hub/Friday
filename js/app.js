/**
 * Friday – AI-powered personal intelligence assistant.
 * Handles UI interactions, message rendering, and integration with VoiceManager.
 */

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const muteBtn = document.getElementById('mute-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');
const voiceSelect = document.getElementById('voice-select');
const autoSpeakToggle = document.getElementById('auto-speak');

let isMuted = false;

/* ── Greeting ─────────────────────────────────────────────────────────── */

function greet() {
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  const message =
    `${greeting}! I'm Friday, your AI-powered personal intelligence assistant. ` +
    `I'm here to help you identify opportunities, track trends, and make smarter decisions. ` +
    `How can I assist you today?`;

  appendMessage('friday', message);
  if (!isMuted) voiceManager.speak(message);
}

/* ── Message rendering ────────────────────────────────────────────────── */

function appendMessage(sender, text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', sender === 'user' ? 'user-message' : 'friday-message');

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = text;

  const timestamp = document.createElement('span');
  timestamp.classList.add('timestamp');
  timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.appendChild(bubble);
  wrapper.appendChild(timestamp);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.classList.add('message', 'friday-message', 'typing-indicator');
  indicator.id = 'typing-indicator';

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.innerHTML = '<span></span><span></span><span></span>';

  indicator.appendChild(bubble);
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return indicator;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) indicator.remove();
}

/* ── Simple response engine ───────────────────────────────────────────── */

const responses = {
  greetings: [
    'Hello! How can I help you today?',
    'Hi there! What can I assist you with?',
    'Greetings! What would you like to explore?',
  ],
  market: [
    'Market analysis requires looking at both macro-economic trends and sector-specific data. Shall I focus on a particular industry or region?',
    'I can help you identify emerging market opportunities. What sector are you most interested in?',
    'Tracking market trends involves monitoring news, financial data, and consumer behaviour. Where would you like to start?',
  ],
  productivity: [
    'Improving productivity often starts with identifying your highest-value tasks. What are your current priorities?',
    'I can help you streamline your workflow. Tell me more about the areas where you feel you're losing the most time.',
    'Automation is a powerful lever for productivity gains. Would you like to explore which of your tasks could be automated?',
  ],
  research: [
    'I can help you structure your research. What topic are you investigating?',
    'Good research starts with a clear question. What are you trying to find out?',
    'I can assist with trend analysis, competitor research, and opportunity mapping. Which would be most useful?',
  ],
  wealth: [
    'Building wealth often involves diversifying income streams and managing risk. What stage of your financial journey are you at?',
    'I can help you explore different income opportunities – from investments to side projects. What interests you most?',
    'Financial growth requires both strategy and discipline. Would you like help with planning, tracking, or finding new opportunities?',
  ],
  default: [
    'That's an interesting point. Could you tell me more so I can provide the most relevant assistance?',
    'I'd like to help with that. Can you give me a bit more context?',
    'Let me think about the best way to assist you with that. Could you elaborate?',
  ],
};

function getResponse(input) {
  const text = input.toLowerCase();

  if (/\b(hello|hi|hey|good morning|good afternoon|good evening|greetings)\b/.test(text)) {
    return pick(responses.greetings);
  }
  if (/\b(market|stock|invest|trading|crypto|finance|financial)\b/.test(text)) {
    return pick(responses.market);
  }
  if (/\b(productive|productivity|workflow|automate|efficiency|time management)\b/.test(text)) {
    return pick(responses.productivity);
  }
  if (/\b(research|trend|data|analysis|analyse|analyze|study)\b/.test(text)) {
    return pick(responses.research);
  }
  if (/\b(wealth|income|money|earn|revenue|profit|rich|grow)\b/.test(text)) {
    return pick(responses.wealth);
  }

  return pick(responses.default);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ── Send message ─────────────────────────────────────────────────────── */

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';
  userInput.disabled = true;
  sendBtn.disabled = true;

  appendMessage('user', text);
  const indicator = showTypingIndicator();

  // Simulate a short thinking delay for a natural feel.
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));

  removeTypingIndicator();
  const reply = getResponse(text);
  appendMessage('friday', reply);

  if (!isMuted) voiceManager.speak(reply);

  userInput.disabled = false;
  sendBtn.disabled = false;
  userInput.focus();
}

/* ── Mute toggle ──────────────────────────────────────────────────────── */

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  muteBtn.title = isMuted ? 'Unmute Friday' : 'Mute Friday';
  muteBtn.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
  if (isMuted) voiceManager.stop();
});

/* ── Settings panel ───────────────────────────────────────────────────── */

settingsBtn.addEventListener('click', () => {
  populateVoiceList();
  settingsPanel.classList.add('open');
});

closeSettings.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

// Close settings when clicking outside the panel.
document.addEventListener('click', (e) => {
  if (
    settingsPanel.classList.contains('open') &&
    !settingsPanel.contains(e.target) &&
    e.target !== settingsBtn
  ) {
    settingsPanel.classList.remove('open');
  }
});

function populateVoiceList() {
  const voices = voiceManager.getAvailableVoices();
  const current = voiceManager.currentVoice;

  voiceSelect.innerHTML = '';

  // Add an "Auto (British female)" option at the top.
  const autoOption = document.createElement('option');
  autoOption.value = '';
  autoOption.textContent = 'Auto (British female preferred)';
  voiceSelect.appendChild(autoOption);

  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (current && voice.name === current.name) {
      option.selected = true;
    }
    voiceSelect.appendChild(option);
  });

  if (!current) {
    autoOption.selected = true;
  }
}

voiceSelect.addEventListener('change', () => {
  voiceManager.setVoiceByName(voiceSelect.value || null);

  // Speak a short preview using the newly selected voice.
  voiceManager.speak("Voice updated. I'm Friday, ready to assist you.");
});

autoSpeakToggle.addEventListener('change', () => {
  isMuted = !autoSpeakToggle.checked;
  muteBtn.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
  muteBtn.title = isMuted ? 'Unmute Friday' : 'Mute Friday';
});

/* ── Input handlers ───────────────────────────────────────────────────── */

sendBtn.addEventListener('click', sendMessage);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/* ── Init ─────────────────────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', greet);
