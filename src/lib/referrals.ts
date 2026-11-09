import { supabase } from "./supabase";
import { hashStr } from "./utils";

/**
 * Invite / referral program.
 *
 * Every profile can own a short invite code. A visitor arriving with
 * `?invite=CODE` (or `?ref=CODE`) keeps the code in localStorage until they
 * finish signing up, at which point a row is written to `public.referrals`
 * and the inviter earns points.
 *
 * All calls fail soft while the referral migration has not been applied, so
 * the rest of the app keeps working on the base schema.
 */

export const INVITE_POINTS = 10;

const PENDING_KEY = "om-pending-invite";
const CODE_RE = /^OM[A-Z0-9]{4,10}$/;

let schemaAvailable: boolean | null = null;

export function isReferralSchemaAvailable(): boolean {
  return schemaAvailable !== false;
}

export function makeInviteCode(uid: string, salt = ""): string {
  const hash = hashStr(`${uid}:${salt}`).toString(36).toUpperCase();
  return `OM${hash.padStart(6, "0").slice(-6)}`;
}

export function inviteLink(code: string): string {
  if (typeof window === "undefined") return `/?invite=${code}`;
  try {
    return `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
  } catch {
    return `/?invite=${code}`;
  }
}

/** Remember an invite code from the current URL (landing or auth page). */
export function captureInviteFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("invite") ?? url.searchParams.get("ref") ?? "")
      .trim()
      .toUpperCase();
    if (CODE_RE.test(code)) localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* non-browser / malformed URL */
  }
}

/** Read and clear the pending invite code (claimed once per signup). */
export function takePendingInvite(): string | null {
  try {
    const code = localStorage.getItem(PENDING_KEY)?.trim().toUpperCase() ?? "";
    if (!code) return null;
    localStorage.removeItem(PENDING_KEY);
    return CODE_RE.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function peekPendingInvite(): string | null {
  try {
    const code = localStorage.getItem(PENDING_KEY)?.trim().toUpperCase() ?? "";
    return CODE_RE.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Put a code back when a claim could not run (e.g. migration missing). */
export function rememberPendingInvite(code: string): void {
  try {
    if (CODE_RE.test(code)) localStorage.setItem(PENDING_KEY, code);
  } catch {
    /* private mode */
  }
}

export async function fetchMyInviteCode(uid: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("invite_code")
    .eq("id", uid)
    .maybeSingle();
  if (error) {
    schemaAvailable = false;
    return null;
  }
  schemaAvailable = true;
  const code = (data as { invite_code?: string | null } | null)?.invite_code ?? null;
  return code && CODE_RE.test(code) ? code : null;
}

/** Return this user's invite code, generating and saving one if needed. */
export async function ensureInviteCode(uid: string): Promise<string | null> {
  if (!uid) return null;
  const existing = await fetchMyInviteCode(uid);
  if (existing) return existing;

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeInviteCode(uid, attempt ? String(attempt) : "");
    const { error } = await supabase
      .from("profiles")
      .update({ invite_code: code })
      .eq("id", uid);
    if (!error) return code;

    // Someone else already owns this code, or the column is missing.
    const current = await fetchMyInviteCode(uid);
    if (current) return current;
    if (!isReferralSchemaAvailable()) return null;
  }
  return null;
}

export async function claimReferral(
  invitedId: string,
  rawCode: string
): Promise<{ ok: boolean; inviterHandle?: string; retry?: boolean }> {
  const code = rawCode.trim().toUpperCase();
  if (!invitedId || !CODE_RE.test(code)) return { ok: false };

  const { data: inviter, error } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("invite_code", code)
    .maybeSingle();
  if (error) {
    schemaAvailable = false;
    return { ok: false, retry: true };
  }

  const row = inviter as { id: string; handle: string } | null;
  if (!row || row.id === invitedId) return { ok: false };

  const { error: insertError } = await supabase.from("referrals").insert({
    inviter_id: row.id,
    invited_id: invitedId,
    code,
    points: INVITE_POINTS,
  });
  if (insertError) {
    const codeNum = (insertError as { code?: string }).code;
    // 23505 = already claimed, 42501 = RLS/migration missing.
    return { ok: false, retry: codeNum !== "23505" };
  }

  return { ok: true, inviterHandle: row.handle };
}

export interface ReferralRecent {
  handle: string;
  avatar_url: string | null;
  created_at: string;
  points: number;
}

export interface ReferralStats {
  invites: number;
  points: number;
  recent: ReferralRecent[];
  available: boolean;
}

export async function fetchReferralStats(uid: string): Promise<ReferralStats> {
  const empty: ReferralStats = { invites: 0, points: 0, recent: [], available: true };

  const { data, error } = await supabase
    .from("referrals")
    .select("invited_id, code, points, created_at")
    .eq("inviter_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    schemaAvailable = false;
    return { ...empty, available: false };
  }
  schemaAvailable = true;

  const rows = (data ?? []) as {
    invited_id: string;
    code: string;
    points: number | null;
    created_at: string;
  }[];
  if (!rows.length) return empty;

  const ids = rows.map((r) => r.invited_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, avatar_url")
    .in("id", ids);
  const byId = new Map(
    ((profiles ?? []) as { id: string; handle: string; avatar_url: string | null }[]).map((p) => [
      p.id,
      p,
    ])
  );

  const recent: ReferralRecent[] = rows.slice(0, 10).map((r) => {
    const p = byId.get(r.invited_id);
    return {
      handle: p?.handle ?? "new member",
      avatar_url: p?.avatar_url ?? null,
      created_at: r.created_at,
      points: r.points ?? INVITE_POINTS,
    };
  });

  return {
    invites: rows.length,
    points: rows.reduce((sum, r) => sum + (r.points ?? INVITE_POINTS), 0),
    recent,
    available: true,
  };
}
