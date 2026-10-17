import { supabase } from "./supabase";
import type {
  Category,
  ChatMsg,
  CommentItem,
  Community,
  CommunityRule,
  NotifItem,
  PostItem,
  Profile,
  ReportItem,
  ReportStatus,
  ReportTarget,
} from "./types";
import { FEED_TABS, PAGE_SIZE } from "./types";
import { isUniqueViolation } from "./utils";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function friendlyError(msg: string): string {
  if (/row-level security/i.test(msg)) return "You don't have permission to do that.";
  if (/posting too quickly|commenting too quickly|sending messages too quickly/i.test(msg))
    return msg;
  if (/new row violates check constraint/i.test(msg))
    return "That input doesn't meet the rules. Please adjust and retry.";
  return msg;
}

const POST_SELECT = `
  id, body, image_url, user_id, created_at, updated_at, community_id, category_id,
  profile:profiles!posts_user_id_fkey(handle, avatar_url),
  category:categories(slug, name),
  community:communities(slug, name, is_restricted),
  likes(count),
  comments(count),
  poll:polls(id, question, poll_options(id, label, sort_order, poll_votes(count)))
`;

function normalizePost(raw: any): PostItem {
  const likes = raw.likes as { count: number }[] | null;
  const comments = raw.comments as { count: number }[] | null;
  let poll: PostItem["poll"] = null;
  if (raw.poll && Array.isArray((raw.poll as any).poll_options)) {
    const p = raw.poll as any;
    poll = {
      id: p.id,
      question: p.question,
      options: (p.poll_options as any[])
        .map((o) => ({
          id: o.id,
          label: o.label,
          sort_order: o.sort_order,
          votes: (o.poll_votes as { count: number }[] | undefined)?.[0]?.count ?? 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  }
  return {
    id: raw.id,
    body: raw.body,
    image_url: raw.image_url,
    user_id: raw.user_id,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    community_id: raw.community_id,
    category_id: raw.category_id,
    profile: raw.profile ?? null,
    category: raw.category ?? null,
    community: raw.community ?? null,
    likeCount: likes?.[0]?.count ?? 0,
    commentCount: comments?.[0]?.count ?? 0,
    liked: false,
    bookmarked: false,
    poll,
    myPollVote: null,
  };
}

/* ------------------------------- Categories ----------------------------- */

let categoriesCache: Category[] | null = null;
let categoriesPromise: Promise<Category[]> | null = null;

export function fetchCategories(): Promise<Category[]> {
  if (categoriesCache) return Promise.resolve(categoriesCache);
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description")
        .order("id");
      if (error) {
        categoriesPromise = null;
        throw new Error(error.message);
      }
      categoriesCache = data as Category[];
      return categoriesCache;
    })();
  }
  return categoriesPromise;
}

/* --------------------------------- Feed ---------------------------------- */

export interface FeedResult {
  posts: PostItem[];
  more: boolean;
}

export async function fetchFeed(
  uid: string,
  tab: string,
  opts: { communityId?: string | null; offset: number; limit?: number }
): Promise<FeedResult> {
  const limit = opts.limit ?? PAGE_SIZE;
  const tabDef = FEED_TABS.find((t) => t.id === tab);

  let q = supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (opts.communityId) {
    q = q.eq("community_id", opts.communityId);
  } else if (tabDef?.categorySlug) {
    const cats = await fetchCategories().catch(() => null);
    const cat = cats?.find((c) => c.slug === tabDef.categorySlug);
    if (cat) q = q.eq("category_id", cat.id);
  }

  if (tab === "trending" && !opts.communityId) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await q.gte("created_at", weekAgo).range(0, 99);
    if (error) throw new Error(error.message);
    const items = (data ?? []).map(normalizePost);
    items.sort(
      (a, b) =>
        b.likeCount * 3 + b.commentCount * 2 + (b.poll ? 2 : 0) -
        (a.likeCount * 3 + a.commentCount * 2 + (a.poll ? 2 : 0))
    );
    return { posts: items.slice(0, limit), more: false };
  }

  if (tab === "foryou" && !opts.communityId) {
    const rel = await fetchMyRelationships(uid);
    const followed = rel.follows.map((f) => f.followee_id);
    const comms = rel.members.map((m) => m.community_id);
    if (followed.length || comms.length) {
      const parts: string[] = [];
      if (followed.length) parts.push(`user_id.in.(${followed.join(",")})`);
      if (comms.length) parts.push(`community_id.in.(${comms.join(",")})`);
      q = q.or(parts.join(","));
    }
  }

  const { data, error, count } = await q.range(opts.offset, opts.offset + limit - 1);
  if (error) throw new Error(error.message);
  const posts: PostItem[] = ((data ?? []) as any[]).map(normalizePost);
  return {
    posts,
    more: count != null ? opts.offset + limit < count : posts.length >= limit,
  };
}

