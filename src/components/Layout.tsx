import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Bookmark,
  Compass,
  Hash,
  Home,
  LogOut,
  Moon,
  PenSquare,
  Settings,
  Sun,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useAuth, useTheme } from "@/context/AppProviders";
import { supabase } from "@/lib/supabase";
import { fetchJoinedCommunities, fetchUnreadCount } from "@/lib/queries";
import type { Community } from "@/lib/types";
import { Avatar, Button, Logo, Menu } from "@/components/ui";
import PostComposer, { requestCompose } from "@/components/PostComposer";
import { cn } from "@/utils/cn";

/* ------------------------------ Unread context --------------------------- */

const UnreadContext = createContext<{ unread: number; setUnread: (n: number) => void }>({
  unread: 0,
  setUnread: () => {},
});
export const useUnread = () => useContext(UnreadContext);

/* --------------------------------- Nav item ------------------------------ */

function NavItem({
  to,
  icon,
  label,
  badge,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 px-3 py-2.5 text-sm font-bold font-mono uppercase tracking-wider transition-colors border border-transparent",
          isActive ? "bg-brand text-black border-brand" : "text-mute hover:text-ink hover:bg-raise hover:border-line"
        )
      }
    >
      <span className="relative">
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 bg-coral text-white text-[9px] font-bold grid place-items-center border border-black">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {label}
    </NavLink>
  );
}

/* --------------------------------- Layout -------------------------------- */

