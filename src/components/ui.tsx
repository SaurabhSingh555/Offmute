import React, {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Database,
  KeyRound,
  Loader2,
  MicOff,
  Terminal,
  X,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { hashStr } from "@/lib/utils";
import { cn } from "@/utils/cn";

/* ------------------------------- Spinner -------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin size-4", className)} aria-hidden />;
}

/* -------------------------------- Logo ---------------------------------- */

export function Logo({ size = 22, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className="grid place-items-center bg-brand text-black shadow-[3px_3px_0px_0px_rgba(255,255,255,0.2)]"
        style={{ width: size + 8, height: size + 8 }}
      >
        <MicOff size={size} strokeWidth={3} />
      </span>
      {withWordmark && (
        <span className="font-display font-bold tracking-tighter text-xl leading-none">
          OFF<span className="text-brand">MUTE</span>
        </span>
      )}
    </span>
  );
}

/* -------------------------------- Button -------------------------------- */

type ButtonVariant = "primary" | "soft" | "ghost" | "outline" | "danger" | "coral";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand text-black hover:bg-brand/80 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] hover:translate-y-0.5 hover:shadow-none disabled:opacity-50",
    coral:
      "bg-coral text-white hover:bg-coral/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)] hover:translate-y-0.5 hover:shadow-none disabled:opacity-50",
    soft: "bg-brand-soft text-brand hover:bg-brand/20 disabled:opacity-50 border border-brand/20",
    ghost: "text-mute hover:text-ink hover:bg-raise disabled:opacity-40",
    outline: "border border-line text-ink hover:bg-raise disabled:opacity-40",
    danger: "bg-bad/15 text-bad hover:bg-bad/25 disabled:opacity-50 border border-bad/20",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs gap-1.5 font-bold font-mono uppercase tracking-wider",
    md: "h-10 px-4 text-sm gap-2 font-bold font-mono uppercase tracking-wide",
    lg: "h-12 px-6 text-[15px] gap-2 font-bold font-mono uppercase tracking-wide",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center transition-all select-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  );
}

