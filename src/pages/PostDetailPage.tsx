import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CornerDownRight, MessageSquareText, Send } from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import type { CommentItem, PostItem } from "@/lib/types";
import {
  addComment,
  deleteComment,
  fetchComments,
  fetchPostById,
} from "@/lib/queries";
import { demoCommentsFor, demoPostById } from "@/lib/demoContent";
import { timeAgo } from "@/lib/utils";
import PostCard, { ReportModal } from "@/components/PostCard";
import { Avatar, Button, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/utils/cn";

function CommentRow({
  comment,
  uid,
  isReply = false,
  onReply,
  onDelete,
  replyingTo,
  setReplyingTo,
}: {
  comment: CommentItem;
  uid: string;
  isReply?: boolean;
  onReply?: (parentId: string) => void;
  onDelete: (id: string) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
}) {
  const isOwn = uid === comment.user_id;
  return (
    <div className={cn("flex gap-3", isReply && "ml-10")}>
      <Link to={`/profile/${comment.profile?.handle ?? "x"}`} className="mt-0.5">
        <Avatar handle={comment.profile?.handle} src={comment.profile?.avatar_url} size={isReply ? 30 : 36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-2xl bg-raise/50 px-3.5 py-2.5",
            !isReply && "mt-0.5"
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/profile/${comment.profile?.handle ?? "x"}`}
              className="text-[13px] font-semibold hover:text-brand"
            >
              {comment.profile?.handle ?? "Anonymous"}
            </Link>
            <span className="text-[11px] text-mute">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-wrap break-words">{comment.body}</p>
        </div>
        <div className="flex items-center gap-3 mt-1.5 ml-1">
          {!isReply && onReply && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className={cn(
                "text-[11px] font-bold transition-colors",
                replyingTo === comment.id ? "text-brand" : "text-mute hover:text-ink"
              )}
            >
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-[11px] font-bold text-mute hover:text-bad transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [post, setPost] = useState<PostItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isDemoId = !!id && id.startsWith("demo-");

  const load = useCallback(async () => {
    if (!id) return;
    if (isDemoId) {
      const dp = demoPostById(id);
      if (!dp) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setPost(dp);
      setComments(demoCommentsFor(id));
      setLoading(false);
      return;
    }
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([fetchPostById(profile.id, id), fetchComments(id)]);
      if (!p) {
        setNotFound(true);
        return;
      }
      setPost(p);
      setComments(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, id, isDemoId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitComment() {
    if (!profile || !id || !body.trim()) return;
    setBusy(true);
    try {
      const row = await addComment(profile.id, id, body, replyingTo);
      const base: CommentItem = {
        ...(row as Omit<CommentItem, "replies">),
        replies: [],
      };
      if (replyingTo) {
        setComments((prev) =>
          prev.map((c) => (c.id === replyingTo ? { ...c, replies: [...c.replies, base] } : c))
        );
      } else {
        setComments((prev) => [...prev, base]);
      }
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setBody("");
      setReplyingTo(null);
    } catch (e) {
      toast({ title: "Comment failed", desc: (e as Error).message, variant: "bad" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(commentId: string) {
    if (!profile) return;
    try {
      await deleteComment(profile.id, commentId);
      setComments((prev) =>
        prev
          .map((c) =>
            c.id === commentId
              ? { ...c, replies: c.replies.filter((r) => r.id !== commentId) }
              : { ...c, replies: c.replies.filter((r) => r.id !== commentId) }
          )
          .filter((c) => c.id !== commentId)
      );
      setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
      toast({ title: "Comment deleted", variant: "ok" });
    } catch (e) {
      toast({ title: "Delete failed", desc: (e as Error).message, variant: "bad" });
    }
  }

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );

  if (error)
    return <ErrorState message={error} onRetry={load} />;

  if (notFound || !post)
    return (
      <div className="rounded-2xl border border-line bg-surface py-16 text-center">
        <p className="font-display font-semibold text-lg">Post not found</p>
        <p className="text-sm text-mute mt-1">
          It may have been deleted, or it's in a community you don't belong to.
        </p>
        <Button variant="soft" size="sm" className="mt-4" onClick={() => navigate("/feed")}>
          Back to feed
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <div className="[&>article]:p-5">
        <PostCard
          post={post}
          onDeleted={() => navigate("/feed")}
          showCategory
        />
      </div>

      {/* Comments */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display font-semibold text-sm flex items-center gap-2">
          <MessageSquareText className="size-4 text-brand" />
          {comments.reduce((a, c) => a + 1 + c.replies.length, 0)} comments
        </h2>

        {isDemoId ? (
          <div className="mt-4 rounded-xl border border-line bg-raise/40 px-4 py-3 text-xs text-mute leading-relaxed">
            This is sample content, shown so new feeds never feel empty. Comments and replies are
            disabled on sample posts — every real post gets full threads.
          </div>
        ) : (
        profile && (
          <div className="mt-4 space-y-3">
            {replyingTo && (
              <div className="flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
                <span className="flex items-center gap-1.5">
                  <CornerDownRight className="size-3.5" /> Replying to a thread…
                </span>
                <button onClick={() => setReplyingTo(null)} className="hover:underline">
                  Cancel
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <Avatar handle={profile.handle} src={profile.avatar_url} size={36} />
              <div className="flex-1">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Add a comment — anonymously, of course."
                  className="w-full rounded-xl bg-raise/60 border border-line px-3.5 py-2.5 text-sm placeholder:text-mute/70 focus:border-brand focus:outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    onClick={submitComment}
                    loading={busy}
                    disabled={!body.trim()}
                  >
                    <Send className="size-3.5" /> Comment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-5 space-y-5">
          {comments.length === 0 && !loading && (
            <p className="text-sm text-mute text-center py-6">
              No comments yet. Start the thread — keep it kind.
            </p>
          )}
          {comments.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CommentRow
                comment={c}
                uid={profile?.id ?? ""}
                onReply={isDemoId ? undefined : (pid) => setReplyingTo(pid)}
                onDelete={deleteOne}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
              />
              {c.replies.map((r) => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  uid={profile?.id ?? ""}
                  isReply
                  onDelete={deleteOne}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                />
              ))}
            </motion.div>
          ))}
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetLabel="this post"
      />
    </div>
  );
}
