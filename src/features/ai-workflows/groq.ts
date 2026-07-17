import "server-only";

import { requireServerEnv } from "@/config/env";
import { log } from "@/lib/logger";

interface GroqChatMessage {
  role: "system" | "user";
  content: string;
}

/** Message shape for the tool-calling agent loop (OpenAI-compatible). */
export interface GroqAgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: GroqToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface AiProviderResultMeta {
  provider: "groq";
  outcome:
    | "succeeded"
    | "not_configured"
    | "model_rejected"
    | "http_error"
    | "network_error"
    | "empty_response"
    | "invalid_json";
  model: string | null;
  attempts: number;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
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
  operation = "structured_json",
  onResult,
}: {
  messages: GroqChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Stable, non-PII label used to monitor quality by assistant capability. */
  operation?: string;
  /** Server-only observer used by the durable Ivo run ledger. */
  onResult?: (result: AiProviderResultMeta) => void;
}): Promise<unknown | null> {
  const requestStartedAt = Date.now();
  let totalAttempts = 0;
  let lastModel: string | null = null;
  let lastOutcome: AiProviderResultMeta["outcome"] = "network_error";
  const report = (
    outcome: AiProviderResultMeta["outcome"],
    details: Partial<Pick<AiProviderResultMeta, "model" | "promptTokens" | "completionTokens" | "totalTokens">> = {},
  ) => {
    onResult?.({
      provider: "groq",
      outcome,
      model: details.model ?? lastModel,
      attempts: totalAttempts,
      durationMs: Date.now() - requestStartedAt,
      promptTokens: details.promptTokens ?? null,
      completionTokens: details.completionTokens ?? null,
      totalTokens: details.totalTokens ?? null,
    });
  };
  const serverEnv = requireServerEnv();
  if (!serverEnv.groqApiKey) {
    log.debug("ai.provider.skipped", { provider: "groq", operation, reason: "not_configured" });
    report("not_configured");
    return null;
  }

  // Try the configured model first, then the stable fallback if the configured
  // one is rejected as unknown/decommissioned.
  const models =
    serverEnv.groqModel === GROQ_FALLBACK_MODEL
      ? [serverEnv.groqModel]
      : [serverEnv.groqModel, GROQ_FALLBACK_MODEL];

  for (const model of models) {
    lastModel = model;
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
      totalAttempts += 1;
      // Abort the request if it exceeds the timeout — frees the function and lets
      // callers fall back to their local/deterministic path quickly.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
      const startedAt = Date.now();
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
          lastOutcome = "http_error";
          log.warn("ai.provider.retryable_http_error", {
            provider: "groq", operation, model, attempt, status: res.status,
            latencyMs: Date.now() - startedAt,
          });
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
          lastOutcome = "model_rejected";
          log.warn("ai.provider.model_rejected", {
            provider: "groq", operation, model, status: res.status,
            latencyMs: Date.now() - startedAt,
          });
          modelRejected = true;
          break;
        }

        if (!res.ok) {
          lastOutcome = "http_error";
          log.warn("ai.provider.http_error", {
            provider: "groq", operation, model, attempt, status: res.status,
            latencyMs: Date.now() - startedAt,
          });
          break;
        }

        const json = (await res.json()) as GroqChatResponse;
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          log.warn("ai.provider.empty_response", {
            provider: "groq", operation, model, attempt,
            latencyMs: Date.now() - startedAt,
          });
          report("empty_response", { model });
          return null;
        }
        const parsed = parseJsonLoose(content);
        if (parsed === null) {
          log.warn("ai.provider.invalid_json", {
            provider: "groq", operation, model, attempt,
            latencyMs: Date.now() - startedAt, responseChars: content.length,
          });
          report("invalid_json", { model });
          return null;
        }
        log.info("ai.provider.succeeded", {
          provider: "groq", operation, model, attempt,
          latencyMs: Date.now() - startedAt,
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
          totalTokens: json.usage?.total_tokens,
        });
        report("succeeded", {
          model,
          promptTokens: json.usage?.prompt_tokens ?? null,
          completionTokens: json.usage?.completion_tokens ?? null,
          totalTokens: json.usage?.total_tokens ?? null,
        });
        return parsed;
      } catch (err) {
        lastOutcome = "network_error";
        // Retry once on abort/network errors; otherwise stop this model.
        const retriable =
          err instanceof Error &&
          (err.name === "AbortError" || err.name === "TypeError");
        if (retriable && attempt < GROQ_MAX_ATTEMPTS) {
          log.warn("ai.provider.retryable_network_error", {
            provider: "groq", operation, model, attempt,
            reason: err instanceof Error ? err.name : "unknown",
            latencyMs: Date.now() - startedAt,
          });
          await sleep(300 * attempt);
          continue;
        }
        log.warn("ai.provider.network_error", {
          provider: "groq", operation, model, attempt,
          reason: err instanceof Error ? err.name : "unknown",
          latencyMs: Date.now() - startedAt,
        });
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
  report(lastOutcome);
  return null;
}

export interface GroqToolChatResult {
  content: string | null;
  toolCalls: GroqToolCall[];
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

interface GroqStreamDelta {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
}

/**
 * Consume an OpenAI-compatible SSE completion stream: forward text deltas,
 * assemble tool calls from their argument fragments, and capture usage from
 * the final chunk. Aborts via the shared controller if chunks stop arriving.
 */
async function readGroqStream(
  body: ReadableStream<Uint8Array>,
  controller: AbortController,
  onDelta: (text: string) => void,
): Promise<Omit<GroqToolChatResult, "model"> | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = new Map<number, GroqToolCall>();
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;

