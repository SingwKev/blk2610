import {
  pgTable,
  serial,
  varchar,
  integer,
  bigint,
  doublePrecision,
  boolean,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export interface DailyVisitorPoint {
  date: string;
  count: number;
}

export interface BlogPostDiagnostic {
  logNo?: string;
  title: string;
  keyword: string;
  competingDocs?: number; // 네이버 해당 키워드 경쟁 문서 수 (실측)
  publishedAt: string;
  url: string;
  status: "통검 상위노출" | "블로그탭 노출" | "일반 색인" | "검색 누락";
  searchRank: number | null;
  blogTabRank?: number | null;
  isIndexed?: boolean;
  charCount: number; // 실제 공백 제외 글자수
  charCountWithSpaces?: number; // 실제 공백 포함 글자수
  imageCount: number; // 실제 본문 이미지 개수 (thumbnailCount)
  commentCount?: number; // 실제 댓글 수
  sympathyCount?: number; // 실제 공감(좋아요) 수
  score: number;
}

export const bloggers = pgTable("bloggers", {
  id: serial("id").primaryKey(),
  blogId: varchar("blog_id", { length: 100 }).notNull().unique(),
  nickname: varchar("nickname", { length: 100 }).notNull(),
  blogTitle: varchar("blog_title", { length: 200 }).notNull(),
  profileImageUrl: text("profile_image_url").notNull().default(""),
  avatarColor: varchar("avatar_color", { length: 60 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  officialDirectory: varchar("official_directory", { length: 80 })
    .notNull()
    .default(""),
  grade: varchar("grade", { length: 30 }).notNull(),
  overallRank: integer("overall_rank").notNull(),
  rankChange: integer("rank_change").notNull().default(0),
  topPercent: doublePrecision("top_percent").notNull(),
  exposureScore: doublePrecision("exposure_score").notNull(),
  cRankScore: doublePrecision("c_rank_score").notNull(),
  diaScore: doublePrecision("dia_score").notNull(),
  topKeywordsCount: integer("top_keywords_count").notNull().default(0),
  homeFeedCount: integer("home_feed_count").notNull().default(0),
  dailyVisitors: integer("daily_visitors").notNull().default(0), // 최근 일평균 방문자 (실측)
  todayVisitors: integer("today_visitors").notNull().default(0), // 오늘 실시간 방문자 (실측)
  totalVisitors: bigint("total_visitors", { mode: "number" })
    .notNull()
    .default(0), // 누적 총 방문자 (실측)
  visitorWidgetPublic: boolean("visitor_widget_public").notNull().default(true),
  visitorHistory: jsonb("visitor_history")
    .$type<DailyVisitorPoint[]>()
    .notNull()
    .default([]),
  subscriberCount: integer("subscriber_count").notNull().default(0), // 이웃/구독자 수 (실측)
  totalPosts: integer("total_posts").notNull().default(0), // 전체 공개 게시글 수 (실측)
  isInfluencer: boolean("is_influencer").notNull().default(false),
  isTopRanker: boolean("is_top_ranker").notNull().default(false),
  acceptsQuestions: boolean("accepts_questions").notNull().default(true),
  responseRate: integer("response_rate").notNull().default(95),
  bio: text("bio").notNull().default(""),
  specialtyTags: jsonb("specialty_tags").$type<string[]>().notNull().default([]),
  recentPosts: jsonb("recent_posts")
    .$type<BlogPostDiagnostic[]>()
    .notNull()
    .default([]),
  dataSourceType: varchar("data_source_type", { length: 40 })
    .notNull()
    .default("naver-live-verified"),
  searchCount: integer("search_count").notNull().default(1),
  lastAnalyzedAt: timestamp("last_analyzed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  targetBloggerId: integer("target_blogger_id").references(() => bloggers.id, {
    onDelete: "set null",
  }),
  authorNickname: varchar("author_nickname", { length: 80 }).notNull(),
  authorBlogId: varchar("author_blog_id", { length: 100 }),
  authorGrade: varchar("author_grade", { length: 30 }),
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  viewsCount: integer("views_count").notNull().default(0),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  bloggerId: integer("blogger_id").references(() => bloggers.id, {
    onDelete: "set null",
  }),
  authorNickname: varchar("author_nickname", { length: 80 }).notNull(),
  authorBadge: varchar("author_badge", { length: 80 })
    .notNull()
    .default("일반 블로거"),
  isMentorAnswer: boolean("is_mentor_answer").notNull().default(false),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Blogger = typeof bloggers.$inferSelect;
export type NewBlogger = typeof bloggers.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
