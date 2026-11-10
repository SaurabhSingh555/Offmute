import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Radio } from "lucide-react";
import type { RecentActivityItem } from "@/lib/queries";
import { fetchRecentActivity } from "@/lib/queries";
import { otherAudienceCommunitySlugs, useAudience } from "@/lib/audience";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { cn } from "@/utils/cn";

const POLL_MS = 30_000;
const FRESH_WINDOW_MS = 3 * 3600_000;

/**
 * Live "just posted" ticker — a heading strip above the feed showing who
 * posted recently. Refreshes itself while the feed is open.
 */
export default function RecentActivity() {
  const audience = useAudience();
  const [items, setItems] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchRecentActivity(14)
        .then((rows) => {
          if (!alive) return;
          const hidden = otherAudienceCommunitySlugs(audience);
          setItems(
            rows.filter(
              (r) => !r.communitySlug || !hidden.has(r.communitySlug)
            )
          );
        })
        .catch(() => {});
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [audience]);

  const fresh = items.filter(
    (r) => Date.now() - new Date(r.created_at).getTime() < FRESH_WINDOW_MS
  );
  if (fresh.length === 0) return null;

  return (
    <section
      aria-label="Recently posted"
      className="rounded-2xl border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-2 px-1 pb-2.5 border-b border-line">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-coral" />
        </span>
        <p className="text-[11px] font-bold font-mono uppercase tracking-widest text-mute">
          Just posted
        </p>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase tracking-widest text-mute/70">
          <Radio className="size-3" /> live
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pt-2.5 pb-0.5 -mx-1 px-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {fresh.map((r) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0"
            >
              <Link
                to={`/post/${r.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-line bg-raise/40 py-1.5 pl-1.5 pr-3",
                  "hover:border-brand/60 hover:bg-brand-soft/40 transition-colors"
                )}
              >
                <Avatar handle={r.handle} size={26} />
                <span className="text-xs leading-tight">
                  <span className="font-bold">@{r.handle}</span>
                  <span className="text-mute font-mono"> · {timeAgo(r.created_at)}</span>
                  {r.communityName && (
                    <span className="text-brand font-bold"> · #{r.communityName}</span>
                  )}
                  <span className="text-mute"> · “{r.preview.slice(0, 42)}{r.preview.length > 42 ? "…" : ""}”</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
