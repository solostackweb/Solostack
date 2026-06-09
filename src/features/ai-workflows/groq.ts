import "server-only";

import { requireServerEnv } from "@/config/env";

interface GroqChatMessage {
  role: "system" | "user";
  content: string;
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Parse JSON that a model returned, tolerating the quirks of reasoning models.
 * qwen3 / deepseek-r1 / qwq emit `<think>…</think>` traces and sometimes wrap
 * the JSON in ```json fences or surrounding prose. We strip those and, as a
 * last resort, extract the first balanced object/array block before parsing.
 */
function parseJsonLoose(raw: string): unknown | null {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Hard ceiling on a single Groq round-trip so a slow upstream can't hang the
 *  user's request (and the serverless function) indefinitely. */
const GROQ_TIMEOUT_MS = 12_000;
/** One retry on transient failures (timeout / 5xx / 429), with brief backoff. */
const GROQ_MAX_ATTEMPTS = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateStructuredJson({
  messages,
  temperature = 0.2,
  maxTokens = 8000,
}: {
  messages: GroqChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<unknown | null> {
  const serverEnv = requireServerEnv();
  if (!serverEnv.groqApiKey) return null;

  // Reasoning models (qwen3, deepseek-r1, qwq, …) interleave a chain-of-thought
  // that corrupts naive JSON parsing. Tell Groq to keep that reasoning out of
  // the returned content; `parseJsonLoose` is a second line of defence in case
  // the flag isn't honoured. `max_tokens` must be generous because reasoning
  // tokens count toward the completion budget on these models.
  const isReasoningModel = /qwen3|qwq|deepseek-r1|-r1\b|reason/i.test(
    serverEnv.groqModel,
  );

  const body = JSON.stringify({
    model: serverEnv.groqModel,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    ...(isReasoningModel ? { reasoning_format: "hidden" } : {}),
  });

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
    // Abort the request if it exceeds the timeout — frees the function and lets
    // callers fall back to their local/deterministic path quickly.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverEnv.groqApiKey}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      // Retry transient upstream errors (rate limit / server) once; fail fast
      // on client errors (bad request, auth) since a retry won't help.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`Groq request failed with status ${res.status}`);
        if (attempt < GROQ_MAX_ATTEMPTS) {
          await sleep(300 * attempt);
          continue;
        }
        throw lastError;
      }
      if (!res.ok) {
        throw new Error(`Groq request failed with status ${res.status}`);
      }

      const json = (await res.json()) as GroqChatResponse;
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      return parseJsonLoose(content);
    } catch (err) {
      lastError = err;
      // Retry once on abort/network errors; otherwise stop.
      const retriable =
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TypeError");
      if (retriable && attempt < GROQ_MAX_ATTEMPTS) {
        await sleep(300 * attempt);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
