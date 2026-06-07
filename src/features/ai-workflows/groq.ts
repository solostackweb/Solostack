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

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: serverEnv.groqModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      ...(isReasoningModel ? { reasoning_format: "hidden" } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed with status ${res.status}`);
  }

  const json = (await res.json()) as GroqChatResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  return parseJsonLoose(content);
}
