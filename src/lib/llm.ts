// src/lib/llm.ts
//
// OpenAI-compatible LLM client.
//
// Why this file exists:
//   The original project used `z-ai-web-dev-sdk`, which hides the endpoint and
//   credentials and locks us to one provider. The user wants "live" mode
//   powered by an OpenAI-compatible endpoint of their choice (OpenAI, a local
//   Ollama / vLLM / LM Studio, OpenRouter, Groq, etc.). All of those speak the
//   same `/v1/chat/completions` shape, so a thin native-fetch wrapper is
//   enough and avoids adding the `openai` npm dep (keeps bundle/install lean
//   and works the same in Bun and Node).
//
// All five existing AI routes (analyze, deep-analyze, smart-search,
// rewrite-readme, recommendations) call `chat()` or `chatJSON()` from here.
// If we ever want streaming, switch providers, add retries, etc., we change
// only this file.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  /** Override the env-default model for a single call. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ask the server to return a JSON object. Only some providers honor it,
   *  but it's harmless for those that don't (we also parse defensively). */
  jsonMode?: boolean;
}

function getConfig() {
  // Read on every call so dev `.env` changes don't require a process restart
  // for the *next* request (the values are still cached by Next per-request).
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return { baseUrl, apiKey, model };
}

/**
 * Call the chat-completions endpoint and return the raw assistant string.
 * Throws on non-2xx so route handlers can decide how to surface the error.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  const { baseUrl, apiKey, model } = getConfig();

  const body: Record<string, unknown> = {
    model: opts.model ?? model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Some local providers (Ollama, LM Studio) don't require auth — sending
      // an empty Bearer is harmless for them and required for hosted ones.
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM request failed ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Convenience wrapper for prompts that ask the model to emit JSON.
 *
 * Why the defensive parsing: even with `response_format: json_object`, some
 * OpenAI-compatible endpoints (notably local llama.cpp / Ollama) wrap the
 * JSON in markdown fences or include a stray prose preamble. We strip the
 * common patterns before `JSON.parse` and return `null` on failure so callers
 * can fall back gracefully instead of crashing the whole request.
 */
export async function chatJSON<T = unknown>(opts: ChatOptions): Promise<T | null> {
  const raw = await chat({ ...opts, jsonMode: true });
  if (!raw) return null;

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```).
  let cleaned = raw.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();

  // Some models prepend "Here is the JSON:" — slice from first { or [.
  const firstBrace = cleaned.search(/[\{\[]/);
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * True if the LLM is configured well enough to attempt a call. Routes can use
 * this to return a friendly 503 instead of throwing.
 */
export function isLLMConfigured(): boolean {
  const { baseUrl, apiKey } = getConfig();
  // We accept missing apiKey for local providers but require a base URL.
  return Boolean(baseUrl);
}
