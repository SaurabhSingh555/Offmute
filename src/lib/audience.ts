import { useSyncExternalStore } from "react";
import type { Community, FeedTabDef, PostItem } from "./types";
import { FEED_TABS } from "./types";

/**
 * Audience selection (Student / Corporate).
 * Stored locally so the landing page, feed tabs, onboarding and AI replies
 * can all adapt without a database migration or a second account type.
 */

export type Audience = "student" | "corporate";

const STORAGE_KEY = "om-audience";
const EVENT = "om:audience";

function readAudience(): Audience | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "student" || value === "corporate" ? value : null;
  } catch {
    return null;
  }
}

let current: Audience | null = readAudience();
let activeLock: Audience | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* non-browser */
  }
}

export function getAudience(): Audience | null {
  return current;
}

export function setAudience(audience: Audience) {
  if (activeLock && activeLock !== audience) return;
  current = audience;
  try {
    localStorage.setItem(STORAGE_KEY, audience);
  } catch {
    /* private mode */
  }
  emit();
}

export function clearAudience() {
  activeLock = null;
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  emit();
}

/* -------------------------------------------------------------------------- */
/* Per-account lock                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Once someone signs up from Student mode their account stays Student.
 * Keyed by email in localStorage because the project has no audience column.
 */
const LOCKS_KEY = "om-audience-locks";

