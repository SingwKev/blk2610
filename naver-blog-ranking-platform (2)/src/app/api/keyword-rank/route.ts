import { NextRequest, NextResponse } from "next/server";
import {
  checkBlogCustomKeywordRank,
  scanLiveKeywordTopBlogs,
} from "@/lib/blog-analyzer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get("keyword") ?? "").trim();
    if (!keyword || keyword.length < 2) {
      return NextResponse.json(
        { error: "검색할 키워드를 2글자 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    const items = await scanLiveKeywordTopBlogs(keyword, 6);
    return NextResponse.json({
      keyword,
      scannedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    console.error("Failed to scan live keyword top blogs:", error);
    return NextResponse.json(
      { error: "실시간 네이버 통합검색 상위 블로그 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      blogId?: string;
      keyword?: string;
    };
    const blogId = (body.blogId ?? "").trim();
    const keyword = (body.keyword ?? "").trim();

    if (!blogId || keyword.length < 2) {
      return NextResponse.json(
        { error: "블로그 ID와 2글자 이상의 검증할 키워드를 입력해 주세요." },
        { status: 400 }
      );
    }

    const result = await checkBlogCustomKeywordRank(blogId, keyword);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to check custom keyword rank:", error);
    return NextResponse.json(
      { error: "키워드 순위 재검증 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
