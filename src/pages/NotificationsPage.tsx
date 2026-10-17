import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BellOff, Heart, MessageCircle, PenSquare, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import type { NotifItem } from "@/lib/types";
import {
  fetchNotifications,
  markAllNotifsRead,
  markNotifRead,
} from "@/lib/queries";
import { timeAgo } from "@/lib/utils";
import { useUnread } from "@/components/Layout";
import { Avatar, Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/utils/cn";

const TYPE_META: Record<NotifItem["type"], { icon: React.ReactNode; text: string }> = {
  like: { icon: <Heart className="size-4 text-coral" />, text: "liked your post" },
  comment: { icon: <MessageCircle className="size-4 text-brand" />, text: "commented on your post" },
  follow: { icon: <UserPlus className="size-4 text-ok" />, text: "started following you" },
  post: { icon: <PenSquare className="size-4 text-warn" />, text: "posted something new" },
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { setUnread } = useUnread();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotifItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(null);
    try {
      const rows = await fetchNotifications(profile.id, 40);
      setItems(rows);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    if (!profile) return;
    try {
      await markAllNotifsRead(profile.id);
      setItems((prev) =>
        prev ? prev.map((n) => ({ ...n, read_at: new Date().toISOString() })) : prev
      );
      setUnread(0);
    } catch {
      /* non-critical */
    }
  }

  function open(n: NotifItem) {
    if (profile && !n.read_at) {
      markNotifRead(profile.id, n.id).catch(() => {});
      setItems((prev) =>
        prev ? prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) : prev
      );
    }
    if (n.type === "follow" && n.actor) {
      navigate(`/profile/${n.actor.handle}`);
    } else if (n.post_id) {
      navigate(`/post/${n.post_id}`);
    }
  }

  const unreadCount = items?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Notifications</h1>
          <p className="text-sm text-mute mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="soft" onClick={markAll}>
            Mark all read
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<BellOff className="size-6" />}
            title="No notifications yet"
            desc="When people like, comment or follow you, it lands here. Quiet, like the office after 9."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => {
            const meta = TYPE_META[n.type];
            return (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                onClick={() => open(n)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-left transition-colors hover:border-brand/40",
                  n.read_at ? "border-line" : "border-brand/40 bg-brand-soft/40"
                )}
              >
                <span className="relative shrink-0">
                  <Avatar handle={n.actor?.handle} src={n.actor?.avatar_url} size={38} />
                  <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center size-5 rounded-full bg-surface border border-line">
                    {meta.icon}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm leading-snug">
                    <b>{n.actor?.handle ?? "Someone"}</b> {meta.text}
                  </span>
                  <span className="block text-xs text-mute mt-0.5">{timeAgo(n.created_at)} ago</span>
                </span>
                {!n.read_at && <span className="size-2 rounded-full bg-brand shrink-0" />}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
