import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react";
import { useAuth, useToast } from "@/context/AppProviders";
import { createCommunity } from "@/lib/queries";
import { slugify } from "@/lib/utils";
import { Button, Field, Input, Textarea, Toggle } from "@/components/ui";
import { motion } from "framer-motion";

export default function CreateCommunityPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [rules, setRules] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugOk = /^[a-z0-9][a-z0-9-]{1,47}$/.test(slug);

  async function submit() {
    if (!profile) return;
    setError(null);
    if (name.trim().length < 2) return setError("Name needs at least 2 characters.");
    if (!slugOk) return setError("Slug needs 2–48 lowercase letters, numbers or dashes.");
    if (description.trim().length < 10)
      return setError("Describe the community in at least 10 characters.");
    setBusy(true);
    try {
      await createCommunity(profile.id, {
        name,
        slug,
        description,
        is_restricted: restricted,
        rules,
      });
      toast({ title: `#${name.trim()} created`, desc: "You're the owner. Invite your people.", variant: "ok" });
      navigate(`/community/${slug}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink transition-colors"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-5"
      >
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">Create a community</h1>
          <p className="text-sm text-mute mt-1">
            A shared space for a team, a city, a shift or a very specific office trauma.
          </p>
        </div>

        <Field label="Name">
          <Input
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. Hybrid Work Survival"
          />
        </Field>

        <Field
          label="URL slug"
          hint={slugOk ? undefined : "lowercase letters, numbers, dashes (2–48 chars)"}
          error={slugTouched && !slugOk ? "Invalid slug" : undefined}
        >
          <div className="flex items-center">
            <span className="h-10 px-3 grid place-items-center rounded-l-xl bg-raise border border-r-0 border-line text-sm text-mute">
              offmute.app/community/
            </span>
            <Input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="rounded-l-none"
              placeholder="hybrid-work-survival"
              aria-label="Community slug"
            />
          </div>
        </Field>

        <Field label="Description">
          <Textarea
            rows={3}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who is this for, and what should people bring?"
          />
        </Field>

        <div className="rounded-xl border border-line bg-raise/30 p-4">
          <Toggle
            checked={restricted}
            onChange={setRestricted}
            label="Restricted community"
            desc="Only members can see posts, messages and the member list. Enforced in the database."
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mute mb-2">
            House rules (optional, up to 6)
          </p>
          <div className="space-y-2">
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={r}
                  maxLength={160}
                  onChange={(e) => setRules((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Rule ${i + 1}`}
                />
                {rules.length > 1 && (
                  <button
                    onClick={() => setRules((cur) => cur.filter((_, j) => j !== i))}
                    className="p-2 text-mute hover:text-bad"
                    aria-label="Remove rule"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {rules.length < 6 && (
            <button
              onClick={() => setRules((cur) => [...cur, ""])}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
            >
              <Plus className="size-3.5" /> Add rule
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-bad bg-bad/10 border border-bad/20 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-mute max-w-45 leading-relaxed">
            {restricted && (
              <span className="inline-flex items-center gap-1 text-warn font-semibold">
                <Lock className="size-3" /> Private by default
              </span>
            )}
            You'll be the owner and can manage rules and reports.
          </p>
          <Button onClick={submit} loading={busy}>
            Create community
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
