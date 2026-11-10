import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Radio, Send, Swords, Users } from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import { supabase } from "@/lib/supabase";
import type { ChatMsg } from "@/lib/types";
import { fetchChatHistory, sendChatMessage } from "@/lib/queries";
import { enterWarRoom, WAR_PROMPTS } from "@/lib/warroom";
import { timeAgo } from "@/lib/utils";
import { Avatar, Button, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/utils/cn";

/**
 * The War Room — one global, realtime, anonymous battle arena.
 * Anyone can drop in and start (or join) a fight. Every message adds +1
 * to your OFFMUTE score.
 */
export default function WarRoomPage() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [communityId, setCommunityId] = useState<string | null>(null);
  const [entering, setEntering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [profiles, setProfiles] = useState<
    Record<string, { handle: string; avatar_url: string | null }>
  >({});
  const [chatLoading, setChatLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uid = profile?.id ?? "";

  /* Enter (auto-create + join) the war room. */
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setEntering(true);
    enterWarRoom(uid)
      .then(({ community }) => {
        if (!alive) return;
        setCommunityId(community.id);
        setEntering(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError((e as Error).message);
        setEntering(false);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  /* Chat history + realtime. */
  useEffect(() => {
    if (!communityId) return;
    let alive = true;
    setChatLoading(true);

    fetchChatHistory(communityId)
      .then((rows) => {
        if (!alive) return;
        setMsgs(rows);
        const map: Record<string, { handle: string; avatar_url: string | null }> = {};
        rows.forEach((r) => {
          if (r.profile) map[r.user_id] = r.profile;
        });
        setProfiles((prev) => ({ ...prev, ...map }));
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setChatLoading(false));

    const channel = supabase
      .channel(`chat-${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_messages",
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            body: string;
            created_at: string;
            user_id: string;
          };
          if (!row.id) return;
          setMsgs((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, profile: null }]
          );
          if (!profiles[row.user_id]) {
            supabase
              .from("profiles")
              .select("handle, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle()
              .then(({ data }) => {
                if (data && alive)
                  setProfiles((prev) => ({
                    ...prev,
                    [row.user_id]: { handle: data.handle, avatar_url: data.avatar_url },
                  }));
              });
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  const activeWarriors = useMemo(() => {
    const recent = msgs.filter(
      (m) => Date.now() - new Date(m.created_at).getTime() < 30 * 60_000
    );
    return new Set(recent.map((m) => m.user_id)).size;
  }, [msgs]);

  async function send() {
    if (!draft.trim() || busy || !communityId || !uid) return;
    setBusy(true);
    const text = draft;
    setDraft("");
    try {
      await sendChatMessage(uid, communityId, text);
    } catch (e) {
      setDraft(text);
      toast({ title: "Message failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  if (entering)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-coral/40 bg-surface p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-coral/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-display font-bold text-2xl tracking-tight uppercase">
              <Swords className="size-6 text-coral" /> War Room
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-soft border border-coral/30 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-widest text-coral">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-coral" />
              </span>
              live
            </span>
          </div>
          <p className="text-sm text-mute mt-1.5 leading-relaxed">
            The global anonymous arena. Drop a hot take, start a roast battle, defend
            the indefensible. Everyone's listening.
          </p>
          <div className="flex items-center gap-4 mt-3 text-[11px] font-bold font-mono uppercase tracking-wider text-mute">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-brand" />
              {activeWarriors} warrior{activeWarriors === 1 ? "" : "s"} in the last 30m
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="size-3.5 text-coral" /> +1 score per message
            </span>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div
          ref={scrollRef}
          className="h-[52vh] min-h-72 overflow-y-auto p-4 space-y-3"
          aria-live="polite"
          aria-label="War room live chat"
        >
          {chatLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-10 w-1/2 ml-auto" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : msgs.length === 0 ? (
            <div className="h-full grid place-items-center">
              <div className="text-center max-w-60">
                <Swords className="size-7 mx-auto mb-2 text-coral" />
                <p className="text-sm font-semibold">The arena is empty.</p>
                <p className="text-xs text-mute mt-1">
                  Fire the first shot — everyone in OFFMUTE can join this room.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {msgs.map((m) => {
                const mine = m.user_id === uid;
                const prof = profiles[m.user_id] ?? m.profile;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn("flex gap-2.5", mine ? "justify-end" : "justify-start")}
                  >
                    {!mine && (
                      <Avatar handle={prof?.handle} src={prof?.avatar_url ?? null} size={28} />
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        mine
                          ? "bg-coral text-white rounded-br-md"
                          : "bg-raise/70 border border-line rounded-bl-md"
                      )}
                    >
                      {!mine && (
                        <p className="text-[11px] font-bold text-brand mb-0.5">
                          {prof?.handle ?? "Warrior"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("text-[10px] mt-1", mine ? "text-white/70" : "text-mute")}>
                        {timeAgo(m.created_at)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Battle starters */}
        <div className="border-t border-line px-3 pt-2.5 pb-1 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {WAR_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setDraft(p.text);
              }}
              className="shrink-0 rounded-full border border-line bg-raise/50 px-3 py-1 text-[11px] font-bold font-mono uppercase tracking-wider text-mute hover:text-coral hover:border-coral/50 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="border-t border-line p-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            maxLength={1000}
            placeholder="Enter the arena — say something risky…"
            className="flex-1 h-10 px-3.5 rounded-xl bg-raise/60 border border-line text-sm placeholder:text-mute/70 focus:border-coral focus:outline-none"
            aria-label="War room message"
          />
          <Button
            variant="coral"
            onClick={send}
            loading={busy}
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-[11px] font-mono text-mute/70 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
        <Radio className="size-3" /> Realtime — messages appear instantly for everyone.
        Keep it anonymous, no real names or private data.
      </p>
    </div>
  );
}
