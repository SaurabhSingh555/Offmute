import { useCallback, useEffect, useState } from "react";
import { BookmarkX } from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import type { PostItem } from "@/lib/types";
import { fetchSavedPosts } from "@/lib/queries";
import { ALL_DEMO_POSTS, demoSavedIds, withDemoEngagement } from "@/lib/demoContent";
import PostCard, { CardMotion } from "@/components/PostCard";
import { Button, EmptyState, ErrorState, PostSkeleton } from "@/components/ui";

export default function SavedPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (!profile) return;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const offset = reset ? 0 : posts.length;
        const res = await fetchSavedPosts(profile.id, offset);
        // Sample posts saved from the feed are stored in this browser only.
        const demoSaved = withDemoEngagement(
          ALL_DEMO_POSTS.filter((p) => demoSavedIds().has(p.id))
        );
        setPosts((prev) =>
          reset ? [...demoSaved, ...res.posts] : [...prev, ...res.posts]
        );
        setMore(res.more);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (reset) setLoading(false);
        else setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.id]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Saved</h1>
        <p className="text-sm text-mute mt-0.5">Only you can see this list. Ever.</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<BookmarkX className="size-6" />}
            title="Nothing saved yet"
            desc="Tap the bookmark icon on any post to stash it here for a slow afternoon."
          />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {posts.map((p, i) => (
              <CardMotion key={p.id} index={i % 6}>
                <PostCard post={p} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
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
