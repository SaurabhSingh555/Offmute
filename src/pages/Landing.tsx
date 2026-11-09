import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Blocks,
  Briefcase,
  Check,
  Gauge,
  GraduationCap,
  Heart,
  Lock,
  MessagesSquare,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";
import { useAuth } from "@/context/AppProviders";
import { Avatar, Button, Logo, Modal } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  AUDIENCES,
  audienceConfig,
  lockedAudienceForEmail,
  setAudience,
  useAudience,
  type Audience,
} from "@/lib/audience";
import { cn } from "@/utils/cn";

const CORPORATE_FEATURES = [
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

const STUDENT_FEATURES = [
  {
    icon: Lock,
    title: "Anonymous on campus",
    body: "A pseudonymous handle instead of your roll number. No class groups, no attendance registers, no judgment.",
  },
  {
    icon: GraduationCap,
    title: "Built for student life",
    body: "Exams, placements, internships, hostel drama and the canteen economy — all in one place.",
  },
  {
    icon: MessagesSquare,
    title: "Confess without consequences",
    body: "Say the thing you'd never say in the group chat. Polls, threads and honest campus talk.",
  },
  {
    icon: Heart,
    title: "Support, not screenshots",
    body: "Ranting about the 8 AM lecture is allowed. Doxxing, threats and leaked private info are not.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy enforced in DB",
    body: "Row-level security on every table. Your saves, notifications and blocks are yours alone.",
  },
  {
    icon: Gauge,
    title: "Fast, even on hostel wifi",
    body: "Lightweight feeds and indexed queries. Works when the hostel router is having its moment.",
  },
];

const CORPORATE_STEPS = [
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

const STUDENT_STEPS = [
  {
    n: "01",
    title: "Sign up with email",
    body: "Your email stays locked in Supabase Auth. Nobody — including the database layer — can list it.",
  },
  {
    n: "02",
    title: "Get your campus handle",
    body: "A unique pseudonym is generated automatically. No roll number, no class section, no real name.",
  },
  {
    n: "03",
    title: "Find your campus crowd",
    body: "Join College Life, Placements, Internships, Exam War Room… Post, vote, discuss, stay unknown.",
  },
];

const CORPORATE_MOCK_POSTS = [
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

const STUDENT_MOCK_POSTS = [
  {
    handle: "ExamOwl21",
    time: "18m",
    body: "8 AM lecture attendance is at 12%. The same 12% will carry the whole batch during placements and we all know it.",
    likes: 126,
    comments: 24,
  },
  {
    handle: "HostelGhost77",
    time: "1h",
    body: "Confession: I have been signing the hostel register with a friend's name for a month. The handwriting is now better than my exam handwriting.",
    likes: 302,
    comments: 57,
  },
  {
    handle: "PlacementPanda",
    time: "4h",
    body: "Cleared aptitude, cleared GD, got rejected in HR because I said I 'handle pressure well'. Apparently that is not a personality.",
    likes: 188,
    comments: 42,
  },
];

const HERO_COPY = {
  corporate: {
    kicker: "[ WORK MODE ]",
    titleA: "Work has a",
    strike: "filter.",
    titleB: "Let it out.",
    sub: "Share office confessions, corporate memes, career war stories and 2 AM night-shift truth — with a pseudonym, not a name.",
    cta: "Get anonymous handle",
  },
  student: {
    kicker: "[ CAMPUS MODE ]",
    titleA: "Campus has a",
    strike: "filter.",
    titleB: "Let it out.",
    sub: "Share hostel confessions, exam panic, placement stories and 2 AM assignment truth — with a pseudonym, not your roll number.",
    cta: "Get anonymous handle",
  },
} as const;

function AudienceChooser({
  open,
  onClose,
  onPick,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (audience: Audience) => void;
  current: Audience | null;
}) {
  return (
    <Modal open={open} onClose={onClose} hideHeader wide>
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand">
              [ Choose your world ]
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight mt-1">
              Who are you here as?
            </h2>
            <p className="text-sm text-mute mt-2 max-w-md leading-relaxed">
              OFFMUTE now has two worlds. Pick one to shape your feed, your communities
              and the conversations you see. You can switch anytime.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-mute border border-line px-2 py-1 hover:text-ink hover:border-mute"
          >
            skip
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {(Object.keys(AUDIENCES) as Audience[]).map((id) => {
            const option = AUDIENCES[id];
            const Icon = id === "student" ? GraduationCap : Briefcase;
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                className={cn(
                  "text-left border-2 p-4 transition-all group",
                  active
                    ? "border-brand bg-brand-soft/40"
                    : "border-line bg-bg hover:border-brand/60 hover:-translate-y-0.5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid place-items-center size-10 border",
                      active
                        ? "bg-brand text-black border-brand"
                        : "bg-surface text-brand border-line group-hover:border-brand"
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  {active ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold font-mono uppercase tracking-wider text-brand">
                      <Check className="size-3" /> selected
                    </span>
                  ) : (
                    <ArrowRight className="size-4 text-mute group-hover:text-brand transition-colors" />
                  )}
                </div>
                <p className="font-display font-bold text-lg tracking-tight mt-3">
                  {option.title}
                </p>
                <p className="text-xs text-mute mt-1 leading-relaxed">{option.blurb}</p>
                <ul className="mt-3 space-y-1.5">
                  {option.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-[11px] font-mono text-mute/90"
                    >
                      <span className="mt-1.5 size-1 bg-brand shrink-0" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] font-mono text-mute mt-5 text-center uppercase tracking-wider">
          {"// You can change this later from the header or sidebar."}
        </p>
      </div>
    </Modal>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audience = useAudience();
  const [chooserOpen, setChooserOpen] = useState(false);
  const audienceLocked = !!lockedAudienceForEmail(user?.email);
  const cfg = audienceConfig(audience);
  const isStudent = audience === "student";
  const hero = isStudent ? HERO_COPY.student : HERO_COPY.corporate;
  const features = isStudent ? STUDENT_FEATURES : CORPORATE_FEATURES;
  const steps = isStudent ? STUDENT_STEPS : CORPORATE_STEPS;
  const mockPosts = isStudent ? STUDENT_MOCK_POSTS : CORPORATE_MOCK_POSTS;

  useEffect(() => {
    if (!audience && !audienceLocked) setChooserOpen(true);
  }, [audience, audienceLocked]);

  const go = (path: string) => navigate(user ? (path === "/auth" ? "/feed" : path) : path);

  function choose(next: Audience) {
    setAudience(next);
    setChooserOpen(false);
  }

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
            {!audienceLocked && (
              <button
                onClick={() => setChooserOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 border border-line bg-surface px-2.5 h-8 text-[10px] font-bold font-mono uppercase tracking-wider text-mute hover:text-ink hover:border-mute transition-colors"
                title="Switch audience"
              >
                {isStudent ? <GraduationCap className="size-3.5" /> : <Briefcase className="size-3.5" />}
                {cfg.label}
              </button>
            )}
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
              {hero.kicker}
            </motion.div>
            
            <motion.h1
              key={hero.titleA}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="font-display font-bold text-5xl lg:text-7xl leading-[0.95] tracking-tighter mt-6 text-ink"
            >
              {hero.titleA} <span className="text-mute line-through decoration-brand decoration-4">{hero.strike}</span>
              <br />
              <span className="text-brand">{hero.titleB}</span>
            </motion.h1>
            
            <motion.p
              key={hero.sub}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="text-mute text-lg leading-relaxed mt-6 max-w-md font-medium"
            >
              {hero.sub}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4 mt-10"
            >
              <Button size="lg" onClick={() => go("/auth?mode=up")} className="bg-brand text-black font-bold hover:bg-brand/80 rounded-none border-2 border-brand shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:translate-y-1 hover:shadow-none transition-all">
                {hero.cta} <ArrowRight className="size-4 ml-2" />
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
              {["No real names", "No roll numbers", "SQL level privacy"].map((t) => (
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
              {mockPosts.map((p, i) => (
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
                        #{isStudent ? "CAMPUS" : "NIGHT"}
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
            {isStudent ? (
              <>Built for the 2 AM <span className="text-brand">assignment</span></>
            ) : (
              <>Built for the 6 PM <span className="text-brand">sigh</span></>
            )}
          </h2>
          <p className="text-mute mt-2 max-w-xl font-mono text-sm">
            {isStudent
              ? "// Everything is designed around saying the campus-true thing without putting your name on it."
              : "// Everything is designed around saying the work-true thing without putting your name on it."}
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-line">
          {features.map((f, i) => (
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
          {steps.map((s, i) => (
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
              No public real names, emails, roll numbers or employers. Private data (bookmarks, notifications, blocks) is protected by row-level security. Every post can be reported; doxxing and harassment are bannable.
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
          {isStudent ? "You've said it in the hostel." : "You've said it in the pantry."}
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

      <AudienceChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onPick={choose}
        current={audience}
      />
    </div>
  );
}
