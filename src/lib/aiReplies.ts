import type { Audience } from "./audience";
import type { CommentItem } from "./types";
import { geminiJson, isGeminiConfigured } from "./gemini";
import { addLocalNotif } from "./localNotifs";
import { generateHandle, hashStr } from "./utils";

/**
 * AI "community replies".
 *
 * When a post is created (or a lonely older post is opened), Gemini writes a
 * few short replies in the voice of different anonymous members. They are
 * cached in this browser and merged into the comment thread so the poster
 * always sees an active conversation — even while the real community is still
 * small.
 */

export interface AiReply {
  id: string;
  handle: string;
  body: string;
  created_at: string;
}

const STORAGE_KEY = "om-ai-replies";
const EVENT = "om:ai-replies";
const MAX_REPLIES = 3;
const pending = new Map<string, Promise<void>>();

type ReplyStore = Record<string, AiReply[]>;

function loadStore(): ReplyStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReplyStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: ReplyStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota */
  }
}

function emit(postId: string) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { postId } }));
  } catch {
    /* non-browser */
  }
}

export function aiRepliesFor(postId: string): AiReply[] {
  const list = loadStore()[postId];
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && typeof r.body === "string" && r.body.trim().length > 0);
}

export function aiReplyCount(postId: string): number {
  return aiRepliesFor(postId).length;
}

/** Add locally generated reply counts to post cards. */
export function applyAiReplyCounts<T extends { id: string; commentCount: number }>(
  posts: T[]
): T[] {
  return posts.map((post) => {
    const extra = aiReplyCount(post.id);
    return extra > 0 ? { ...post, commentCount: post.commentCount + extra } : post;
  });
}

export function removeAiReplies(postId: string) {
  const store = loadStore();
  if (!store[postId]) return;
  delete store[postId];
  saveStore(store);
  emit(postId);
}

interface GeminiReplyPayload {
  replies?: { body?: string }[];
}

function normalizeBodies(payload: unknown, limit: number): string[] {
  let bodies: string[] = [];

  if (Array.isArray(payload)) {
    bodies = payload.map((item) =>
      typeof item === "string" ? item : (item as { body?: string })?.body ?? ""
    );
  } else if (payload && typeof payload === "object") {
    const replies = (payload as GeminiReplyPayload).replies;
    if (Array.isArray(replies)) {
      bodies = replies.map((reply) =>
        typeof reply === "string" ? reply : reply?.body ?? ""
      );
    }
  }

  const seen = new Set<string>();
  return bodies
    .map((body) =>
      String(body)
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^["'“”]|["'“”]$/g, "")
    )
    .filter((body) => {
      if (body.length < 2 || body.length > 280) return false;
      const key = body.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function makeReplies(postId: string, bodies: string[]): AiReply[] {
  const used = new Set<string>();
  const now = Date.now();

  return bodies.map((body, index) => {
    let handle = generateHandle();
    let guard = 0;
    while (used.has(handle) && guard++ < 20) handle = generateHandle();
    used.add(handle);

    return {
      id: `ai-${postId}-${now.toString(36)}-${index}-${Math.abs(hashStr(handle)) % 9999}`,
      handle,
      body,
      created_at: new Date(now - (bodies.length - index) * 45_000).toISOString(),
    };
  });
}

export function generateAiReplies(opts: {
  postId: string;
  body: string;
  audience?: Audience | null;
  authorHandle?: string | null;
  /** When set, drop an in-app notification for the post's author. */
  uid?: string | null;
}): Promise<void> {
  const { postId } = opts;
  const body = (opts.body ?? "").trim();

  if (!isGeminiConfigured || !postId || !body) return Promise.resolve();
  if (aiRepliesFor(postId).length > 0) return Promise.resolve();

  const inflight = pending.get(postId);
  if (inflight) return inflight;

  const audience = opts.audience ?? "corporate";
  const community =
    audience === "student"
      ? "college/student community (students, hostel life, exams, placements, internships)"
      : "corporate/office community (working professionals, meetings, managers, night shifts)";

  const prompt = [
    `You are simulating a few different anonymous members of a ${community} on a social app called OFFMUTE.`,
    `A user just posted this anonymously:`,
    `"""${body.slice(0, 1200)}"""`,
    `Write ${MAX_REPLIES} short replies as ${MAX_REPLIES} completely different people.`,
    `Rules:`,
    `- Match the language and tone of the post (English, Hindi or Hinglish if the post uses it).`,
    `- Each reply must be 1-2 sentences, natural, and specific to the post, under 220 characters.`,
    `- Vary the voices: one supportive, one funny or sarcastic, one curious or asking a follow-up.`,
    `- Never say you are an AI, a bot, or a simulation. Never mention OFFMUTE's system.`,
    `- No real names, company names, phone numbers, addresses, slurs or abusive content.`,
    `- No hashtags, no emojis, no bullet points.`,
    opts.authorHandle
      ? `- The original poster's handle is @${opts.authorHandle}. Do not impersonate or address them by handle.`
      : `- Do not address the original poster by any name.`,
    `Return strict JSON only, with this exact shape:`,
    `{"replies":[{"body":"..."},{"body":"..."},{"body":"..."}]}`,
  ].join("\n");

  const task = (async () => {
    try {
      const payload = await geminiJson<GeminiReplyPayload>(prompt, {
        temperature: 1,
        maxOutputTokens: 500,
      });
      const bodies = normalizeBodies(payload, MAX_REPLIES);
      if (!bodies.length) return;

      const store = loadStore();
      if (store[postId]?.length) return;
      const replies = makeReplies(postId, bodies);
      store[postId] = replies;
      saveStore(store);
      emit(postId);
      if (opts.uid) {
        addLocalNotif(opts.uid, {
          postId,
          preview: replies[0]?.body,
          count: replies.length,
        });
      }
    } catch {
      /* Silent: the feed still works without AI replies. */
    } finally {
      pending.delete(postId);
    }
  })();

  pending.set(postId, task);
  return task;
}

export function mergeAiComments(postId: string, real: CommentItem[]): CommentItem[] {
  const ai = aiRepliesFor(postId);
  if (!ai.length) return real;

  const mapped: CommentItem[] = ai.map((reply) => ({
    id: reply.id,
    body: reply.body,
    created_at: reply.created_at,
    user_id: `ai-${reply.id}`,
    parent_comment_id: null,
    profile: { handle: reply.handle, avatar_url: null },
    replies: [],
    isAi: true,
  }));

  return [...real, ...mapped].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

export const AI_REPLIES_EVENT = EVENT;
