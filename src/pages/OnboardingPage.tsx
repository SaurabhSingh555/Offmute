import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Hash, Lock, Users } from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import type { Community } from "@/lib/types";
import { fetchCommunities, joinCommunity } from "@/lib/queries";
import { otherAudienceCommunitySlugs, useAudience } from "@/lib/audience";
import { Avatar, Button } from "@/components/ui";
import { cn } from "@/utils/cn";

export default function OnboardingPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const audience = useAudience();
  const [comms, setComms] = useState<Community[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hidden = otherAudienceCommunitySlugs(audience);
    fetchCommunities({ limit: 60 })
      .then((list) => {
        setComms(list.filter((c) => !hidden.has(c.slug)).slice(0, 12));
      })
      .catch(() => setComms([]))
      .finally(() => setLoaded(true));
  }, [audience]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function finish(skip: boolean) {
    setBusy(true);
    try {
      if (!skip && profile) {
        const results = await Promise.allSettled(
          [...picked].map((id) => joinCommunity(profile.id, id))
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0)
          toast({
            title: `Joined ${results.length - failed} communities`,
            desc: failed > 0 ? "A few joins failed — you can retry in Explore." : undefined,
            variant: failed === results.length ? "bad" : "ok",
          });
        else toast({ title: "Welcome to OFFMUTE", desc: `${picked.size} communities joined.`, variant: "ok" });
      }
      try {
        localStorage.setItem("om-onboarded", "1");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event("om:refresh-side"));
      navigate("/feed", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center pt-4">
        <div className="flex justify-center">
          <Avatar handle={profile?.handle} src={profile?.avatar_url} size={64} />
        </div>
        <h1 className="font-display font-bold text-2xl tracking-tight mt-4">
          Welcome, <span className="text-brand">{profile?.handle}</span>
        </h1>
        <p className="text-sm text-mute mt-2 max-w-sm mx-auto leading-relaxed">
          Your anonymous identity is live. Pick a few {audience === "student" ? "campus" : ""} communities
          to make your For You feed actually about your world — you can change this anytime.
        </p>
      </div>

      {loaded && comms.length === 0 && (
        <div className="mt-8 border border-brand/40 bg-brand-soft/40 px-4 py-3 text-xs leading-relaxed text-mute">
          <b className="text-brand">
            {audience === "student" ? "Student" : "Corporate"} communities aren't set up in this
            project yet.
          </b>
          {audience === "student" && (
            <span className="block mt-1">
              Run <b>supabase/audience_migration.sql</b> in the Supabase SQL editor, then reload
              this page. You can also skip and join communities later from Explore.
            </span>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mt-8">
        {comms.map((c, i) => {
          const on = picked.has(c.id);
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.35) }}
              onClick={() => toggle(c.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                on
                  ? "border-brand bg-brand-soft shadow-lg shadow-brand/10"
                  : "border-line bg-surface hover:border-brand/40"
              )}
              aria-pressed={on}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid place-items-center size-8 rounded-lg",
                    on ? "bg-brand text-white" : "bg-coral-soft text-coral"
                  )}
                >
                  <Hash className="size-4" />
                </span>
                <p className="font-semibold text-sm truncate flex-1">{c.name}</p>
                {c.is_restricted && <Lock className="size-3.5 text-mute" />}
                {on && <Check className="size-4 text-brand" />}
              </div>
              {c.description && (
                <p className="text-xs text-mute mt-2 line-clamp-2 leading-relaxed">{c.description}</p>
              )}
              <p className="text-[11px] text-mute mt-2 flex items-center gap-1">
                <Users className="size-3" /> {c.member_count ?? 0} members
              </p>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3 mt-8 pb-8">
        <Button variant="outline" onClick={() => finish(true)} disabled={busy}>
          Skip for now
        </Button>
        <Button onClick={() => finish(false)} disabled={picked.size === 0} loading={busy}>
          Join {picked.size > 0 ? `${picked.size} ` : ""}communities
        </Button>
      </div>
    </div>
  );
}
