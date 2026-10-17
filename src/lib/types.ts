export interface Profile {
  id: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_restricted: boolean;
  created_by: string | null;
  created_at: string;
  member_count?: number | null;
}

export interface CommunityRule {
  id: string;
  content: string;
  sort_order: number;
}

export interface PollOptionData {
  id: string;
  label: string;
  sort_order: number;
  votes: number;
}

export interface PollData {
  id: string;
  question: string | null;
  options: PollOptionData[];
}

export type PostItem = {
  id: string;
  body: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  community_id: string | null;
  category_id: number | null;
  profile: { handle: string; avatar_url: string | null } | null;
  category: { slug: string; name: string } | null;
  community: { slug: string; name: string; is_restricted: boolean } | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  bookmarked: boolean;
  poll: PollData | null;
  myPollVote: string | null;
  /** Client-side sample content (never exists in the database). */
  isDemo?: boolean;
};

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_comment_id: string | null;
  profile: { handle: string; avatar_url: string | null } | null;
  replies: CommentItem[];
};

export type NotifType = "like" | "comment" | "follow" | "post";

export interface NotifItem {
  id: string;
  type: NotifType;
  created_at: string;
  read_at: string | null;
  actor: { handle: string; avatar_url: string | null } | null;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  community: { slug: string } | null;
}

export interface ChatMsg {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profile: { handle: string; avatar_url: string | null } | null;
}

export type ReportTarget = "post" | "comment" | "user" | "community";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface ReportItem {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface UserPrefs {
  likes_notifs: boolean;
  comment_notifs: boolean;
  follow_notifs: boolean;
  post_notifs: boolean;
}

export const REPORT_REASONS = [
  "Doxxing / private personal data",
  "Threats or harassment",
  "Impersonation",
  "Spam or scams",
  "Leaking confidential company information",
  "Offensive / hate content",
  "Something else",
] as const;

export interface FeedTabDef {
  id: string;
  label: string;
  categorySlug?: string;
}

export const FEED_TABS: FeedTabDef[] = [
  { id: "foryou", label: "For You" },
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
  { id: "cat-confessions", label: "Confessions", categorySlug: "office-confessions" },
  { id: "cat-humor", label: "Corporate Humor", categorySlug: "corporate-memes" },
  { id: "cat-career", label: "Career Talk", categorySlug: "career-advice" },
  { id: "cat-stories", label: "Workplace Stories", categorySlug: "workplace-stories" },
  { id: "cat-questions", label: "Ask Anonymously", categorySlug: "questions" },
];

export const PAGE_SIZE = 20;
