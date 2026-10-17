import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Blocks,
  Gauge,
  Heart,
  Lock,
  MessagesSquare,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import { Avatar, Button, Logo } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";

const FEATURES = [
  {
    icon: Lock,
    title: "Anonymous by default",
    body: "You get a pseudonymous handle — SilentPanda47, not your name. No emails, no phone numbers, no employer directory, ever.",
  },
  {
    icon: Blocks,
    title: "Communities that travel with you",
    body: "You resign, you still belong. Your OFFMUTE identity and communities stay with you across jobs, cities and roles.",
  },
  {
    icon: MessagesSquare,
    title: "Real discussions",
    body: "Confessions, career talk, shift stories, corporate humor — with polls, threads and live community discussions.",
  },
  {
    icon: Heart,
    title: "Honest criticism, safely",
    body: "Ranting about the meeting that could've been an email is a right. Doxxing, threats and leaks are not — and are reportable.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy enforced in the database",
    body: "Row-level security on every table. Your bookmarks, notifications and blocks are unreadable by anyone else — at the SQL level.",
  },
  {
    icon: Gauge,
    title: "Fast, even on office wifi",
    body: "Bounded queries, indexed feeds, optimistic interactions and lazy-loaded routes. No spinners that mock you like a sprint review.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sign up with email",
    body: "Your email stays locked in Supabase Auth. Nobody — including the database layer for public queries — can list it.",
  },
  {
    n: "02",
    title: "Get your anonymous handle",
    body: "A unique pseudonym is generated automatically. Change it anytime; your identity and follows stay intact.",
  },
  {
    n: "03",
    title: "Find your people",
    body: "Join IT & Software, BPO Support, Noida Corporate, Night Shift… Post, vote, discuss, stay incognito.",
  },
];

