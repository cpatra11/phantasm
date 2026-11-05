/**
 * Meta Model API access layer.
 * Base URL: https://api.meta.ai/v1 — OpenAI-compatible.
 * Without META_API_BASE_URL and META_API_KEY, every call falls back to deterministic
 * mocks, so the full pipeline still runs end to end.
 */
export const META_BASE_URL = process.env.META_API_BASE_URL ?? '';
export const META_API_KEY = process.env.META_API_KEY ?? '';
export const metaLive = Boolean(META_BASE_URL && META_API_KEY);

/** base URL without a trailing slash */
export const BASE = META_BASE_URL.replace(/\/$/, '');

export const WONDER_MODEL = 'muse-wonder-1.0';
// Reasoning model: it spends tokens thinking before answering.
export const SPARK_MODEL = 'muse-spark-1.3';
export const IMAGE_MODEL = 'muse-image-1.0';
export const SAM_MODEL = 'sam-3.1';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] };

export async function metaPost(path: string, body: unknown, accept?: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${META_API_KEY}`,
      'content-type': 'application/json',
      ...(accept ? { accept } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Meta ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** One non-streaming chat turn. All chat uses want JSON, so JSON mode is always on. */
export async function metaChat(model: string, messages: ChatMessage[], maxTokens = 12000): Promise<string> {
  const res = (await metaPost('/chat/completions', {
    model,
    messages,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  })) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = res.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`Meta ${model} returned no answer.`);
  return content;
}



/**
 * One chat turn that must return JSON matching `schema`.
 * Retries once with the validation error so the model can fix its output.
 */
export async function metaJSON<T>(
  model: string,
  system: string,
  user: string,
  schema: { parse: (value: unknown) => T },
  maxTokens = 12000,
): Promise<T> {
  return metaMessagesJSON(
    model,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    schema,
    maxTokens,
  );
}

/** Same JSON contract, but the user turn carries images (vision). */
export async function metaVisionJSON<T>(
  model: string,
  system: string,
  user: string,
  imageUrls: string[],
  schema: { parse: (value: unknown) => T },
  maxTokens = 12000,
): Promise<T> {
  const content: ChatContentPart[] = [
    { type: 'text', text: user },
    ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  return metaMessagesJSON(
    model,
    [
      { role: 'system', content: system },
      { role: 'user', content },
    ],
    schema,
    maxTokens,
  );
}

async function metaMessagesJSON<T>(
  model: string,
  base: ChatMessage[],
  schema: { parse: (value: unknown) => T },
  maxTokens: number,
): Promise<T> {
  const messages: ChatMessage[] = [
    ...base,
  ];
  messages[0] = { role: 'system', content: `${String(messages[0].content)}\nReturn only a single valid JSON value. No markdown, no commentary.` };
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await metaChat(model, messages, maxTokens);
    try {
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      return schema.parse(JSON.parse(cleaned));
    } catch (e) {
      if (e instanceof SyntaxError) lastError = 'Output was not valid JSON.';
      else if (e instanceof Object && 'issues' in e) lastError = String(e);
      else throw e;
    }
    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: `That answer failed this check: ${lastError}\nReturn the corrected JSON value only.` });
  }
  throw new Error(`Meta ${model} could not produce valid output: ${lastError}`);
}

/** Streams SAM /responses as SSE, yielding each `data:` payload as an event object. */
export async function* samStreamEvent(body: Record<string, unknown>): AsyncGenerator<{ type: string } & Record<string, unknown>> {
  const res = await fetch(`${BASE}/responses`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${META_API_KEY}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Meta SAM failed: ${res.status} ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      yield JSON.parse(data) as { type: string } & Record<string, unknown>;
    }
  }
}
