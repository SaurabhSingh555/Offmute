import type { CommentItem, PostItem } from "./types";

/**
 * CLIENT-SIDE SAMPLE CONTENT
 * ------------------------------------------------------------------
 * No demo accounts exist in the database. These hardcoded posts are
 * shown ONLY while a feed context is empty, so new signups never see
 * a blank product. Real posts always replace samples.
 *
 * Likes / bookmarks / poll votes on sample posts persist in
 * localStorage (this browser only) so the experience feels alive
 * without writing anything to Supabase.
 */

const AUTHORS = {
  d1: "SilentPanda47",
  d2: "NightShiftFox",
  d3: "CoffeeBreak92",
  d4: "MidnightCrane88",
  d5: "StandupSparrow31",
  d6: "OvertimeOtter24",
  d7: "PingPony63",
  d8: "ChaiPause77",
  d9: "BacklogBear15",
  d10: "FilterCoffee56",
} as const;
type AuthorKey = keyof typeof AUTHORS;
const demoUserId = (k: AuthorKey) => `demo-user-${k}`;
const hrsAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const CAT_NAMES: Record<string, string> = {
  "office-confessions": "Office Confessions",
  "corporate-memes": "Corporate Humor",
  "career-advice": "Career Advice",
  "workplace-stories": "Workplace Stories",
  questions: "Anonymous Questions",
  "it-software": "IT & Software",
  "bpo-support": "BPO & Customer Support",
  "night-shift": "Night Shift Stories",
  "interns-freshers": "Interns & Freshers",
  "sales-marketing": "Sales & Marketing",
  "toxic-workplaces": "Toxic Workplace Experiences",
  "hr-recruitment": "HR & Recruitment",
};

const COMM_NAMES: Record<string, string> = {
  "bengaluru-tech": "Bengaluru Tech",
  "noida-corporate": "Noida Corporate",
  "mumbai-corporate": "Mumbai Corporate",
  "former-colleagues": "Former Colleagues",
  "corporate-memes": "Corporate Memes",
  "office-confessions": "Office Confessions",
  "toxic-workplaces": "Toxic Workplace Experiences",
  "interns-freshers": "Interns & Freshers",
  "career-advice": "Career Advice",
  "night-shift": "Night Shift Stories",
  "it-software": "IT & Software",
  "bpo-support": "BPO & Customer Support",
  "hr-recruitment": "HR & Recruitment",
  "sales-marketing": "Sales & Marketing",
};

interface DemoCommentSpec {
  author: AuthorKey;
  hoursAgo: number;
  body: string;
  replyTo?: number;
}

const COMMENTS: Record<string, DemoCommentSpec[]> = {
  "demo-01": [
    { author: "d5", hoursAgo: 2, body: "The silent laugh is a load-bearing wall of every office. Do not stop." },
    { author: "d9", hoursAgo: 1, body: "I do the head-nod now. It is lower maintenance." },
    { author: "d1", hoursAgo: 0.75, body: "Head nod is the next evolution, you are right.", replyTo: 1 },
  ],
  "demo-04": [{ author: "d1", hoursAgo: 4, body: `“Could have been a shorter email” is the true endgame.` }],
  "demo-07": [
    { author: "d8", hoursAgo: 7, body: "This works. I asked where in the band and got a real number instead of a “competitive package” speech." },
    { author: "d10", hoursAgo: 6, body: "Did the company actually move after you asked?" },
    { author: "d4", hoursAgo: 5, body: "Yes. 8% more than the first offer. The band question buys you room.", replyTo: 1 },
  ],
  "demo-09": [
    { author: "d7", hoursAgo: 6, body: "Day 1 to day 400 is the real promotion. Congratulations." },
    { author: "d3", hoursAgo: 4, body: "Same energy. I asked my trainer for help and now they ask me to unprint their reports." },
  ],
  "demo-10": [
    { author: "d9", hoursAgo: 24, body: "“We're experiencing some network issues” is the most important phrase in corporate history." },
    { author: "d2", hoursAgo: 23, body: "Eleven minutes?! I would have died. Well done, your PM." },
    { author: "d7", hoursAgo: 22, body: "She did not blink. Not once. She even made a joke on the call at minute 9.", replyTo: 1 },
  ],
  "demo-12": [
    {
      author: "d8",
      hoursAgo: 5,
      body: "It is probably just a formality intro. If it feels evaluative, ask “is there anything specific I should focus on this month?”",
    },
  ],
  "demo-14": [
    { author: "d1", hoursAgo: 48, body: "I countered the first number 10% up and asked for a written band. Got the band. The number followed." },
  ],
  "demo-15": [
    { author: "d1", hoursAgo: 10, body: 'Stage 11 says “waiting for approval” and the approver is a distribution list.' },
  ],
  "demo-19": [
    { author: "d5", hoursAgo: 7, body: "The printer knows too many things. It is fine. We do not talk about it." },
  ],
  "demo-31": [
    { author: "d3", hoursAgo: 8, body: "Family on a rotational basis. The family metaphor has no labor law, ever." },
  ],
};