const MOCK_POSTS = [
  {
    handle: "MidnightCrane42",
    time: "12m",
    body: "Standup ran 25 minutes over. Twenty five. The Jira board is now a literal wall and someone renamed their branch 'prod-fix-FINAL-3'.",
    likes: 214,
    comments: 38,
  },
  {
    handle: "CoffeeBreak92",
    time: "1h",
    body: "HR called it a 'restructuring'. My manager called it 'letting people go before the quarter'. The exit interview called it 'gratitude'.",
    likes: 486,
    comments: 91,
  },
  {
    handle: "NightShiftFox",
    time: "3h",
    body: "2:47 AM. The whole floor is empty and I'm the only person in the building who knows the printer's real name.",
    likes: 167,
    comments: 22,
  },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = (path: string) => navigate(user ? (path === "/auth" ? "/feed" : path) : path);

  return (
    <div className="force-dark min-h-dvh bg-bg text-ink">
      <div className="om-noise relative">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo size={20} />
          <nav className="flex items-center gap-2">
            {user ? (
              <Button size="sm" onClick={() => navigate("/feed")}>
                Open OFFMUTE <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => go("/auth")}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => go("/auth?mode=up")}>
                  Create account
                </Button>
              </>
            )}
          </nav>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 pt-10 lg:pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-mute"
            >
              <span className="size-1.5 rounded-full bg-coral animate-pulse" />
              The anonymous corporate social platform
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="font-display font-bold text-5xl lg:text-6xl leading-[1.05] tracking-tight mt-5"
            >
              Work has a filter.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-brand to-coral">
                Here, you can let it out.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="text-mute text-lg leading-relaxed mt-5 max-w-lg"
            >
              Share office confessions, corporate memes, career war stories and 2 AM night-shift
              truth — with a pseudonym, not a name.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.24 }}
              className="flex flex-wrap items-center gap-3 mt-8"
            >
              <Button size="lg" onClick={() => go("/auth?mode=up")}>
                Get your anonymous handle <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => go("/explore")}>
                Browse communities
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap gap-2 mt-8"
            >
              {["No real names", "No employer directory", "Privacy at the SQL level"].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-brand-soft text-brand text-xs font-semibold px-3 py-1.5"
                >
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Illustrative feed mock */}
          <div className="relative aria-hidden pointer-events-none select-none" aria-hidden>
            <div className="om-grid absolute -inset-8 -z-10" />
            <div className="space-y-4 max-w-sm mx-auto lg:mx-0 lg:ml-auto">
              {MOCK_POSTS.map((p, i) => (
                <motion.div
                  key={p.handle}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
                  className={`rounded-2xl border border-line bg-surface/90 backdrop-blur p-4 shadow-xl shadow-black/20 ${
                    i === 1 ? "lg:translate-x-6" : i === 2 ? "lg:-translate-x-3" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar handle={p.handle} size={34} />
                    <div>
                      <p className="text-sm font-semibold">{p.handle}</p>
                      <p className="text-[11px] text-mute">{p.time} ago</p>
                    </div>
                    {i === 2 && (
                      <span className="ml-auto text-[10px] font-bold text-coral bg-coral-soft rounded-full px-2 py-0.5">
                        #Night Shift
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-mute/90 mt-2.5 leading-relaxed">{p.body}</p>
                  <div className="flex gap-4 mt-3 text-xs font-semibold text-mute">
                    <span className="flex items-center gap-1">
                      <Heart className="size-3.5 text-coral" /> {p.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessagesSquare className="size-3.5" /> {p.comments}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="font-display font-bold text-3xl tracking-tight">
            Built for the 6 PM <span className="text-coral">sigh</span>
          </h2>
          <p className="text-mute mt-2 max-w-xl">
            Everything OFFMUTE does is designed around one thing: saying the work-true thing
            without putting your name on it.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="rounded-2xl border border-line bg-surface/70 p-5 hover:border-brand/40 transition-colors"
              >
                <div className="size-10 rounded-xl bg-brand-soft text-brand grid place-items-center">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-display font-semibold mt-4">{f.title}</h3>
                <p className="text-sm text-mute mt-1.5 leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="font-display font-bold text-3xl tracking-tight">Muted in 3 steps</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="rounded-2xl border border-line bg-surface/70 p-6"
              >
                <span className="font-display text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-brand to-coral">
                  {s.n}
                </span>
                <h3 className="font-display font-semibold text-lg mt-3">{s.title}</h3>
                <p className="text-sm text-mute mt-2 leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Honesty */}
        <section className="max-w-6xl mx-auto px-5 py-16">
          <div className="rounded-3xl border border-brand/30 bg-gradient-to-br from-brand-soft to-coral-soft/40 p-8">
            <div className="flex items-center gap-3">
              <UserRoundCog className="text-brand size-6" />
              <h2 className="font-display font-bold text-2xl tracking-tight">
                What “anonymous” really means here
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-3 mt-6 text-sm leading-relaxed text-mute/90">
              <p>
                <b className="text-ink">What we guarantee:</b> no public real names, emails or
                employers. Private data (bookmarks, notifications, blocks) is protected by
                row-level security you can't bypass from the frontend. Every post can be reported;
                doxxing and harassment are bannable.
              </p>
              <p>
                <b className="text-ink">What we can't guarantee:</b> absolute anonymity. If your
                account is compromised, if content is legally compelled, or if privileged platform
                access is involved, identity protection has limits. Post what you'd be okay with
                explaining in a very bad week.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-5 py-20 text-center">
          <h2 className="font-display font-bold text-4xl tracking-tight">
            You've said it in the pantry.
            <br />
            <span className="text-coral">Say it here.</span>
          </h2>
          <Button size="lg" className="mt-8" onClick={() => go("/auth?mode=up")}>
            {isSupabaseConfigured ? "Create your anonymous account" : "See setup → create your account"}
          </Button>
          <p className="text-xs text-mute mt-4">
            Free pseudonym. No real names. Ever.
          </p>
        </section>

        <footer className="border-t border-line">
          <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo size={16} />
            <p className="text-xs text-mute">
              OFFMUTE — work has a filter. Here, you can let it out.
            </p>
            <Link
              to="/auth"
              className="text-xs font-semibold text-brand hover:underline"
            >
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
