import { db, getDatabaseUrl } from "@/db";
import { bloggers, questions, answers } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { buildDiagnosisAdvice } from "@/app/api/analyze/route";
import { GRADE_DISTRIBUTION, TOTAL_TRACKED_BLOGS } from "@/lib/blog-analyzer";
import type {
  AnalyzeResponse,
  MentorSummary,
  PlatformStats,
  QuestionItem,
  RankedBloggerItem,
} from "@/lib/ui-helpers";
import { BlaiRankApp } from "@/components/BlaiRankApp";
import { asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!getDatabaseUrl()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] p-6">
        <div className="max-w-md rounded-[28px] border border-black/[0.06] bg-white p-8 shadow-sm">
          <div className="text-[17px] font-bold text-[#1D1D1F]">BLNK 설정 안내</div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#86868B]">
            사이트 배포가 완료되었습니다. 마지막으로 데이터베이스만 연결하면 바로 작동합니다.
          </p>
          <ol className="mt-5 space-y-2.5 text-[13px] text-[#1D1D1F]">
            <li>1. <strong>Neon(neon.tech)</strong>에서 무료 프로젝트 생성 후 <code>postgresql://...</code> 주소 복사</li>
            <li>2. Netlify의 <strong>Site configuration → Environment variables</strong> 클릭</li>
            <li>3. Key에 <code>DATABASE_URL</code>, Value에 복사한 주소 입력 후 <strong>Deploys → Trigger deploy</strong> 클릭</li>
          </ol>
        </div>
      </div>
    );
  }

  await ensureSeeded();

  const allBloggers = await db
    .select()
    .from(bloggers)
    .orderBy(asc(bloggers.overallRank));

  const allQuestions = await db
    .select()
    .from(questions)
    .orderBy(desc(questions.createdAt));

  const allAnswers = await db
    .select()
    .from(answers)
    .orderBy(asc(answers.createdAt));

  const bloggerMap = new Map(allBloggers.map((b) => [b.id, b]));

  const questionCountMap = new Map<number, number>();
  for (const q of allQuestions) {
    if (q.targetBloggerId) {
      questionCountMap.set(
        q.targetBloggerId,
        (questionCountMap.get(q.targetBloggerId) ?? 0) + 1
      );
    }
  }

  const answerCountMap = new Map<number, number>();
  for (const a of allAnswers) {
    if (a.bloggerId) {
      answerCountMap.set(
        a.bloggerId,
        (answerCountMap.get(a.bloggerId) ?? 0) + 1
      );
    }
  }

  const topBloggers: RankedBloggerItem[] = allBloggers
    .filter((b) => b.isTopRanker)
    .map((b) => ({
      ...b,
      questionCount: questionCountMap.get(b.id) ?? 0,
      mentorAnswerCount: answerCountMap.get(b.id) ?? 0,
    }));

  const mentors: MentorSummary[] = topBloggers.map((b) => ({
    id: b.id,
    blogId: b.blogId,
    nickname: b.nickname,
    category: b.category,
    grade: b.grade,
    overallRank: b.overallRank,
    avatarColor: b.avatarColor,
    responseRate: b.responseRate,
  }));

  const recentAnalyzed = allBloggers
    .filter((b) => !b.isTopRanker)
    .sort(
      (a, b) =>
        new Date(b.lastAnalyzedAt).getTime() -
        new Date(a.lastAnalyzedAt).getTime()
    )
    .slice(0, 8);

  const answersByQuestion = new Map<number, QuestionItem["answers"]>();
  for (const ans of allAnswers) {
    const list = answersByQuestion.get(ans.questionId) ?? [];
    list.push({
      id: ans.id,
      questionId: ans.questionId,
      bloggerId: ans.bloggerId,
      authorNickname: ans.authorNickname,
      authorBadge: ans.authorBadge,
      isMentorAnswer: ans.isMentorAnswer,
      content: ans.content,
      likesCount: ans.likesCount,
      createdAt: ans.createdAt.toISOString(),
    });
    answersByQuestion.set(ans.questionId, list);
  }

  const enrichedQuestions: QuestionItem[] = allQuestions.map((q) => {
    const target = q.targetBloggerId
      ? bloggerMap.get(q.targetBloggerId) ?? null
      : null;
    return {
      id: q.id,
      targetBloggerId: q.targetBloggerId,
      authorNickname: q.authorNickname,
      authorBlogId: q.authorBlogId,
      authorGrade: q.authorGrade,
      category: q.category,
      title: q.title,
      content: q.content,
      likesCount: q.likesCount,
      viewsCount: q.viewsCount,
      isResolved: q.isResolved,
      createdAt: q.createdAt.toISOString(),
      targetBlogger: target
        ? {
            id: target.id,
            blogId: target.blogId,
            nickname: target.nickname,
            category: target.category,
            grade: target.grade,
            overallRank: target.overallRank,
            avatarColor: target.avatarColor,
          }
        : null,
      answers: answersByQuestion.get(q.id) ?? [],
    };
  });

  const stats: PlatformStats = {
    totalTrackedBlogs: TOTAL_TRACKED_BLOGS + recentAnalyzed.length,
    gradeDistribution: GRADE_DISTRIBUTION,
    totalQuestions: allQuestions.length,
    resolvedQuestions: allQuestions.filter((q) => q.isResolved).length,
    totalAnswers: allAnswers.length,
  };

  const featuredTop1 = topBloggers[0] ?? null;
  const initialFeaturedAnalysis: AnalyzeResponse | null = featuredTop1
    ? {
        blog: featuredTop1,
        dataSource: "naver-live-verified",
        advice: buildDiagnosisAdvice(featuredTop1),
      }
    : null;

  return (
    <BlaiRankApp
      initialTopBloggers={topBloggers}
      initialMentors={mentors}
      initialRecentAnalyzed={recentAnalyzed}
      initialQuestions={enrichedQuestions}
      initialStats={stats}
      initialFeaturedAnalysis={initialFeaturedAnalysis}
    />
  );
}
