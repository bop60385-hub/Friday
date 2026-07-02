const SYSTEM_PROMPT = `You are Friday, a calm and practical personal intelligence assistant.
Provide concise, actionable, and trustworthy guidance.`;

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: typeof item.content === 'string' ? item.content.trim() : '',
    }))
    .filter((item) => item.content.length > 0);
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const body = parseBody(req.body);
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const history = normalizeHistory(body.history);

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];

  try {
    const openAIResponse = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      return res.status(openAIResponse.status).json({ error: 'OpenAI request failed' });
    }

    const data = await openAIResponse.json();
    const responseText = data?.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
      return res.status(502).json({ error: 'Empty model response' });
    }

    return res.status(200).json({ response: responseText });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
