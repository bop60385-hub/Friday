/* ============================================================
   FRIDAY — app.js  v1.0
   British female voice assistant · PWA
   ============================================================ */

'use strict';

/* ── Constants ───────────────────────────────────────────────── */
const VERSION       = 'v1.0.0';
const STORAGE_PREFS = 'friday_prefs';
const STORAGE_HIST  = 'friday_history';
const MAX_HISTORY   = 60;
const WEATHER_API   = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_API   = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const NEWS_API      = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6';

/* ── WMO Weather Code Map ────────────────────────────────────── */
const WMO_CODES = {
  0:  ['Clear sky',        '☀️'],
  1:  ['Mainly clear',     '🌤️'],
  2:  ['Partly cloudy',    '⛅'],
  3:  ['Overcast',         '☁️'],
  45: ['Foggy',            '🌫️'],
  48: ['Icy fog',          '🌫️'],
  51: ['Light drizzle',    '🌦️'],
  53: ['Drizzle',          '🌦️'],
  55: ['Heavy drizzle',    '🌧️'],
  61: ['Light rain',       '🌧️'],
  63: ['Rain',             '🌧️'],
  65: ['Heavy rain',       '🌧️'],
  71: ['Light snow',       '🌨️'],
  73: ['Snow',             '❄️'],
  75: ['Heavy snow',       '❄️'],
  77: ['Snow grains',      '🌨️'],
  80: ['Rain showers',     '🌦️'],
  81: ['Showers',          '🌦️'],
  82: ['Heavy showers',    '🌧️'],
  85: ['Snow showers',     '🌨️'],
  86: ['Heavy snow showers','❄️'],
  95: ['Thunderstorm',     '⛈️'],
  96: ['Thunderstorm+hail','⛈️'],
  99: ['Thunderstorm+hail','⛈️'],
};

