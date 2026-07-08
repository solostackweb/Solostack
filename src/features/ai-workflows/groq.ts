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

/**
 * Known-stable Groq production model. Groq regularly decommissions preview
 * models (e.g. qwen/qwen3-32b was retired 2026-06-17), after which the API
 * rejects requests for them with a 400/404. When the *configured* model is
 * rejected we transparently retry with this fallback so a single upstream
 * decommission can never silently break the in-app assistant.
 */
const GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";

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

  // Try the configured model first, then the stable fallback if the configured
  // one is rejected as unknown/decommissioned.
  const models =
    serverEnv.groqModel === GROQ_FALLBACK_MODEL
      ? [serverEnv.groqModel]
      : [serverEnv.groqModel, GROQ_FALLBACK_MODEL];

  for (const model of models) {
    // Reasoning models handle chain-of-thought differently. With Groq JSON mode,
    // reasoning must be returned separately or hidden; raw reasoning in content
    // is rejected. GPT-OSS also accepts `reasoning_effort`, so keep it low for
    // fast structured extraction while still requesting hidden reasoning.
    // Reasoning tokens count toward the completion budget, so floor max_tokens
    // for reasoning models to avoid truncating the JSON answer.
    const isGptOss = /gpt-oss|oss-120|oss-20/i.test(model);
    const isReasoningModel =
      isGptOss || /qwen3|qwq|deepseek-r1|-r1\b|reason/i.test(model);
    const effectiveMaxTokens =
      isGptOss || isReasoningModel ? Math.max(maxTokens, 4000) : maxTokens;

    const body = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: effectiveMaxTokens,
      response_format: { type: "json_object" },
      ...(isReasoningModel ? { reasoning_format: "hidden" } : {}),
      ...(isGptOss ? { reasoning_effort: "low" } : {}),
    });

    let modelRejected = false;

    for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
      // Abort the request if it exceeds the timeout — frees the function and lets
      // callers fall back to their local/deterministic path quickly.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
      try {
        const res = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serverEnv.groqApiKey}`,
              "Content-Type": "application/json",
            },
            body,
            signal: controller.signal,
          },
        );

        // Retry transient upstream errors (rate limit / server) once.
        if (res.status === 429 || res.status >= 500) {
          if (attempt < GROQ_MAX_ATTEMPTS) {
            await sleep(300 * attempt);
            continue;
          }
          break; // give up on this model
        }

        // A 400/404 almost always means the model name is unknown or has been
        // decommissioned. Don't retry the same model — fall through to the next
        // candidate (the stable fallback).
        if (res.status === 400 || res.status === 404) {
          modelRejected = true;
          break;
        }

        if (!res.ok) {
          break;
        }

        const json = (await res.json()) as GroqChatResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content) return null;
        return parseJsonLoose(content);
      } catch (err) {
        // Retry once on abort/network errors; otherwise stop this model.
        const retriable =
          err instanceof Error &&
          (err.name === "AbortError" || err.name === "TypeError");
        if (retriable && attempt < GROQ_MAX_ATTEMPTS) {
          await sleep(300 * attempt);
          continue;
        }
        break;
      } finally {
        clearTimeout(timer);
      }
    }

    // Only advance to the fallback model when the current one was outright
    // rejected. For transient/network failures we don't, since the fallback
    // would likely hit the same condition.
    if (!modelRejected) break;
  }

  // Every candidate failed. Return null so callers fall back gracefully instead
  // of surfacing an exception.
  return null;
}
