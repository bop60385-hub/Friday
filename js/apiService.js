'use strict';

(() => {
  const STORAGE_KEY = 'friday_ai_settings';
  const AI_UNAVAILABLE_MESSAGE = "I'm unable to access my advanced intelligence systems at the moment.";
  const DEFAULT_TIMEOUT_MS = 12000;
  // Keep a short rolling window of conversation context for backend requests.
  const MAX_HISTORY_MESSAGES = 10;

  const PROVIDERS = [
    { id: 'friday-secure-backend', label: 'Friday Secure Backend', endpoint: '/api/ai/chat' },
  ];

  const DEFAULT_SETTINGS = {
    mode: 'local',
    provider: PROVIDERS[0].id,
    endpoint: PROVIDERS[0].endpoint,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  const APP_SCRIPT_PATH = '/js/apiService.js';
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

  function _safeParse(input) {
    try { return JSON.parse(input); } catch { return null; }
  }

  function _pickProvider(id) {
    return PROVIDERS.find(provider => provider.id === id) || PROVIDERS[0];
  }

  function getSettings() {
    const stored = _safeParse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    const provider = _pickProvider(stored.provider || DEFAULT_SETTINGS.provider);
    const mode = stored.mode === 'ai' ? 'ai' : 'local';
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      mode,
      provider: provider.id,
      endpoint: typeof stored.endpoint === 'string' && stored.endpoint.trim() ? stored.endpoint.trim() : provider.endpoint,
    };
  }

  function _saveSettings(next) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function setMode(mode) {
    const nextMode = mode === 'ai' ? 'ai' : 'local';
    _saveSettings({ ...getSettings(), mode: nextMode });
    return nextMode;
  }

  function setProvider(providerId) {
    const provider = _pickProvider(providerId);
    _saveSettings({ ...getSettings(), provider: provider.id, endpoint: provider.endpoint });
    return provider.id;
  }

  function getProviderOptions() {
    return PROVIDERS.map(provider => ({ id: provider.id, label: provider.label }));
  }

  async function sendMessage({ message, history = [] }) {
    const settings = getSettings();
    if (settings.mode !== 'ai') return { ok: true, mode: 'local', text: '', skipped: true };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
    try {
      const trimmedHistory = history.length > MAX_HISTORY_MESSAGES
        ? history.slice(-MAX_HISTORY_MESSAGES)
        : history;

      const response = await fetch(withRoot(settings.endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Friday-AI-Provider': settings.provider,
          'X-Friday-Client': 'friday-web',
        },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({
          message,
          history: trimmedHistory,
        }),
      });

      if (!response.ok) throw new Error(`AI backend error: ${response.status}`);
      const payload = await response.json();
      // Expected contract: { reply: string }. `message` is accepted for compatibility.
      let reply = '';
      if (typeof payload?.reply === 'string') {
        reply = payload.reply.trim();
      } else if (typeof payload?.message === 'string') {
        reply = payload.message.trim();
      }
      if (!reply) throw new Error('AI backend returned an empty reply.');
      return { ok: true, mode: 'ai', text: reply };
    } catch (error) {
      console.warn('[Friday][ai] Secure backend request failed.', error);
      return { ok: false, mode: 'ai', text: AI_UNAVAILABLE_MESSAGE };
    } finally {
      clearTimeout(timeout);
    }
  }

  window.APIService = {
    AI_UNAVAILABLE_MESSAGE,
    getSettings,
    getMode: () => getSettings().mode,
    setMode,
    setProvider,
    getProviderOptions,
    sendMessage,
  };
})();
