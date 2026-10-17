import { useEffect, useRef, useState } from "react";
import { ImagePlus, ListPlus, Plus, Trash2 } from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import { createPost, fetchCategories, fetchJoinedCommunities } from "@/lib/queries";
import type { Category, Community } from "@/lib/types";
import { isValidImageFile } from "@/lib/utils";
import { Avatar, Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn } from "@/utils/cn";

/** Any page can open the global composer: requestCompose(communityId?) */
export function requestCompose(communityId?: string | null) {
  window.dispatchEvent(new CustomEvent("om:compose", { detail: { communityId: communityId ?? null } }));
}

export default function PostComposer({
  open,
  onClose,
  initialCommunityId = null,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  initialCommunityId?: string | null;
  onPosted?: (postId: string) => void;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"post" | "poll">("post");
  const [body, setBody] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [communityId, setCommunityId] = useState<string | null>(initialCommunityId);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [cats, setCats] = useState<Category[]>([]);
  const [comms, setComms] = useState<Community[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setMode("post");
    setBody("");
    setCategorySlug("");
    setCommunityId(initialCommunityId);
    setImage(null);
    setImagePreview(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    fetchCategories().then(setCats).catch(() => {});
    fetchJoinedCommunities(profile.id, 24).then(setComms).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCommunityId, profile?.id]);

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function pickImage(file: File | undefined) {
    if (!file) return;
    const check = isValidImageFile(file);
    if (!check.ok) {
      toast({ title: "Image rejected", desc: check.error, variant: "bad" });
      return;
    }
    setImage(file);
  }

  const pollOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
  const canSubmit =
    !busy &&
    (mode === "post" ? body.trim().length > 0 : body.trim().length > 0 || pollOpts.length >= 2);

  async function submit() {
    if (busy) return;
    if (!profile) {
      toast({
        title: "Your profile isn't ready yet",
        desc: "The anonymous profile didn't load, so the post can't be attached to you. Hit Retry on the banner above, or reload the page.",
        variant: "bad",
      });
      return;
    }
    if (!canSubmit) return;
    setBusy(true);
    try {
      const finalBody =
        mode === "poll" && !body.trim()
          ? (pollQuestion.trim() || pollOpts.slice(0, 2).join(" vs "))
          : body;
      const id = await createPost({
        uid: profile.id,
        body: finalBody,
        categorySlug: categorySlug || null,
        communityId,
        imageFile: mode === "post" ? image : null,
        poll: mode === "poll" ? { question: pollQuestion, options: pollOptions } : null,
      });
      toast({ title: "Posted anonymously", desc: "Your real identity stays private.", variant: "ok" });
      onClose();
      onPosted?.(id);
      window.dispatchEvent(new Event("om:posted"));
    } catch (e) {
      console.error("[OFFMUTE] post failed:", e);
      toast({
        title: "Couldn't post",
        desc: (e as Error).message || "Unexpected error. Check your connection and try again.",
        variant: "bad",
      });
    } finally {
      setBusy(false);
    }
  }

  const fixedCommunity = comms.find((c) => c.id === initialCommunityId);

  return (
    <Modal open={open} onClose={onClose} title="New post" wide>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar handle={profile?.handle} src={profile?.avatar_url} size={38} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{profile?.handle}</p>
            <p className="text-xs text-mute">Posting to OFFMUTE anonymously</p>
          </div>
          {fixedCommunity && <Badge tone="brand">#{fixedCommunity.name}</Badge>}
        </div>

        <div className="flex rounded-xl bg-raise/70 p-1 text-sm font-semibold">
          {(["post", "poll"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 h-9 rounded-lg transition-colors",
                mode === m ? "bg-surface shadow text-ink" : "text-mute hover:text-ink"
              )}
            >
              {m === "post" ? "Post" : "Poll"}
            </button>
          ))}
        </div>

        <Textarea
          rows={mode === "poll" ? 2 : 5}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            mode === "post"
              ? "What's actually happening at work? (No names, no private data)"
              : "Add context for your poll (optional)…"
          }
          className="text-[15px]"
          autoFocus
        />
        <div className="flex justify-end -mt-2">
          <span className="text-xs text-mute tabular-nums">{body.length}/2000</span>
        </div>

        {mode === "poll" && (
          <div className="space-y-3 rounded-xl border border-line bg-raise/30 p-3">
            <Field label="Poll question">
              <Input
                value={pollQuestion}
                maxLength={200}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="e.g. What's the worst meeting you're in this week?"
              />
            </Field>
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    maxLength={100}
                    onChange={(e) =>
                      setPollOptions((cur) => cur.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    placeholder={`Option ${i + 1}`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => setPollOptions((cur) => cur.filter((_, j) => j !== i))}
                      className="p-2 text-mute hover:text-bad transition-colors"
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button
                  onClick={() => setPollOptions((cur) => [...cur, ""])}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                >
                  <ListPlus className="size-3.5" /> Add option
                </button>
              )}
            </div>
            {pollOpts.length < 2 && (
              <p className="text-xs text-mute">Polls need at least 2 filled options.</p>
            )}
          </div>
        )}

        {mode === "post" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                pickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Attachment preview"
                  className="max-h-56 rounded-xl border border-line"
                />
                <button
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 size-7 rounded-full bg-surface border border-line grid place-items-center text-mute hover:text-bad shadow"
                  aria-label="Remove image"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
              >
                <ImagePlus className="size-4.5" /> Add image (JPG/PNG/WEBP/GIF, ≤5MB)
              </button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
              <option value="">General</option>
              {cats.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {!fixedCommunity && (
            <Field label="Community (optional)">
              <Select
                value={communityId ?? ""}
                onChange={(e) => setCommunityId(e.target.value || null)}
              >
                <option value="">OFFMUTE (everyone)</option>
                {comms.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-mute max-w-[60%] leading-relaxed">
            Don't name real people, companies, or leak confidential info.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit} loading={busy}>
              <Plus className="size-4" /> Post
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
