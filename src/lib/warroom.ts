import { supabase } from "./supabase";
import { isUniqueViolation } from "./utils";
import { fetchCommunityBySlug, joinCommunity } from "./queries";
import type { Community } from "./types";

/**
 * The War Room — one global, realtime, anonymous battle arena.
 *
 * It is backed by a normal community (slug `war-room`) so chat history,
 * RLS, realtime and rate limiting all reuse the existing infrastructure.
 * The first visitor auto-creates it; everyone auto-joins on entry.
 */

export const WAR_ROOM_SLUG = "war-room";

export interface WarRoom {
  community: Community;
  joined: boolean;
}

/** Find or create the war room, then make sure this user is a member. */
export async function enterWarRoom(uid: string): Promise<WarRoom> {
  let detail = await fetchCommunityBySlug(uid, WAR_ROOM_SLUG).catch(() => null);

  if (!detail) {
    // First visitor creates it. A race with another user simply falls
    // through to the re-fetch below (unique slug violation).
    const { error } = await supabase.from("communities").insert({
      name: "War Room",
      slug: WAR_ROOM_SLUG,
      description: "The global anonymous battle arena. Bring a hot take, leave with a scar.",
      is_restricted: false,
      created_by: uid,
    });
    if (error && !isUniqueViolation(error)) throw new Error(error.message);
    detail = await fetchCommunityBySlug(uid, WAR_ROOM_SLUG).catch(() => null);
  }

  if (!detail) throw new Error("Couldn't open the War Room. Try again.");

  if (!detail.joined) {
    await joinCommunity(uid, detail.community.id).catch(() => {});
  }

  return { community: detail.community, joined: true };
}

/** Battle-start prompts shown as quick-fire chips in the war room. */
export const WAR_PROMPTS: { label: string; text: string }[] = [
  { label: "🔥 Hot take", text: "Unpopular opinion time — I'll go first: " },
  { label: "⚔️ Challenge", text: "Anyone brave enough to defend this: " },
  { label: "🎯 Roast battle", text: "Roast battle, topic: " },
  { label: "🧠 Debate", text: "Pick a side and fight me on it: " },
  { label: "⚡ This or that", text: "Only one can win: " },
];