  let idle: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(),
    GROQ_TIMEOUT_MS,
  );
  const resetIdle = () => {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let chunk: GroqStreamDelta;
        try {
          chunk = JSON.parse(payload) as GroqStreamDelta;
        } catch {
          continue; // partial/malformed frame
        }
        const delta = chunk.choices?.[0]?.delta;
        if (typeof delta?.content === "string" && delta.content) {
          content += delta.content;
          onDelta(delta.content);
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const fragment of delta.tool_calls) {
            const index = Number(fragment.index ?? 0);
            const existing = toolCalls.get(index) ?? {
              id: "",
              type: "function" as const,
              function: { name: "", arguments: "" },
            };
            if (typeof fragment.id === "string" && fragment.id) existing.id = fragment.id;
            if (typeof fragment.function?.name === "string" && fragment.function.name) {
              existing.function.name = fragment.function.name;
            }
            if (typeof fragment.function?.arguments === "string") {
              existing.function.arguments += fragment.function.arguments;
            }
            toolCalls.set(index, existing);
          }
        }
        const usage = chunk.usage ?? chunk.x_groq?.usage;
        if (usage) {
          promptTokens = usage.prompt_tokens ?? promptTokens;
          completionTokens = usage.completion_tokens ?? completionTokens;
        }
      }
    }
  } catch (err) {
    log.warn("ai.provider.stream_error", {
      provider: "groq",
      reason: err instanceof Error ? err.name : "unknown",
    });
    return null;
  } finally {
    if (idle) clearTimeout(idle);
    reader.releaseLock();
  }

  return {
    content: content || null,
    toolCalls: [...toolCalls.values()].filter((call) => call.id && call.function.name),
    promptTokens,
    completionTokens,
  };
}

/**
 * One tool-calling chat round for the Ivo agent loop. Unlike
 * `generateStructuredJson`, the model may either answer in natural language
 * or request one/more tool invocations; the caller owns the loop.
 * Returns null when Groq is unavailable so callers can fall back to the
 * deterministic router.
 */
export async function generateToolChat({
  messages,
  tools,
  temperature = 0.3,
  maxTokens = 2000,
  operation = "agent_chat",
  onDelta,
}: {
  messages: GroqAgentMessage[];
  tools: GroqToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  operation?: string;
  /**
   * When provided, the request streams and text deltas are forwarded as they
   * arrive (tool-call rounds usually produce no text). The resolved result is
   * identical to the non-streaming shape.
   */
  onDelta?: (text: string) => void;
}): Promise<GroqToolChatResult | null> {
  const serverEnv = requireServerEnv();
  if (!serverEnv.groqApiKey) {
    log.debug("ai.provider.skipped", { provider: "groq", operation, reason: "not_configured" });
    return null;
  }

  const models =
    serverEnv.groqModel === GROQ_FALLBACK_MODEL
      ? [serverEnv.groqModel]
      : [serverEnv.groqModel, GROQ_FALLBACK_MODEL];

  for (const model of models) {
    const isGptOss = /gpt-oss|oss-120|oss-20/i.test(model);
    const isReasoningModel =
      isGptOss || /qwen3|qwq|deepseek-r1|-r1\b|reason/i.test(model);
    const body = JSON.stringify({
      model,
      messages,
      ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      temperature,
      max_tokens: isReasoningModel ? Math.max(maxTokens, 3000) : maxTokens,
      ...(isReasoningModel ? { reasoning_format: "hidden" } : {}),
      ...(isGptOss ? { reasoning_effort: "low" } : {}),
      ...(onDelta ? { stream: true, stream_options: { include_usage: true } } : {}),
    });

    let modelRejected = false;
    for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
      const startedAt = Date.now();
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
        if (res.status === 429 || res.status >= 500) {
          if (attempt < GROQ_MAX_ATTEMPTS) {
            await sleep(300 * attempt);
            continue;
          }
          break;
        }
        if (res.status === 400 || res.status === 404) {
          log.warn("ai.provider.model_rejected", {
            provider: "groq", operation, model, status: res.status,
            latencyMs: Date.now() - startedAt,
          });
          modelRejected = true;
          break;
        }
        if (!res.ok) break;

        if (onDelta && res.body) {
          // Streaming mode. The initial timer guarded time-to-first-byte;
          // from here an idle timer aborts if chunks stop arriving.
          clearTimeout(timer);
          const streamed = await readGroqStream(res.body, controller, onDelta);
          if (!streamed) return null;
          log.info("ai.provider.succeeded", {
            provider: "groq", operation, model, attempt, streamed: true,
            latencyMs: Date.now() - startedAt,
            promptTokens: streamed.promptTokens,
            completionTokens: streamed.completionTokens,
            toolCalls: streamed.toolCalls.length,
          });
          return { ...streamed, model };
        }

        const json = (await res.json()) as GroqChatResponse;
        const message = json.choices?.[0]?.message;
        if (!message) return null;
        log.info("ai.provider.succeeded", {
          provider: "groq", operation, model, attempt,
          latencyMs: Date.now() - startedAt,
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
          toolCalls: message.tool_calls?.length ?? 0,
        });
        return {
          content: typeof message.content === "string" ? message.content : null,
          toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
          model,
          promptTokens: json.usage?.prompt_tokens ?? null,
          completionTokens: json.usage?.completion_tokens ?? null,
        };
      } catch (err) {
        const retriable =
          err instanceof Error &&
          (err.name === "AbortError" || err.name === "TypeError");
        if (retriable && attempt < GROQ_MAX_ATTEMPTS) {
          await sleep(300 * attempt);
          continue;
        }
        log.warn("ai.provider.network_error", {
          provider: "groq", operation, model,
          reason: err instanceof Error ? err.name : "unknown",
          latencyMs: Date.now() - startedAt,
        });
        break;
      } finally {
        clearTimeout(timer);
      }
    }
    if (!modelRejected) break;
  }
  return null;
}
