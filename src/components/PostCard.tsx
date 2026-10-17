import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Bookmark,
  Check,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  ShieldBan,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import type { PostItem } from "@/lib/types";
import { REPORT_REASONS, type ReportTarget } from "@/lib/types";
import { fullDate, pollPercents, timeAgo } from "@/lib/utils";
import {
  createReport,
  deletePost,
  isBlocking,
  toggleBlock,
  toggleBookmark,
  toggleLike,
  castPollVote,
  updatePostBody,
} from "@/lib/queries";
import {
  castDemoPollVote,
  toggleDemoLike,
  toggleDemoSaved,
} from "@/lib/demoContent";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Menu,
  Modal,
  Spinner,
  Textarea,
} from "@/components/ui";
import { cn } from "@/utils/cn";

/* ------------------------------- ReportModal ------------------------------ */

export function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  targetLabel: string;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!profile) return;
    setBusy(true);
    try {
      await createReport(profile.id, targetType, targetId, reason, details);
      toast({ title: "Report submitted", desc: "Thank you. Our moderation workflow picks it up here.", variant: "ok" });
      setDetails("");
      onClose();
    } catch (e) {
      toast({ title: "Could not submit report", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Report ${targetType}`}>
      <p className="text-sm text-mute leading-relaxed">
        Reporting <b className="text-ink">{targetLabel}</b>. Reports are private and anonymous to
        the reported user.
      </p>
      <div className="mt-4 space-y-4">
        <Field label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-raise/60 border border-line text-sm focus:border-brand focus:outline-none"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Details (optional)">
          <Textarea
            rows={3}
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything that helps us review this…"
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} loading={busy}>
          Submit report
        </Button>
      </div>
    </Modal>
  );
}

/* --------------------------------- Poll ----------------------------------- */

function PollView({ post, uid, demo = false }: { post: PostItem; uid: string; demo?: boolean }) {
  const poll = post.poll!;
  const [opts, setOpts] = useState(poll.options);
  const [myVote, setMyVote] = useState<string | null>(post.myPollVote);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const total = opts.reduce((a, b) => a + b.votes, 0);
  const percents = useMemo(() => pollPercents(opts.map((o) => o.votes)), [opts]);

  async function vote(optionId: string) {
    if (busy) return;
    if (demo) {
      const prevMine = myVote;
      castDemoPollVote(poll.id, optionId);
      setMyVote(optionId);
      setOpts((cur) =>
        cur.map((o) => {
          let v = o.votes;
          if (o.id === optionId) v += 1;
          if (prevMine && o.id === prevMine && prevMine !== optionId) v -= 1;
          return { ...o, votes: v };
        })
      );
      return;
    }
    setBusy(true);
    try {
      const prevMine = myVote;
      await castPollVote(uid, poll.id, optionId);
      setMyVote(optionId);
      setOpts((cur) =>
        cur.map((o) => {
          let v = o.votes;
          if (o.id === optionId) v += 1;
          if (prevMine && o.id === prevMine && prevMine !== optionId) v -= 1;
          return { ...o, votes: v };
        })
      );
    } catch (e) {
      toast({ title: "Vote failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-raise/40 p-3 space-y-1.5">
      {poll.question && <p className="text-sm font-semibold mb-2">{poll.question}</p>}
      {opts.map((o, i) => {
        const mine = myVote === o.id;
        return (
          <button
            key={o.id}
            onClick={() => vote(o.id)}
            disabled={busy}
            className={cn(
              "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              mine ? "border-brand" : "border-line hover:border-brand/50"
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 transition-all duration-500",
                mine ? "bg-brand/25" : "bg-brand/10"
              )}
              style={{ width: `${percents[i]}%` }}
            />
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                {mine && <Check className="size-3.5 text-brand" />}
                {o.label}
              </span>
              <span className="text-xs font-semibold text-mute tabular-nums">{percents[i]}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-[11px] text-mute pt-1">
        {total} vote{total === 1 ? "" : "s"} {myVote ? "· your vote is highlighted" : "· tap to vote"}
      </p>
    </div>
  );
}

/* -------------------------------- PostCard -------------------------------- */

export default function PostCard({
  post,
  onDeleted,
  onBodyUpdated,
  showCategory = true,
}: {
  post: PostItem;
  onDeleted?: (id: string) => void;
  onBodyUpdated?: (id: string, body: string) => void;
  showCategory?: boolean;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const uid = profile?.id ?? "";
  const isOwn = profile?.id === post.user_id;
  const demo = !!post.isDemo;

  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.bookmarked);
  const [likeBusy, setLikeBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [editBusy, setEditBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handle = post.profile?.handle ?? "Anonymous";
  const longBody = post.body.length > 320;
  const displayLikes = demo ? post.likeCount + (liked ? 1 : 0) : likeCount;

  async function onLike() {
    if (likeBusy) return;
    if (demo) {
      setLiked(toggleDemoLike(post.id));
      return;
    }
    if (!uid) return;
    const prevL = liked;
    const prevC = likeCount;
    setLiked(!prevL);
    setLikeCount(prevC + (prevL ? -1 : 1));
    setLikeBusy(true);
    try {
      await toggleLike(uid, post.id, prevL);
    } catch (e) {
      setLiked(prevL);
      setLikeCount(prevC);
      toast({ title: "Couldn't update like", desc: (e as Error).message, variant: "bad" });
    } finally {
      setLikeBusy(false);
    }
  }

  async function onBookmark() {
    if (demo) {
      setSaved(toggleDemoSaved(post.id));
      toast({
        title: saved ? "Removed from saved" : "Sample post saved",
        variant: "info",
      });
      return;
    }
    if (!uid) return;
    const prev = saved;
    setSaved(!prev);
    try {
      await toggleBookmark(uid, post.id, prev);
      toast({ title: prev ? "Removed from saved" : "Saved for later", variant: "info" });
    } catch (e) {
      setSaved(prev);
      toast({ title: "Couldn't update bookmark", desc: (e as Error).message, variant: "bad" });
    }
  }

  async function onShare() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast({ title: "Link copied", desc: "Anyone signed in can open it.", variant: "ok" });
    } catch {
      toast({ title: "Copy failed", variant: "bad" });
    }
  }

  async function onBlockAuthor() {
    if (!uid || !post.profile) return;
    setBlockBusy(true);
    try {
      const current = await isBlocking(uid, post.user_id);
      const next = await toggleBlock(uid, post.user_id, current);
      toast({
        title: next ? `Blocked @${handle}` : `Unblocked @${handle}`,
        desc: next ? "Their posts, comments and messages are hidden from you." : undefined,
        variant: next ? "ok" : "info",
      });
    } catch (e) {
      toast({ title: "Action failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBlockBusy(false);
      setConfirmBlock(false);
    }
  }

  async function onDelete() {
    if (!uid) return;
    setDeleteBusy(true);
    try {
      await deletePost(uid, post.id);
      toast({ title: "Post deleted", variant: "ok" });
      onDeleted?.(post.id);
    } catch (e) {
      toast({ title: "Delete failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  }

  async function saveEdit() {
    if (!uid || !draft.trim()) return;
    setEditBusy(true);
    try {
      await updatePostBody(uid, post.id, draft);
      onBodyUpdated?.(post.id, draft.trim());
      setEditing(false);
      toast({ title: "Post updated", variant: "ok" });
    } catch (e) {
      toast({ title: "Edit failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setEditBusy(false);
    }
  }

  const menuItems = [
    ...(demo
      ? []
      : isOwn
      ? [
          { label: "Edit post", icon: <PenLine className="size-4" />, onClick: () => setEditing(true) },
          { label: "Delete post", icon: <Trash2 className="size-4" />, onClick: () => setConfirmDelete(true), danger: true },
        ]
      : [
          { label: "Report post", icon: <TriangleAlert className="size-4" />, onClick: () => setReportOpen(true) },
          {
            label: `Block @${handle}`,
            icon: <ShieldBan className="size-4" />,
            onClick: () => setConfirmBlock(true),
            danger: true,
          },
        ]),
    { label: "Copy link", icon: <Link2 className="size-4" />, onClick: onShare },
  ];

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand/30">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to={`/profile/${handle}`} aria-label={`View ${handle}`}>
          <Avatar handle={handle} src={post.profile?.avatar_url} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/profile/${handle}`}
              className="font-semibold text-sm hover:text-brand transition-colors truncate"
            >
              {handle}
            </Link>
            {isOwn && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand">
                <BadgeCheck className="size-3.5" /> you
              </span>
            )}
            <span className="text-xs text-mute" title={fullDate(post.created_at)}>
              · {timeAgo(post.created_at)}
            </span>
            {demo && <Badge tone="neutral">sample</Badge>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {post.community && (
              <Link to={`/community/${post.community.slug}`}>
                <Badge tone="brand" className="hover:brightness-110 cursor-pointer">
                  #{post.community.name}
                  {post.community.is_restricted && <span aria-hidden>🔒</span>}
                </Badge>
              </Link>
            )}
            {showCategory && post.category && (
              <Badge>{post.category.name}</Badge>
            )}
          </div>
        </div>
        <Menu
          trigger={
            <button
              className="p-1.5 rounded-lg text-mute hover:text-ink hover:bg-raise transition-colors"
              aria-label="Post options"
            >
              <MoreHorizontal className="size-4.5" />
            </button>
          }
          items={menuItems}
        />
      </div>

      {/* Body */}
      {editing ? (
        <div className="mt-3 space-y-3">
          <Textarea
            rows={4}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-mute tabular-nums">{draft.length}/2000</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(post.body); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} loading={editBusy} disabled={!draft.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p
            className={cn(
              "text-[15px] leading-relaxed whitespace-pre-wrap break-words",
              longBody && !expanded && "line-clamp-4"
            )}
          >
            {post.body}
          </p>
          {longBody && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs font-semibold text-brand mt-1 hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {/* Image */}
      {post.image_url && (
        <a href={post.image_url} target="_blank" rel="noreferrer" className="block mt-3">
          <img
            src={post.image_url}
            alt="Post attachment"
            loading="lazy"
            className="w-full max-h-[420px] object-cover rounded-xl border border-line"
          />
        </a>
      )}

      {/* Poll */}
      {post.poll && (
        <div className="mt-3">
          <PollView post={post} uid={uid} demo={demo} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 -ml-1">
        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={onLike}
          className={cn(
            "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors",
            liked ? "text-coral bg-coral-soft" : "text-mute hover:text-coral hover:bg-coral-soft/60"
          )}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart className={cn("size-4.5 transition-transform", liked && "fill-current")} />
          <span className="tabular-nums">{displayLikes || ""}</span>
        </motion.button>

        <Link
          to={`/post/${post.id}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-mute hover:text-brand hover:bg-brand-soft/60 transition-colors"
          aria-label="Open comments"
        >
          <MessageCircle className="size-4.5" />
          <span className="tabular-nums">{post.commentCount || ""}</span>
        </Link>

        <motion.button
          whileTap={{ scale: 0.82 }}
          onClick={onBookmark}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors",
            saved ? "text-brand bg-brand-soft" : "text-mute hover:text-brand hover:bg-brand-soft/60"
          )}
          aria-pressed={saved}
          aria-label={saved ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark className={cn("size-4.5", saved && "fill-current")} />
        </motion.button>

        <span className="flex-1" />
        {likeBusy && <Spinner className="text-mute mr-2" />}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteBusy}
        danger
        title="Delete this post?"
        message="This permanently removes the post, its comments, likes and poll. There is no undo."
        confirmLabel="Delete post"
      />
      <ConfirmDialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        onConfirm={onBlockAuthor}
        loading={blockBusy}
        danger
        title={`Block @${handle}?`}
        message="Their posts, comments and community messages will be hidden from you, and they can't interact with you."
        confirmLabel="Block"
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetLabel="this post"
      />
    </article>
  );
}

/* Skeleton row for lists is in ui.tsx (PostSkeleton) */
export function CardMotion({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3) }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence };
