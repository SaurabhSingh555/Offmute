import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AtSign,
  Camera,
  Hash,
  Pencil,
  ShieldBan,
  ShieldOff,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import type { Community, PostItem, Profile } from "@/lib/types";
import {
  fetchProfileByHandle,
  fetchProfileCommunities,
  fetchProfilePosts,
  isBlocking,
  isFollowing,
  toggleBlock,
  toggleFollow,
  uploadAvatar,
} from "@/lib/queries";
import { handleIsValid, isValidImageFile, timeAgo } from "@/lib/utils";
import PostCard, { CardMotion, ReportModal } from "@/components/PostCard";
import {
  Avatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Menu,
  Modal,
  PostSkeleton,
  Textarea,
} from "@/components/ui";

/* --------------------------- Profile edit modal --------------------------- */

export function ProfileEditModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && profile) {
      setHandle(profile.handle);
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url);
      setError(null);
    }
  }, [open, profile]);

  async function onFile(file: File | undefined) {
    if (!file || !profile) return;
    const check = isValidImageFile(file);
    if (!check.ok) {
      toast({ title: "Image rejected", desc: check.error, variant: "bad" });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      setAvatarUrl(url);
      toast({ title: "Avatar uploaded", desc: "Save the form to make it live.", variant: "ok" });
    } catch (e) {
      toast({ title: "Upload failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!profile) return;
    setError(null);
    if (!handleIsValid(handle))
      return setError("Handle: 3–24 chars, starts with a letter; letters, numbers, underscores only.");
    const patch: { handle?: string; bio?: string; avatar_url?: string | null } = {};
    if (handle !== profile.handle) patch.handle = handle;
    if (bio !== (profile.bio ?? "")) patch.bio = bio;
    if (avatarUrl !== profile.avatar_url) patch.avatar_url = avatarUrl;
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const res = await updateProfile(patch);
      if (res.error) {
        setError(res.error);
      } else {
        toast({ title: "Profile updated", variant: "ok" });
        onSaved?.();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit anonymous profile">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar handle={handle || profile?.handle} src={avatarUrl} size={64} />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} loading={busy}>
              <Camera className="size-3.5" /> Upload avatar
            </Button>
            {avatarUrl && (
              <button
                onClick={() => setAvatarUrl(null)}
                className="text-xs font-semibold text-bad hover:underline text-left"
              >
                Remove avatar
              </button>
            )}
          </div>
        </div>

        <Field
          label="Handle"
          hint={
            handle !== (profile?.handle ?? "")
              ? "Changing your handle keeps your identity, follows and posts intact."
              : undefined
          }
          error={error ?? undefined}
        >
          <div className="flex items-center gap-2">
            <AtSign className="size-4 text-mute shrink-0" />
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} />
          </div>
        </Field>

        <Field label="Bio (optional)">
          <Textarea
            rows={3}
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="e.g. 7 years in BPO QA. Night owl. Professional apologist."
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- Profile page ---------------------------- */

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { profile: me } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [following, setFollowing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [comms, setComms] = useState<Community[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isMe = !!me && !!data && me.id === data.id;

  const load = useCallback(async () => {
    if (!handle) return;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProfileByHandle(handle);
      if (!p) {
        setNotFound(true);
        return;
      }
      setData(p);
      if (me && p.id !== me.id) {
        const [f, b] = await Promise.all([
          isFollowing(me.id, p.id).catch(() => false),
          isBlocking(me.id, p.id).catch(() => false),
        ]);
        setFollowing(f);
        setBlocking(b);
      }
      fetchProfileCommunities(p.id).then(setComms).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [handle, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPosts = useCallback(
    async (reset: boolean) => {
      if (!me || !data) return;
      if (reset) setPostsLoading(true);
      try {
        const offset = reset ? 0 : posts.length;
        const res = await fetchProfilePosts(me.id, data.id, offset);
        setPosts((prev) => (reset ? res.posts : [...prev, ...res.posts]));
        setMore(res.more);
      } catch (e) {
        toast({ title: "Couldn't load posts", desc: (e as Error).message, variant: "bad" });
      } finally {
        setPostsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, data?.id]
  );

  useEffect(() => {
    if (data) loadPosts(true);
  }, [data?.id, loadPosts]);

  async function onFollow() {
    if (!me || !data) return;
    const prev = following;
    setFollowing(!prev);
    try {
      await toggleFollow(me.id, data.id, prev);
      toast({
        title: prev ? `Unfollowed @${data.handle}` : `Following @${data.handle}`,
        variant: "ok",
      });
    } catch (e) {
      setFollowing(prev);
      toast({ title: "Action failed", desc: (e as Error).message, variant: "bad" });
    }
  }

  async function onBlock() {
    if (!me || !data) return;
    setBlockBusy(true);
    try {
      const next = await toggleBlock(me.id, data.id, blocking);
      setBlocking(next);
      toast({
        title: next ? `Blocked @${data.handle}` : `Unblocked @${data.handle}`,
        variant: next ? "ok" : "info",
      });
    } catch (e) {
      toast({ title: "Action failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBlockBusy(false);
      setConfirmBlock(false);
    }
  }

  if (loading)
    return (
      <div className="space-y-4">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );

  if (error) return <ErrorState message={error} onRetry={load} />;

  if (notFound || !data)
    return (
      <div className="rounded-2xl border border-line bg-surface py-16 text-center">
        <p className="font-display font-semibold text-lg">Handle not found</p>
        <p className="text-sm text-mute mt-1">@{handle} doesn't exist (or was deleted).</p>
        <Button variant="soft" size="sm" className="mt-4" onClick={() => navigate("/feed")}>
          Back to feed
        </Button>
      </div>
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-line bg-surface p-5"
      >
        <div className="flex items-start gap-4">
          <Avatar handle={data.handle} src={data.avatar_url} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-xl tracking-tight flex items-center gap-2">
              <span className="truncate">{data.handle}</span>
              {isMe && (
                <span className="text-[11px] font-bold text-brand bg-brand-soft rounded-full px-2 py-0.5">
                  that's you
                </span>
              )}
            </h1>
            {data.bio && <p className="text-sm text-mute mt-1 leading-relaxed">{data.bio}</p>}
            <p className="text-xs text-mute mt-2">
              On OFFMUTE since {timeAgo(data.created_at)} ago
            </p>
          </div>
          {isMe ? (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant={following ? "outline" : "primary"} onClick={onFollow}>
                {following ? "Following" : "Follow"}
              </Button>
              <Menu
                trigger={
                  <Button size="sm" variant="ghost" aria-label="More options">
                    <span className="text-base leading-none">⋯</span>
                  </Button>
                }
                items={[
                  {
                    label: blocking ? "Unblock" : "Block",
                    icon: blocking ? <ShieldOff className="size-4" /> : <ShieldBan className="size-4" />,
                    onClick: () => setConfirmBlock(true),
                    danger: !blocking,
                  },
                  {
                    label: "Report user",
                    icon: <TriangleAlert className="size-4" />,
                    onClick: () => setReportOpen(true),
                    danger: true,
                  },
                ]}
              />
            </div>
          )}
        </div>

        {comms.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-[11px] font-bold uppercase tracking-wider text-mute mb-2">
              Communities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {comms.map((c) => (
                <Link
                  key={c.id}
                  to={`/community/${c.slug}`}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-soft text-brand text-xs font-semibold px-2.5 py-1 hover:brightness-110 transition"
                >
                  <Hash className="size-3" /> {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Posts */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-mute mb-3">
          Posts ({posts.length}{more ? "+" : ""})
        </h2>
        {postsLoading ? (
          <PostSkeleton />
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<UserX className="size-6" />}
              title={isMe ? "You haven't posted yet" : `@${data.handle} hasn't posted yet`}
              desc={
                isMe
                  ? "Your anonymous voice is waiting. The office is listening."
                  : undefined
              }
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
              <div className="flex justify-center pt-3">
                <Button variant="outline" onClick={() => loadPosts(false)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={onBlock}
        loading={blockBusy}
        danger={!blocking}
        title={`${blocking ? "Unblock" : "Block"} @${data.handle}?`}
        message={
          blocking
            ? "They'll be able to see your posts and interact with you again."
            : "Their posts, comments and messages will be hidden from you."
        }
        confirmLabel={blocking ? "Unblock" : "Block"}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={data.id}
        targetLabel={`@${data.handle}`}
      />
    </div>
  );
}