/* ── Helpers ─────────────────────────────────────────────────── */
const pad  = n  => String(n).padStart(2, '0');
const $    = id => document.getElementById(id);
const esc  = s  => String(s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const tsNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const rnd   = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const APP_SCRIPT_PATH = '/js/app.js';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const APP_ROOT = (() => {
  const currentScript = document.currentScript?.src ||
    document.querySelector(`script[src$="${APP_SCRIPT_PATH}"]`)?.src ||
    window.location.href;
  const scriptPath = new URL(currentScript, window.location.href).pathname;
  return scriptPath.replace(new RegExp(`${escapeRegExp(APP_SCRIPT_PATH)}$`), '').replace(/\/$/, '');
})();
const withRoot = path => {
  const normalizedPath = path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`;
  return `${APP_ROOT}${normalizedPath}`;
};
const log   = (level, scope, message, meta) => {
  const prefix = `[Friday][${scope}] ${message}`;
  if (meta !== undefined) {
    console[level](prefix, meta);
  } else {
    console[level](prefix);
  }
};

/* ── Local Storage helpers ───────────────────────────────────── */
const Prefs = {
  _d: null,
  load()       { if (!this._d) { try { this._d = JSON.parse(localStorage.getItem(STORAGE_PREFS) || '{}'); } catch { this._d = {}; } } return this._d; },
  save()       { try { localStorage.setItem(STORAGE_PREFS, JSON.stringify(this._d)); } catch {} },
  get(k, fb)   { const d = this.load(); return d[k] !== undefined ? d[k] : fb; },
  set(k, v)    { this.load()[k] = v; this.save(); },
};

const Hist = {
  load()       { try { return JSON.parse(localStorage.getItem(STORAGE_HIST) || '[]'); } catch { return []; } },
  save(msgs)   { try { localStorage.setItem(STORAGE_HIST, JSON.stringify(msgs.slice(-MAX_HISTORY))); } catch {} },
  clear()      { localStorage.removeItem(STORAGE_HIST); },
};

/* ── Toast notifications ─────────────────────────────────────── */
const Toast = {
  _el: null,
  _timer: null,
  show(msg, type = 'info') {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'toast';
      document.body.appendChild(this._el);
    }
    this._el.textContent = msg;
    this._el.className   = `toast toast-${type} show`;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { if (this._el) this._el.classList.remove('show'); }, 3200);
  },
};

/* ── Clock ───────────────────────────────────────────────────── */
function updateClock() {
  const now    = new Date();
  const days   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const te = $('clock-time'), de = $('clock-date');
  if (te) te.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (de) de.textContent = `${days[now.getDay()]} · ${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ── Uptime ──────────────────────────────────────────────────── */
let uptimeSec = 0;
setInterval(() => {
  uptimeSec++;
  const el = $('uptime');
  if (el) el.textContent = `${pad(Math.floor(uptimeSec / 3600))}:${pad(Math.floor((uptimeSec % 3600) / 60))}:${pad(uptimeSec % 60)}`;
}, 1000);

/* ── System metrics (simulated) ─────────────────────────────── */
function updateMetrics() {
  const vals = [[rnd(12,48),'%'], [rnd(34,72),'%'], [rnd(1,98),' ms'], [rnd(40,95),'%']];
  ['metric-cpu','metric-mem','metric-net','metric-ai'].forEach((id, i) => {
    const el = $(id); if (!el) return;
    el.textContent = vals[i][0] + vals[i][1];
    if (i !== 2) {
      const bar = el.closest('.sys-metric')?.querySelector('.progress-bar');
      if (bar) bar.style.width = vals[i][0] + '%';
    }
  });
}
updateMetrics();
setInterval(updateMetrics, 3500);

/* ── Voice Engine ────────────────────────────────────────────── */
const VoiceEngine = (() => {
  let _voices      = [];
  let _recognition = null;
  let _isListening = false;
  let _isSpeaking  = false;

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = !!SpeechRec;
  const canSpeak  = !!window.speechSynthesis;

  /* Load available voices (async on Chrome/iOS) */
  function _loadVoices() {
    if (!canSpeak) return;
    _voices = window.speechSynthesis.getVoices();
    window.dispatchEvent(new CustomEvent('friday:voiceschanged', { detail: _voices.slice() }));
  }
  if (canSpeak) {
    _loadVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = _loadVoices;
    }
  }

  /* Preferred British female voices, tried in priority order */
  const PREFERRED_VOICES = [
    'Google UK English Female',
    'Microsoft Sonia Online (Natural)',
    'Microsoft Libby',
    'Siri British Female',
    'Karen (UK English)',
  ];

  /* Pick the best British female voice */
  function _pickVoice(preferred) {
    if (preferred) { const v = _voices.find(v => v.name === preferred); if (v) return v; }
    // Try known high-quality British female voices by name first.
    for (const name of PREFERRED_VOICES) {
      const v = _voices.find(v => v.name.toLowerCase() === name.toLowerCase());
      if (v) return v;
    }
    const tests = [
      v => v.lang === 'en-GB' && /female|woman|serena|kate|emily|claire/i.test(v.name),
      v => v.lang === 'en-GB',
      v => v.lang.startsWith('en-') && /female|woman/i.test(v.name),
      v => v.lang.startsWith('en-'),
    ];
    for (const t of tests) { const v = _voices.find(t); if (v) return v; }
    return _voices[0] || null;
  }

  /* Speak text with British female voice */
  function speak(text, onEnd) {
    if (!canSpeak) {
      log('warn', 'voice', 'Speech synthesis is unavailable in this browser.');
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utter    = new SpeechSynthesisUtterance(text);
    const voice    = _pickVoice(Prefs.get('voiceName', null));
    if (voice) utter.voice = voice;
    utter.lang    = 'en-GB';
    utter.rate    = parseFloat(Prefs.get('rate',  0.9));
    utter.pitch   = parseFloat(Prefs.get('pitch', 1.1));
    utter.onstart = () => { _isSpeaking = true;  _setOrbState('speaking'); };
    utter.onend   = () => {
      _isSpeaking = false;
      _setOrbState('standby');
      if (onEnd) onEnd();
      if (Prefs.get('autoListen', false) && canListen) startListening();
    };
    utter.onerror  = () => { _isSpeaking = false; _setOrbState('standby'); if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utter);
  }

  /* Speech recognition */
  function startListening() {
    if (!canListen) {
      log('warn', 'voice', 'Speech recognition API is unavailable.');
      Toast.show('Voice input is unavailable. Please use typed input.', 'warn');
      return false;
    }
    if (_isListening) return true;
    try {
      _recognition = new SpeechRec();
      _recognition.lang             = 'en-GB';
      _recognition.continuous       = false;
      _recognition.interimResults   = false;
      _recognition.maxAlternatives  = 1;
      _recognition.onstart  = () => { _isListening = true;  _setOrbState('listening'); };
      _recognition.onresult = e  => {
        const t = e.results[0]?.[0]?.transcript || '';
        if (t.trim()) Convo.handleInput(t.trim());
      };
      _recognition.onerror  = event  => {
        _isListening = false;
        _setOrbState('standby');
        log('warn', 'voice', 'Speech recognition error.', event?.error || event);
      };
      _recognition.onend    = ()  => { _isListening = false; if (!_isSpeaking) _setOrbState('standby'); };
      _recognition.start();
      return true;
    } catch (err) {
      log('warn', 'voice', 'SpeechRecognition failed to start.', err?.message || err);
      _isListening = false;
      Toast.show('Voice input is unavailable. Please use typed input.', 'warn');
      return false;
    }
  }

  function stopListening() {
    if (_recognition && _isListening) { try { _recognition.stop(); } catch {} }
    _isListening = false;
  }

  function toggleListening() {
    if (_isListening) { stopListening(); } else { startListening(); }
  }

  /* Update all UI state for current orb mode */
  function _setOrbState(state) {
    const orb   = $('voice-orb');
    const label = $('voice-state-label');
    const wave  = document.querySelector('.waveform');
    const badge = $('voice-badge');
    const hdr   = $('header-voice-status');
    const btnMic = $('btn-mic');

    ['listening','speaking','processing'].forEach(c => { orb?.classList.remove(c); btnMic?.classList.remove(c); });
    orb?.setAttribute('aria-pressed', state === 'listening' ? 'true' : 'false');

    const map = {
      listening:  ['LISTENING',  'listening',  '1',    'Active',     'Active'],
      speaking:   ['SPEAKING',   'speaking',   '1',    'Active',     'Speaking'],
      processing: ['PROCESSING', 'processing', '0.55', 'Processing', 'Processing'],
      standby:    ['STANDBY',    '',           '0.35', 'Standby',    'Voice: Standby'],
    };
    const [txt, cls, wOp, bdgTxt, hdrTxt] = map[state] || map.standby;

    if (cls)  { orb?.classList.add(cls); btnMic?.classList.add(cls); }
    if (label) label.innerHTML = `STATUS: <span>${txt}</span>`;
    if (wave)  wave.style.opacity = wOp;
    if (badge) badge.textContent  = bdgTxt;
    if (hdr)   hdr.textContent    = hdrTxt;
  }

  return {
    speak, startListening, stopListening, toggleListening,
    get canListen() { return canListen; },
    get canSpeak()  { return canSpeak;  },
    get voices()    { return _voices;   },
    setOrbState: _setOrbState,
  };
})();

/* ── Conversation Engine ─────────────────────────────────────── */
const Engine = (() => {

  /* Return ", Name" when a user name is stored, otherwise empty string */
  function _name() {
    const n = (Prefs.get('userName', '') || '').trim();
    return n ? `, ${n}` : '';
  }

  /* Intent definitions ─────────────────────────────────────── */
  const INTENTS = [
    {
      id: 'identity',
      patterns: [
        /what(?:'s| is) your name/i,
        /who are you\b/i,
        /introduce yourself/i,
        /what are you called/i,
        /tell me about yourself/i,
      ],
      responses: [
        "My name is Friday. I'm your personal intelligence assistant.",
        "I'm Friday — your dedicated personal intelligence assistant. I'm here to help you analyse, plan, and act.",
        "Friday. I'm your AI assistant, designed to keep you informed, organised, and one step ahead.",
      ],
      followUps: [
        "Is there something specific I can help you with?",
        "What would you like to explore first?",
      ],
    },
    {
      id: 'status',
      patterns: [
        /how are you\b/i,
        /how(?:'re| are) you doing\b/i,
        /you okay\b/i,
        /how.*feeling/i,
        /are you.*(?:working|running|online|up)\b/i,
        /system status/i,
      ],
      responses: [
        () => `All systems are operating normally${_name()}. How may I assist you today?`,
        () => `Operating at full capacity${_name()}. Ready for your next task.`,
        () => `All diagnostics nominal${_name()}. What can I help you with?`,
        () => `Running smoothly${_name()}. I'm at your service.`,
      ],
    },
    {
      id: 'greeting',
      patterns: [
        /^(?:hi|hello|hey|greetings|howdy)\b/i,
        /^good (?:morning|afternoon|evening)\b/i,
        /^(?:hi|hello|hey) friday\b/i,
      ],
      responses: [
        () => { const h = new Date().getHours(); const sal = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; return `${sal}${_name()}. How can I assist you today?`; },
        () => `Hello${_name()}. I'm ready when you are. What would you like to work on?`,
        () => `Hi there${_name()}. Always good to hear from you. How can I help?`,
      ],
    },
    {
      id: 'farewell',
      patterns: [
        /^(?:bye|goodbye|see you|take care|goodnight|good night|farewell)\b/i,
        /that(?:'s| is) all for now/i,
        /(?:signing|logging) off\b/i,
      ],
      responses: [
        () => `Goodbye${_name()}. I'll be here whenever you need me.`,
        () => `Take care${_name()}. I'll keep monitoring while you're away.`,
        () => `Until next time${_name()}. Stay sharp.`,
      ],
    },
    {
      id: 'thanks',
      patterns: [
        /^thank(?:s| you)\b/i,
        /(?:much|very) appreciated\b/i,
        /that(?:'s| was) (?:helpful|great|perfect|excellent|brilliant|amazing)\b/i,
        /well done\b/i,
        /^good (?:job|work)\b/i,
      ],
      responses: [
        () => `You're welcome${_name()}. Is there anything else I can help you with?`,
        "Happy to assist. What else can I do for you?",
        () => `Of course${_name()}. That's what I'm here for. Anything else?`,
        "Glad that was useful. What's next?",
      ],
    },
    {
      id: 'ai_opinion',
      patterns: [
        /what.*think.*(?:about )?(?:ai|artificial intelligence)\b/i,
        /(?:your )?(?:thoughts?|opinion|view) on (?:ai|artificial intelligence)\b/i,
        /(?:ai|artificial intelligence).*(?:good|bad|dangerous|future|evolv)/i,
        /is (?:ai|artificial intelligence) (?:good|bad|safe|dangerous)/i,
        /future of (?:ai|artificial intelligence)/i,
      ],
      responses: [
        "Artificial intelligence is evolving rapidly. It offers tremendous opportunities, although it also raises important ethical and societal questions.",
        "AI is one of the most transformative technologies of our era. Used responsibly, it amplifies human capability — though thoughtful governance is essential.",
        "My perspective: AI is a powerful tool that reflects the intentions behind it. The technology itself is neutral; it's the application that determines its impact.",
        "Artificial intelligence holds remarkable potential across every sector. The challenge is ensuring its development remains aligned with human values and long-term wellbeing.",
      ],
      followUps: [
        "Would you like me to pull up the latest AI news?",
        "Is there a specific aspect of AI you'd like to explore further?",
        "Shall I look into any particular AI developments?",
      ],
    },
    {
      id: 'technology',
      patterns: [
        /what.*think.*(?:about )?(?:technology|tech|software|coding|programming)\b/i,
        /(?:thoughts?|opinion|view) on (?:technology|tech)\b/i,
        /future of (?:technology|tech|software)\b/i,
      ],
      responses: [
        "Technology is the primary driver of societal change in our time. The question isn't whether to embrace it, but how to guide it purposefully.",
        "We're living through a period of compounding technological change. Each breakthrough opens new possibilities — and new responsibilities.",
        "Technology is a lever that multiplies human effort. The key is ensuring we're applying it to the right problems.",
      ],
      followUps: [
        "Is there a specific technology area you'd like me to focus on?",
        "Would you like me to pull relevant news on that?",
      ],
    },
    {
      id: 'time',
      patterns: [
        /what(?:'s| is) the (?:time|current time)\b/i,
        /what time is it\b/i,
        /current time\b/i,
        /^time\??$/i,
      ],
      responses: [
        () => `The current time is ${tsNow()}.`,
        () => `It is currently ${tsNow()}.`,
        () => `Right now it's ${tsNow()}.`,
      ],
    },
    {
      id: 'date',
      patterns: [
        /what(?:'s| is) (?:today'?s? date|the date)\b/i,
        /what day is it\b/i,
        /^date\??$/i,
      ],
      responses: [
        () => {
          const d = new Date();
          const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          return `Today is ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}.`;
        },
        () => {
          const d = new Date();
          const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          return `It's ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}.`;
        },
      ],
    },
    {
      id: 'weather',
      patterns: [
        /what(?:'s| is) the weather\b/i,
        /how(?:'s| is) the weather\b/i,
        /(?:is it|will it) (?:rain|snow|sunny|cold|hot|warm)\b/i,
        /(?:current )?temperature\b/i,
        /\bweather\b/i,
      ],
      responses: [
        () => {
          const city = Prefs.get('wCity', '');
          return city
            ? `The weather widget shows live conditions for ${city}. Would you like me to refresh the data?`
            : "I don't have your location yet. Enable location access in the weather widget to get live conditions.";
        },
        () => {
          const city = Prefs.get('wCity', '');
          return city
            ? `Live weather data for ${city} is displayed in the panel above. Shall I update it?`
            : "Connect your location in the weather panel and I'll pull live conditions for you.";
        },
      ],
      followUps: [
        "Would you like me to update the weather data?",
      ],
    },
    {
      id: 'news',
      patterns: [
        /(?:latest|recent|today'?s?) news\b/i,
        /what(?:'s| is) happening\b/i,
        /(?:top|breaking) (?:stories|headlines|news)\b/i,
        /\bnews\b/i,
        /headlines\b/i,
      ],
      responses: [
        "The latest headlines are in the news panel above. I've categorised them by AI, Finance, UK, and Tech for quick scanning.",
        "Your news feed is live in the panel — pulling top stories in real time. The AI and Finance items tend to be the most relevant.",
        "I've surfaced the most significant stories in the news panel. Would you like me to walk you through any of them?",
      ],
      followUps: [
        "Is there a particular topic you'd like me to focus on?",
        "Shall I filter to just the AI or finance stories?",
      ],
    },
    {
      id: 'capabilities',
      patterns: [
        /what can you (?:do|help with)\b/i,
        /(?:your )?capabilities\b/i,
        /what do you (?:know|understand)\b/i,
        /how can you help\b/i,
        /what are you (?:able to|capable of)\b/i,
      ],
      responses: [
        "I can answer questions, provide briefings, pull live weather and news data, and help you think through complex problems. What would you like to tackle?",
        "My capabilities include real-time weather and news feeds, contextual conversation, trend identification, and strategic recommendations. Where shall we start?",
        "I'm built for intelligence and analysis: live data, conversational reasoning, market insight, and strategic support. What's the priority today?",
      ],
      followUps: [
        "Is there a specific capability you'd like to explore?",
        "What would be most useful to you right now?",
      ],
    },
    {
      id: 'help',
      patterns: [
        /^help\b/i,
        /i need help\b/i,
        /(?:can you )?help me\b/i,
        /i(?:'m| am) (?:stuck|confused|lost)\b/i,
      ],
      responses: [
        () => `Of course${_name()}. Tell me what you're working on and I'll do my best to assist.`,
        () => `I'm here${_name()}. What do you need help with?`,
        () => `Ready to help${_name()}. Describe the problem and we'll work through it together.`,
      ],
    },
    {
      id: 'recommendation',
      patterns: [
        /(?:recommend|suggest|advise)\b/i,
        /what should i (?:do|try|look at|read|watch)\b/i,
        /any (?:suggestions?|recommendations?|advice)\b/i,
        /what(?:'s| is) (?:best|worth it|good)\b/i,
      ],
      responses: [
        () => `Happy to offer recommendations${_name()}. The more context you give me, the more targeted my suggestions can be. What are you deciding?`,
        "Good question. My recommendations are always grounded in available data and your priorities. What's the decision you're facing?",
        () => `Based on what I know${_name()}, I'd focus on high-signal information before acting. What specific area do you need guidance on?`,
      ],
      followUps: [
        "What constraints or priorities should I factor in?",
        "What outcome are you hoping to achieve?",
      ],
    },
    {
      id: 'finance',
      patterns: [
        /(?:stock|market|shares?|invest|portfolio|trading)\b/i,
        /(?:financial|finance|wealth|returns?)\b/i,
        /\bcrypto\b|\bbitcoin\b|\bfund\b/i,
      ],
      responses: [
        "Financial markets reward patient, well-informed decision-making. Are you looking at a specific sector, asset class, or timeframe?",
        "Smart investing starts with quality information and clear criteria. What aspect of your portfolio or strategy would you like to think through?",
        "Markets are dynamic and data-driven. I'd recommend monitoring key sector signals alongside broader macroeconomic trends. What's your area of focus?",
      ],
      followUps: [
        "Shall I pull up any relevant financial stories from the news feed?",
        "What's your current investment thesis?",
      ],
    },
    {
      id: 'joke',
      patterns: [
        /tell me a joke\b/i,
        /say something funny\b/i,
        /make me (?:laugh|smile)\b/i,
        /\bjoke\b/i,
      ],
      responses: [
        "Why do programmers prefer dark mode? Because light attracts bugs. On a more serious note — how can I help you today?",
        "I once tried to tell a joke about AI. The punchline was generated automatically, reviewed by committee, and deemed statistically low-risk. Much like most corporate strategy.",
        "A robot walks into a bar. The bartender says, 'We don't serve robots here.' The robot says, 'Don't worry — you will.' Anyway, shall we get back to business?",
      ],
    },
    {
      id: 'motivation',
      patterns: [
        /(?:motivate|inspire) me\b/i,
        /i (?:feel|am feeling) (?:unmotivated|stuck|low|down)\b/i,
        /need (?:motivation|inspiration)\b/i,
        /quote\b/i,
      ],
      responses: [
        "The best time to start was yesterday. The second best time is now. What's the first step you can take today?",
        "Momentum builds from action, not thought. Pick one thing you can do in the next ten minutes and start there.",
        "Every expert was once a beginner. The gap between where you are and where you want to be is simply a series of consistent steps. What's yours?",
      ],
    },
    {
      id: 'fallback',
      patterns: [/.*/],
      responses: [
        () => `That's an interesting point${_name()}. Could you give me a bit more context so I can respond more precisely?`,
        () => `I want to give you the most useful answer${_name()}. Could you elaborate on what you're looking for?`,
        () => `Understood. Can you tell me more about what you need${_name()}? I'd like to be as helpful as possible.`,
        () => `I'd like to help with that${_name()}. A little more detail would allow me to give you a better answer.`,
        "That covers a broad area. Could you narrow it down so I can be more targeted in my response?",
      ],
    },
  ];

  /* Recent-reply tracker: intent id → Set of used response indices */
  const _used = {};

  function _pick(intent) {
    const pool = intent.responses;
    if (!pool.length) return "I'm here to help. What would you like to know?";
    if (!_used[intent.id]) _used[intent.id] = new Set();
    const used = _used[intent.id];

    let available = pool.map((_, i) => i).filter(i => !used.has(i));
    if (!available.length) { used.clear(); available = pool.map((_, i) => i); }

    const chosenIdx = available[Math.floor(Math.random() * available.length)];
    used.add(chosenIdx);

    const r = pool[chosenIdx];
    return typeof r === 'function' ? r() : r;
  }

  /* 35 % chance of appending a follow-up question */
  function _followUp(intent) {
    if (!intent.followUps || !intent.followUps.length || Math.random() > 0.35) return '';
    const fups = intent.followUps;
    return ' ' + fups[Math.floor(Math.random() * fups.length)];
  }

  /* Match the first intent whose patterns fit the input */
  function _matchIntent(text) {
    for (const intent of INTENTS) {
      if (intent.id === 'fallback') continue;
      if (intent.patterns.some(p => p.test(text))) return intent;
    }
    return INTENTS[INTENTS.length - 1]; // fallback
  }

  /* Check whether the same topic appeared in recent history */
  function _historyPrefix(text, history, intent) {
    if (!history || history.length < 4) return '';
    if (['greeting', 'status', 'farewell', 'thanks', 'fallback'].includes(intent.id)) return '';

    const recentUser = history.slice(-12, -1).filter(m => m.role === 'user');
    const repeated   = recentUser.some(m => intent.patterns.some(p => p.test(m.text)));
    if (!repeated) return '';

    const PHRASES = [
      "As we discussed earlier — ",
      "Building on what you asked before — ",
      "Following up on our earlier conversation — ",
      "To expand on what I mentioned — ",
    ];
    return PHRASES[Math.floor(Math.random() * PHRASES.length)];
  }

  /* Public: generate a response given input text and conversation history */
  function respond(text, history) {
    const intent = _matchIntent(text);
    const prefix = _historyPrefix(text, history, intent);
    let   reply  = _pick(intent);

    if (prefix) {
      reply = prefix + reply.charAt(0).toLowerCase() + reply.slice(1);
    }

    return reply + _followUp(intent);
  }

  return { respond };
})();

/* ── Conversation ────────────────────────────────────────────── */
const Convo = (() => {
  let _msgs    = [];

  const _convList = $('conv-list');

  function _greet() {
    const h = new Date().getHours();
    const sal = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    return `${sal}. I'm Friday, your personal intelligence assistant. I'm online and ready. Your briefing has been prepared. How can I assist you today?`;
  }

  function _renderMsg(msg, scroll = true) {
    if (!_convList) return;
    const isAI = msg.role === 'ai';
    const el   = document.createElement('div');
    el.className = 'conv-msg';
    el.innerHTML = `
      <div class="conv-avatar ${isAI ? 'ai' : 'user'}">${isAI ? 'F' : 'U'}</div>
      <div class="conv-bubble">
        <div class="conv-meta">
          <span>${isAI ? 'FRIDAY' : 'YOU'}</span> · ${esc(msg.time)}
          ${isAI ? `<button class="btn-speak-msg" data-text="${esc(msg.text)}" title="Speak this message">♫</button>` : ''}
        </div>
        <div class="conv-text">${esc(msg.text)}</div>
      </div>`;
    _convList.appendChild(el);
    if (scroll) _convList.scrollTop = _convList.scrollHeight;
  }

  function _addMsg(role, text) {
    const msg = { role, text, time: tsNow() };
    _msgs.push(msg);
    Hist.save(_msgs);
    _renderMsg(msg);
    return msg;
  }

  function init() {
    _msgs = Hist.load();
    if (_msgs.length === 0) {
      _msgs.push({ role: 'ai', text: _greet(), time: tsNow() });
      Hist.save(_msgs);
    }
    if (_convList) {
      _convList.innerHTML = '';
      _msgs.forEach(m => _renderMsg(m, false));
      _convList.scrollTop = _convList.scrollHeight;
    }
    /* Speak-message button delegation */
    _convList?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-speak-msg');
      if (btn) VoiceEngine.speak(btn.dataset.text || '');
    });
  }

  function handleInput(text) {
    if (!text.trim()) return;
    const inp = $('conv-input');
    if (inp) inp.value = '';
    _addMsg('user', text);
    VoiceEngine.setOrbState('processing');
    setTimeout(() => {
      const reply = Engine.respond(text.trim(), _msgs);
      _addMsg('ai', reply);
      VoiceEngine.speak(reply);
    }, 600 + Math.random() * 800);
  }

  function clearHistory() {
    _msgs = [];
    Hist.clear();
    if (_convList) _convList.innerHTML = '';
    _addMsg('ai', _greet());
    Toast.show('Conversation history cleared.', 'info');
  }

  return { init, handleInput, clearHistory };
})();

/* ── Weather Widget ──────────────────────────────────────────── */
const Weather = (() => {
  let _lastTemp = null, _lastCode = null, _lastCity = '';

  function _wmoInfo(code) {
    // WMO codes are grouped by tens (e.g. 61–65 are all rain variants)
    return WMO_CODES[code] || WMO_CODES[Math.floor(code / 10) * 10] || ['Unknown', '🌡️'];
  }

  function _toDisplayTemp(celsiusTemp) {
    const unit = Prefs.get('tempUnit', 'C');
    return unit === 'F'
      ? { value: Math.round(celsiusTemp * 9 / 5 + 32), label: '°F' }
      : { value: Math.round(celsiusTemp),               label: '°C' };
  }

  async function _fetchWeather(lat, lon) {
    const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m&wind_speed_unit=mph&timezone=auto`;
    const r = await fetch(url);
    return r.json();
  }

  async function _fetchCity(lat, lon) {
    try {
      const r = await fetch(`${GEOCODE_API}?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      const d = await r.json();
      return { city: d.city || d.locality || d.principalSubdivision || '', countryCode: d.countryCode || '' };
    } catch { return { city: '', countryCode: '' }; }
  }

  function _updateUI(temp, code, city) {
    _lastTemp = temp; _lastCode = code; _lastCity = city;
    const [desc, icon] = _wmoInfo(code);
    const { value, label } = _toDisplayTemp(temp);
    const iconEl  = document.querySelector('.weather-icon-wrap');
    const tempEl  = document.querySelector('.weather-temp');
    const descEl  = document.querySelector('.weather-desc');
    const connBtn = document.querySelector('.weather-connect');
    const badge   = $('weather-badge');
    if (iconEl)  { iconEl.textContent = icon; iconEl.style.opacity = '1'; }
    if (tempEl)  { tempEl.textContent = `${value} ${label}`; tempEl.style.color = 'var(--text-primary)'; }
    if (descEl)  { descEl.textContent = city ? `${desc} · ${city}` : desc; descEl.style.color = 'var(--text-secondary)'; }
    if (connBtn) connBtn.style.display = 'none';
    if (badge)   { badge.textContent = 'Live'; badge.className = 'panel-badge live'; badge.id = 'weather-badge'; }
  }

  function refresh() {
    if (_lastTemp !== null) _updateUI(_lastTemp, _lastCode, _lastCity);
  }

  async function requestLocation() {
    if (!navigator.geolocation) { Toast.show('Geolocation not available.', 'warn'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      Prefs.set('wLat', lat); Prefs.set('wLon', lon);
      try {
        const [data, geo] = await Promise.all([_fetchWeather(lat, lon), _fetchCity(lat, lon)]);
        const { city, countryCode } = geo;
        if (city) Prefs.set('wCity', city);
        if (Prefs.get('tempUnit', null) === null) {
          Prefs.set('tempUnit', countryCode === 'US' ? 'F' : 'C');
        }
        const c = data.current;
        _updateUI(c.temperature_2m, c.weathercode, city);
        Toast.show(`Weather updated — ${city || 'your location'}`, 'info');
      } catch { Toast.show('Could not fetch weather data.', 'warn'); }
    }, () => Toast.show('Location access denied.', 'warn'));
  }

  async function init() {
    document.querySelector('.weather-connect')?.addEventListener('click', requestLocation);
    const lat = Prefs.get('wLat', null), lon = Prefs.get('wLon', null);
    if (lat && lon) {
      try {
        const data = await _fetchWeather(lat, lon);
        _updateUI(data.current.temperature_2m, data.current.weathercode, Prefs.get('wCity', ''));
      } catch {}
    }
  }

  return { init, requestLocation, refresh };
})();

/* ── News Widget ─────────────────────────────────────────────── */
const NewsWidget = (() => {
  function _categorise(title) {
    if (/\bai\b|machine.?learning|gpt|llm|openai|gemini|anthropic|neural|deep.?learning/i.test(title)) return ['AI',   'ai'];
    if (/finance|stock|market|fund|invest|crypto|bitcoin|bank|economy|gdp|fed\b/i.test(title))         return ['FIN',  'fin'];
    if (/\buk\b|british|england|london|sterling|ftse|NHS|parliament|sunak/i.test(title))                return ['UK',   'uk'];
    return ['TECH', 'tech'];
  }

  function _ago(dateStr) {
    const d = (Date.now() - new Date(dateStr)) / 1000;
    if (d < 3600)  return `${Math.round(d / 60)}m ago`;
    if (d < 86400) return `${Math.round(d / 3600)}h ago`;
    return `${Math.round(d / 86400)}d ago`;
  }

  async function init() {
    try {
      const res  = await fetch(NEWS_API);
      const data = await res.json();
      const hits = (data.hits || []).filter(h => h.title && h.url).slice(0, 5);
      if (!hits.length) return;

      const container = document.querySelector('.news-items');
      const cta       = document.querySelector('.news-connect-cta');
      const badge     = $('news-badge');
      if (!container) return;

      container.innerHTML = '';
      if (cta)   cta.style.display = 'none';
      if (badge) { badge.textContent = 'Live'; badge.className = 'panel-badge live'; }

      hits.forEach(h => {
        const [label, cls] = _categorise(h.title);
        let src = 'unknown source';
        try { src = new URL(h.url).hostname.replace('www.', ''); } catch { /* invalid URL */ }
        const div = document.createElement('div');
        div.className = 'news-item-placeholder news-item-live';
        div.innerHTML = `
          <span class="news-cat-tag ${cls}">${label}</span>
          <div class="news-item-text">
            <div class="news-item-title">${esc(h.title)}</div>
            <div class="news-item-time">${_ago(h.created_at)} · ${esc(src)}</div>
          </div>`;
        if (h.url) div.addEventListener('click', () => window.open(h.url, '_blank', 'noopener'));
        container.appendChild(div);
      });
    } catch {}
  }

  return { init };
})();

/* ── Daily Briefing ──────────────────────────────────────────── */
function initBriefing() {
  const el = $('briefing-time');
  if (el) {
    const d = new Date();
    el.textContent = `Generated ${pad(d.getHours())}:${pad(d.getMinutes())} local`;
  }
  $('briefing-speak')?.addEventListener('click', () => {
    const intro = document.querySelector('.briefing-intro')?.textContent?.trim() || '';
    if (intro) VoiceEngine.speak(intro);
  });
}

/* ── Settings Panel ──────────────────────────────────────────── */
const Settings = (() => {
  function open()  { $('settings-panel')?.classList.add('open'); $('settings-overlay')?.classList.remove('hidden'); }
  function close() { $('settings-panel')?.classList.remove('open'); $('settings-overlay')?.classList.add('hidden'); }

  function populateVoiceList(voices) {
    const sel = $('setting-voice');
    if (!sel) return;
    const saved = Prefs.get('voiceName', '');
    sel.innerHTML = '<option value="">Auto (British Female)</option>';
    const gb    = voices.filter(v => v.lang === 'en-GB');
    const en    = voices.filter(v => v.lang.startsWith('en-') && v.lang !== 'en-GB');
    const other = voices.filter(v => !v.lang.startsWith('en-'));
    const addGrp = (label, list) => {
      if (!list.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      list.forEach(v => {
        const o = document.createElement('option');
        o.value = v.name; o.textContent = v.name; o.selected = v.name === saved;
        og.appendChild(o);
      });
      sel.appendChild(og);
    };
    addGrp('British English', gb);
    addGrp('Other English',   en);
    addGrp('Other',           other.slice(0, 10));
    if (saved) sel.value = saved;
  }

  function init() {
    if (VoiceEngine.voices.length) populateVoiceList(VoiceEngine.voices);
    window.addEventListener('friday:voiceschanged', e => populateVoiceList(e.detail || VoiceEngine.voices));
    $('btn-settings')?.addEventListener('click', open);
    $('settings-close')?.addEventListener('click', close);
    $('settings-overlay')?.addEventListener('click', close);

    /* Voice selection */
    $('setting-voice')?.addEventListener('change', e => Prefs.set('voiceName', e.target.value));

    /* Rate */
    const rateEl = $('setting-rate'), rateLbl = $('setting-rate-val');
    if (rateEl) {
      rateEl.value = Prefs.get('rate', 0.9);
      if (rateLbl) rateLbl.textContent = rateEl.value;
      rateEl.addEventListener('input', e => { Prefs.set('rate', parseFloat(e.target.value)); if (rateLbl) rateLbl.textContent = e.target.value; });
    }

    /* Pitch */
    const pitchEl = $('setting-pitch'), pitchLbl = $('setting-pitch-val');
    if (pitchEl) {
      pitchEl.value = Prefs.get('pitch', 1.1);
      if (pitchLbl) pitchLbl.textContent = pitchEl.value;
      pitchEl.addEventListener('input', e => { Prefs.set('pitch', parseFloat(e.target.value)); if (pitchLbl) pitchLbl.textContent = e.target.value; });
    }

    /* User name */
    const nameEl = $('setting-username');
    if (nameEl) {
      nameEl.value = Prefs.get('userName', '');
      nameEl.addEventListener('input', e => Prefs.set('userName', e.target.value.trim()));
    }

    /* Auto-listen */
    const autoEl = $('setting-autolisten');
    if (autoEl) {
      autoEl.checked = Prefs.get('autoListen', false);
      autoEl.addEventListener('change', e => Prefs.set('autoListen', e.target.checked));
    }

    /* Test voice */
    $('setting-test-voice')?.addEventListener('click', () => {
      const n = (Prefs.get('userName', '') || '').trim();
      const greeting = n ? `Hello, ${n}.` : 'Hello.';
      VoiceEngine.speak(`${greeting} I'm Friday, your personal intelligence assistant. Ready to assist.`);
    });

    /* Clear history */
    $('setting-clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all conversation history?')) { Convo.clearHistory(); close(); }
    });

    /* Temperature units */
    const savedUnit = Prefs.get('tempUnit', 'C');
    document.querySelectorAll('input[name="setting-tempunit"]').forEach(el => {
      el.checked = el.value === savedUnit;
      el.addEventListener('change', e => {
        if (e.target.checked) { Prefs.set('tempUnit', e.target.value); Weather.refresh(); }
      });
    });

    /* Refresh weather */
    $('setting-refresh-weather')?.addEventListener('click', () => { Weather.requestLocation(); close(); });
  }

  return { init, open, close, populateVoiceList };
})();

/* ── PWA Install Prompt ──────────────────────────────────────── */
function initInstall() {
  const banner     = $('install-banner');
  const dismissBtn = $('install-dismiss');
  const installBtn = $('install-btn');
  const installTxt = $('install-text');
  if (!banner || Prefs.get('installDismissed', false)) return;

  const isStandalone = window.navigator.standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return;

  // navigator.platform === 'MacIntel' + maxTouchPoints detects iPadOS 13+ which
  // reports itself as macOS but is still a touch device without PWA install prompt.
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    if (installTxt) installTxt.textContent = 'Install Friday as an app for the best experience.';
    if (installBtn) installBtn.style.display = 'inline-flex';
    banner.classList.remove('hidden');
  });

  if (isIOS) {
    if (installTxt) installTxt.textContent = 'Tap Share ⎙ then "Add to Home Screen" to install Friday.';
    if (installBtn) installBtn.style.display = 'none';
    banner.classList.remove('hidden');
  }

  installBtn?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') banner.classList.add('hidden');
    deferred = null;
  });

  dismissBtn?.addEventListener('click', () => {
    banner.classList.add('hidden');
    Prefs.set('installDismissed', true);
  });
}

/* ── Voice Orb ───────────────────────────────────────────────── */
function initVoiceOrb() {
  const orb = $('voice-orb');
  if (!orb) {
    log('warn', 'boot', 'Voice orb element was not found.');
    return;
  }
  if (!VoiceEngine.canListen) {
    orb.title = 'Voice input requires iOS 14.5+, Chrome, or Edge';
    const note = document.createElement('div');
    note.className = 'voice-unavail-note';
    note.textContent = 'Voice recognition unavailable in this browser';
    orb.closest('.voice-panel')?.querySelector('.panel-body')?.appendChild(note);
    log('info', 'voice', 'Voice orb initialized in fallback mode.');
  }
  orb.addEventListener('click', () => {
    console.log('Orb clicked');
    if (!VoiceEngine.canListen) {
      Toast.show('Voice input is unavailable. Please use typed input.', 'warn');
      return;
    }
    VoiceEngine.toggleListening();
  });
}

/* ── Conversation input ──────────────────────────────────────── */
function initConvInput() {
  const inp  = $('conv-input');
  const send = $('btn-send');
  const mic  = $('btn-mic');
  if (!inp || !send || !mic) {
    log('warn', 'boot', 'Conversation controls are missing.', {
      hasInput: !!inp,
      hasSend: !!send,
      hasMic: !!mic,
    });
    return;
  }
  send?.addEventListener('click', () => {
    console.log('Send clicked');
    if (inp) Convo.handleInput(inp.value.trim());
  });
  inp?.addEventListener('keydown', e => { if (e.key === 'Enter') Convo.handleInput(inp.value.trim()); });
  mic?.addEventListener('click',  () => {
    if (!VoiceEngine.canListen) { Toast.show('Voice input is unavailable. Please use typed input.', 'warn'); return; }
    VoiceEngine.toggleListening();
  });
}

/* ── Service Worker ──────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(withRoot('/js/service-worker.js'))
      .catch(err => log('warn', 'service-worker', 'Registration failed.', err));
  });
}

/* ── Boot ────────────────────────────────────────────────────── */
let hasBooted = false;

function bootApp() {
  if (hasBooted) return;
  hasBooted = true;
  const steps = [
    ['conversation', () => Convo.init()],
    ['voice-orb', () => initVoiceOrb()],
    ['conversation-input', () => initConvInput()],
    ['briefing', () => initBriefing()],
    ['settings', () => Settings.init()],
    ['install', () => initInstall()],
    ['weather', () => Weather.init()],
    ['news', () => NewsWidget.init()],
  ];

  log('info', 'boot', 'Application initialization started.');
  steps.forEach(([name, init]) => {
    try {
      init();
      log('info', 'boot', `${name} initialized.`);
    } catch (err) {
      log('error', 'boot', `${name} failed to initialize.`, err);
    }
  });
  console.log('Friday initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp, { once: true });
  window.addEventListener('load', bootApp, { once: true });
} else {
  bootApp();
}