/* ------------------------------- Inputs --------------------------------- */

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      {label && (
        <span className="block text-[11px] font-bold font-mono uppercase tracking-widest text-mute mb-1.5">
          {label}
        </span>
      )}
      {children}
      {error && <span className="block text-xs text-bad mt-1.5 font-mono">{error}</span>}
      {!error && hint && <span className="block text-[10px] text-mute mt-1.5 font-mono">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full h-10 px-3 bg-bg border border-line text-sm text-ink placeholder:text-mute/50 focus:border-brand focus:outline-none transition-colors font-mono rounded-none";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn(inputCls, className)} {...rest} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(inputCls, "h-auto py-3 leading-relaxed resize-none", className)}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select className={cn(inputCls, "appearance-none cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

/* -------------------------------- Badge --------------------------------- */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "coral" | "ok" | "warn" | "bad";
  className?: string;
}) {
  const tones = {
    neutral: "bg-raise text-mute border border-line",
    brand: "bg-brand-soft text-brand border border-brand/30",
    coral: "bg-coral-soft text-coral border border-coral/30",
    ok: "bg-ok/15 text-ok border border-ok/30",
    warn: "bg-warn/15 text-warn border border-warn/30",
    bad: "bg-bad/15 text-bad border border-bad/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wider",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Avatar -------------------------------- */

export function Avatar({
  handle,
  size = 40,
  src,
  className,
}: {
  handle?: string | null;
  size?: number;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={handle ?? "avatar"}
        width={size}
        height={size}
        loading="lazy"
        className={cn("object-cover shrink-0 grayscale hover:grayscale-0 transition-all border border-line", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const h = hashStr(handle ?? "offmute");
  const hue = h % 360;
  const hue2 = (hue + 45 + (h % 50)) % 360;
  const variant = h % 4;
  return (
    <div
      aria-hidden
      className={cn("overflow-hidden shrink-0 border border-line", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} role="img" aria-label={`Anonymous avatar for ${handle ?? ""}`}>
        <defs>
          <linearGradient id={`ag${h}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${hue} 60% 45%)`} />
            <stop offset="1" stopColor={`hsl(${hue2} 50% 25%)`} />
          </linearGradient>
        </defs>
        <rect width="40" height="40" fill={`url(#ag${h})`} />
        {variant === 0 && (
          <circle cx="20" cy="20" r="8.5" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" />
        )}
        {variant === 1 && (
          <path
            d="M20 10.5 L29.5 28 H10.5 Z"
            fill="none"
            stroke="rgba(255,255,255,.8)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}
        {variant === 2 && (
          <>
            <rect
              x="11.5"
              y="13"
              width="17"
              height="14"
              rx="1"
              fill="none"
              stroke="rgba(255,255,255,.8)"
              strokeWidth="2.5"
            />
            <line x1="20" y1="13" x2="20" y2="27" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" />
          </>
        )}
        {variant === 3 && (
          <>
            <circle cx="15" cy="20" r="4.5" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" />
            <circle cx="26" cy="20" r="4.5" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.5" />
          </>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------- Skeleton ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("om-skeleton", className)} aria-hidden />;
}

export function PostSkeleton() {
  return (
    <div className="border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

/* ------------------------------ EmptyState ------------------------------ */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="grid place-items-center size-14 border border-line bg-bg text-brand mb-4">
        {icon}
      </div>
      <h3 className="font-display font-bold text-base tracking-tight">{title}</h3>
      {desc && <p className="text-sm text-mute mt-1.5 max-w-xs leading-relaxed font-mono">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="grid place-items-center size-14 border border-bad/30 bg-bad/10 text-bad mb-4">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display font-bold text-base tracking-tight">Something went wrong</h3>
      <p className="text-sm text-mute mt-1.5 max-w-xs leading-relaxed break-words font-mono">
        {message ?? "The request failed. Check your connection and try again."}
      </p>
      {onRetry && (
        <Button variant="soft" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  hideHeader = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  hideHeader?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn(
              "relative w-full bg-surface border border-line shadow-2xl max-h-[92dvh] overflow-y-auto rounded-none",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg"
            )}
          >
            {!hideHeader && (
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface/95 backdrop-blur border-b border-line">
                <h2 className="font-display font-bold text-base tracking-tight uppercase font-mono">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 text-mute hover:text-ink hover:bg-raise transition-colors border border-transparent hover:border-line"
                  aria-label="Close dialog"
                >
                  <X className="size-4.5" />
                </button>
              </div>
            )}
            <div className={hideHeader ? "" : "px-5 py-4"}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-mute leading-relaxed font-mono">{message}</div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* -------------------------------- Toggle -------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 w-full text-left py-1 group disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-bold tracking-tight">{label}</span>
        {desc && <span className="block text-xs text-mute mt-0.5 font-mono">{desc}</span>}
      </span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 transition-colors border border-line",
          checked ? "bg-brand" : "bg-raise"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 bg-black transition-transform",
            checked ? "translate-x-4.5" : "translate-x-0.5 bg-mute"
          )}
        />
      </span>
    </button>
  );
}

/* ------------------------------ DropdownMenu ---------------------------- */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.13 }}
            className={cn(
              "absolute z-40 mt-1.5 min-w-44 border border-line bg-surface shadow-xl overflow-hidden py-1 rounded-none",
              align === "end" ? "right-0" : "left-0"
            )}
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-bold font-mono uppercase tracking-wider transition-colors text-left",
                  item.danger ? "text-bad hover:bg-bad/10" : "text-ink hover:bg-raise"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ SetupScreen ----------------------------- */

export function SetupScreen({ compact = false }: { compact?: boolean }) {
  const rows: { icon: ReactNode; title: string; body: ReactNode }[] = [
    {
      icon: <Database className="size-4" />,
      title: "Run the database migration",
      body: (
        <>
          Supabase Dashboard → <b>SQL Editor</b> → paste the entire{" "}
          <code className="text-brand">supabase/schema.sql</code> → Run. It creates tables, RLS
          policies, triggers, storage buckets and seeds.
        </>
      ),
    },
    {
      icon: <KeyRound className="size-4" />,
      title: "Only two environment variables",
      body: (
        <code className="block bg-bg border border-line px-3 py-2 text-[11px] leading-relaxed whitespace-pre font-mono text-mute">
          {"VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY"}
        </code>
      ),
    },
    {
      icon: <Terminal className="size-4" />,
      title: "One-time dashboard checks",
      body: (
        <ul className="list-disc pl-4 space-y-1">
          <li>Authentication → Sign In / Up → Email provider enabled</li>
          <li>
            Authentication → URL Configuration: Site URL = your deployed URL, add it to Redirect
            URLs
          </li>
          <li>
            (Optional) Authentication → Providers → SMTP / Resend for delivery of email links
          </li>
        </ul>
      ),
    },
  ];

  return (
    <div className={cn("border border-warn/30 bg-warn/5 p-5", compact && "p-4")}>
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="text-warn size-5 shrink-0" />
        <h3 className="font-display font-bold uppercase tracking-tight">Connect to Supabase</h3>
      </div>
      <p className="text-xs text-mute mt-2 leading-relaxed font-mono">
        No keys detected yet. Once these steps are done, every feature below goes live with just
        the two <code className="text-xs">VITE_*</code> variables — no service key, no backend.
      </p>
      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.title} className="flex gap-3">
            <span className="grid place-items-center size-8 border border-warn/30 bg-warn/10 text-warn shrink-0 mt-0.5">
              {r.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold font-mono uppercase">{r.title}</p>
              <div className="text-[11px] text-mute mt-1 leading-relaxed font-mono">{r.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Verified check ------------------------- */

export function CheckIcon({ className }: { className?: string }) {
  return <Check className={cn("size-4", className)} />;
}

export { isSupabaseConfigured };