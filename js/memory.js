/* ============================================================
   FRIDAY — memory.js  v1.0
   Persistent local user profile and conversation recall
   ============================================================ */

'use strict';

const STORAGE_MEMORY = 'friday_memory';
const MAX_SUMMARIES  = 20;

/* ── Memory ──────────────────────────────────────────────────── */
const Memory = (() => {
  let _data = null;

  /* Low-level load / save */
  function _load() {
    if (!_data) {
      try { _data = JSON.parse(localStorage.getItem(STORAGE_MEMORY) || '{}'); }
      catch { _data = {}; }
    }
    return _data;
  }

  function _save() {
    try { localStorage.setItem(STORAGE_MEMORY, JSON.stringify(_data)); } catch {}
  }

  /* Generic key/value access */
  function get(key, fallback) {
    const d = _load();
    return d[key] !== undefined ? d[key] : fallback;
  }

  function set(key, value) {
    _load()[key] = value;
    _save();
  }

  /* Topic helpers */
  function addTopic(topic) {
    const list = get('favoriteTopics', []);
    const t    = topic.toLowerCase().trim();
    if (t && !list.includes(t)) { list.push(t); set('favoriteTopics', list); }
  }

  function addInterest(interest) {
    const list = get('interests', []);
    const i    = interest.toLowerCase().trim();
    if (i && !list.includes(i)) { list.push(i); set('interests', list); }
  }

  /* Conversation-summary helpers */
  function addConversationSummary(topic, snippet) {
    const list = get('conversationSummaries', []);
    list.push({
      date:    new Date().toISOString().split('T')[0],
      topic,
      snippet: snippet.slice(0, 80),
    });
    set('conversationSummaries', list.slice(-MAX_SUMMARIES));
  }

  /* ── Passive-learning patterns ─────────────────────────────── */
  const _TOPIC_PATTERNS = [
    { re: /\bai\b|artificial intelligence|machine.?learning|gpt|llm|neural/i, topic: 'AI' },
    { re: /\bfinance\b|financial|stocks?|markets?|invest|crypto|bitcoin|fund/i, topic: 'finance' },
    { re: /\btech\b|technology|software|programming|developer/i,               topic: 'technology' },
    { re: /news|world events?|current events?|politics|global/i,               topic: 'world events' },
    { re: /\bhealth\b|fitness|wellness|medical|diet|exercise/i,                topic: 'health' },
    { re: /\bscience\b|research|discovery|space|physics|biology/i,             topic: 'science' },
    { re: /\bbusiness\b|startup|entrepreneur|enterprise/i,                     topic: 'business' },
    { re: /\bsports?\b|football|soccer|basketball|tennis|cricket/i,            topic: 'sports' },
  ];

  const _INTEREST_PATTERNS = [
    { re: /financ(?:e|ial) opportunit|investment opportunit|grant|funding/i,   interest: 'financial opportunities' },
    { re: /ai (?:news|update|development|trend|tool)/i,                        interest: 'AI developments' },
    { re: /market (?:update|analysis|trend|report)/i,                          interest: 'market analysis' },
    { re: /partner(?:ship)?|collaborat/i,                                       interest: 'partnerships' },
    { re: /automati(?:on|ng)|workflow/i,                                        interest: 'automation' },
  ];

  const _SUMMARY_PATTERNS = [
    { re: /financ(?:e|ial) opportunit|grant|funding/i,    topic: 'financial opportunities' },
    { re: /ai (?:news|update|development|trend)/i,         topic: 'AI developments' },
    { re: /market (?:update|analysis|trend)/i,             topic: 'market analysis' },
    { re: /partner(?:ship)?|collaborat/i,                  topic: 'partnerships' },
    { re: /\bweather\b/i,                                  topic: 'weather' },
    { re: /\bnews\b/i,                                     topic: 'news' },
  ];

  const _NAME_RE = [
    /(?:my name is|i(?:'m| am) called|call me)\s+([A-Z][a-z]+)/i,
    /^(?:i(?:'m| am))\s+([A-Z][a-z]+)(?:\s|$)/i,
  ];

  const _LOCATION_RE = [
    /(?:i(?:'m| am) in|i live in|i(?:'m| am) from|based in|located in)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\.|,|$)/i,
  ];

  /* Analyse a user message and update stored memory */
  function learnFromMessage(text) {
    /* Name */
    if (!get('userName', '')) {
      for (const re of _NAME_RE) {
        const m = text.match(re);
        if (m && m[1]) { set('userName', m[1]); break; }
      }
    }

    /* Location */
    if (!get('location', '')) {
      for (const re of _LOCATION_RE) {
        const m = text.match(re);
        if (m && m[1]) { set('location', m[1].trim()); break; }
      }
    }

    /* Topics */
    for (const { re, topic } of _TOPIC_PATTERNS) {
      if (re.test(text)) addTopic(topic);
    }

    /* Interests */
    for (const { re, interest } of _INTEREST_PATTERNS) {
      if (re.test(text)) addInterest(interest);
    }

    /* Conversation summaries */
    for (const { re, topic } of _SUMMARY_PATTERNS) {
      if (re.test(text)) { addConversationSummary(topic, text); break; }
    }
  }

  /* ── Recall / personalisation strings ─────────────────────── */
  function getRecallLines() {
    const lines      = [];
    const topics     = get('favoriteTopics', []);
    const interests  = get('interests', []);
    const summaries  = get('conversationSummaries', []);

    const _joinList = list => {
      if (list.length === 1) return list[0];
      if (list.length === 2) return `${list[0]} and ${list[1]}`;
      return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
    };

    if (topics.length >= 2) {
      lines.push(`I remember you follow ${_joinList(topics.slice(0, 3))}.`);
    } else if (topics.length === 1) {
      lines.push(`I remember you follow ${topics[0]}.`);
    }

    if (summaries.length > 0) {
      const last = summaries[summaries.length - 1];
      lines.push(`You previously asked about ${last.topic}.`);
    }

    if (interests.length > 0) {
      lines.push(`You have interests in ${_joinList(interests.slice(0, 3))}.`);
    }

    return lines;
  }

  function getRandomRecall() {
    const lines = getRecallLines();
    if (!lines.length) return '';
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /* Returns a personalised greeting prefix, or empty string if no data */
  function getPersonalisedGreeting() {
    const name   = get('userName', '');
    const recall = getRandomRecall();
    const parts  = [];
    if (name)   parts.push(`Welcome back, ${name}.`);
    if (recall) parts.push(recall);
    return parts.join(' ');
  }

  /* Wipe all stored memory */
  function clear() {
    _data = {};
    try { localStorage.removeItem(STORAGE_MEMORY); } catch {}
  }

  return {
    get, set,
    addTopic, addInterest, addConversationSummary,
    learnFromMessage,
    getRecallLines, getRandomRecall, getPersonalisedGreeting,
    clear,
  };
})();