interface DemoPostSpec {
  author: AuthorKey;
  hoursAgo: number;
  body: string;
  category?: string;
  community?: string;
  restricted?: boolean;
  likes: number;
  poll?: { question: string; options: { label: string; votes: number }[] };
}

const POSTS: DemoPostSpec[] = [
  { author: "d1", hoursAgo: 3, category: "office-confessions", likes: 14, body: `Confession: I have been the person who "silently" laughs at my manager's jokes in every meeting for 3 years, and I have not once actually found them funny. I could retire on this skill.` },
  { author: "d3", hoursAgo: 26, category: "office-confessions", likes: 22, body: `I typed "AS PER MY LAST EMAIL" in all caps in a follow-up email. I am not ready to explain the energy.` },
  { author: "d9", hoursAgo: 48, category: "office-confessions", likes: 9, body: `My manager says "let's circle back". There is no circle. It's a spiral and we are falling in it.` },
  {
    author: "d5", hoursAgo: 5, category: "corporate-memes", likes: 18,
    body: `There are two types of meetings: ones that could have been emails, and ones that could have been shorter emails.`,
    poll: {
      question: "What time are your 1:1s?",
      options: [
        { label: "9:00 — before I'm human", votes: 3 },
        { label: "11:00 — mid-deadline", votes: 1 },
        { label: "4:00 — the “quick” sync", votes: 5 },
        { label: "Random — depends on mood", votes: 1 },
      ],
    },
  },
  { author: "d7", hoursAgo: 24, category: "corporate-memes", likes: 25, body: `Me: *thinks "maybe I'll skip standup today"*\nAlso me: presenting a 4-minute update about doing absolutely nothing` },
  {
    author: "d9", hoursAgo: 72, category: "corporate-memes", likes: 31,
    body: `The calendar invite said "Quick sync". It lasted 52 minutes, ended with "let's take this offline", and now there is another quick sync on Thursday.`,
    poll: {
      question: "Does your company have a real no-meeting Friday?",
      options: [
        { label: "Yes, and it's actually respected", votes: 2 },
        { label: "Yes, on paper only", votes: 5 },
        { label: "No, and it's never been discussed", votes: 2 },
      ],
    },
  },
  { author: "d4", hoursAgo: 9, category: "career-advice", likes: 12, body: `Negotiation tip that actually worked for me: I asked for the band, not a number. "Where would this role sit in the band for 4 years experience?" changes the whole conversation.` },
  { author: "d3", hoursAgo: 96, category: "career-advice", likes: 19, body: `Switched from BPO to IT after 3 years of night study. First month salary was less. Second year it was 3x. Long game.` },
  { author: "d4", hoursAgo: 7, category: "workplace-stories", likes: 28, body: `Day 1 as a fresher: someone in the lift says "ah, the new one". Day 400: the same person asks me where the AC remote is. We make it.` },
  { author: "d7", hoursAgo: 48, category: "workplace-stories", likes: 34, body: `The server went down during the client demo. Our PM said "we're experiencing some network issues" for 11 minutes straight until we were back. She is a legend and I am still shaking.` },
  { author: "d5", hoursAgo: 120, category: "workplace-stories", likes: 21, body: `Onboarding day the trainer said "the system is very old, just don't touch it". The system had a physical key in a drawer. A physical key.` },
  { author: "d10", hoursAgo: 6, category: "questions", likes: 8, body: `Is it normal to get a performance review meeting in the first week of the new job, before I have even touched the internal tools?` },
  { author: "d1", hoursAgo: 30, category: "questions", likes: 11, body: `What do you do when your manager says "I trust you" and then micmanages every Jira update within an hour?` },
  { author: "d6", hoursAgo: 72, category: "questions", likes: 15, body: `Salary negotiation: do you counter the first number, or ask for a range? Real experiences only.` },
  { author: "d7", hoursAgo: 11, category: "it-software", likes: 26, body: `We have a deployment pipeline with 14 stages. 11 of them say "pending" and nobody explains what they are waiting for. We could have shipped in 2019.` },
  { author: "d1", hoursAgo: 48, category: "it-software", likes: 30, body: `A production bug was "fixed" by restarting the server and writing "worked on its own" in the ticket. Ticket closed. No investigation.` },
  {
    author: "d3", hoursAgo: 4, category: "bpo-support", likes: 23,
    body: `Caller screamed for 8 minutes. My queue average talk time is 6 minutes. I have never felt more proud of a call.`,
    poll: {
      question: "Which shift is actually the hardest?",
      options: [
        { label: "Morning shift", votes: 6 },
        { label: "Evening shift", votes: 2 },
        { label: "Night shift — obviously", votes: 2 },
      ],
    },
  },
  { author: "d2", hoursAgo: 72, category: "bpo-support", likes: 17, body: `The IVR menu has 14 options and every option leads to a different waiting queue. We are all trapped in the matrix.` },
  { author: "d2", hoursAgo: 8, category: "night-shift", likes: 35, body: `2:47 AM, empty floor, and the only person who knows the printer's real name is me. There is peace here that the day shift will never understand.` },
  { author: "d5", hoursAgo: 96, category: "night-shift", likes: 19, body: `Best part of night shift: when the building lights dim for "energy saving mode" and the whole office becomes a horror movie set.` },
  { author: "d10", hoursAgo: 12, category: "interns-freshers", likes: 24, body: `First week: "any questions?" — every week. I have 47 questions. I have asked 0.` },
  { author: "d6", hoursAgo: 48, category: "sales-marketing", likes: 13, body: `Q3 target announced on a Tuesday. It is 40% of the annual target and we are 2 months in. The sales floor applauded. For no reason at all.` },
  { author: "d4", hoursAgo: 144, category: "toxic-workplaces", likes: 27, body: `Pattern I saw across 3 different jobs: the loudest person in the meeting gets the promotion, not the person who did the work. Naming no names, because no names exist here.` },
  { author: "d8", hoursAgo: 24, category: "hr-recruitment", likes: 20, body: `Recruiter to me: "your notice period is flexible, right?" Me: "it's 90 days written in my contract." Recruiter: "oh. okay. so flexible-ish."` },
  { author: "d10", hoursAgo: 2, community: "bengaluru-tech", likes: 16, body: `Which office area is worst for 9 AM standups — HSR traffic or Indiranagar? Asking for my commute planning.` },
  { author: "d4", hoursAgo: 26, community: "bengaluru-tech", likes: 21, body: `My building's cafeteria started calling filter coffee "premium brew". We live in a post-truth workplace.` },
  { author: "d1", hoursAgo: 5, community: "noida-corporate", likes: 21, body: `Sector 62 cabs at 8:55 PM is a spiritual experience. Everyone's story is different, everyone's pain is the same.` },
  { author: "d3", hoursAgo: 48, community: "noida-corporate", likes: 18, body: `The "free parking for 2 hours" policy created more conflict in our office than any project ever did.` },
  { author: "d6", hoursAgo: 24, community: "mumbai-corporate", likes: 14, body: `BKC monsoon: the office is dry, the road is a river, and the 5:30 metro is a contact sport.` },
  { author: "d8", hoursAgo: 72, community: "former-colleagues", likes: 12, body: `Former team: we have moved to 5 different companies. This is our group chat now, but anonymous. Miss you all.` },
  { author: "d9", hoursAgo: 9, community: "corporate-memes", likes: 29, body: `Company values slide 1: "We are a family". Slide 2: "Family members are expected to work during holidays on a rotational basis."` },
  { author: "d4", hoursAgo: 16, community: "interns-freshers", likes: 15, body: `Fresher tip: the "small task" your senior gives you is actually a test. Ask one genuinely good question about it.` },
  { author: "d3", hoursAgo: 24, community: "office-confessions", restricted: true, likes: 17, body: `I still keep my first-day badge on my desk. The person I trained is now my manager.` },
  { author: "d1", hoursAgo: 72, community: "office-confessions", restricted: true, likes: 23, body: `Confession: I ghosted a colleague for 2 months. Every time I saw them in the cafeteria they looked so happy I could not work up the courage to talk.` },
  { author: "d4", hoursAgo: 96, community: "toxic-workplaces", restricted: true, likes: 26, body: `My old manager copied me on every email to my new manager. The pattern: "just so you are aware" followed by a screenshot of my Jira comments.` },
  { author: "d7", hoursAgo: 18, community: "it-software", likes: 13, body: `Our on-call rotation has 4 people. 3 of them now use it to avoid meetings: "I'm on on-call."` },
  { author: "d2", hoursAgo: 9, community: "bpo-support", likes: 11, body: `My QA call was flagged "too long" because I said "you're welcome" twice.` },
  { author: "d8", hoursAgo: 48, community: "hr-recruitment", likes: 10, body: `We onboarded 6 people this month. 2 left before their welcome kit arrived.` },
  { author: "d6", hoursAgo: 26, community: "sales-marketing", likes: 16, body: `Marketing says the campaign "underperformed expectations". It had zero impressions. The website was down.` },
  { author: "d10", hoursAgo: 72, community: "career-advice", likes: 12, body: `Rule I live by: every exit-interview answer should read like a LinkedIn post in disguise.` },
  { author: "d5", hoursAgo: 14, community: "night-shift", likes: 20, body: `Day 400 of night shift: I can hear the office fridge cycle. We are close now.` },
];

