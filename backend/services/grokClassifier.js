const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_XAI_MODEL = 'grok-4';
const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Travel',
  'Education',
  'Other'
];

function fallbackCategory(title = '') {
  const value = title.toLowerCase();
  if (/(food|restaurant|cafe|coffee|pizza|grocery|swiggy|zomato)/.test(value)) return 'Food';
  if (/(bus|train|taxi|uber|ola|fuel|petrol|metro)/.test(value)) return 'Transport';
  if (/(amazon|flipkart|mall|clothes|shoe|shopping)/.test(value)) return 'Shopping';
  if (/(electric|water|wifi|internet|rent|bill|recharge)/.test(value)) return 'Bills';
  if (/(doctor|medicine|hospital|pharmacy|health)/.test(value)) return 'Health';
  if (/(movie|netflix|game|concert|entertainment)/.test(value)) return 'Entertainment';
  if (/(flight|hotel|trip|travel)/.test(value)) return 'Travel';
  if (/(book|course|college|tuition|education)/.test(value)) return 'Education';
  return 'Other';
}

function parseJsonResponse(text = '') {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (innerError) {
      return null;
    }
  }
}

async function callGrok(messages) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return null;

  const isGroqCloudKey = apiKey.startsWith('gsk_') || apiKey.startsWith('gs');
  const apiUrl = isGroqCloudKey ? GROQ_API_URL : XAI_API_URL;
  const model = isGroqCloudKey
    ? process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
    : process.env.GROK_MODEL || DEFAULT_XAI_MODEL;
  const hasImageInput = messages.some(message =>
    Array.isArray(message.content) &&
    message.content.some(item => item.type === 'image_url')
  );

  const response = await fetch(apiUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      ...(isGroqCloudKey && hasImageInput ? { response_format: { type: 'json_object' } } : {}),
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI provider request failed with ${response.status}: ${errorText.slice(0, 300)}`);
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function classifyExpense({ title = '', amount = '' }) {
  try {
    const content = await callGrok([
      {
        role: 'system',
        content: `Classify an expense into exactly one of these categories: ${CATEGORIES.join(', ')}. Return only the category name.`
      },
      {
        role: 'user',
        content: `Title: ${title}\nAmount: ${amount}`
      }
    ]);

    return CATEGORIES.includes(content) ? content : fallbackCategory(title);
  } catch (error) {
    return fallbackCategory(title);
  }
}

async function analyzeBillImage(file) {
  if (!file) {
    throw new Error('Bill image is required.');
  }

  if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
    throw new Error('Only JPG and PNG bill images are supported.');
  }

  const fallbackTitle = file.originalname || 'Uploaded bill';
  const fallback = {
    title: fallbackTitle,
    amount: 0,
    category: fallbackCategory(fallbackTitle),
    notes: 'Could not analyze the bill image. Please verify the amount manually.'
  };

  try {
    const base64Image = file.buffer.toString('base64');
    const content = await callGrok([
      {
        role: 'system',
        content: `You extract expense details from bill or receipt images. Return strict JSON only with keys title, amount, category, notes. Category must be one of: ${CATEGORIES.join(', ')}. Amount must be the final payable total as a number.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${file.mimetype};base64,${base64Image}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: 'Read this bill image. Extract the merchant or bill title, final total amount, and expense category.'
          }
        ]
      }
    ]);

    const parsed = parseJsonResponse(content);
    if (!parsed) return fallback;

    const amount = Number(parsed.amount);
    const title = String(parsed.title || fallbackTitle).trim();
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : fallbackCategory(title);

    return {
      title,
      amount: Number.isFinite(amount) ? amount : 0,
      category,
      notes: String(parsed.notes || '').trim()
    };
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  CATEGORIES,
  analyzeBillImage,
  classifyExpense
};
