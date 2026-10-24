import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bloggers, questions, answers } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { GRADE_DISTRIBUTION, TOTAL_TRACKED_BLOGS } from "@/lib/blog-analyzer";
import { asc, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "전체";
    const grade = searchParams.get("grade") || "전체";
    const sort = searchParams.get("sort") || "rank";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const allBloggers = await db
      .select()
      .from(bloggers)
      .orderBy(asc(bloggers.overallRank));

    const allQuestions = await db.select().from(questions);
    const allAnswers = await db.select().from(answers);

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

    const enrichedTop = allBloggers
      .filter((b) => b.isTopRanker)
      .map((b) => ({
        ...b,
        questionCount: questionCountMap.get(b.id) ?? 0,
        mentorAnswerCount: answerCountMap.get(b.id) ?? 0,
      }))
      .filter((b) => {
        if (category !== "전체" && b.category !== category) return false;
        if (grade !== "전체") {
          if (grade === "최적·NB") {
            if (b.grade !== "최적" && b.grade !== "NB") return false;
          } else if (grade === "준최7~5") {
            if (!["준최7", "준최6", "준최5"].includes(b.grade)) return false;
          } else if (b.grade !== grade) {
            return false;
          }
        }
        if (search) {
          const hay =
            `${b.nickname} ${b.blogId} ${b.blogTitle} ${b.category} ${b.specialtyTags.join(" ")}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

    enrichedTop.sort((a, b) => {
      if (sort === "score") return b.exposureScore - a.exposureScore;
      if (sort === "visitors") return b.dailyVisitors - a.dailyVisitors;
      if (sort === "answers") {
        return (
          b.mentorAnswerCount +
          b.questionCount -
          (a.mentorAnswerCount + a.questionCount)
        );
      }
      return a.overallRank - b.overallRank;
    });

    const recentAnalyzed = await db
      .select()
      .from(bloggers)
      .where(eq(bloggers.isTopRanker, false))
      .orderBy(desc(bloggers.lastAnalyzedAt))
      .limit(8);

    const resolvedCount = allQuestions.filter((q) => q.isResolved).length;

    return NextResponse.json({
      topBloggers: enrichedTop,
      allTopMentors: allBloggers
        .filter((b) => b.isTopRanker)
        .map((b) => ({
          id: b.id,
          blogId: b.blogId,
          nickname: b.nickname,
          category: b.category,
          grade: b.grade,
          overallRank: b.overallRank,
          avatarColor: b.avatarColor,
          responseRate: b.responseRate,
        })),
      recentAnalyzed,
      stats: {
        totalTrackedBlogs: TOTAL_TRACKED_BLOGS + recentAnalyzed.length,
        gradeDistribution: GRADE_DISTRIBUTION,
        totalQuestions: allQuestions.length,
        resolvedQuestions: resolvedCount,
        totalAnswers: allAnswers.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch rankings:", error);
    return NextResponse.json(
      { error: "랭킹 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
