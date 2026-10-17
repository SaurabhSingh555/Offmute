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
              ? "Your email isn't confirmed yet. Check your inbox (or resend from Settings once you can sign in)."
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
            desc: "We sent a confirmation link to your email. Once confirmed, sign in here — your anonymous handle will be ready.",
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
      return setError("Enter a valid email address for the reset link.");
    setForgotBusy(true);
    try {
      const res = await resetPassword(forgotEmail);
      if (res.error) setError(res.error);
      else
        setNotice({
          title: "Reset link sent",
          desc: `If an account exists for ${forgotEmail}, a password reset link is on its way.`,
        });
      setForgotOpen(false);
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg om-noise flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size={24} />
        </div>

        {!isSupabaseConfigured ? (
          <div className="rounded-2xl border border-line bg-surface p-2">
            <SetupScreen />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-line bg-surface p-6 sm:p-7 shadow-2xl shadow-black/10"
          >
            {resetDone && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-ok/30 bg-ok/10 px-3.5 py-3 text-sm">
                <CheckCircle2 className="text-ok size-4.5 shrink-0 mt-0.5" />
                <p>
                  <b>Password updated.</b> Sign in with your new password.
                </p>
              </div>
            )}
            {notice && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-soft px-3.5 py-3 text-sm">
                <MailCheck className="text-brand size-4.5 shrink-0 mt-0.5" />
                <p>
                  <b>{notice.title}</b>
                  <span className="block text-xs text-mute mt-0.5">{notice.desc}</span>
                </p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex rounded-xl bg-raise/70 p-1 mb-6">
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
                    "flex-1 h-9 rounded-lg text-sm font-semibold transition-colors",
                    mode === m ? "bg-surface shadow text-ink" : "text-mute hover:text-ink"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
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
                <p className="text-sm text-bad bg-bad/10 border border-bad/20 rounded-xl px-3.5 py-2.5 break-words">
                  {error}
                </p>
              )}

              <Button fullWidth size="lg" onClick={submit} loading={busy}>
                {mode === "in" ? "Sign in" : "Create anonymous account"}
              </Button>

              {mode === "up" && (
                <p className="text-xs text-mute text-center leading-relaxed">
                  We'll auto-generate a pseudonymous handle like{" "}
                  <span className="text-brand font-semibold">NightShiftFox</span>. Your email is
                  never shown publicly.
                </p>
              )}
            </div>

            {!forgotOpen ? (
              <button
                onClick={() => {
                  setForgotOpen(true);
                  setError(null);
                }}
                className="mt-4 w-full text-center text-xs font-semibold text-mute hover:text-brand transition-colors"
              >
                Forgot your password?
              </button>
            ) : (
              <div className="mt-4 rounded-xl border border-line bg-raise/40 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="size-4 text-brand" /> Reset your password
                </p>
                <Input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setForgotOpen(false);
                      setError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button size="sm" className="flex-1" onClick={sendReset} loading={forgotBusy}>
                    Send reset link
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <p className="text-center text-xs text-mute mt-6 leading-relaxed max-w-xs mx-auto">
          Anonymity protects you from other users — it is not a shield against account
          compromise or legal process. Be kind about that gap.
        </p>
      </div>
    </div>
  );
}
