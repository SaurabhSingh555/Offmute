import { supabase } from "./supabase";
import { INVITE_POINTS } from "./referrals";

/**
 * OFFMUTE score — a Snapchat-style activity score.
 *
 * The score is always derived from real activity in the database, so it can
 * never drift out of sync and needs no extra tables or migrations:
 *
 *   posts x 10, comments x 3, likes given x 2, poll votes x 2,
 *   war-room messages x 1, invites x 25, plus a daily streak bonus.
 */

export const SCORE_RULES = [
  { key: "posts", label: "Posts published", per: 10 },
  { key: "comments", label: "Comments written", per: 3 },
  { key: "likes", label: "Likes given", per: 2 },
  { key: "pollVotes", label: "Poll votes", per: 2 },
  { key: "warMsgs", label: "War room messages", per: 1 },
  { key: "invites", label: "Friends invited", per: INVITE_POINTS },
] as const;

export const STREAK_BONUS_PER_DAY = 5;

export interface ScoreBreakdown {
  posts: number;
  comments: number;
  likes: number;
  pollVotes: number;
  warMsgs: number;
  invites: number;
  streak: number;
}

export interface MyScore {
  total: number;
  streak: number;
  bestStreak: number;
  breakdown: ScoreBreakdown;
}

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  posts: 0,
  comments: 0,
  likes: 0,
  pollVotes: 0,
  warMsgs: 0,
  invites: 0,
  streak: 0,
};

async function countRows(
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) return 0;
  return count ?? 0;
}

/** Distinct YYYY-MM-DD activity days from ISO timestamps. */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function currentStreakFrom(days: Set<string>): number {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  if (days.size === 0) return 0;
  // Streak alive only if active today or yesterday.
  if (!days.has(today) && !days.has(yesterday)) return 0;
  let cursor = days.has(today) ? today : yesterday;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = dayKey(
      new Date(new Date(`${cursor}T12:00:00Z`).getTime() - 86400000).toISOString()
    );
  }
  return streak;
}

async function fetchActiveDays(table: string, uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select("created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return [];
  return (data ?? []).map((r) => r.created_at as string);
}

export async function fetchMyScore(uid: string): Promise<MyScore> {
  if (!uid) {
    return { total: 0, streak: 0, bestStreak: 0, breakdown: { ...EMPTY_BREAKDOWN } };
  }

  const [posts, comments, likes, pollVotes, warMsgs, invites, postDays, commentDays] =
    await Promise.all([
      countRows("posts", "user_id", uid),
      countRows("comments", "user_id", uid),
      countRows("likes", "user_id", uid),
      countRows("poll_votes", "user_id", uid),
      countRows("community_messages", "user_id", uid),
      countRows("referrals", "inviter_id", uid),
      fetchActiveDays("posts", uid),
      fetchActiveDays("comments", uid),
    ]);

  const activeDays = new Set<string>([...postDays, ...commentDays].map(dayKey));
  const streak = currentStreakFrom(activeDays);

  const breakdown: ScoreBreakdown = {
    posts,
    comments,
    likes,
    pollVotes,
    warMsgs,
    invites,
    streak,
  };

  const base =
    posts * 10 +
    comments * 3 +
    likes * 2 +
    pollVotes * 2 +
    warMsgs * 1 +
    invites * INVITE_POINTS;

  return {
    total: base + streak * STREAK_BONUS_PER_DAY,
    streak,
    // Best streak approximation: total distinct active days (an upper bound).
    bestStreak: activeDays.size,
    breakdown,
  };
}

export function scoreLevel(total: number): {
  label: string;
  next: number;
  min: number;
} {
  const levels: [number, string][] = [
    [0, "Lurker"],
    [50, "Voice"],
    [150, "Regular"],
    [400, "Loud"],
    [1000, "Legend"],
    [2500, "Unmuteable"],
  ];
  let current = levels[0];
  let next = levels[1][0];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (total >= levels[i][0]) {
      current = levels[i];
      next = levels[i + 1]?.[0] ?? current[0];
      break;
    }
  }
  return { label: current[1], min: current[0], next };
}
