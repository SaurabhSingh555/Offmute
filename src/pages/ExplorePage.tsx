import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AtSign,
  Check,
  Hash,
  Lock,
  Search,
  SearchX,
  Users,
} from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import type { Category, Community, PostItem, Profile } from "@/lib/types";
import {
  fetchCategories,
  fetchCommunities,
  fetchJoinedCommunities,
  joinCommunity,
  leaveCommunity,
  searchAll,
} from "@/lib/queries";
import PostCard, { CardMotion } from "@/components/PostCard";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/utils/cn";

function CommunityCard({
  community,
  joined,
  onToggle,
}: {
  community: Community;
  joined: boolean;
  onToggle: () => void;
}) {
  const restricted = community.is_restricted;
  const memberCount = community.member_count ?? 0;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 hover:border-brand/40 transition-colors">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-10 rounded-xl bg-coral-soft text-coral shrink-0">
          <Hash className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/community/${community.slug}`}
            className="font-semibold text-[15px] hover:text-brand transition-colors flex items-center gap-1.5"
          >
            <span className="truncate">{community.name}</span>
            {restricted && <Lock className="size-3.5 text-mute shrink-0" />}
          </Link>
          <p className="text-xs text-mute mt-0.5 flex items-center gap-1">
            {restricted && memberCount <= 1 ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> Members only
              </span>
            ) : (
              <>
                <Users className="size-3" /> {memberCount} member{memberCount === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant={joined ? "outline" : "soft"}
          onClick={onToggle}
          className="shrink-0"
        >
          {joined ? (
            <>
              <Check className="size-3.5" /> Joined
            </>
          ) : (
            "Join"
          )}
        </Button>
      </div>
      {community.description && (
        <p className="text-[13px] text-mute leading-relaxed line-clamp-2">{community.description}</p>
      )}
    </div>
  );
}

export default function ExplorePage() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<{
    posts: PostItem[];
    communities: Community[];
    profiles: Profile[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Debounced search input */
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetchCategories().then(setCats).catch(() => {});
    if (profile)
      fetchJoinedCommunities(profile.id, 100)
        .then((c) => setJoinedIds(new Set(c.map((x) => x.id))))
        .catch(() => {});
  }, [profile?.id]);

  useEffect(() => {
    let alive = true;
    setError(null);
    setCommunities(null);
    fetchCommunities({ slugEquals: activeCat || undefined })
      .then((c) => alive && setCommunities(c))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [activeCat]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    searchAll(debounced)
      .then((r) => alive && setResults(r))
      .catch(() => alive && setResults(null))
      .finally(() => alive && setSearching(false));
    return () => {
      alive = false;
    };
  }, [debounced]);

  async function toggleJoin(c: Community) {
    if (!profile) return;
    const wasJoined = joinedIds.has(c.id);
    try {
      if (wasJoined) await leaveCommunity(profile.id, c.id);
      else await joinCommunity(profile.id, c.id);
      setJoinedIds((prev) => {
        const next = new Set(prev);
        if (wasJoined) next.delete(c.id);
        else next.add(c.id);
        return next;
      });
      window.dispatchEvent(new Event("om:refresh-side"));
      toast({
        title: wasJoined ? `Left #${c.name}` : `Joined #${c.name}`,
        variant: wasJoined ? "info" : "ok",
      });
    } catch (e) {
      toast({ title: "Couldn't change membership", desc: (e as Error).message, variant: "bad" });
    }
  }

  const visibleCommunities = useMemo(
    () => (results ? results.communities : communities ?? []),
    [results, communities]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Explore</h1>
        <p className="text-sm text-mute mt-0.5">Find communities, people and posts.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-mute" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts, communities, @handles…"
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-line text-sm placeholder:text-mute/70 focus:border-brand focus:outline-none transition-colors"
          aria-label="Search"
        />
        {searching && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="block size-4 rounded-full border-2 border-line border-t-brand animate-spin" />
          </span>
        )}
      </div>

      {debounced.length >= 2 ? (
        /* ------------------------------ Search results ---------------------------- */
        results === null && !searching ? (
          <ErrorState message="Search failed." />
        ) : (
          <div className="space-y-6">
            {results && results.profiles.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-mute mb-3">
                  People
                </h2>
                <div className="space-y-2">
                  {results.profiles.map((p) => (
                    <Link
                      key={p.id}
                      to={`/profile/${p.handle}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-brand/40 transition-colors"
                    >
                      <Avatar handle={p.handle} src={p.avatar_url} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <AtSign className="size-3.5 text-mute" />
                          {p.handle}
                        </p>
                        {p.bio && <p className="text-xs text-mute truncate">{p.bio}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results && results.communities.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-mute mb-3">
                  Communities
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {results.communities.map((c) => (
                    <CommunityCard
                      key={c.id}
                      community={c}
                      joined={joinedIds.has(c.id)}
                      onToggle={() => toggleJoin(c)}
                    />
                  ))}
                </div>
              </section>
            )}

            {results && results.posts.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-mute mb-3">Posts</h2>
                <div className="space-y-4">
                  {results.posts.map((p, i) => (
                    <CardMotion key={p.id} index={i}>
                      <PostCard post={p} />
                    </CardMotion>
                  ))}
                </div>
              </section>
            )}

            {results &&
              results.posts.length === 0 &&
              results.communities.length === 0 &&
              results.profiles.length === 0 && (
                <div className="rounded-2xl border border-line bg-surface">
                  <EmptyState
                    icon={<SearchX className="size-6" />}
                    title={`No results for “${debounced}”`}
                    desc="Try a different word, or browse communities below."
                  />
                </div>
              )}
          </div>
        )
      ) : (
        /* ------------------------------ Browse mode ------------------------------- */
        <>
          <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
            <button
              onClick={() => setActiveCat("")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                activeCat === "" ? "bg-ink text-bg" : "bg-raise/60 text-mute hover:text-ink"
              )}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActiveCat(c.slug)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  activeCat === c.slug ? "bg-ink text-bg" : "bg-raise/60 text-mute hover:text-ink"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>

          {error ? (
            <ErrorState message={error} />
          ) : communities === null ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : visibleCommunities.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState
                icon={<Hash className="size-6" />}
                title="No communities match this filter"
                desc="Try another category, or create the community you wish existed."
                action={
                  <Link to="/community/new">
                    <Button size="sm">Create community</Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {visibleCommunities.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <CommunityCard
                    community={c}
                    joined={joinedIds.has(c.id)}
                    onToggle={() => toggleJoin(c)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl border border-brand/30 bg-brand-soft/60 px-4 py-3.5">
            <p className="text-sm font-semibold">
              Can't find your world? <span className="text-mute font-normal">Build it.</span>
            </p>
            <Link to="/community/new">
              <Button size="sm">Create community</Button>
            </Link>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge tone="coral">Tip</Badge>
        <p className="text-xs text-mute flex-1 min-w-52 leading-relaxed">
          Restricted communities hide their members and posts from non-members — enforced at the
          database level, not just the UI.
        </p>
      </div>
    </div>
  );
}
