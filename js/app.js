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
const personality = () => window.FridayPersonalityEngine || null;
const defaultReply = () => personality()?.defaultResponse?.() || 'Understood. I am ready to assist.';
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

  /* Pick the best British female voice */
  function _pickVoice(preferred) {
    if (preferred) { const v = _voices.find(v => v.name === preferred); if (v) return v; }
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
    utter.pitch   = parseFloat(Prefs.get('pitch', 1.0));
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

/* ── Conversation ────────────────────────────────────────────── */
const Convo = (() => {
  let _msgs    = [];

  const _convList = $('conv-list');

  function _greet() {
    return personality()?.greeting('startup') || 'FRIDAY online and ready.';
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
      const reply = personality()?.respond(text) || defaultReply();
      _addMsg('ai', reply);
      personality()?.rememberConversation(text, reply);
      VoiceEngine.speak(reply);
    }, 800 + Math.random() * 600);
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
  function _wmoInfo(code) {
    // WMO codes are grouped by tens (e.g. 61–65 are all rain variants)
    return WMO_CODES[code] || WMO_CODES[Math.floor(code / 10) * 10] || ['Unknown', '🌡️'];
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
      return d.city || d.locality || d.principalSubdivision || '';
    } catch { return ''; }
  }

  function _updateUI(temp, code, city) {
    const [desc, icon] = _wmoInfo(code);
    const iconEl  = document.querySelector('.weather-icon-wrap');
    const tempEl  = document.querySelector('.weather-temp');
    const descEl  = document.querySelector('.weather-desc');
    const connBtn = document.querySelector('.weather-connect');
    const badge   = $('weather-badge');
    if (iconEl)  { iconEl.textContent = icon; iconEl.style.opacity = '1'; }
    if (tempEl)  { tempEl.textContent = `${Math.round(temp)} °C`; tempEl.style.color = 'var(--text-primary)'; }
    if (descEl)  { descEl.textContent = city ? `${desc} · ${city}` : desc; descEl.style.color = 'var(--text-secondary)'; }
    if (connBtn) connBtn.style.display = 'none';
    if (badge)   { badge.textContent = 'Live'; badge.className = 'panel-badge live'; badge.id = 'weather-badge'; }
  }

  async function requestLocation() {
    if (!navigator.geolocation) { Toast.show('Geolocation not available.', 'warn'); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      Prefs.set('wLat', lat); Prefs.set('wLon', lon);
      try {
        const [data, city] = await Promise.all([_fetchWeather(lat, lon), _fetchCity(lat, lon)]);
        if (city) Prefs.set('wCity', city);
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

  return { init, requestLocation };
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
    const saveVoicePreferences = (voiceName) => {
      const resolvedVoiceName = voiceName ?? Prefs.get('voiceName', '');
      personality()?.rememberPreferredVoice({
        voiceName: resolvedVoiceName,
        lang: 'en-GB',
        rate: parseFloat(Prefs.get('rate', 0.9)),
        pitch: parseFloat(Prefs.get('pitch', 1.0)),
      });
    };

    if (VoiceEngine.voices.length) populateVoiceList(VoiceEngine.voices);
    window.addEventListener('friday:voiceschanged', e => populateVoiceList(e.detail || VoiceEngine.voices));
    $('btn-settings')?.addEventListener('click', open);
    $('settings-close')?.addEventListener('click', close);
    $('settings-overlay')?.addEventListener('click', close);

    /* Voice selection */
    $('setting-voice')?.addEventListener('change', e => {
      Prefs.set('voiceName', e.target.value);
      saveVoicePreferences(e.target.value);
    });

    /* Rate */
    const rateEl = $('setting-rate'), rateLbl = $('setting-rate-val');
    if (rateEl) {
      rateEl.value = Prefs.get('rate', 0.9);
      if (rateLbl) rateLbl.textContent = rateEl.value;
      rateEl.addEventListener('input', e => {
        Prefs.set('rate', parseFloat(e.target.value));
        saveVoicePreferences();
        if (rateLbl) rateLbl.textContent = e.target.value;
      });
    }

    /* Pitch */
    const pitchEl = $('setting-pitch'), pitchLbl = $('setting-pitch-val');
    if (pitchEl) {
      pitchEl.value = Prefs.get('pitch', 1.0);
      if (pitchLbl) pitchLbl.textContent = pitchEl.value;
      pitchEl.addEventListener('input', e => {
        Prefs.set('pitch', parseFloat(e.target.value));
        saveVoicePreferences();
        if (pitchLbl) pitchLbl.textContent = e.target.value;
      });
    }

    /* Auto-listen */
    const autoEl = $('setting-autolisten');
    if (autoEl) {
      autoEl.checked = Prefs.get('autoListen', false);
      autoEl.addEventListener('change', e => Prefs.set('autoListen', e.target.checked));
    }

    /* Test voice */
    $('setting-test-voice')?.addEventListener('click', () =>
      VoiceEngine.speak(personality()?.greeting('timeAware') || "Hello. I'm Friday, your personal intelligence assistant. Ready to assist."));

    /* Clear history */
    $('setting-clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all conversation history?')) { Convo.clearHistory(); close(); }
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
