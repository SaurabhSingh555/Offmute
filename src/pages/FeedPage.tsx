import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Compass, Inbox, PenSquare } from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import type { Community, PostItem } from "@/lib/types";
import {
  fetchFeed,
  fetchJoinedCommunities,
  fetchMyEngagement,
  fetchMyPollVotes,
} from "@/lib/queries";
import {
  getFeedTabs,
  otherAudienceCommunitySlugs,
  useAudience,
} from "@/lib/audience";
import { applyAiReplyCounts } from "@/lib/aiReplies";
import PostCard, { CardMotion } from "@/components/PostCard";
import RecentActivity from "@/components/RecentActivity";
import { requestCompose } from "@/components/PostComposer";
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
  const audience = useAudience();
  const tabs = getFeedTabs(audience);
  const [tab, setTab] = useState("foryou");
  const [communityId, setCommunityId] = useState("");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Community[]>([]);
  const postsRef = useRef<PostItem[]>([]);
  postsRef.current = posts;
  const seq = useRef(0);

  useEffect(() => {
    if (!profile) return;
    const hidden = otherAudienceCommunitySlugs(audience);
    fetchJoinedCommunities(profile.id, 30)
      .then((list) => setJoined(list.filter((c) => !hidden.has(c.slug))))
      .catch(() => {});
  }, [profile?.id, audience]);

  const load = useCallback(
    async (reset: boolean) => {
      if (!profile) {
        setLoading(false);
        return;
      }
      const mySeq = ++seq.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const offset = reset ? 0 : postsRef.current.length;
        const tabDef = getFeedTabs(audience).find((t) => t.id === tab);
        const res = await fetchFeed(profile.id, tab, {
          communityId: communityId || null,
          offset,
          categorySlug: tabDef?.categorySlug ?? null,
          audience,
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

        const withAi = applyAiReplyCounts(res.posts);
        setPosts((prev) => (reset ? withAi : [...prev, ...withAi]));
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
    [profile?.id, tab, communityId, audience]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const onPosted = () => load(true);
    const onAiReplies = () => load(true);
    window.addEventListener("om:posted", onPosted);
    window.addEventListener("om:ai-replies", onAiReplies);
    return () => {
      window.removeEventListener("om:posted", onPosted);
      window.removeEventListener("om:ai-replies", onAiReplies);
    };
  }, [load]);

  useEffect(() => {
    if (!getFeedTabs(audience).some((t) => t.id === tab)) setTab("foryou");
    setCommunityId("");
  }, [audience, tab]);

  function onDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }
  function onBodyUpdated(id: string, body: string) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, body } : p)));
  }

  const isForyouEmpty = tab === "foryou" && !communityId;

  return (
    <div className="space-y-6">
      {/* Live ticker: who just posted */}
      <RecentActivity />

      {/* Header */}
      <div className="flex items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight uppercase">Feed</h1>
          <p className="text-xs font-mono text-mute mt-1 uppercase tracking-wider">
            {audience === "student"
              ? "What's actually going on around campus."
              : "What's actually going on at work."}
          </p>
        </div>
        <Button size="sm" className="shrink-0 hidden sm:inline-flex" onClick={() => requestCompose()}>
          <PenSquare className="size-3.5 mr-1" /> Post
        </Button>
      </div>

      {/* Filter & Tabs */}
      <div className="space-y-3">
        {joined.length > 0 && (
          <div className="max-w-xs">
            <Select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              aria-label="Filter by your communities"
              className="h-9 text-xs font-mono uppercase"
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

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" role="tablist" aria-label="Feed tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id && !communityId}
              onClick={() => {
                setTab(t.id);
                setCommunityId("");
              }}
              className={cn(
                "relative shrink-0 border px-4 py-1.5 text-[11px] font-bold font-mono uppercase tracking-wider transition-colors",
                tab === t.id && !communityId 
                  ? "bg-brand text-black border-brand" 
                  : "text-mute hover:text-ink bg-surface border-line hover:border-mute"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-4 pt-2">
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : posts.length === 0 ? (
        <div className="border border-line bg-surface">
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
                ? "Follow anonymous handles and join communities."
                : "Be the first to say what everyone's thinking."
            }
            action={
              <div className="flex gap-2 flex-wrap justify-center mt-2">
                <Button size="sm" onClick={() => requestCompose()}>
                  <PenSquare className="size-3.5 mr-1" /> Write post
                </Button>
                <Link to="/explore">
                  <Button size="sm" variant="outline">
                    <Compass className="size-3.5 mr-1" /> Find communities
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
            <div className="flex justify-center pt-4 border-t border-line mt-4">
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