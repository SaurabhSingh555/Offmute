import type { Audience } from "./audience";
import { geminiJson, isGeminiConfigured } from "./gemini";

/**
 * AI Boost — the OFFMUTE AI coach.
 *
 * Helps posts get real engagement: the composer can polish a draft before
 * publishing, and a lonely post can be rescued with concrete tips.
 */

interface PolishPayload {
  body?: string;
}

/** Rewrite a draft so it hooks readers (meaning and language preserved). */
export async function polishPostDraft(
  text: string,
  audience: Audience | null
): Promise<string | null> {
  const draft = text.trim();
  if (!isGeminiConfigured || draft.length < 8) return null;

  const community =
    audience === "student"
      ? "college students (campus life, exams, placements, hostel chaos)"
      : "working professionals (offices, managers, night shifts, corporate life)";

  const prompt = [
    `You are the writing coach of an anonymous social app used by ${community}.`,
    `Rewrite the following anonymous post so it gets more engagement (replies and reactions).`,
    `Rules:`,
    `- Keep the same language (English, Hindi or Hinglish) and the same meaning.`,
    `- Add a strong first line hook, keep it punchy and conversational.`,
    `- Similar length or shorter (never longer than the original).`,
    `- No hashtags, no emojis, no bullet points, no quotes around the text.`,
    `- Never add real names, company names or private data.`,
    `Original post:`,
    `"""${draft.slice(0, 1500)}"""`,
    `Return strict JSON only: {"body":"rewritten post"}`,
  ].join("\n");

  try {
    const payload = await geminiJson<PolishPayload>(prompt, {
      temperature: 0.8,
      maxOutputTokens: 500,
    });
    const body = (payload?.body ?? "").replace(/\s+/g, " ").trim();
    if (body.length < 8 || body.length > 2000) return null;
    return body;
  } catch {
    return null;
  }
}

interface TipsPayload {
  tips?: string[];
}

/** Concrete, personalised tips to revive a post that gets no engagement. */
export async function engagementRescue(opts: {
  body: string;
  likes: number;
  comments: number;
  audience: Audience | null;
}): Promise<string[]> {
  const body = opts.body.trim();
  if (!isGeminiConfigured || !body) return [];

  const community =
    opts.audience === "student"
      ? "college students (campus, exams, placements, hostel life)"
      : "working professionals (offices, managers, night shifts)";

  const prompt = [
    `You are the growth coach of an anonymous social app for ${community}.`,
    `A user's post is sitting at ${opts.likes} likes and ${opts.comments} comments — basically zero engagement.`,
    `The post:`,
    `"""${body.slice(0, 1200)}"""`,
    `Give exactly 4 short, specific, actionable tips to get this post more replies.`,
    `Rules:`,
    `- Match the post's language (English, Hindi or Hinglish).`,
    `- Each tip under 120 characters, concrete and practical.`,
    `- Focus on what the user can do right now (ask a question, add a poll, timing, hook, joining a community).`,
    `- No emojis, no bullet numbering inside the text.`,
    `Return strict JSON only: {"tips":["...","...","...","..."]}`,
  ].join("\n");

  try {
    const payload = await geminiJson<TipsPayload>(prompt, {
      temperature: 0.7,
      maxOutputTokens: 400,
    });
    const tips = (payload?.tips ?? [])
      .map((t) => String(t).replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 4 && t.length < 220);
    return [...new Set(tips)].slice(0, 4);
  } catch {
    return [];
  }
}