function readLocks(): Record<string, Audience> {
  try {
    const raw = localStorage.getItem(LOCKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Audience> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value === "student" || value === "corporate") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function lockAudienceForEmail(email: string, audience: Audience) {
  const key = email.trim().toLowerCase();
  if (!key) return;
  try {
    const locks = readLocks();
    locks[key] = audience;
    localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
  } catch {
    /* private mode */
  }
}

export function lockedAudienceForEmail(email?: string | null): Audience | null {
  if (!email) return null;
  return readLocks()[email.trim().toLowerCase()] ?? null;
}

/**
 * Locks the account to the mode it was created/signed in with, then forces
 * that mode. Returns the locked audience (or null without an email).
 */
export function ensureAudienceLockForEmail(
  email?: string | null,
  preferred?: Audience | null
): Audience | null {
  const key = email?.trim().toLowerCase();
  if (!key) return null;
  let locked = preferred ?? lockedAudienceForEmail(key);
  if (!locked) locked = getAudience() ?? "corporate";
  lockAudienceForEmail(key, locked);
  activeLock = locked;
  if (current !== locked) setAudience(locked);
  return locked;
}

/** Audience stored on the Supabase auth user (survives browsers/devices). */
export function audienceFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): Audience | null {
  const value = metadata?.audience;
  return value === "student" || value === "corporate" ? value : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAudience(): Audience | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/* -------------------------------------------------------------------------- */
/* Content + navigation config                                                 */
/* -------------------------------------------------------------------------- */

export interface AudienceOption {
  id: Audience;
  label: string;
  short: string;
  title: string;
  blurb: string;
  bullets: string[];
  categorySlugs: string[];
  communitySlugs: string[];
}

export const STUDENT_CATEGORY_SLUGS = [
  "campus-life",
  "exams-placements",
  "internships",
  "study-hacks",
  "campus-confessions",
] as const;

export const STUDENT_COMMUNITY_SLUGS = [
  "college-life",
  "placements",
  "internships",
  "exam-war-room",
  "campus-confessions",
] as const;

export const CORPORATE_CATEGORY_SLUGS = [
  "it-software",
  "bpo-support",
  "hr-recruitment",
  "sales-marketing",
  "corporate-memes",
  "office-confessions",
  "toxic-workplaces",
  "interns-freshers",
  "career-advice",
  "night-shift",
  "workplace-stories",
  "questions",
] as const;

export const CORPORATE_COMMUNITY_SLUGS = [
  "it-software",
  "bpo-support",
  "hr-recruitment",
  "sales-marketing",
  "corporate-memes",
  "office-confessions",
  "toxic-workplaces",
  "interns-freshers",
  "career-advice",
  "night-shift",
  "noida-corporate",
  "bengaluru-tech",
  "mumbai-corporate",
  "former-colleagues",
] as const;

export const AUDIENCES: Record<Audience, AudienceOption> = {
  student: {
    id: "student",
    label: "Student",
    short: "Student mode",
    title: "I'm a student",
    blurb: "College, hostel, exams, placements and the chaos in between.",
    bullets: ["Campus + hostel confessions", "Exam and placement talk", "Internship stories"],
    categorySlugs: [...STUDENT_CATEGORY_SLUGS],
    communitySlugs: [...STUDENT_COMMUNITY_SLUGS],
  },
  corporate: {
    id: "corporate",
    label: "Corporate",
    short: "Corporate mode",
    title: "I'm working",
    blurb: "Office confessions, night shifts, managers and everything after 6 PM.",
    bullets: ["Office confessions", "Career + salary talk", "Night shift stories"],
    categorySlugs: [...CORPORATE_CATEGORY_SLUGS],
    communitySlugs: [...CORPORATE_COMMUNITY_SLUGS],
  },
};

export function audienceConfig(audience: Audience | null): AudienceOption {
  return AUDIENCES[audience ?? "corporate"];
}

const STUDENT_TABS: FeedTabDef[] = [
  { id: "foryou", label: "For You" },
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
  { id: "cat-campus", label: "Campus Life", categorySlug: "campus-life" },
  { id: "cat-exams", label: "Exams & Placements", categorySlug: "exams-placements" },
  { id: "cat-confessions", label: "Confessions", categorySlug: "campus-confessions" },
];

export function getFeedTabs(audience: Audience | null): FeedTabDef[] {
  return audience === "student" ? STUDENT_TABS : FEED_TABS;
}

/* -------------------------------------------------------------------------- */
/* Offline previews                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Local definitions for the Student categories/communities. They are normally
 * seeded by supabase/audience_migration.sql. If an existing project has not run
 * that migration yet, Explore shows these as non-joinable previews instead of
 * falling back to the Corporate catalog.
 */
export interface AudienceSeed {
  slug: string;
  name: string;
  description: string;
  restricted?: boolean;
}

export const STUDENT_CATEGORY_SEEDS: AudienceSeed[] = [
  { slug: "campus-life", name: "Campus Life", description: "Hostel, fests, attendance, friend groups and campus chaos." },
  { slug: "exams-placements", name: "Exams & Placements", description: "Semester exams, aptitude prep, placement season survival." },
  { slug: "internships", name: "Internships", description: "Finding internships, stipends, first-day nerves and PPOs." },
  { slug: "study-hacks", name: "Study Hacks", description: "Notes, focus tricks, resources and last-night saves." },
  { slug: "campus-confessions", name: "Campus Confessions", description: "Crushes, canteen stories and things you never told your class." },
];

export const STUDENT_COMMUNITY_SEEDS: AudienceSeed[] = [
  { slug: "college-life", name: "College Life", description: "Campus, hostel, fests, attendance and the everyday chaos of college." },
  { slug: "placements", name: "Placements", description: "Placement season, aptitude rounds, interviews and offer stories." },
  { slug: "internships", name: "Internships", description: "Internship leads, stipend talk, first-day nerves and PPO wins." },
  { slug: "exam-war-room", name: "Exam War Room", description: "Exam prep, study plans, resources and last-minute rescue threads." },
  { slug: "campus-confessions", name: "Campus Confessions", description: "Anonymous campus stories you would never post with your name. Restricted.", restricted: true },
];

const STUDENT_CATEGORY_COMMUNITIES: Record<string, string[]> = {
  "campus-life": ["college-life"],
  "exams-placements": ["placements", "exam-war-room"],
  internships: ["internships"],
  "study-hacks": ["exam-war-room"],
  "campus-confessions": ["campus-confessions"],
};

/** Community slugs that belong to the *other* audience (never show these). */
export function otherAudienceCommunitySlugs(audience: Audience | null): Set<string> {
  return new Set(
    audience === "student" ? CORPORATE_COMMUNITY_SLUGS : STUDENT_COMMUNITY_SLUGS
  );
}

/** Community slugs suggested for a category. null = no category filter. */
export function categoryCommunitySlugs(
  audience: Audience | null,
  categorySlug?: string | null
): Set<string> | null {
  if (!categorySlug) return null;
  if (audience === "student") {
    return new Set(STUDENT_CATEGORY_COMMUNITIES[categorySlug] ?? []);
  }
  return new Set([categorySlug]);
}

export function previewCommunity(seed: AudienceSeed): Community {
  return {
    id: `preview-community-${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    is_restricted: seed.restricted ?? false,
    created_by: null,
    created_at: new Date(0).toISOString(),
    member_count: 0,
  };
}

export function isPreviewCommunity(id: string): boolean {
  return id.startsWith("preview-community-");
}

/**
 * Client-side audience filter for real posts. Posts tagged with a known
 * category/community of the *other* audience are hidden; untagged or custom
 * content stays visible in both modes.
 */
export function postMatchesAudience(
  post: PostItem,
  audience: Audience | null
): boolean {
  const categorySlug = post.category?.slug ?? null;
  const communitySlug = post.community?.slug ?? null;

  if (audience === "student") {
    // Stricter: untagged legacy posts belong to the original corporate feed.
    if (categorySlug && (STUDENT_CATEGORY_SLUGS as readonly string[]).includes(categorySlug))
      return true;
    if (
      communitySlug &&
      (STUDENT_COMMUNITY_SLUGS as readonly string[]).includes(communitySlug)
    )
      return true;
    return false;
  }

  const otherComms = otherAudienceCommunitySlugs(audience);
  if (communitySlug && otherComms.has(communitySlug)) return false;

  const otherCats: readonly string[] = STUDENT_CATEGORY_SLUGS;
  if (categorySlug && otherCats.includes(categorySlug)) return false;

  return true;
}

export function isAudienceCategory(audience: Audience | null, slug?: string | null): boolean {
  if (!slug) return true;
  return audienceConfig(audience).categorySlugs.includes(slug);
}

export function isAudienceCommunity(audience: Audience | null, slug?: string | null): boolean {
  if (!slug) return true;
  return audienceConfig(audience).communitySlugs.includes(slug);
}
