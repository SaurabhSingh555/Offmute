import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Inbox, PenSquare } from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import type { Community, PostItem } from "@/lib/types";
import { FEED_TABS } from "@/lib/types";
import {
  fetchFeed,
  fetchJoinedCommunities,
  fetchMyEngagement,
  fetchMyPollVotes,
} from "@/lib/queries";
import PostCard, { CardMotion } from "@/components/PostCard";
import { requestCompose } from "@/components/PostComposer";
import { demoPostsFor } from "@/lib/demoContent";
import {
  Button,
  EmptyState,
  ErrorState,
  PostSkeleton,
  Select,
} from "@/components/ui";
import { cn } from "@/utils/cn";

export default function FeedPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState("foryou");
  const [communityId, setCommunityId] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Community[]>([]);
  const [showingDemos, setShowingDemos] = useState(false);
  const joinedRef = useRef<Community[]>([]);
  joinedRef.current = joined;
  const postsRef = useRef<PostItem[]>([]);
  postsRef.current = posts;
  const seq = useRef(0);

  useEffect(() => {
    if (!profile) return;
    fetchJoinedCommunities(profile.id, 30).then(setJoined).catch(() => {});
  }, [profile?.id]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!profile) {
        // Profile not loaded yet — the layout banner offers retry/reload.
        setLoading(false);
        return;
      }
      const mySeq = ++seq.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const offset = reset ? 0 : postsRef.current.length;
        const res = await fetchFeed(profile.id, tab, {
          communityId: communityId || null,
          offset,
        });
        const ids = res.posts.map((p) => p.id);
        const [eng, votes] = await Promise.all([
          fetchMyEngagement(profile.id, ids),
          fetchMyPollVotes(profile.id, res.posts.filter((p) => p.poll).map((p) => p.poll!.id)),
        ]);
        res.posts.forEach((p) => {
          p.liked = eng.liked.has(p.id);
          p.bookmarked = eng.bookmarked.has(p.id);
          p.myPollVote = p.poll ? (votes.get(p.poll.id) ?? null) : null;
        });
        if (mySeq !== seq.current) return;
        // Empty context → show client-side samples so new users never see a blank feed.
        if (reset && res.posts.length === 0 && !res.more) {
          const cSlug = joinedRef.current.find((c) => c.id === communityId)?.slug ?? null;
          const tabDef2 = FEED_TABS.find((t) => t.id === tab);
          const demos = demoPostsFor({
            tab,
            categorySlug: tabDef2?.categorySlug,
            communitySlug: cSlug,
          });
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
        if (mySeq === seq.current) setError((e as Error).message);
      } finally {
        if (mySeq === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [profile?.id, tab, communityId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  /* Refresh the feed when a new post is published from anywhere */
  useEffect(() => {
    const onPosted = () => load(true);
    window.addEventListener("om:posted", onPosted);
    return () => window.removeEventListener("om:posted", onPosted);
  }, [load]);

  function onDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }
  function onBodyUpdated(id: string, body: string) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, body } : p)));
  }

  const isForyouEmpty = tab === "foryou" && !communityId;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Feed</h1>
          <p className="text-sm text-mute mt-0.5">What's actually going on at work.</p>
        </div>
        <Button size="sm" className="shrink-0 hidden sm:inline-flex" onClick={() => requestCompose()}>
          <PenSquare className="size-3.5" /> Post
        </Button>
      </div>

      {joined.length > 0 && (
        <div className="max-w-xs">
          <Select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            aria-label="Filter by your communities"
          >
            <option value="">All of OFFMUTE</option>
            {joined.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" role="tablist" aria-label="Feed tabs">
        {FEED_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id && !communityId}
            onClick={() => {
              setTab(t.id);
              setCommunityId("");
            }}
            className={cn(
              "relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              tab === t.id && !communityId ? "text-white" : "text-mute hover:text-ink bg-raise/60"
            )}
          >
            {tab === t.id && !communityId && (
              <motion.span
                layoutId="feed-tab"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {showingDemos && !loading && !error && (
        <p className="text-center text-[11px] text-mute">
          Sample posts while this feed fills up — real posts take over automatically.
        </p>
      )}

      {loading ? (
        <div className="space-y-4 pt-2">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={
              communityId
                ? "This community is quiet"
                : isForyouEmpty
                ? "Your For You feed is empty"
                : "Nothing here yet"
            }
            desc={
              isForyouEmpty && !communityId
                ? "Follow anonymous handles and join communities — their posts will show up here."
                : "Be the first to say what everyone's thinking."
            }
            action={
              <div className="flex gap-2 flex-wrap justify-center">
                <Button size="sm" onClick={() => requestCompose()}>
                  <PenSquare className="size-3.5" /> Write the first post
                </Button>
                <Link to="/explore">
                  <Button size="sm" variant="outline">
                    <Compass className="size-3.5" /> Find communities
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((p, i) => (
              <CardMotion key={p.id} index={i % 6}>
                <PostCard
                  post={p}
                  onDeleted={onDeleted}
                  onBodyUpdated={onBodyUpdated}
                  showCategory={tab.startsWith("cat-")}
                />
              </CardMotion>
            ))}
          </div>
          {more && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => load(false)} loading={loadingMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
