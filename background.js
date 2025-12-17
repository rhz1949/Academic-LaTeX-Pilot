const SYSTEM_PROMPT = ({ context_text, target_text }) => `You are an academic writing assistant.
INPUT CONTEXT: ${context_text || ''}
INPUT TARGET: ${target_text}

TASK:
1. Analyze the CONTEXT to understand the specific academic field and terminology.
2. Polish the TARGET Chinese text to be logically sound and academic.
3. Translate the polished text into professional English LaTeX code.

OUTPUT JSON format:
{
  "polished_cn": "...",
  "translated_en": "..."
}`;

const GEMINI_MODEL = 'gemini-1.5-flash-latest';

const buildGeminiRequest = (prompt, apiKey) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
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

const parseGeminiResponse = async (response) => {
  const data = await response.json();
  if (!data.candidates || !data.candidates.length) {
    throw new Error('No candidates returned from Gemini');
  }
  const text = data.candidates[0].content?.parts?.[0]?.text || '';
  return parseModelText(text);
};

const parseOpenAIResponse = async (response) => {
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseModelText(text);
};

const parseModelText = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse model output as JSON, returning raw text', err);
    return { polished_cn: '', translated_en: text };
  }
};

const handleRequest = async ({ target_text, context_text, api_key, provider }) => {
  if (!api_key) {
    throw new Error('API Key missing');
  }
  const prompt = SYSTEM_PROMPT({ target_text, context_text });
  if (provider === 'gemini') {
    const { url, body } = buildGeminiRequest(prompt, api_key);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini error: ${errorText}`);
    }
    return parseGeminiResponse(response);
  }

  const { url, body, headers } = buildOpenAIRequest(prompt, api_key);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }
  return parseOpenAIResponse(response);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'ai-translate') return;
  handleRequest(message)
    .then((data) => sendResponse({ success: true, data }))
    .catch((err) => {
      console.error(err);
      sendResponse({ success: false, error: err.message });
    });
  return true;
});