export default function Layout() {
  const { profile, user, loading, signOut, refreshProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [sideComms, setSideComms] = useState<Community[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerCommunity, setComposerCommunity] = useState<string | null>(null);

  const uid = profile?.id;

  /* Composer global event */
  useEffect(() => {
    const onCompose = (e: Event) => {
      const detail = (e as CustomEvent).detail as { communityId?: string | null } | undefined;
      setComposerCommunity(detail?.communityId ?? null);
      setComposerOpen(true);
    };
    window.addEventListener("om:compose", onCompose);
    return () => window.removeEventListener("om:compose", onCompose);
  }, []);

  /* Sidebar communities (refreshed on membership changes) */
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    fetchJoinedCommunities(uid, 5).then((c) => alive && setSideComms(c)).catch(() => {});
    const refresh = () => fetchJoinedCommunities(uid, 5).then((c) => alive && setSideComms(c)).catch(() => {});
    window.addEventListener("om:refresh-side", refresh);
    return () => {
      alive = false;
      window.removeEventListener("om:refresh-side", refresh);
    };
  }, [uid]);

  /* Realtime unread badge (bounded per-user channel) */
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const refresh = () =>
      fetchUnreadCount(uid).then((n) => alive && setUnread(n)).catch(() => {});
    refresh();
    const channel = supabase
      .channel(`notif-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [uid]);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <UnreadContext.Provider value={{ unread, setUnread }}>
      <div className="min-h-dvh bg-bg text-ink font-sans">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-surface px-4 py-5 z-30">
          <NavLink to="/feed" aria-label="OFFMUTE home">
            <Logo />
          </NavLink>
          <Button fullWidth className="mt-6" onClick={() => requestCompose()}>
            <PenSquare className="size-4" /> New post
          </Button>
          <nav className="mt-6 flex-1 overflow-y-auto space-y-1" aria-label="Primary">
            <NavItem to="/feed" icon={<Home className="size-4.5" />} label="Feed" />
            <NavItem to="/explore" icon={<Compass className="size-4.5" />} label="Explore" />
            <NavItem
              to="/notifications"
              icon={<Bell className="size-4.5" />}
              label="Notifications"
              badge={unread}
            />
            <NavItem to="/saved" icon={<Bookmark className="size-4.5" />} label="Saved" />
            {profile && (
              <NavItem
                to={`/profile/${profile.handle}`}
                icon={<UserRound className="size-4.5" />}
                label="Profile"
              />
            )}
            {sideComms.length > 0 && (
              <div className="pt-5 mt-5 border-t border-line">
                <p className="px-3 text-[10px] font-bold font-mono uppercase tracking-widest text-mute mb-2">
                  Your communities
                </p>
                {sideComms.map((c) => (
                  <NavLink
                    key={c.id}
                    to={`/community/${c.slug}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold font-mono uppercase tracking-wider transition-colors truncate border border-transparent",
                        isActive ? "bg-coral-soft text-coral border-coral/30" : "text-mute hover:text-ink hover:bg-raise hover:border-line"
                      )
                    }
                  >
                    <Hash className="size-3.5 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </NavLink>
                ))}
                <NavLink
                  to="/explore"
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold font-mono text-brand hover:underline uppercase tracking-wider mt-1"
                >
                  Explore all →
                </NavLink>
              </div>
            )}
          </nav>

          <div className="pt-3 mt-3 border-t border-line space-y-1">
            <button
              onClick={toggle}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-bold font-mono uppercase tracking-wider text-mute hover:text-ink hover:bg-raise transition-colors border border-transparent hover:border-line"
            >
              {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            {profile && (
              <div className="flex items-center gap-2.5 px-2 py-2 mt-2 border border-line bg-bg">
                <Avatar handle={profile.handle} src={profile.avatar_url} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold font-mono truncate">{profile.handle}</p>
                  <p className="text-[10px] text-mute font-mono uppercase tracking-tighter truncate">Anonymous identity</p>
                </div>
                <Menu
                  trigger={
                    <button
                      className="p-1.5 text-mute hover:text-ink hover:bg-raise border border-transparent hover:border-line"
                      aria-label="Account menu"
                    >
                      <Settings className="size-4" />
                    </button>
                  }
                  items={[
                    {
                      label: "Settings",
                      icon: <Settings className="size-4" />,
                      onClick: () => navigate("/settings"),
                    },
                    {
                      label: "Sign out",
                      icon: <LogOut className="size-4" />,
                      onClick: handleSignOut,
                      danger: true,
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-surface border-b border-line">
          <NavLink to="/feed" aria-label="OFFMUTE home">
            <Logo />
          </NavLink>
          <NavLink
            to="/notifications"
            className="relative p-2 text-mute hover:text-ink transition-colors border border-transparent hover:border-line"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-coral text-white text-[9px] font-bold grid place-items-center border border-black">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </NavLink>
        </header>

        {/* Content */}
        <div className="lg:pl-64">
          <main className="max-w-2xl mx-auto px-4 pt-4 lg:pt-8 pb-28 lg:pb-14">
            {user && !loading && !profile && (
              <div className="mb-4 flex items-start gap-3 border border-bad/30 bg-bad/10 p-4">
                <TriangleAlert className="text-bad size-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold font-mono uppercase tracking-tight">Couldn't load your profile</p>
                  <p className="text-xs text-mute mt-1 leading-relaxed font-mono">
                    Posting, feeds and comments need your profile. Retry once, or reload the page
                    if it still fails.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => refreshProfile().catch(() => {})}>
                      Retry
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                      Reload page
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 items-center border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile"
        >
          {[
            { to: "/feed", icon: <Home className="size-5" />, label: "Feed" },
            { to: "/explore", icon: <Compass className="size-5" />, label: "Explore" },
            { fab: true },
            { to: "/saved", icon: <Bookmark className="size-5" />, label: "Saved" },
            {
              to: profile ? `/profile/${profile.handle}` : "/feed",
              icon: <UserRound className="size-5" />,
              label: "Profile",
            },
          ].map((item, i) =>
            "fab" in item && item.fab ? (
              <button
                key={i}
                onClick={() => requestCompose()}
                className="mx-auto -mt-6 size-12 bg-brand text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] grid place-items-center active:translate-y-1 active:shadow-none transition-all border border-brand"
                aria-label="New post"
              >
                <PenSquare className="size-5" />
              </button>
            ) : (
              <NavLink
                key={i}
                to={(item as { to: string }).to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-bold font-mono uppercase tracking-tighter transition-colors",
                    isActive ? "text-brand" : "text-mute"
                  )
                }
              >
                {(item as { icon: ReactNode }).icon}
                {(item as { label: string }).label}
              </NavLink>
            )
          )}
        </nav>

        <PostComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          initialCommunityId={composerCommunity}
        />
      </div>
    </UnreadContext.Provider>
  );
}