/* ------------------------------- Engagement ------------------------------ */

const LS = { likes: "om-demo-likes", saved: "om-demo-saved", votes: "om-demo-votes" };

function loadSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    /* private mode */
  }
}

export function demoLikedIds(): Set<string> {
  return loadSet(LS.likes);
}
export function toggleDemoLike(id: string): boolean {
  const s = loadSet(LS.likes);
  const next = !s.has(id);
  if (next) s.add(id);
  else s.delete(id);
  saveSet(LS.likes, s);
  return next;
}

export function demoSavedIds(): Set<string> {
  return loadSet(LS.saved);
}
export function toggleDemoSaved(id: string): boolean {
  const s = loadSet(LS.saved);
  const next = !s.has(id);
  if (next) s.add(id);
  else s.delete(id);
  saveSet(LS.saved, s);
  return next;
}

function loadVotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS.votes) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
export function demoPollVotes(): Record<string, string> {
  return loadVotes();
}
export function castDemoPollVote(pollId: string, optionId: string) {
  const v = loadVotes();
  v[pollId] = optionId;
  try {
    localStorage.setItem(LS.votes, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/* -------------------------------- Building ------------------------------- */

function commentCountFor(id: string): number {
  const list = COMMENTS[id] ?? [];
  return list.filter((c) => c.replyTo == null).length + list.filter((c) => c.replyTo != null).length;
}

const DEMO_POSTS: PostItem[] = POSTS.map((s, i) => {
  const id = `demo-${String(i + 1).padStart(2, "0")}`;
  return {
    id,
    body: s.body,
    image_url: null,
    user_id: demoUserId(s.author),
    created_at: hrsAgo(s.hoursAgo),
    updated_at: hrsAgo(s.hoursAgo),
    community_id: s.community ? `demo-comm-${s.community}` : null,
    category_id: s.category ? 9000 + i : null,
    profile: { handle: AUTHORS[s.author], avatar_url: null },
    category: s.category ? { slug: s.category, name: CAT_NAMES[s.category] ?? s.category } : null,
    community: s.community
      ? { slug: s.community, name: COMM_NAMES[s.community] ?? s.community, is_restricted: !!s.restricted }
      : null,
    likeCount: s.likes,
    commentCount: commentCountFor(id),
    liked: false,
    bookmarked: false,
    poll: s.poll
      ? {
          id: `demo-poll-${i + 1}`,
          question: s.poll.question,
          options: s.poll.options.map((o, j) => ({
            id: `demo-opt-${i + 1}-${j + 1}`,
            label: o.label,
            sort_order: j,
            votes: o.votes,
          })),
        }
      : null,
    myPollVote: null,
    isDemo: true,
  } as PostItem;
});

export const ALL_DEMO_POSTS: PostItem[] = DEMO_POSTS;

function applyEngagement(p: PostItem): PostItem {
  const liked = loadSet(LS.likes).has(p.id);
  const saved = loadSet(LS.saved).has(p.id);
  const votes = loadVotes();
  const myVote = p.poll ? (votes[p.poll.id] ?? null) : null;
  let poll = p.poll;
  if (p.poll && myVote) {
    poll = {
      ...p.poll,
      options: p.poll.options.map((o) => (o.id === myVote ? { ...o, votes: o.votes + 1 } : o)),
    };
  }
  return { ...p, liked, bookmarked: saved, myPollVote: myVote, poll };
}

export function withDemoEngagement(posts: PostItem[]): PostItem[] {
  return posts.map(applyEngagement);
}

export function demoPostById(id: string): PostItem | null {
  const p = DEMO_POSTS.find((x) => x.id === id) ?? null;
  return p ? applyEngagement(p) : null;
}

export function demoCommentsFor(postId: string): CommentItem[] {
  const spec = COMMENTS[postId] ?? [];
  const items: CommentItem[] = spec.map((c, i) => ({
    id: `demo-c-${postId}-${i}`,
    body: c.body,
    created_at: hrsAgo(c.hoursAgo),
    user_id: demoUserId(c.author),
    parent_comment_id: null,
    profile: { handle: AUTHORS[c.author], avatar_url: null },
    replies: [],
  }));
  spec.forEach((c, i) => {
    if (c.replyTo != null && items[c.replyTo]) items[c.replyTo].replies.push(items[i]);
  });
  return items.filter((_, i) => spec[i].replyTo == null);
}

/** Sample posts for the currently-empty feed context. */
export function demoPostsFor(context: {
  tab: string;
  categorySlug?: string;
  communitySlug?: string | null;
}): PostItem[] {
  let list = DEMO_POSTS;
  if (context.communitySlug) list = list.filter((p) => p.community?.slug === context.communitySlug);
  else if (context.categorySlug) list = list.filter((p) => p.category?.slug === context.categorySlug);
  if (context.tab === "trending")
    list = [...list].sort((a, b) => b.likeCount - a.likeCount).slice(0, 20);
  return withDemoEngagement(list);
}

export function demoPostsForCommunity(slug: string): PostItem[] {
  return withDemoEngagement(DEMO_POSTS.filter((p) => p.community?.slug === slug));
}
