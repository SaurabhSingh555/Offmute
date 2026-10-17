import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Profile, UserPrefs } from "@/lib/types";
import { generateHandle, isUniqueViolation } from "@/lib/utils";
import { cn } from "@/utils/cn";

/* ========================================================================== */
/* Toasts                                                                     */
/* ========================================================================== */

export type ToastVariant = "ok" | "bad" | "info";
export interface ToastItem {
  id: number;
  title: string;
  desc?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (t: { title: string; desc?: string; variant?: ToastVariant }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, desc, variant = "info" }: { title: string; desc?: string; variant?: ToastVariant }) => {
      const id = toastSeq++;
      setToasts((t) => [...t.slice(-3), { id, title, desc, variant }]);
      window.setTimeout(() => dismiss(id), variant === "bad" ? 6000 : 3800);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[100] bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 flex flex-col gap-2 w-[min(92vw,380px)] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface/95 backdrop-blur px-4 py-3 shadow-xl"
            >
              {t.variant === "ok" && <CheckCircle2 className="text-ok size-4.5 mt-0.5 shrink-0" />}
              {t.variant === "bad" && <XCircle className="text-bad size-4.5 mt-0.5 shrink-0" />}
              {t.variant === "info" && <Info className="text-brand size-4.5 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.desc && <p className="text-xs text-mute mt-0.5 break-words">{t.desc}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-mute hover:text-ink transition-colors"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

/* ========================================================================== */
/* Theme                                                                      */
/* ========================================================================== */

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("om-theme");
      return saved === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("om-theme", theme);
    } catch {
      /* private mode */
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}

/* ========================================================================== */
/* Auth + profile                                                             */
/* ========================================================================== */

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updateProfile: (
    patch: Partial<Pick<Profile, "handle" | "bio" | "avatar_url">>
  ) => Promise<{ error?: string }>;
  getPrefs: () => Promise<UserPrefs | null>;
  savePrefs: (p: UserPrefs) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string; authRemoved?: boolean }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_PREFS: UserPrefs = {
  likes_notifs: true,
  comment_notifs: true,
  follow_notifs: true,
  post_notifs: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfileOnce = useCallback(async (uid: string): Promise<Profile> => {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, handle, avatar_url, bio, created_at")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Fallback for environments where the auth trigger did not run.
      for (let attempt = 0; attempt < 5; attempt++) {
        const handle = generateHandle();
        const { error: insErr } = await supabase.from("profiles").insert({ id: uid, handle });
        if (!insErr) {
          data = {
            id: uid,
            handle,
            avatar_url: null,
            bio: "",
            created_at: new Date().toISOString(),
          };
          break;
        }
        if (!isUniqueViolation(insErr)) throw new Error(insErr.message);
      }
      if (!data) throw new Error("Could not create your anonymous profile. Please retry.");
    }
    return data as Profile;
  }, []);

  /** Profile load with 3 attempts + backoff so a flaky network never
   *  leaves the app in a silent "profile missing" dead state. */
  const loadProfile = useCallback(async (uid: string): Promise<Profile> => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await loadProfileOnce(uid);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => window.setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Could not load your profile.");
  }, [loadProfileOnce]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;

    supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      const session = sessionData.session;
      if (session) {
        setUser(session.user);
        loadProfile(session.user.id)
          .then(setProfile)
          .catch((e) => setAuthError((e as Error).message))
          .finally(() => alive && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;
      if (session) {
        setUser(session.user);
        try {
          setProfile(await loadProfile(session.user.id));
        } catch (e) {
          setAuthError((e as Error).message);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return { needsConfirm: false, error: error.message };
      return { needsConfirm: !data.session };
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=1`,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, "handle" | "bio" | "avatar_url">>) => {
      if (!user) return { error: "Not signed in." };
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (error) {
        if (isUniqueViolation(error))
          return { error: "That handle is already taken." };
        return { error: error.message };
      }
      const fresh = await loadProfile(user.id).catch(() => null);
      if (fresh) setProfile(fresh);
      else if (profile) setProfile({ ...profile, ...patch });
      return {};
    },
    [user, profile, loadProfile]
  );

  const getPrefs = useCallback(async (): Promise<UserPrefs | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("user_preferences")
      .select("likes_notifs, comment_notifs, follow_notifs, post_notifs")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data) return DEFAULT_PREFS;
    return data as UserPrefs;
  }, [user]);

  const savePrefs = useCallback(
    async (p: UserPrefs) => {
      if (!user) return { error: "Not signed in." };
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, ...p })
        .eq("user_id", user.id);
      if (error) return { error: error.message };
      return {};
    },
    [user]
  );

  const deleteAccount = useCallback(async () => {
    const { data, error } = await supabase.rpc("offmute_delete_account");
    if (error) return { error: error.message };
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    return { authRemoved: (data as { auth_removed?: boolean })?.auth_removed };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const fresh = await loadProfile(user.id).catch(() => null);
    if (fresh) setProfile(fresh);
  }, [user, loadProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authError,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      getPrefs,
      savePrefs,
      deleteAccount,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      authError,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      getPrefs,
      savePrefs,
      deleteAccount,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/* ========================================================================== */
/* Provider composition                                                       */
/* ========================================================================== */

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

/* Small shared motion helper (respects reduced-motion via MotionConfig) */
export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function cx(...c: (string | false | null | undefined)[]) {
  return cn(c.filter(Boolean).join(" "));
}
