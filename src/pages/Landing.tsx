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
    body: "You get a pseudonymous handle. No emails, no phone numbers, no employer directory. Ever.",
  },
  {
    icon: Blocks,
    title: "Communities that travel",
    body: "You resign, you still belong. Your OFFMUTE identity and communities stay with you across jobs.",
  },
  {
    icon: MessagesSquare,
    title: "Real discussions",
    body: "Confessions, career talk, shift stories, corporate humor — with polls, threads and live discussions.",
  },
  {
    icon: Heart,
    title: "Honest criticism, safely",
    body: "Ranting about the meeting that could've been an email is a right. Doxxing, threats and leaks are not.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy enforced in DB",
    body: "Row-level security on every table. Your bookmarks, notifications and blocks are unreadable by anyone else.",
  },
  {
    icon: Gauge,
    title: "Fast, even on office wifi",
    body: "Bounded queries, indexed feeds, optimistic interactions. No spinners that mock you like a sprint review.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sign up with email",
    body: "Your email stays locked in Supabase Auth. Nobody — including the database layer — can list it.",
  },
  {
    n: "02",
    title: "Get your handle",
    body: "A unique pseudonym is generated automatically. Change it anytime; your identity stays intact.",
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
    <div className="force-dark min-h-dvh bg-bg text-ink font-sans">
      <div className="om-noise relative border-b border-line">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between border-b border-line/50">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-[10px] font-mono border border-line px-1.5 py-0.5 text-mute uppercase tracking-widest">v1.0_beta</span>
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button size="sm" onClick={() => navigate("/feed")} className="bg-brand text-black font-bold hover:bg-brand/90">
                Open OFFMUTE <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => go("/auth")} className="text-mute hover:text-ink">
                  Sign in
                </Button>
                <Button size="sm" onClick={() => go("/auth?mode=up")} className="bg-brand text-black font-bold hover:bg-brand/90">
                  Create account
                </Button>
              </>
            )}
          </nav>
        </header>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 pt-16 lg:pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center relative">
          
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 border border-line bg-surface px-3 py-1 text-xs font-mono text-mute"
            >
              <span className="size-2 bg-brand animate-pulse" />
              [ SYSTEM ONLINE ]
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="font-display font-bold text-5xl lg:text-7xl leading-[0.95] tracking-tighter mt-6 text-ink"
            >
              Work has a <span className="text-mute line-through decoration-brand decoration-4">filter.</span>
              <br />
              <span className="text-brand">Let it out.</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="text-mute text-lg leading-relaxed mt-6 max-w-md font-medium"
            >
              Share office confessions, corporate memes, career war stories and 2 AM night-shift
              truth — with a pseudonym, not a name.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 mt-10"
            >
              <Button size="lg" onClick={() => go("/auth?mode=up")} className="bg-brand text-black font-bold hover:bg-brand/80 rounded-none border-2 border-brand shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-1 hover:shadow-none transition-all">
                Get anonymous handle <ArrowRight className="size-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => go("/explore")} className="border-line text-mute hover:text-ink hover:border-ink rounded-none">
                Browse communities
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-wrap gap-3 mt-10 font-mono text-[11px] uppercase tracking-wider text-mute"
            >
              {["No real names", "No employer directory", "SQL level privacy"].map((t) => (
                <span key={t} className="border border-line px-2 py-1 bg-surface">
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Illustrative feed mock - Made it look messy/asymmetrical */}
          <div className="relative aria-hidden pointer-events-none select-none lg:h-[500px]" aria-hidden>
            <div className="om-grid absolute inset-0 -z-10" />
            
            <div className="space-y-4 max-w-sm mx-auto lg:mx-0 lg:absolute lg:right-0 lg:top-10">
              {MOCK_POSTS.map((p, i) => (
                <motion.div
                  key={p.handle}
                  initial={{ opacity: 0, rotate: 0, y: 30 }}
                  animate={{ opacity: 1, rotate: i === 1 ? 2 : i === 2 ? -2 : 0, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                  className={`border border-line bg-surface p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] ${
                    i === 1 ? "lg:translate-x-12 lg:-translate-y-4" : i === 2 ? "lg:-translate-x-8 lg:translate-y-8" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar handle={p.handle} size={34} />
                    <div>
                      <p className="text-sm font-bold font-mono tracking-tight">{p.handle}</p>
                      <p className="text-[10px] font-mono text-mute uppercase">{p.time} ago</p>
                    </div>
                    {i === 2 && (
                      <span className="ml-auto text-[9px] font-mono font-bold text-black bg-brand px-1.5 py-0.5">
                        #NIGHT
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink/80 mt-3 leading-relaxed font-medium">{p.body}</p>
                  <div className="flex gap-4 mt-4 pt-3 border-t border-line text-xs font-mono text-mute">
                    <span className="flex items-center gap-1.5">
                      <Heart className="size-3.5 text-coral" /> {p.likes}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessagesSquare className="size-3.5" /> {p.comments}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Features - Flat & Blocky */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="border-l-4 border-brand pl-4 mb-10">
          <h2 className="font-display font-bold text-3xl tracking-tight">
            Built for the 6 PM <span className="text-brand">sigh</span>
          </h2>
          <p className="text-mute mt-2 max-w-xl font-mono text-sm">
            // Everything is designed around saying the work-true thing without putting your name on it.
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-line">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="border-b border-r border-line bg-surface p-6 hover:bg-raise transition-colors group"
            >
              <div className="size-10 border border-line bg-bg text-brand grid place-items-center group-hover:border-brand transition-colors">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display font-bold mt-4 tracking-tight">{f.title}</h3>
              <p className="text-sm text-mute mt-2 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works - Numbered Blocks */}
      <section className="max-w-6xl mx-auto px-5 py-20 border-t border-line">
        <h2 className="font-display font-bold text-3xl tracking-tight mb-10">Muted in 3 steps</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="relative p-6 border border-line bg-surface hover:border-brand/50 transition-colors"
            >
              <span className="font-mono text-6xl font-bold text-raise absolute top-2 right-4 pointer-events-none group-hover:text-brand-soft transition-colors">
                {s.n}
              </span>
              <div className="relative z-10">
                <h3 className="font-display font-bold text-lg tracking-tight">{s.title}</h3>
                <p className="text-sm text-mute mt-3 leading-relaxed font-medium">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Honesty - Harsh Box */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="border-2 border-brand bg-brand-soft/20 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-brand text-black font-mono text-[10px] px-2 py-1 font-bold tracking-widest uppercase">
            Read Me
          </div>
          <div className="flex items-center gap-3 mb-6">
            <UserRoundCog className="text-brand size-6" />
            <h2 className="font-display font-bold text-2xl tracking-tight">
              What “anonymous” really means here
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 text-sm leading-relaxed text-mute/90 font-medium">
            <div className="border-l-2 border-line pl-4">
              <b className="text-brand font-mono text-xs uppercase tracking-wider block mb-2">What we guarantee:</b> 
              No public real names, emails or employers. Private data (bookmarks, notifications, blocks) is protected by row-level security. Every post can be reported; doxxing and harassment are bannable.
            </div>
            <div className="border-l-2 border-coral pl-4">
              <b className="text-coral font-mono text-xs uppercase tracking-wider block mb-2">What we can't guarantee:</b> 
              Absolute anonymity. If your account is compromised, if content is legally compelled, or if privileged platform access is involved, identity protection has limits. Post what you'd be okay with explaining in a very bad week.
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Big and Bold */}
      <section className="max-w-4xl mx-auto px-5 py-24 text-center border-t border-line">
        <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tighter leading-tight">
          You've said it in the pantry.
          <br />
          <span className="text-brand bg-brand/10 px-2">Say it here.</span>
        </h2>
        <Button size="lg" className="mt-10 bg-brand text-black font-bold hover:bg-brand/80 rounded-none px-8 py-6 text-lg border-2 border-brand shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-1 hover:shadow-none transition-all" onClick={() => go("/auth?mode=up")}>
          {isSupabaseConfigured ? "Create your anonymous account" : "See setup → create your account"}
        </Button>
        <p className="text-xs font-mono text-mute mt-6 uppercase tracking-widest">
          // Free pseudonym. No real names. Ever.
        </p>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-mute">
          <Logo size={16} />
          <p>
            OFFMUTE © 2024 — Built for the night shift.
          </p>
          <Link to="/auth" className="text-brand hover:text-brand/80 transition-colors">
            [ SIGN IN ]
          </Link>
        </div>
      </footer>
    </div>
  );
}