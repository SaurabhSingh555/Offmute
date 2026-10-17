import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Hash,
  Lock,
  MessageCircle,
  PenSquare,
  Plus,
  ScrollText,
  Send,
  ShieldAlert,
  Trash2,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import { supabase } from "@/lib/supabase";
import type { ChatMsg, CommunityRule, PostItem, ReportItem } from "@/lib/types";
import {
  deleteCommunity,
  fetchChatHistory,
  fetchCommunityBySlug,
  fetchCommunityFeed,
  fetchCommunityReports,
  fetchCommunityRules,
  fetchMembers,
  fetchMyPollVotes,
  joinCommunity,
  leaveCommunity,
  sendChatMessage,
  setReportStatus,
  type CommunityDetail,
  type MemberRow,
} from "@/lib/queries";
import PostCard, { CardMotion } from "@/components/PostCard";
import { requestCompose } from "@/components/PostComposer";
import { demoPostsForCommunity } from "@/lib/demoContent";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Menu,
  PostSkeleton,
  Skeleton,
  type MenuItem,
} from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/utils/cn";

/* ----------------------------- Discussion chat --------------------------- */

function ChatPanel({ communityId, uid }: { communityId: string; uid: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { handle: string; avatar_url: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const load = () =>
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
        .finally(() => alive && setLoading(false));

    load();
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
          const row = payload.new as { id: string; body: string; created_at: string; user_id: string };
          if (!row.id) return;
          setMsgs((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { ...row, profile: profiles[row.user_id] ?? null }]
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

  async function send() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const text = draft;
    setDraft("");
    try {
      await sendChatMessage(uid, communityId, text);
      window.setTimeout(() => {
        fetchChatHistory(communityId).then(setMsgs).catch(() => {});
      }, 500);
    } catch (e) {
      setDraft(text);
      toast({ title: "Message failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div
        ref={scrollRef}
        className="h-96 overflow-y-auto p-4 space-y-3"
        aria-live="polite"
        aria-label="Community discussion"
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2 ml-auto" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="h-full grid place-items-center">
            <p className="text-sm text-mute text-center max-w-55">
              <MessageCircle className="size-6 mx-auto mb-2 text-brand" />
              The room is quiet. Say hi — this is live for all members.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {msgs.map((m) => {
              const mine = m.user_id === uid;
              const prof = profiles[m.user_id];
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      mine
                        ? "bg-brand text-white rounded-br-md"
                        : "bg-raise/70 rounded-bl-md"
                    )}
                  >
                    {!mine && (
                      <p className="text-[11px] font-bold text-brand mb-0.5">
                        {prof?.handle ?? "Member"}
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
      <div className="border-t border-line p-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          maxLength={1000}
          placeholder="Message the community…"
          className="flex-1 h-10 px-3.5 rounded-xl bg-raise/60 border border-line text-sm placeholder:text-mute/70 focus:border-brand focus:outline-none"
          aria-label="Chat message"
        />
        <Button onClick={send} loading={busy} disabled={!draft.trim()} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Community page --------------------------- */

type Tab = "posts" | "about" | "chat" | "members" | "reports";

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("posts");

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [showingDemos, setShowingDemos] = useState(false);
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const [joinBusy, setJoinBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const uid = profile?.id ?? "";
  const isOwner = detail?.community.created_by === uid;
  const joined = detail?.joined ?? false;

  const load = useCallback(async () => {
    if (!uid || !slug) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchCommunityBySlug(uid, slug);
      if (!d) {
        setNotFound(true);
        return;
      }
      setDetail(d);
      fetchCommunityRules(d.community.id).then(setRules).catch(() => {});
      if (d.role === "owner")
        fetchCommunityReports(uid, d.community.id).then(setReports).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [uid, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const cid = detail?.community.id;

  const loadPosts = useCallback(
    async (reset: boolean) => {
      if (!cid || !uid) return;
      if (reset) setPostsLoading(true);
      try {
        const offset = reset ? 0 : posts.length;
        const res = await fetchCommunityFeed(uid, cid, offset);
        const votes = await fetchMyPollVotes(
          uid,
          res.posts.filter((p) => p.poll).map((p) => p.poll!.id)
        );
        res.posts.forEach((p) => (p.myPollVote = p.poll ? votes.get(p.poll.id) ?? null : null));
        // Empty community → client-side samples until real posts exist.
        if (reset && res.posts.length === 0 && !res.more) {
          const demos = demoPostsForCommunity(detail?.community.slug ?? "");
          if (demos.length > 0) {
            setPosts(demos);
            setMore(false);
            setShowingDemos(true);
            return;
          }
        }
        setShowingDemos(false);
        setPosts((prev) => (reset ? res.posts : [...prev, ...res.posts]));
        setMore(res.more);
      } catch (e) {
        toast({ title: "Couldn't load posts", desc: (e as Error).message, variant: "bad" });
      } finally {
        setPostsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cid, uid]
  );

  useEffect(() => {
    if (cid && joined) loadPosts(true);
  }, [cid, joined, loadPosts]);

  /* Refresh the community feed when a post is published from the composer */
  useEffect(() => {
    const onPosted = () => {
      if (tab === "posts" && joined) loadPosts(true);
    };
    window.addEventListener("om:posted", onPosted);
    return () => window.removeEventListener("om:posted", onPosted);
  }, [tab, joined, loadPosts]);

  useEffect(() => {
    if (tab === "members" && cid) {
      fetchMembers(cid).then(setMembers).catch(() => {});
    }
  }, [tab, cid]);

  async function onToggleJoin() {
    if (!detail) return;
    setJoinBusy(true);
    try {
      if (joined) await leaveCommunity(uid, detail.community.id);
      else await joinCommunity(uid, detail.community.id);
      window.dispatchEvent(new Event("om:refresh-side"));
      await load();
      toast({
        title: joined ? `Left #${detail.community.name}` : `Joined #${detail.community.name}`,
        variant: "ok",
      });
    } catch (e) {
      toast({ title: "Membership failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setJoinBusy(false);
      setConfirmLeave(false);
    }
  }

  async function onDelete() {
    if (!detail) return;
    setDeleteBusy(true);
    try {
      await deleteCommunity(uid, detail.community.id);
      toast({ title: "Community deleted", variant: "ok" });
      navigate("/explore");
    } catch (e) {
      toast({ title: "Delete failed", desc: (e as Error).message, variant: "bad" });
      setDeleteBusy(false);
    }
  }

  async function onReportStatus(id: string, status: "resolved" | "dismissed") {
    try {
      await setReportStatus(uid, id, status);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, resolved_at: new Date().toISOString() } : r))
      );
      toast({ title: status === "resolved" ? "Report resolved" : "Report dismissed", variant: "ok" });
    } catch (e) {
      toast({ title: "Action failed", desc: (e as Error).message, variant: "bad" });
    }
  }

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );

  if (error) return <ErrorState message={error} onRetry={load} />;

  if (notFound || !detail)
    return (
      <div className="rounded-2xl border border-line bg-surface py-16 text-center">
        <p className="font-display font-semibold text-lg">Community not found</p>
        <p className="text-sm text-mute mt-1">It may have been removed.</p>
        <Button variant="soft" size="sm" className="mt-4" onClick={() => navigate("/explore")}>
          Back to explore
        </Button>
      </div>
    );

  const c = detail.community;
  const memberLabel =
    c.is_restricted && c.member_count! <= 1 ? "Members only" : `${c.member_count} members`;

  const ownerMenu: MenuItem[] = [
    { label: "Review reports", icon: <ShieldAlert className="size-4" />, onClick: () => setTab("reports") },
    { label: "Delete community", icon: <Trash2 className="size-4" />, onClick: () => setConfirmDelete(true), danger: true },
  ];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "posts", label: "Posts", icon: <Hash className="size-3.5" /> },
    { id: "about", label: "About & Rules", icon: <ScrollText className="size-3.5" /> },
    { id: "chat", label: "Discussion", icon: <MessageCircle className="size-3.5" /> },
    { id: "members", label: "Members", icon: <Users className="size-3.5" /> },
    ...(isOwner ? [{ id: "reports" as Tab, label: "Reports", icon: <ShieldAlert className="size-3.5" /> }] : []),
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start gap-4">
          <span className="grid place-items-center size-14 rounded-2xl bg-gradient-to-br from-brand/25 to-coral/25 border border-line shrink-0">
            <Hash className="size-7 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl tracking-tight">{c.name}</h1>
              {c.is_restricted && (
                <Badge tone="warn">
                  <Lock className="size-3" /> Restricted
                </Badge>
              )}
            </div>
            {c.description && (
              <p className="text-sm text-mute mt-1 leading-relaxed">{c.description}</p>
            )}
            <p className="text-xs text-mute mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" /> {memberLabel}
              </span>
              <span>{detail.postCount} posts</span>
              {isOwner && <span className="text-brand font-semibold">you're the owner</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {joined && (
              <Button size="sm" onClick={() => requestCompose(c.id)}>
                <PenSquare className="size-3.5" /> Post
              </Button>
            )}
            {isOwner ? (
              <Menu
                align="end"
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-3.5 rotate-45" /> Manage
                  </Button>
                }
                items={ownerMenu}
              />
            ) : joined ? (
              <Button size="sm" variant="outline" onClick={() => setConfirmLeave(true)}>
                Leave
              </Button>
            ) : (
              <Button size="sm" onClick={onToggleJoin} loading={joinBusy}>
                <UserRoundPlus className="size-3.5" /> Join
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              tab === t.id ? "bg-ink text-bg" : "bg-raise/60 text-mute hover:text-ink"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "posts" &&
        (!joined ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<Lock className="size-6" />}
              title="Join to see posts"
              desc={
                c.is_restricted
                  ? "This is a restricted community. Join to read and post — membership is private."
                  : "Join the community to see its posts and take part."
              }
              action={
                <Button size="sm" onClick={onToggleJoin} loading={joinBusy}>
                  <UserRoundPlus className="size-3.5" /> Join community
                </Button>
              }
            />
          </div>
        ) : postsLoading ? (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : showingDemos ? (
          <div>
            <p className="text-center text-[11px] text-mute mb-3">
              Sample posts while this community fills up — real posts take over automatically.
            </p>
            <div className="space-y-4">
              {posts.map((p, i) => (
                <CardMotion key={p.id} index={i % 6}>
                  <PostCard post={p} showCategory={false} />
                </CardMotion>
              ))}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<Hash className="size-6" />}
              title="No posts yet"
              desc="Start the first conversation in this community."
              action={
                <Button size="sm" onClick={() => requestCompose(c.id)}>
                  <PenSquare className="size-3.5" /> Write the first post
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((p, i) => (
                <CardMotion key={p.id} index={i % 6}>
                  <PostCard post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} showCategory={false} />
                </CardMotion>
              ))}
            </div>
            {more && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => loadPosts(false)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        ))}

      {tab === "about" && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display font-semibold text-sm">House rules</h2>
          {rules.length === 0 ? (
            <p className="text-sm text-mute mt-3">No rules posted yet. The OFFMUTE-wide guidelines apply: no doxxing, no harassment, no leaks.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 text-sm">
                  <Check className="text-ok size-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{r.content}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 pt-4 border-t border-line text-xs text-mute leading-relaxed">
            OFFMUTE platform guidelines: keep criticism honest and about culture, never about
            individuals. Never name real people or companies, never publish confidential
            information, never threaten or harass.
          </div>
        </div>
      )}

      {tab === "chat" &&
        (joined ? (
          <ChatPanel communityId={c.id} uid={uid} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<MessageCircle className="size-6" />}
              title="Discussion is for members"
              desc="Join the community to open the live discussion room."
            />
          </div>
        ))}

      {tab === "members" &&
        (members.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<Users className="size-6" />}
              title={c.is_restricted ? "Member lists are private" : "No members to show yet"}
              desc={
                c.is_restricted
                  ? "Restricted communities don't expose their member lists to non-members."
                  : "Be the first in."
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <div
                key={m.user.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5"
              >
                <Avatar handle={m.user.handle} src={m.user.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{m.user.handle}</p>
                  <p className="text-[11px] text-mute">joined {timeAgo(m.joined_at)} ago</p>
                </div>
                {m.role === "owner" && <Badge tone="coral">owner</Badge>}
              </div>
            ))}
          </div>
        ))}

      {tab === "reports" && isOwner && (
        <div className="space-y-2">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState
                icon={<ShieldAlert className="size-6" />}
                title="No reports on this community"
                desc="Reports filed against this community will appear here for your review."
              />
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "pending" ? "warn" : r.status === "resolved" ? "ok" : "neutral"}>
                    {r.status}
                  </Badge>
                  <span className="text-xs text-mute">{timeAgo(r.created_at)} ago</span>
                </div>
                <p className="text-sm font-semibold mt-2">{r.reason}</p>
                {r.details && <p className="text-sm text-mute mt-1 leading-relaxed">{r.details}</p>}
                {r.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="soft" onClick={() => onReportStatus(r.id, "resolved")}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onReportStatus(r.id, "dismissed")}>
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={onToggleJoin}
        loading={joinBusy}
        title={`Leave #${c.name}?`}
        message="You can rejoin anytime. Your identity and handle are unaffected."
        confirmLabel="Leave community"
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteBusy}
        danger
        title="Delete this community?"
        message="This permanently removes the community, its posts, messages, rules and memberships. This cannot be undone."
        confirmLabel="Delete community"
      />
    </div>
  );
}
