import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bloggers, type Blogger } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  analyzeNaverBlogById,
  normalizeNaverBlogId,
} from "@/lib/blog-analyzer";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export function buildDiagnosisAdvice(blog: Blogger): string[] {
  const tips: string[] = [];

  const missingCount = blog.recentPosts.filter(
    (p) => p.status === "검색 누락"
  ).length;
  const unifiedCount = blog.recentPosts.filter(
    (p) => p.status === "통검 상위노출"
  ).length;

  if (missingCount > 0) {
    tips.push(
      `최근 글 ${blog.recentPosts.length}건 중 ${missingCount}건이 검색에 잡히지 않습니다. 발행 직후 색인 대기 중이거나 상업성 표현 확인이 필요합니다.`
    );
  } else if (unifiedCount > 0) {
    tips.push(
      `최근 글 ${blog.recentPosts.length}건 중 ${unifiedCount}건이 상위 노출되고 있습니다.`
    );
  } else {
    tips.push(
      `최근 글 모두 정상 색인되어 있습니다. 3~4어절 세부 키워드를 제목 앞쪽에 배치하면 상위 진입에 유리합니다.`
    );
  }

  if (blog.recentPosts.length > 0) {
    const avgChars = Math.round(
      blog.recentPosts.reduce((a, p) => a + p.charCount, 0) /
        blog.recentPosts.length
    );
    const avgImgs = Math.round(
      blog.recentPosts.reduce((a, p) => a + p.imageCount, 0) /
        blog.recentPosts.length
    );
    tips.push(
      `최근 포스팅 평균 분량은 공백 제외 ${avgChars.toLocaleString(
        "ko-KR"
      )}자, 이미지 ${avgImgs}장입니다.${
        avgChars < 1200 ? " 1,500자 내외로 본문 밀도를 높여보세요." : ""
      }`
    );
  }

  return tips;
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();

    const body = (await request.json()) as { blogInput?: string };
    const rawInput = body.blogInput ?? "";
    const inputId = normalizeNaverBlogId(rawInput);

    if (!inputId || inputId.length < 2) {
      return NextResponse.json(
        {
          error:
            "올바른 네이버 블로그 아이디(예: chooravel, naverofficial) 또는 블로그 주소를 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const analyzed = await analyzeNaverBlogById(inputId, {
      verifySearch: true,
      postLimit: 5,
    });

    if (!analyzed) {
      return NextResponse.json(
        {
          error: `'${inputId}' 아이디의 네이버 블로그를 찾을 수 없습니다. 실제 운영 중인 네이버 블로그 ID 또는 URL인지 확인해 주세요.`,
        },
        { status: 404 }
      );
    }

    const existingRows = await db
      .select()
      .from(bloggers)
      .where(eq(bloggers.blogId, analyzed.blogId))
      .limit(1);

    const existing = existingRows[0];

    let savedRecord: Blogger;
    if (existing) {
      const updated = await db
        .update(bloggers)
        .set({
          nickname: analyzed.nickname,
          blogTitle: analyzed.blogTitle,
          profileImageUrl: analyzed.profileImageUrl,
          officialDirectory: analyzed.officialDirectory,
          category: existing.isTopRanker ? existing.category : analyzed.category,
          grade: analyzed.grade,
          overallRank: existing.isTopRanker
            ? existing.overallRank
            : analyzed.overallRank,
          topPercent: analyzed.topPercent,
          exposureScore: analyzed.exposureScore,
          cRankScore: analyzed.cRankScore,
          diaScore: analyzed.diaScore,
          topKeywordsCount: analyzed.topKeywordsCount,
          homeFeedCount: analyzed.homeFeedCount,
          dailyVisitors: analyzed.dailyVisitors,
          todayVisitors: analyzed.todayVisitors,
          totalVisitors: analyzed.totalVisitors,
          visitorWidgetPublic: analyzed.visitorWidgetPublic,
          visitorHistory: analyzed.visitorHistory,
          subscriberCount: analyzed.subscriberCount,
          totalPosts: analyzed.totalPosts,
          isInfluencer: analyzed.isInfluencer,
          bio: existing.isTopRanker ? existing.bio : analyzed.bio,
          specialtyTags: analyzed.specialtyTags,
          recentPosts: analyzed.recentPosts,
          dataSourceType: "naver-live-verified",
          searchCount: sql`${bloggers.searchCount} + 1`,
          lastAnalyzedAt: new Date(),
        })
        .where(eq(bloggers.id, existing.id))
        .returning();
      savedRecord = updated[0]!;
    } else {
      const inserted = await db
        .insert(bloggers)
        .values({
          blogId: analyzed.blogId,
          nickname: analyzed.nickname,
          blogTitle: analyzed.blogTitle,
          profileImageUrl: analyzed.profileImageUrl,
          avatarColor: analyzed.avatarColor,
          category: analyzed.category,
          officialDirectory: analyzed.officialDirectory,
          grade: analyzed.grade,
          overallRank: analyzed.overallRank,
          rankChange: 0,
          topPercent: analyzed.topPercent,
          exposureScore: analyzed.exposureScore,
          cRankScore: analyzed.cRankScore,
          diaScore: analyzed.diaScore,
          topKeywordsCount: analyzed.topKeywordsCount,
          homeFeedCount: analyzed.homeFeedCount,
          dailyVisitors: analyzed.dailyVisitors,
          todayVisitors: analyzed.todayVisitors,
          totalVisitors: analyzed.totalVisitors,
          visitorWidgetPublic: analyzed.visitorWidgetPublic,
          visitorHistory: analyzed.visitorHistory,
          subscriberCount: analyzed.subscriberCount,
          totalPosts: analyzed.totalPosts,
          isInfluencer: analyzed.isInfluencer,
          isTopRanker: false,
          acceptsQuestions: false,
          responseRate: 0,
          bio: analyzed.bio,
          specialtyTags: analyzed.specialtyTags,
          recentPosts: analyzed.recentPosts,
          dataSourceType: "naver-live-verified",
          searchCount: 1,
        })
        .returning();
      savedRecord = inserted[0]!;
    }

    return NextResponse.json({
      blog: savedRecord,
      dataSource: "naver-live-verified",
      advice: buildDiagnosisAdvice(savedRecord),
    });
  } catch (error) {
    console.error("Failed to analyze blog:", error);
    return NextResponse.json(
      { error: "블로그 실측 진단 중 일시적인 오류가 발생했습니다. 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