let relCache = new Map<string, { follows: { followee_id: string }[]; members: { community_id: string }[] }>();

export async function fetchMyRelationships(uid: string) {
  const cached = relCache.get(uid);
  if (cached) return cached;
  const [f, m] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", uid).limit(100),
    supabase.from("community_members").select("community_id").eq("user_id", uid).limit(100),
  ]);
  const value = { follows: (f.data ?? []) as { followee_id: string }[], members: (m.data ?? []) as { community_id: string }[] };
  relCache.set(uid, value);
  return value;
}

export function invalidateRelationships() {
  relCache = new Map();
}

/* --------------------------- Own engagement sets -------------------------- */

export async function fetchMyEngagement(
  uid: string,
  postIds: string[]
): Promise<{ liked: Set<string>; bookmarked: Set<string> }> {
  if (!postIds.length) return { liked: new Set(), bookmarked: new Set() };
  const [l, b] = await Promise.all([
    supabase.from("likes").select("post_id").eq("user_id", uid).in("post_id", postIds),
    supabase.from("bookmarks").select("post_id").eq("user_id", uid).in("post_id", postIds),
  ]);
  return {
    liked: new Set((l.data ?? []).map((x) => (x as any).post_id)),
    bookmarked: new Set((b.data ?? []).map((x) => (x as any).post_id)),
  };
}

export async function fetchMyPollVotes(uid: string, pollIds: string[]) {
  if (!pollIds.length) return new Map<string, string>();
  const { data } = await supabase
    .from("poll_votes")
    .select("poll_id, option_id")
    .eq("user_id", uid)
    .in("poll_id", pollIds);
  return new Map((data ?? []).map((v) => [(v as any).poll_id, (v as any).option_id]));
}

/* ------------------------------- Single post ------------------------------ */

export async function fetchPostById(uid: string, id: string): Promise<PostItem | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const item = normalizePost(data);
  const [eng, votes] = await Promise.all([
    fetchMyEngagement(uid, [id]),
    item.poll ? fetchMyPollVotes(uid, [item.poll.id]) : Promise.resolve(new Map<string, string>()),
  ]);
  item.liked = eng.liked.has(id);
  item.bookmarked = eng.bookmarked.has(id);
  item.myPollVote = item.poll ? (votes.get(item.poll.id) ?? null) : null;
  return item;
}

/* -------------------------------- Comments -------------------------------- */

export async function fetchComments(postId: string): Promise<CommentItem[]> {
  // Two separate queries avoid ambiguous nested self-join schema errors.
  const [parentData, replyData] = await Promise.all([
    supabase
      .from("comments")
      .select("id, body, created_at, user_id, parent_comment_id, profile:profiles!comments_user_id_fkey(handle, avatar_url)")
      .eq("post_id", postId)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("comments")
      .select("id, body, created_at, user_id, parent_comment_id, profile:profiles!comments_user_id_fkey(handle, avatar_url)")
      .eq("post_id", postId)
      .not("parent_comment_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (parentData.error) throw new Error(parentData.error.message);
  if (replyData.error) throw new Error(replyData.error.message);
  const parents: CommentItem[] = (parentData.data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    user_id: r.user_id,
    parent_comment_id: r.parent_comment_id,
    profile: r.profile ?? null,
    replies: [],
  }));
  const replyMap = new Map<string, CommentItem[]>();
  const replies: CommentItem[] = (replyData.data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    user_id: r.user_id,
    parent_comment_id: r.parent_comment_id,
    profile: r.profile ?? null,
    replies: [],
  }));
  replies.forEach((r) => {
    if (r.parent_comment_id) {
      if (!replyMap.has(r.parent_comment_id)) replyMap.set(r.parent_comment_id, []);
      replyMap.get(r.parent_comment_id)!.push(r);
    }
  });
  parents.forEach((p) => {
    p.replies = replyMap.get(p.id) ?? [];
  });
  return parents;
}

