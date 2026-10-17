/* Shared pure helpers (unit-tested in src/lib/__tests__/utils.test.ts) */

const HANDLE_ADJECTIVES = [
  "Silent", "Night", "Coffee", "Broken", "Quiet", "Midnight", "Paper", "Ghost",
  "Lucky", "Lowkey", "Second", "Overtime", "Backlog", "Desk", "Retro", "Standup",
  "Ping", "Buffer", "Sandbox", "Deploy",
];

const HANDLE_ANIMALS = [
  "Panda", "Fox", "Heron", "Otter", "Lynx", "Mole", "Raven", "Gecko", "Badger",
  "Moth", "Koi", "Newt", "Crane", "Marmot", "Orca", "Shrew",
];

/** Generate a pseudonymous handle like "SilentPanda47". Deterministic if a rand fn is passed. */
export function generateHandle(rand: () => number = Math.random): string {
  const a = HANDLE_ADJECTIVES[Math.floor(rand() * HANDLE_ADJECTIVES.length)];
  const b = HANDLE_ANIMALS[Math.floor(rand() * HANDLE_ANIMALS.length)];
  const n = 10 + Math.floor(rand() * 90);
  return `${a}${b}${n}`;
}

export function handleIsValid(handle: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** FNV-1a 32-bit hash — stable per handle, used for avatar art. */
export function hashStr(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function pollPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  return counts.map((c) => Math.round((c / total) * 100));
}

export function clampLen(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function isValidImageFile(file: File): { ok: boolean; error?: string } {
  const types = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!types.includes(file.type))
    return { ok: false, error: "Only JPG, PNG, WEBP or GIF images." };
  if (file.size > 5 * 1024 * 1024)
    return { ok: false, error: "Images must be 5MB or smaller." };
  return { ok: true };
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}
