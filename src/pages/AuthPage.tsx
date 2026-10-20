import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, MailCheck } from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button, Field, Input, Logo, SetupScreen } from "@/components/ui";
import { cn } from "@/utils/cn";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<"in" | "up">(
    params.get("mode") === "up" ? "up" : "in"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; desc: string } | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const next =
    (location.state as { from?: string } | null)?.from ?? params.get("next") ?? "";
  const resetDone = params.get("reset") === "1";

  useEffect(() => {
    if (!loading && user) {
      navigate(next ? `/${next}` : "/feed", { replace: true });
    }
  }, [user, loading, next, navigate]);

  function afterAuth() {
    let onboarded = "1";
    try {
      onboarded = localStorage.getItem("om-onboarded") ?? "";
    } catch {
      /* ignore */
    }
    navigate(onboarded ? (next ? `/${next}` : "/feed") : "/onboarding", { replace: true });
  }

  async function submit() {
    setError(null);
    setNotice(null);
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "up" && password !== confirm)
      return setError("Passwords don't match.");

    setBusy(true);
    try {
      if (mode === "in") {
        const res = await signIn(email, password);
        if (res.error) {
          setError(
            /email not confirmed/i.test(res.error)
              ? "Your email isn't confirmed yet. Check your inbox."
              : res.error
          );
        } else {
          afterAuth();
        }
      } else {
        const res = await signUp(email, password);
        if (res.error) {
          setError(
            /already registered|already been registered/i.test(res.error)
              ? "That email already has an account. Sign in instead."
              : res.error
          );
        } else if (res.needsConfirm) {
          setNotice({
            title: "Check your inbox",
            desc: "We sent a confirmation link. Once confirmed, sign in here.",
          });
        } else {
          afterAuth();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setError(null);
    if (!EMAIL_RE.test(forgotEmail))
      return setError("Enter a valid email address.");
    setForgotBusy(true);
    try {
      const res = await resetPassword(forgotEmail);
      if (res.error) setError(res.error);
      else
        setNotice({
          title: "Reset link sent",
          desc: `If an account exists for ${forgotEmail}, a reset link is on its way.`,
        });
      setForgotOpen(false);
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="force-dark min-h-dvh bg-bg om-noise flex flex-col items-center justify-center px-4 py-6 font-sans">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size={28} />
        </div>

        {!isSupabaseConfigured ? (
          <div className="border border-line bg-surface p-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)]">
            <SetupScreen />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="border border-line bg-surface p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] relative"
          >
            <div className="absolute top-0 right-0 bg-brand text-black font-mono text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest">
              {mode === "in" ? "Login" : "Signup"}
            </div>

            {resetDone && (
              <div className="mb-4 flex items-start gap-2 border border-ok/30 bg-ok/10 px-3 py-2 text-xs">
                <CheckCircle2 className="text-ok size-4 shrink-0 mt-0.5" />
                <p>Password updated. Sign in now.</p>
              </div>
            )}
            {notice && (
              <div className="mb-4 flex items-start gap-2 border border-brand/30 bg-brand-soft px-3 py-2 text-xs">
                <MailCheck className="text-brand size-4 shrink-0 mt-0.5" />
                <p>
                  <b>{notice.title}</b>
                  <span className="block text-[10px] text-mute mt-0.5 font-mono">{notice.desc}</span>
                </p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border border-line mb-5">
              {(
                [
                  ["in", "Sign in"],
                  ["up", "Create account"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setNotice(null);
                  }}
                  className={cn(
                    "flex-1 h-9 text-[11px] font-bold font-mono uppercase tracking-wider transition-colors",
                    mode === m ? "bg-brand text-black" : "text-mute hover:text-ink hover:bg-raise"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password" hint={mode === "up" ? "Minimum 6 characters." : undefined}>
                <Input
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </Field>
              {mode === "up" && (
                <Field label="Confirm password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </Field>
              )}

              {error && (
                <p className="text-[11px] font-mono text-bad bg-bad/10 border border-bad/30 px-2.5 py-1.5 break-words uppercase tracking-tight">
                  [ ERR ] {error}
                </p>
              )}

              <Button fullWidth size="md" onClick={submit} loading={busy} className="mt-1">
                {mode === "in" ? "Sign in" : "Create anonymous account"}
              </Button>

              {mode === "up" && (
                <p className="text-[10px] text-mute text-center leading-snug font-mono px-2">
                  We'll auto-generate a handle like <span className="text-brand font-bold">NightShiftFox</span>.
                </p>
              )}
            </div>

            {!forgotOpen ? (
              <button
                onClick={() => {
                  setForgotOpen(true);
                  setError(null);
                }}
                className="mt-4 w-full text-center text-[10px] font-mono text-mute hover:text-brand transition-colors uppercase tracking-wider"
              >
                Forgot your password?
              </button>
            ) : (
              <div className="mt-3 border border-line bg-raise/30 p-3 space-y-2">
                <p className="text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 text-brand">
                  <KeyRound className="size-3.5" /> Reset password
                </p>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-[10px]"
                    onClick={() => {
                      setForgotOpen(false);
                      setError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-[10px]" onClick={sendReset} loading={forgotBusy}>
                    Send link
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Chhota Footer Disclaimer */}
        <p className="text-center text-[9px] font-mono text-mute mt-5 leading-snug max-w-xs mx-auto uppercase tracking-tighter opacity-60">
          Anonymity protects you from users, not from legal process or account compromise.
        </p>
      </div>
    </div>
  );
}