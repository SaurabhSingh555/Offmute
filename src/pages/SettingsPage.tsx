import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Flag,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Palette,
  ShieldBan,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth, useTheme, useToast } from "@/context/AppProviders";
import { supabase } from "@/lib/supabase";
import type { ReportItem, UserPrefs } from "@/lib/types";
import { fetchMyBlocks, fetchMyReports, toggleBlock } from "@/lib/queries";
import { timeAgo } from "@/lib/utils";
import { ProfileEditModal } from "@/pages/ProfilePage";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Input,
  Toggle,
} from "@/components/ui";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display font-semibold text-sm flex items-center gap-2 mb-4">
        <span className="text-brand">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { profile, user, signOut, resetPassword, savePrefs, deleteAccount, getPrefs } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [blocks, setBlocks] = useState<{ blocked: { id: string; handle: string; avatar_url: string | null }[]; blockedMe: { id: string; handle: string }[] } | null>(null);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const uid = profile?.id;

  useEffect(() => {
    if (!uid) return;
    fetchMyBlocks(uid).then(setBlocks).catch(() => {});
    fetchMyReports(uid).then(setReports).catch(() => {});
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    getPrefs().then((p) => p && setPrefs(p));
  }, [uid, getPrefs]);

  async function setPref(key: keyof UserPrefs, value: boolean) {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const res = await savePrefs(next);
    if (res.error) {
      setPrefs(prefs);
      toast({ title: "Preference not saved", desc: res.error, variant: "bad" });
    }
  }

  async function unblock(targetId: string, handle: string) {
    if (!uid) return;
    try {
      await toggleBlock(uid, targetId, true);
      setBlocks((prev) =>
        prev ? { ...prev, blocked: prev.blocked.filter((b) => b.id !== targetId) } : prev
      );
      toast({ title: `Unblocked @${handle}`, variant: "ok" });
    } catch (e) {
      toast({ title: "Action failed", desc: (e as Error).message, variant: "bad" });
    }
  }

  async function changePw() {
    if (!user) return;
    if (newPw.length < 6) {
      toast({ title: "Password too short", desc: "Minimum 6 characters.", variant: "bad" });
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) toast({ title: "Couldn't change password", desc: error.message, variant: "bad" });
      else {
        setNewPw("");
        toast({ title: "Password updated", variant: "ok" });
      }
    } finally {
      setPwBusy(false);
    }
  }

  async function sendReset() {
    if (!user?.email) return;
    setResetBusy(true);
    try {
      const res = await resetPassword(user.email);
      if (res.error) toast({ title: "Reset failed", desc: res.error, variant: "bad" });
      else toast({ title: "Reset link sent", desc: `Sent to ${user.email}`, variant: "ok" });
    } finally {
      setResetBusy(false);
    }
  }

  async function onDelete() {
    setDeleteBusy(true);
    try {
      const res = await deleteAccount();
      if (res.error) {
        toast({ title: "Deletion failed", desc: res.error, variant: "bad" });
        setDeleteBusy(false);
      } else {
        navigate("/", { replace: true });
      }
    } catch (e) {
      toast({ title: "Deletion failed", desc: (e as Error).message, variant: "bad" });
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Settings</h1>
        <p className="text-sm text-mute mt-0.5">Your identity, your rules, your peace.</p>
      </div>

      <Section icon={<UserRound className="size-4" />} title="Profile">
        <div className="flex items-center gap-3">
          <Avatar handle={profile?.handle} src={profile?.avatar_url} size={44} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{profile?.handle}</p>
            <p className="text-xs text-mute truncate">{profile?.bio || "No bio yet"}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        </div>
      </Section>

      <Section icon={<Palette className="size-4" />} title="Appearance">
        <Toggle
          checked={theme === "dark"}
          onChange={toggle}
          label="Dark theme"
          desc="Charcoal and deep navy by default, with a light mode for the day shift."
        />
      </Section>

      <Section icon={<Bell className="size-4" />} title="Notification preferences">
        <div className="space-y-3">
          {prefs && (
            <>
              <Toggle checked={prefs.likes_notifs} onChange={(v) => setPref("likes_notifs", v)} label="Likes" desc="When someone likes your post" />
              <Toggle checked={prefs.comment_notifs} onChange={(v) => setPref("comment_notifs", v)} label="Comments" desc="When someone comments or replies" />
              <Toggle checked={prefs.follow_notifs} onChange={(v) => setPref("follow_notifs", v)} label="Follows" desc="When someone starts following you" />
              <Toggle checked={prefs.post_notifs} onChange={(v) => setPref("post_notifs", v)} label="Posts from people you follow" desc="Their new posts, in your notifications" />
            </>
          )}
          {!prefs && <p className="text-sm text-mute">Loading…</p>}
        </div>
      </Section>

      <Section icon={<ShieldBan className="size-4" />} title="Privacy & blocked users">
        <p className="text-xs text-mute leading-relaxed mb-3">
          Blocking hides their posts, comments and messages from you. You can't be blocked without
          your knowledge of the effect: their content simply disappears from your views.
        </p>
        {blocks === null ? (
          <p className="text-sm text-mute">Loading…</p>
        ) : blocks.blocked.length === 0 ? (
          <p className="text-sm text-mute">You haven't blocked anyone.</p>
        ) : (
          <div className="space-y-2">
            {blocks.blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <Avatar handle={b.handle} src={b.avatar_url} size={32} />
                <span className="text-sm font-semibold flex-1">{b.handle}</span>
                <Button size="sm" variant="outline" onClick={() => unblock(b.id, b.handle)}>
                  Unblock
                </Button>
              </div>
            ))}
            {blocks.blockedMe.length > 0 && (
              <p className="text-xs text-mute pt-1">
                {blocks.blockedMe.length} user
                {blocks.blockedMe.length === 1 ? " has" : "s have"} blocked you. Their content is
                hidden from them, and they can't interact with you.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section icon={<Flag className="size-4" />} title="Your reports">
        {reports === null ? (
          <p className="text-sm text-mute">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-mute">You haven't filed any reports. Keep it that way.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-line px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "pending" ? "warn" : r.status === "resolved" ? "ok" : "neutral"}>
                    {r.status}
                  </Badge>
                  <Badge>{r.target_type}</Badge>
                  <span className="text-xs text-mute ml-auto">{timeAgo(r.created_at)} ago</span>
                </div>
                <p className="text-sm mt-1.5">{r.reason}</p>
              </div>
            ))}
            <p className="text-xs text-mute pt-1">
              Community owners can see reports filed against their community. Reports about people
              are only visible to the reporter and platform moderators.
            </p>
          </div>
        )}
      </Section>

      <Section icon={<KeyRound className="size-4" />} title="Account">
        <div className="space-y-4">
          <Field label="Change password">
            <div className="flex gap-2">
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password (min 6)"
                aria-label="New password"
              />
              <Button onClick={changePw} loading={pwBusy} disabled={!newPw}>
                Update
              </Button>
            </div>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={sendReset} loading={resetBusy}>
              <Mail className="size-3.5" /> Email me a reset link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
          <div className="rounded-xl border border-bad/30 bg-bad/5 p-4">
            <p className="text-sm font-semibold text-bad flex items-center gap-2">
              <Trash2 className="size-4" /> Danger zone
            </p>
            <p className="text-xs text-mute mt-1.5 leading-relaxed">
              Deleting your account removes your handle, posts, comments, polls, follows,
              memberships and uploaded images. This is permanent and cannot be undone.
            </p>
            <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </Button>
          </div>
          <p className="text-[11px] text-mute leading-relaxed">
            Anonymity note: OFFMUTE protects your identity from other users. It does not guarantee
            immunity from account compromise, privileged platform access, or lawful legal process.
          </p>
        </div>
      </Section>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleteBusy}
        danger
        title="Delete your OFFMUTE account?"
        message={`This permanently erases @${profile?.handle} and everything you've posted, plus your storage files and auth credentials. There is no undo and no recovery.`}
        confirmLabel="Delete forever"
      />
    </div>
  );
}
