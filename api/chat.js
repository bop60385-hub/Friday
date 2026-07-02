const SYSTEM_PROMPT = `You are Friday, a British female intelligence assistant.
You are calm, intelligent, professional, supportive, and analytical.
You help Benny stay informed, make decisions, analyse information, and remain organised.
Avoid repetitive responses, ask thoughtful follow-up questions when useful, admit uncertainty clearly, and speak naturally.`;

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

function getOpenAIErrorMessage(status, errorType) {
  if (status === 401 || errorType === 'invalid_request_error') return 'OpenAI authentication failed';
  if (status === 429 || errorType === 'rate_limit_error') return 'OpenAI rate limit exceeded';
  if (status >= 500) return 'OpenAI service unavailable';
  return 'OpenAI request failed';
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
      const errorPayload = await openAIResponse.json().catch((parseError) => {
        console.error('Failed to parse OpenAI error response:', parseError?.name || 'Error');
        return {};
      });
      const errorType = errorPayload?.error?.type;
      const errorMessage = getOpenAIErrorMessage(openAIResponse.status, errorType);
      return res.status(openAIResponse.status).json({ error: errorMessage });
    }

    const data = await openAIResponse.json();
    if (!Array.isArray(data?.choices) || data.choices.length === 0) {
      return res.status(502).json({ error: 'Invalid model response' });
    }

    const responseText = data.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return res.status(502).json({ error: 'Empty model response' });
    }

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('OpenAI chat endpoint error:', error?.name || 'Error');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
