/**
 * Tiny Gemini REST client used by the "community replies" feature.
 *
 * NOTE: this runs in the browser because OFFMUTE is a static app. The key is
 * therefore part of the client bundle. For a public production launch, proxy
 * this through a small serverless function and keep the key server-side.
 */

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY ?? "").trim();
const MODEL =
  (import.meta.env.VITE_GEMINI_MODEL ?? "").trim() || "gemini-3.1-flash-lite";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 25_000;

export const isGeminiConfigured =
  API_KEY.length > 10 && !/YOUR_|PLACEHOLDER/i.test(API_KEY);

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export async function geminiGenerate(
  prompt: string,
  opts: GeminiOptions = {}
): Promise<string> {
  if (!isGeminiConfigured) throw new Error("Gemini is not configured.");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.9,
            maxOutputTokens: opts.maxOutputTokens ?? 600,
          },
        }),
      }
    );

    const data = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini request failed (${response.status})`);
    }
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) throw new Error("Gemini returned an empty response.");
    return text;
  } finally {
    window.clearTimeout(timer);
  }
}

function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through to bracket extraction */
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
  throw new Error("Gemini did not return valid JSON.");
}

export async function geminiJson<T>(
  prompt: string,
  opts: GeminiOptions = {}
): Promise<T> {
  const raw = await geminiGenerate(prompt, opts);
  return parseJsonLoose<T>(raw);
}
