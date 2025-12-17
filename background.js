const POLISH_PROMPT = ({ context_text, target_text }) => `You are an academic writing assistant.

INPUT CONTEXT: ${context_text || ''}
INPUT TARGET: ${target_text}

TASK:
1. Analyze the CONTEXT to understand the academic field and terminology.
2. Polish the TARGET Chinese text to be logically sound, concise, and academic.
3. Output ONLY the polished Chinese text. No Markdown, no code fences.`;

const TRANSLATE_PROMPT = ({ context_text, polished_text }) => `You are an academic writing assistant.

INPUT CONTEXT: ${context_text || ''}
POLISHED CHINESE: ${polished_text}

TASK:
1. Translate the POLISHED CHINESE into professional English LaTeX.
2. Return a compact JSON object only, without Markdown or fences.
   { "translated_en": "..." }`;

const GEMINI_ENDPOINTS = [
  { version: 'v1', model: 'gemini-1.5-flash-latest' },
  { version: 'v1', model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
];

const buildGeminiRequest = (prompt, apiKey, { version, model }) => {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };
  return { url, body };
};

const buildOpenAIRequest = (prompt, apiKey) => {
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.3,
  };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  return { url, body, headers };
};

const buildDeepSeekRequest = (prompt, apiKey) => {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.3,
  };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  return { url, body, headers };
};

const stripCodeFences = (text = '') => {
  const fenceMatch = text.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text.trim();
};

const parsePolishResponse = (text) => {
  const cleaned = stripCodeFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string') return parsed.trim();
    if (parsed.polished_cn) return String(parsed.polished_cn).trim();
  } catch (_) {
    // fall through
  }
  return cleaned;
};

const parseTranslateResponse = (text) => {
  const cleaned = stripCodeFences(text);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.translated_en) {
      return { translated_en: String(parsed.translated_en).trim() };
    }
    if (parsed.english || parsed.en) {
      return { translated_en: String(parsed.english || parsed.en).trim() };
    }
  } catch (_) {
    // fall through
  }
  return { translated_en: cleaned };
};

const parseGeminiResponse = async (response) => {
  const data = await response.json();
  if (!data.candidates || !data.candidates.length) {
    throw new Error('No candidates returned from Gemini');
  }
  return data.candidates[0].content?.parts?.[0]?.text || '';
};

const parseOpenAIStyleResponse = async (response) => {
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGemini = async (prompt, apiKey) => {
  let lastError = null;
  for (const endpoint of GEMINI_ENDPOINTS) {
    const { url, body } = buildGeminiRequest(prompt, apiKey, endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return parseGeminiResponse(response);
    }

    const errorText = await response.text();
    lastError = `Gemini error (${endpoint.version}/${endpoint.model}): ${errorText}`;

    if (response.status !== 404) break;
  }
  throw new Error(lastError || 'Gemini error: Unknown issue');
};

const callDeepSeek = async (prompt, apiKey) => {
  const { url, body, headers } = buildDeepSeekRequest(prompt, apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek error: ${errorText}`);
  }
  return parseOpenAIStyleResponse(response);
};

const callOpenAI = async (prompt, apiKey) => {
  const { url, body, headers } = buildOpenAIRequest(prompt, apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }
  return parseOpenAIStyleResponse(response);
};

const callProvider = async ({ provider, prompt, apiKey }) => {
  if (!apiKey) throw new Error('API Key missing');
  if (provider === 'gemini') return callGemini(prompt, apiKey);
  if (provider === 'deepseek') return callDeepSeek(prompt, apiKey);
  return callOpenAI(prompt, apiKey);
};

const handlePolish = async ({ target_text, context_text, api_key, provider }) => {
  const prompt = POLISH_PROMPT({ target_text, context_text });
  const raw = await callProvider({ provider, prompt, apiKey: api_key });
  return { polished_cn: parsePolishResponse(raw) };
};

const handleTranslate = async ({ polished_text, context_text, api_key, provider }) => {
  const prompt = TRANSLATE_PROMPT({ polished_text, context_text });
  const raw = await callProvider({ provider, prompt, apiKey: api_key });
  return parseTranslateResponse(raw);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ai-polish') {
    handlePolish(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === 'ai-translate') {
    handleTranslate(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  return false;
});
