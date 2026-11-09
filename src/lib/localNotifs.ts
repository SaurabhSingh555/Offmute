import type { NotifItem } from "./types";

/**
 * Client-side notifications for events that never touch the database —
 * currently the simulated community replies on a freshly created post.
 *
 * Rows live in localStorage per user id so the unread badge and the
 * notifications page can treat them exactly like server notifications.
 */

export const LOCAL_NOTIF_EVENT = "om:local-notifs";

const STORAGE_KEY = "om-local-notifs";
const MAX_PER_USER = 30;

export interface LocalNotif extends NotifItem {
  /** First reply body, shown as a one-line preview. */
  preview?: string | null;
  /** How many replies arrived in this batch. */
  count?: number;
}

type NotifStore = Record<string, LocalNotif[]>;

function loadStore(): NotifStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NotifStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: NotifStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota */
  }
}

function emit(detail: { uid: string; title?: string; desc?: string }) {
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_NOTIF_EVENT, { detail }));
  } catch {
    /* non-browser */
  }
}

function isNotif(value: unknown): value is LocalNotif {
  if (!value || typeof value !== "object") return false;
  const n = value as LocalNotif;
  return typeof n.id === "string" && typeof n.created_at === "string";
}

export function localNotifsFor(uid: string | null | undefined): LocalNotif[] {
  if (!uid) return [];
  const list = loadStore()[uid];
  if (!Array.isArray(list)) return [];
  return list.filter(isNotif).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function localUnreadCount(uid: string | null | undefined): number {
  return localNotifsFor(uid).filter((n) => !n.read_at).length;
}

/** Add one notification per post; returns null when it already exists. */
export function addLocalNotif(
  uid: string,
  input: { postId: string; preview?: string | null; count: number }
): LocalNotif | null {
  if (!uid || !input.postId) return null;

  const store = loadStore();
  const list = Array.isArray(store[uid]) ? store[uid].filter(isNotif) : [];
  if (list.some((n) => n.post_id === input.postId)) return null;

  const notif: LocalNotif = {
    id: `ai-notif-${input.postId}-${Date.now().toString(36)}`,
    type: "ai",
    created_at: new Date().toISOString(),
    read_at: null,
    actor: null,
    post_id: input.postId,
    comment_id: null,
    community_id: null,
    community: null,
    preview: input.preview ?? null,
    count: input.count,
  };

  store[uid] = [notif, ...list].slice(0, MAX_PER_USER);
  saveStore(store);

  emit({
    uid,
    title: input.count === 1 ? "1 new reply" : `${input.count} new replies`,
    desc: "Someone replied to your anonymous post.",
  });

  return notif;
}

export function markLocalNotifRead(uid: string, id: string) {
  const store = loadStore();
  const list = store[uid];
  if (!Array.isArray(list)) return;
  store[uid] = list.map((n) =>
    n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
  );
  saveStore(store);
}

export function markAllLocalNotifsRead(uid: string) {
  const store = loadStore();
  const list = store[uid];
  if (!Array.isArray(list) || !list.some((n) => !n.read_at)) return;
  const now = new Date().toISOString();
  store[uid] = list.map((n) => (n.read_at ? n : { ...n, read_at: now }));
  saveStore(store);
}

export function clearLocalNotifs(uid: string | null | undefined) {
  if (!uid) return;
  const store = loadStore();
  if (!store[uid]) return;
  delete store[uid];
  saveStore(store);
}
