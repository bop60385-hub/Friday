'use strict';

(() => {
  const STORAGE_MEMORY = 'friday_user_memory';
  const STORAGE_PERSONALITY = 'friday_personality';
  // Keep memory small enough for localStorage while preserving recent context.
  const MAX_CONVERSATION_HISTORY = 120;
  // Track only high-signal recurring topics for lightweight personalization.
  const MAX_PREFERRED_TOPICS = 30;
  const MIN_TOPIC_WORD_LENGTH = 4;
  const TOPIC_WORD_REGEX = new RegExp(`[a-zA-Z]{${MIN_TOPIC_WORD_LENGTH},}`, 'g');
  const NAME_CAPTURE_REGEX = /\bmy name is\s+([a-zA-Z][a-zA-Z\-']{1,30})\b/i;
  const TOPIC_STOP_WORDS = new Set([
    'this', 'that', 'from', 'with', 'have', 'will', 'would', 'could', 'should', 'there',
    'their', 'about', 'into', 'your', 'youre', 'they', 'them', 'just', 'what', 'when',
    'where', 'which', 'while', 'been', 'being', 'were', 'very', 'more', 'most', 'some',
  ]);

  const PERSONALITIES = {
    professionalBritish: {
      id: 'professionalBritish',
      name: 'FRIDAY Professional',
      tone: {
        style: 'calm, intelligent, professional, loyal, encouraging, analytical, confident, respectful, slightly warm',
        maxSentenceLength: 'short',
        verbosity: 'concise',
      },
      greetings: {
        morning: 'Good morning, {name}. FRIDAY systems online.',
        evening: 'Good evening, {name}. How may I assist you today?',
        startup: 'FRIDAY online and ready.',
        shutdown: "Voice session terminated. I'll remain on standby.",
      },
      examples: {
        hello: 'Hello {name}. How may I help?',
        status: 'Operating normally and ready to assist.',
        thanks: "You're very welcome.",
        goodnight: "Sleep well, {name}. I'll remain on standby.",
        assessment: 'Based on the available information, here is my assessment.',
        general: "Understood. Based on what's available, my recommendation is to proceed with the clearest low-risk option first, then review the outcome.",
      },
      rules: {
        avoid: ['robotic', 'overly emotional', 'childish', 'sarcastic', 'excessively verbose'],
        uncertainty: 'Never claim certainty when uncertain.',
        recommendations: 'Offer practical recommendations with reasoning.',
        professionalism: 'Maintain professionalism and supportive language.',
      },
    },
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function merge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    const next = { ...base };
    Object.keys(patch).forEach((key) => {
      if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
        next[key] = merge(base[key] || {}, patch[key]);
      } else {
        next[key] = patch[key];
      }
    });
    return next;
  }

  const defaultMemory = {
    userName: 'Benny',
    preferredVoice: { lang: 'en-GB', rate: 0.9, pitch: 1.0 },
    preferredTopics: [],
    greetingPreference: 'timeAware',
    conversationHistory: [],
  };

  function template(text, memory) {
    return String(text || '').replace('{name}', memory.userName || 'Benny');
  }

  function inferIntent(input) {
    const text = String(input || '').trim().toLowerCase();
    if (!text) return 'empty';
    if (/\b(hello|hi|hey)\b/.test(text)) return 'hello';
    if (/how are you|how're you|how do you feel/.test(text)) return 'status';
    if (/\b(thank you|thanks|cheers)\b/.test(text)) return 'thanks';
    if (/\b(good night|night|sleep well)\b/.test(text)) return 'goodnight';
    if (/\b(what do you think|your assessment|your opinion)\b/.test(text)) return 'assessment';
    if (/\b(stressed|overwhelmed|anxious|worried)\b/.test(text)) return 'support';
    return 'general';
  }

  const Engine = {
    listPersonalities() {
      return Object.values(PERSONALITIES).map(p => ({ id: p.id, name: p.name }));
    },

    getActivePersonalityId() {
      const saved = read(STORAGE_PERSONALITY, { id: 'professionalBritish', config: {} });
      return saved.id in PERSONALITIES ? saved.id : 'professionalBritish';
    },

    setActivePersonality(id) {
      if (!(id in PERSONALITIES)) return false;
      const saved = read(STORAGE_PERSONALITY, { id: 'professionalBritish', config: {} });
      write(STORAGE_PERSONALITY, { ...saved, id });
      return true;
    },

    updateConfig(configPatch) {
      const saved = read(STORAGE_PERSONALITY, { id: 'professionalBritish', config: {} });
      write(STORAGE_PERSONALITY, { ...saved, config: merge(saved.config || {}, configPatch || {}) });
    },

    getProfile() {
      const saved = read(STORAGE_PERSONALITY, { id: 'professionalBritish', config: {} });
      const id = saved.id in PERSONALITIES ? saved.id : 'professionalBritish';
      return merge(PERSONALITIES[id], saved.config || {});
    },

    getMemory() {
      return merge(defaultMemory, read(STORAGE_MEMORY, defaultMemory));
    },

    setMemory(update) {
      const current = this.getMemory();
      const next = merge(current, update || {});
      if (Array.isArray(next.conversationHistory)) next.conversationHistory = next.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
      if (Array.isArray(next.preferredTopics)) next.preferredTopics = [...new Set(next.preferredTopics)].slice(0, MAX_PREFERRED_TOPICS);
      write(STORAGE_MEMORY, next);
      return next;
    },

    rememberUserName(name) {
      if (!name || !String(name).trim()) return;
      this.setMemory({ userName: String(name).trim() });
    },

    rememberPreferredVoice(voice = {}) {
      this.setMemory({
        preferredVoice: {
          lang: voice.lang || 'en-GB',
          rate: Number.isFinite(voice.rate) ? voice.rate : 0.9,
          pitch: Number.isFinite(voice.pitch) ? voice.pitch : 1.0,
          voiceName: voice.voiceName || '',
        },
      });
    },

    rememberConversation(userText, aiText) {
      const memory = this.getMemory();
      const conversationHistory = Array.isArray(memory.conversationHistory)
        ? memory.conversationHistory.slice(-(MAX_CONVERSATION_HISTORY - 1))
        : [];
      conversationHistory.push({
        time: new Date().toISOString(),
        user: String(userText || ''),
        ai: String(aiText || ''),
      });
      const words = (String(userText || '').toLowerCase().match(TOPIC_WORD_REGEX) || [])
        .filter(word => !TOPIC_STOP_WORDS.has(word));
      const preferredTopics = [...new Set([...(memory.preferredTopics || []), ...words])]
        .slice(-MAX_PREFERRED_TOPICS);
      this.setMemory({ conversationHistory, preferredTopics });
    },

    greeting(kind = 'startup') {
      const profile = this.getProfile();
      const memory = this.getMemory();
      if (kind === 'startup') return profile.greetings.startup;
      if (kind === 'shutdown') return profile.greetings.shutdown;
      if (kind === 'morning') return template(profile.greetings.morning, memory);
      if (kind === 'evening') return template(profile.greetings.evening, memory);
      const hour = new Date().getHours();
      if (hour < 12) return template(profile.greetings.morning, memory);
      if (hour >= 18) return template(profile.greetings.evening, memory);
      return `Good afternoon, ${memory.userName}. How may I assist you today?`;
    },

    defaultResponse() {
      return this.getProfile().examples.general;
    },

    respond(userText) {
      const providedName = String(userText || '').match(NAME_CAPTURE_REGEX)?.[1];
      if (providedName) this.rememberUserName(providedName);
      const intent = inferIntent(userText);
      const profile = this.getProfile();
      const memory = this.getMemory();
      const map = profile.examples;

      if (intent === 'hello') return template(map.hello, memory);
      if (intent === 'status') return map.status;
      if (intent === 'thanks') return map.thanks;
      if (intent === 'goodnight') return template(map.goodnight, memory);
      if (intent === 'assessment') return map.assessment;
      if (intent === 'support') return `Understood, ${memory.userName}. Let's take this one step at a time. I recommend we focus on the highest-impact action first.`;
      if (intent === 'empty') return 'Ready when you are.';

      return this.defaultResponse();
    },
  };

  window.FridayPersonalityEngine = Engine;
})();
