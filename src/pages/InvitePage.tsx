import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Gift,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import {
  ensureInviteCode,
  fetchReferralStats,
  INVITE_POINTS,
  inviteLink,
  type ReferralStats,
} from "@/lib/referrals";
import { timeAgo } from "@/lib/utils";
import InstallApp from "@/components/InstallApp";
import { Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { cn } from "@/utils/cn";

function tierFor(invites: number): { label: string; tone: "neutral" | "brand" | "coral" } | null {
  if (invites >= 10) return { label: "Campus legend", tone: "coral" };
  if (invites >= 5) return { label: "Connector", tone: "brand" };
  if (invites >= 1) return { label: "Starter", tone: "brand" };
  return null;
}

export default function InvitePage() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [inviteCode, referralStats] = await Promise.all([
      ensureInviteCode(profile.id),
      fetchReferralStats(profile.id),
    ]);
    setCode(inviteCode);
    setStats(referralStats);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const link = code ? inviteLink(code) : "";
  const schemaMissing = stats ? !stats.available : false;
  const tier = tierFor(stats?.invites ?? 0);
  const nextGoal = stats ? (stats.points < 50 ? 50 : stats.points < 150 ? 150 : 500) : 50;

  async function copyText(text: string, title: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      toast({ title, variant: "ok" });
    } catch {
      toast({
        title: "Copy failed",
        desc: "Select the text and copy it manually.",
        variant: "bad",
      });
    }
  }

  async function shareInvite() {
    if (!link) return;
    const text = "Join me on OFFMUTE — anonymous work and campus talk, no real names.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "OFFMUTE", text, url: link });
      } else {
        await copyText(`${text} ${link}`, "Invite message copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  const whatsapp = link
    ? `https://wa.me/?text=${encodeURIComponent(
        `Join me on OFFMUTE — anonymous work and campus talk, no real names. ${link}`
      )}`
    : "#";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Invite & earn</h1>
        <p className="text-sm text-mute mt-0.5">
          Bring your people to OFFMUTE. Every friend who joins with your link earns you
          {" "}
          {INVITE_POINTS} points.
        </p>
      </div>

      {schemaMissing && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-4">
          <p className="text-sm font-bold font-mono uppercase tracking-tight">
            Referral tables aren't set up yet
          </p>
          <p className="text-xs text-mute mt-1 leading-relaxed">
            Run <code className="font-mono text-ink">supabase/referral_migration.sql</code>{" "}
            in the Supabase SQL editor, then reload. Codes and points stay disabled until
            then.
          </p>
        </div>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-widest text-brand">
              <Gift className="size-4" /> Invite points
            </span>
            {tier && <Badge tone={tier.tone}>{tier.label}</Badge>}
          </div>

          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-5xl font-bold leading-none tracking-tight">
              {stats?.points ?? 0}
            </span>
            <span className="text-sm text-mute mb-1">points</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-lg border border-line bg-raise/50 px-3 py-2">
              <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-mute">
                Friends joined
              </p>
              <p className="font-display text-xl font-semibold mt-0.5">{stats?.invites ?? 0}</p>
            </div>
            <div className="rounded-lg border border-line bg-raise/50 px-3 py-2">
              <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-mute">
                Next milestone
              </p>
              <p className="font-display text-xl font-semibold mt-0.5">
                {Math.max(0, nextGoal - (stats?.points ?? 0))}
                <span className="text-xs text-mute font-sans font-normal ml-1">pts to go</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display font-semibold text-sm flex items-center gap-2 mb-4">
          <Share2 className="size-4 text-brand" /> Your invite link
        </h2>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-raise/50 px-3 py-2">
              <code className="flex-1 truncate text-sm font-mono font-bold tracking-widest">
                {code}
              </code>
              <Button size="sm" variant="soft" onClick={() => copyText(code, "Invite code copied")}>
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-line bg-raise/50 px-3 py-2">
              <span className="flex-1 truncate text-xs text-mute font-mono">{link}</span>
              <Button size="sm" variant="soft" onClick={() => copyText(link, "Invite link copied")}>
                <Copy className="size-3.5" /> Link
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={shareInvite}>
                <Share2 className="size-4" /> Share
              </Button>
              <Button
                size="sm"
                variant="coral"
                onClick={() => window.open(whatsapp, "_blank", "noopener,noreferrer")}
              >
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyText(code, "Invite code copied")}
              >
                <Sparkles className="size-4" /> Copy code
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mute">
              Couldn't create your invite code yet. If you just set up the database, run the
              referral migration and retry.
            </p>
            <Button size="sm" variant="soft" onClick={load}>
              Retry
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display font-semibold text-sm flex items-center gap-2 mb-4">
          <Trophy className="size-4 text-brand" /> How it works
        </h2>
        <ol className="space-y-3">
          {[
            { n: 1, title: "Share your link", desc: "Send it to a friend on WhatsApp, X or anywhere else." },
            { n: 2, title: "They sign up", desc: "Their new account is linked to you automatically." },
            { n: 3, title: "Earn points", desc: `${INVITE_POINTS} points per successful signup. Climb the tiers.` },
          ].map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft border border-brand/30 text-[11px] font-bold font-mono text-brand">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">{step.title}</p>
                <p className="text-xs text-mute mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display font-semibold text-sm flex items-center gap-2 mb-4">
          <Users className="size-4 text-brand" /> Recent invites
        </h2>
        {!stats || stats.recent.length === 0 ? (
          <div className={cn("rounded-lg border border-dashed border-line px-4 py-6 text-center")}>
            <p className="text-sm font-semibold">No invites yet</p>
            <p className="text-xs text-mute mt-1">Share your link and your first friend shows up here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {stats.recent.map((r) => (
              <li
                key={`${r.handle}-${r.created_at}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-raise/40 px-3 py-2"
              >
                <Avatar handle={r.handle} src={r.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">@{r.handle}</p>
                  <p className="text-[11px] text-mute">{timeAgo(r.created_at)} ago</p>
                </div>
                <Badge tone="ok">+{r.points}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InstallApp />
    </div>
  );
}