export async function addComment(uid: string, postId: string, body: string, parentId?: string | null) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: uid, body: body.trim(), parent_comment_id: parentId ?? null })
    .select("id, body, created_at, user_id, parent_comment_id, profile:profiles!comments_user_id_fkey(handle, avatar_url)")
    .single();
  if (error) throw new Error(friendlyError(error.message));
  return data as any;
}

export async function deleteComment(uid: string, commentId: string) {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", uid);
  if (error) throw new Error(friendlyError(error.message));
}

/* ---------------------------- Likes / bookmarks --------------------------- */

export async function toggleLike(uid: string, postId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", uid);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: uid });
  if (error) {
    if (isUniqueViolation(error)) return true;
    throw new Error(error.message);
  }
  return true;
}

export async function toggleBookmark(uid: string, postId: string, currentlySaved: boolean): Promise<boolean> {
  if (currentlySaved) {
    const { error } = await supabase.from("bookmarks").delete().eq("post_id", postId).eq("user_id", uid);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase.from("bookmarks").insert({ post_id: postId, user_id: uid });
  if (error) {
    if (isUniqueViolation(error)) return true;
    throw new Error(error.message);
  }
  return true;
}

/* ---------------------------------- Polls --------------------------------- */

export async function castPollVote(uid: string, pollId: string, optionId: string): Promise<void> {
  const { error } = await supabase
    .from("poll_votes")
    .upsert({ poll_id: pollId, option_id: optionId, user_id: uid }, { onConflict: "poll_id,user_id" });
  if (error) throw new Error(friendlyError(error.message));
}

/* ---------------------------------- Posts --------------------------------- */

export async function uploadPostImage(uid: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("post-images")
    .upload(path, file, { cacheControl: "3600" });
  if (error) throw new Error(friendlyError(error.message));
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(friendlyError(error.message));
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export interface CreatePostInput {
  uid: string;
  body: string;
  categorySlug?: string | null;
  communityId?: string | null;
  imageFile?: File | null;
  poll?: { question: string; options: string[] } | null;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const cats = await fetchCategories().catch(() => [] as Category[]);
  const categoryId = input.categorySlug
    ? (cats.find((c) => c.slug === input.categorySlug)?.id ?? null)
    : null;
  let imageUrl: string | null = null;
  if (input.imageFile) imageUrl = await uploadPostImage(input.uid, input.imageFile);

  const { data: rows, error } = await supabase
    .from("posts")
    .insert({
      user_id: input.uid,
      body: input.body.trim(),
      community_id: input.communityId ?? null,
      category_id: categoryId,
      image_url: imageUrl,
    })
    .select("id");
  if (error) throw new Error(friendlyError(error.message));
  const postId = (rows?.[0] as any)?.id as string;

  const cleanOptions = (input.poll?.options ?? []).map((o) => o.trim()).filter(Boolean).slice(0, 5);
  if (cleanOptions.length >= 2) {
    const { data: pollRow, error: pollErr } = await supabase
      .from("polls")
      .insert({ post_id: postId, question: input.poll?.question?.trim() || null })
      .select("id")
      .single();
    if (pollErr) throw new Error(friendlyError(pollErr.message));
    const { error: optErr } = await supabase
      .from("poll_options")
      .insert(cleanOptions.map((label, i) => ({ poll_id: (pollRow as any).id, label, sort_order: i })));
    if (optErr) throw new Error(friendlyError(optErr.message));
  }
  return postId;
}

export async function updatePostBody(uid: string, postId: string, body: string) {
  const { error } = await supabase
    .from("posts")
    .update({ body: body.trim() })
    .eq("id", postId)
    .eq("user_id", uid);
  if (error) throw new Error(friendlyError(error.message));
}

export async function deletePost(uid: string, postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", uid);
  if (error) throw new Error(friendlyError(error.message));
}

/* --------------------------------- Search --------------------------------- */

export async function searchAll(
  q: string
): Promise<{ posts: PostItem[]; communities: Community[]; profiles: Profile[] }> {
  const needle = `%${q}%`;
  const [p, c, u] = await Promise.all([
    supabase
      .from("posts")
      .select(POST_SELECT)
      .ilike("body", needle)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("communities")
      .select(
        "id, slug, name, description, is_restricted, created_by, created_at, member:community_members(count)"
      )
      .or(`name.ilike.${needle},slug.ilike.${needle}`)
      .limit(8),
    supabase
      .from("profiles")
      .select("id, handle, avatar_url, bio")
      .ilike("handle", needle)
      .limit(8),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (c.error) throw new Error(c.error.message);
  if (u.error) throw new Error(u.error.message);
  const communities = ((c.data ?? []) as any[]).map((x) => ({
    ...(x as unknown as Community),
    member_count: (x.member as { count: number }[] | undefined)?.[0]?.count ?? 0,
  }));
  return {
    posts: (p.data ?? []).map(normalizePost),
    communities,
    profiles: (u.data ?? []) as Profile[],
  };
}

/* ------------------------------- Communities ------------------------------ */

export async function fetchCommunities(opts: {
  slugEquals?: string;
  limit?: number;
} = {}): Promise<Community[]> {
  let q = supabase
    .from("communities")
    .select("id, slug, name, description, is_restricted, created_by, created_at, member:community_members(count)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 40);
  if (opts.slugEquals) q = q.eq("slug", opts.slugEquals);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((x) => ({
    ...(x as unknown as Community),
    member_count: (x.member as { count: number }[] | undefined)?.[0]?.count ?? 0,
  }));
}

export interface CommunityDetail {
  community: Community;
  joined: boolean;
  role: "owner" | "member" | null;
  postCount: number;
}

export async function fetchCommunityBySlug(uid: string, slug: string): Promise<CommunityDetail | null> {
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug, name, description, is_restricted, created_by, created_at, member:community_members(count)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [meRow, postCount] = await Promise.all([
    supabase
      .from("community_members")
      .select("role")
      .eq("community_id", (data as any).id)
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("community_id", (data as any).id),
  ]);
  return {
    community: {
      ...(data as unknown as Community),
      member_count: ((data as any).member as { count: number }[] | undefined)?.[0]?.count ?? 0,
    },
    joined: !!meRow.data,
    role: (meRow.data as any)?.role ?? null,
    postCount: postCount.count ?? 0,
  };
}

export async function joinCommunity(uid: string, communityId: string) {
  const { error } = await supabase
    .from("community_members")
    .insert({ community_id: communityId, user_id: uid, role: "member" });
  if (error) throw new Error(friendlyError(error.message));
  invalidateRelationships();
}

export async function leaveCommunity(uid: string, communityId: string) {
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", uid);
  if (error) throw new Error(friendlyError(error.message));
  invalidateRelationships();
}

export async function fetchCommunityRules(communityId: string): Promise<CommunityRule[]> {
  const { data, error } = await supabase
    .from("community_rules")
    .select("id, content, sort_order")
    .eq("community_id", communityId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as CommunityRule[];
}

export async function fetchCommunityFeed(
  uid: string,
  communityId: string,
  offset: number,
  limit?: number
): Promise<FeedResult> {
  const lim = limit ?? PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .range(offset, offset + lim - 1);
  if (error) throw new Error(error.message);
  const posts: PostItem[] = ((data ?? []) as any[]).map(normalizePost);
  const eng = await fetchMyEngagement(uid, posts.map((p) => p.id));
  posts.forEach((p) => {
    p.liked = eng.liked.has(p.id);
    p.bookmarked = eng.bookmarked.has(p.id);
  });
  return { posts, more: count != null ? offset + lim < count : posts.length >= lim };
}

export interface MemberRow {
  user: { id: string; handle: string; avatar_url: string | null };
  role: "owner" | "member";
  joined_at: string;
}

export async function fetchMembers(communityId: string, limit = 60): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("community_members")
    .select("user:profiles!community_members_user_id_fkey(id, handle, avatar_url), role, joined_at")
    .eq("community_id", communityId)
    .order("joined_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MemberRow[];
}

export async function createCommunity(
  uid: string,
  input: { name: string; slug: string; description: string; is_restricted: boolean; rules: string[] }
): Promise<string> {
  const { data, error } = await supabase
    .from("communities")
    .insert({
      name: input.name.trim(),
      slug: input.slug,
      description: input.description.trim(),
      is_restricted: input.is_restricted,
      created_by: uid,
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw new Error("A community with that name already exists.");
    throw new Error(friendlyError(error.message));
  }
  const rules = input.rules.map((r) => r.trim()).filter(Boolean).slice(0, 6);
  if (rules.length) {
    const { error: rErr } = await supabase
      .from("community_rules")
      .insert(rules.map((content, i) => ({ community_id: (data as any).id, content, sort_order: i })));
    if (rErr) throw new Error(friendlyError(rErr.message));
  }
  return (data as any).id as string;
}

export async function deleteCommunity(uid: string, communityId: string) {
  const { error } = await supabase
    .from("communities")
    .delete()
    .eq("id", communityId)
    .eq("created_by", uid);
  if (error) throw new Error(friendlyError(error.message));
}

/* ----------------------------- Community chat ----------------------------- */

export async function fetchChatHistory(communityId: string): Promise<ChatMsg[]> {
  const { data, error } = await supabase
    .from("community_messages")
    .select("id, body, created_at, user_id, profile:profiles!community_messages_user_id_fkey(handle, avatar_url)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: true })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ChatMsg[];
}

export async function sendChatMessage(uid: string, communityId: string, body: string) {
  const { error } = await supabase
    .from("community_messages")
    .insert({ community_id: communityId, user_id: uid, body: body.trim() });
  if (error) throw new Error(friendlyError(error.message));
}

/* ------------------------------- Notifications ---------------------------- */

export async function fetchNotifications(uid: string, limit = 30): Promise<NotifItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, created_at, read_at, post_id, comment_id, community_id, community:communities(slug), actor:profiles!notifications_actor_id_fkey(handle, avatar_url)"
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotifItem[];
}

export async function fetchUnreadCount(uid: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markNotifRead(uid: string, id: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", uid);
}

export async function markAllNotifsRead(uid: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("read_at", null);
}

/* --------------------------------- Profiles ------------------------------- */

export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, avatar_url, bio, created_at")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

export async function fetchProfilePosts(
  uid: string,
  authorId: string,
  offset: number,
  limit?: number
): Promise<FeedResult> {
  const lim = limit ?? PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("posts")
    .select(POST_SELECT, { count: "exact" })
    .eq("user_id", authorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + lim - 1);
  if (error) throw new Error(error.message);
  const posts: PostItem[] = ((data ?? []) as any[]).map(normalizePost);
  const eng = await fetchMyEngagement(uid, posts.map((p) => p.id));
  posts.forEach((p) => {
    p.liked = eng.liked.has(p.id);
    p.bookmarked = eng.bookmarked.has(p.id);
  });
  return { posts, more: count != null ? offset + lim < count : posts.length >= lim };
}

export async function fetchProfileCommunities(profileId: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from("community_members")
    .select("community:communities(id, slug, name, is_restricted, description, created_by, created_at)")
    .eq("user_id", profileId)
    .limit(20);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((x) => x.community) as unknown as Community[];
}

export async function isFollowing(uid: string, followeeId: string): Promise<boolean> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", uid)
    .eq("followee_id", followeeId)
    .maybeSingle();
  return !!data;
}

export async function toggleFollow(uid: string, followeeId: string, current: boolean): Promise<boolean> {
  if (current) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", uid)
      .eq("followee_id", followeeId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: uid, followee_id: followeeId });
  if (error) {
    if (isUniqueViolation(error)) return true;
    throw new Error(friendlyError(error.message));
  }
  return true;
}

export async function fetchJoinedCommunities(uid: string, limit = 10): Promise<Community[]> {
  const rel = await fetchMyRelationships(uid);
  const ids = rel.members.map((m) => m.community_id).slice(0, limit);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug, name, is_restricted, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Community[];
}

/* --------------------------------- Reports -------------------------------- */

export async function createReport(
  uid: string,
  targetType: ReportTarget,
  targetId: string,
  reason: string,
  details: string
) {
  const { error } = await supabase
    .from("reports")
    .insert({
      reporter_id: uid,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
  if (error) throw new Error(friendlyError(error.message));
}

export async function fetchMyReports(uid: string): Promise<ReportItem[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, created_at, resolved_at")
    .eq("reporter_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReportItem[];
}

export async function fetchCommunityReports(uid: string, communityId: string): Promise<ReportItem[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, created_at, resolved_at")
    .eq("target_type", "community")
    .eq("target_id", communityId)
    .eq("reporter_id", uid) // owners see community reports via RLS; own reports too
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  // RLS also returns community reports for owners; fetch those too when owner:
  const all = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, created_at, resolved_at")
    .eq("target_type", "community")
    .eq("target_id", communityId)
    .order("created_at", { ascending: false })
    .limit(50);
  const merged = new Map<string, ReportItem>();
  [...(data ?? []), ...((all.data ?? []) as ReportItem[])].forEach((r) => merged.set(r.id, r));
  return [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function setReportStatus(uid: string, reportId: string, status: ReportStatus) {
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", reportId)
    .eq("user_id", uid);
  if (error) throw new Error(friendlyError(error.message));
}

/* ---------------------------------- Blocks -------------------------------- */

export async function fetchMyBlocks(
  uid: string
): Promise<{ blocked: Profile[]; blockedMe: Profile[] }> {
  const [a, b] = await Promise.all([
    supabase
      .from("blocks")
      .select("blocked:profiles!blocks_blocked_id_fkey(id, handle, avatar_url, bio, created_at)")
      .eq("blocker_id", uid),
    supabase
      .from("blocks")
      .select("blocker:profiles!blocks_blocker_id_fkey(id, handle, avatar_url, bio, created_at)")
      .eq("blocked_id", uid),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  return {
    blocked: ((a.data ?? []) as any[]).map((x) => x.blocked) as unknown as Profile[],
    blockedMe: ((b.data ?? []) as any[]).map((x) => x.blocker) as unknown as Profile[],
  };
}

export async function isBlocking(uid: string, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", uid)
    .eq("blocked_id", targetId)
    .maybeSingle();
  return !!data;
}

export async function toggleBlock(uid: string, targetId: string, current: boolean): Promise<boolean> {
  if (current) {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", uid)
      .eq("blocked_id", targetId);
    if (error) throw new Error(error.message);
    return false;
  }
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: uid, blocked_id: targetId });
  if (error) {
    if (isUniqueViolation(error)) return true;
    throw new Error(friendlyError(error.message));
  }
  return true;
}

/* --------------------------------- Bookmarks ------------------------------ */

export async function fetchSavedPosts(uid: string, offset: number, limit?: number): Promise<FeedResult> {
  const lim = limit ?? PAGE_SIZE;
  const { data, error } = await supabase
    .from("bookmarks")
    .select("post:posts(" + POST_SELECT.replace(/user_id,/g, "") + "), created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .range(offset, offset + lim - 1);
  if (error) throw new Error(error.message);
  const posts = ((data ?? []) as any[]).map((x) => normalizePost(x.post));
  posts.forEach((p) => (p.bookmarked = true));
  return { posts, more: (data?.length ?? 0) >= lim };
}
