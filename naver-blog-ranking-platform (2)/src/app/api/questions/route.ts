import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bloggers, questions, answers } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { normalizeNaverBlogId } from "@/lib/blog-analyzer";
import { asc, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureSeeded();

    const { searchParams } = new URL(request.url);
    const targetBloggerIdParam = searchParams.get("targetBloggerId");
    const category = searchParams.get("category") || "전체";
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "latest";
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    const allBloggers = await db.select().from(bloggers);
    const bloggerMap = new Map(allBloggers.map((b) => [b.id, b]));

    const allQuestions = await db
      .select()
      .from(questions)
      .orderBy(desc(questions.createdAt));

    const allAnswers = await db
      .select()
      .from(answers)
      .orderBy(asc(answers.createdAt));

    const answersByQuestion = new Map<number, typeof allAnswers>();
    for (const ans of allAnswers) {
      const list = answersByQuestion.get(ans.questionId) ?? [];
      list.push(ans);
      answersByQuestion.set(ans.questionId, list);
    }

    const filtered = allQuestions
      .map((item) => {
        const target = item.targetBloggerId
          ? bloggerMap.get(item.targetBloggerId) ?? null
          : null;
        const itemAnswers = (answersByQuestion.get(item.id) ?? []).map((a) => ({
          ...a,
          mentorBlogger: a.bloggerId
            ? bloggerMap.get(a.bloggerId) ?? null
            : null,
        }));

        return {
          ...item,
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
          answers: itemAnswers,
        };
      })
      .filter((item) => {
        if (targetBloggerIdParam && targetBloggerIdParam !== "all") {
          if (targetBloggerIdParam === "open") {
            if (item.targetBloggerId !== null) return false;
          } else {
            const tid = Number(targetBloggerIdParam);
            if (!Number.isNaN(tid) && item.targetBloggerId !== tid) {
              return false;
            }
          }
        }
        if (category !== "전체" && item.category !== category) return false;
        if (status === "resolved" && !item.isResolved) return false;
        if (status === "pending" && item.isResolved) return false;
        if (q) {
          const hay = `${item.title} ${item.content} ${item.authorNickname} ${
            item.targetBlogger?.nickname ?? ""
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

    filtered.sort((a, b) => {
      if (sort === "popular") {
        return b.likesCount - a.likesCount || b.id - a.id;
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id
      );
    });

    return NextResponse.json({ questions: filtered });
  } catch (error) {
    console.error("Failed to fetch questions:", error);
    return NextResponse.json(
      { error: "질문 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSeeded();

    const body = (await request.json()) as {
      targetBloggerId?: number | null;
      authorNickname?: string;
      authorBlogId?: string;
      authorGrade?: string;
      category?: string;
      title?: string;
      content?: string;
    };

    const authorNickname = (body.authorNickname ?? "").trim();
    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    const category = (body.category ?? "상위노출·로직").trim();

    if (!authorNickname || !title || !content) {
      return NextResponse.json(
        { error: "닉네임, 질문 제목, 질문 내용을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const cleanBlogId = body.authorBlogId
      ? normalizeNaverBlogId(body.authorBlogId)
      : null;

    let resolvedGrade = (body.authorGrade ?? "").trim() || null;
    if (!resolvedGrade && cleanBlogId) {
      const matched = await db
        .select()
        .from(bloggers)
        .where(eq(bloggers.blogId, cleanBlogId))
        .limit(1);
      if (matched[0]) {
        resolvedGrade = matched[0].grade;
      }
    }

    const targetBloggerId =
      typeof body.targetBloggerId === "number" && body.targetBloggerId > 0
        ? body.targetBloggerId
        : null;

    const inserted = await db
      .insert(questions)
      .values({
        targetBloggerId,
        authorNickname: authorNickname.slice(0, 80),
        authorBlogId: cleanBlogId || null,
        authorGrade: resolvedGrade || "준최2",
        category,
        title: title.slice(0, 200),
        content,
        likesCount: 0,
        viewsCount: 1,
        isResolved: false,
      })
      .returning();

    const created = inserted[0]!;
    let targetBlogger = null;
    if (created.targetBloggerId) {
      const bRows = await db
        .select()
        .from(bloggers)
        .where(eq(bloggers.id, created.targetBloggerId))
        .limit(1);
      if (bRows[0]) {
        const b = bRows[0];
        targetBlogger = {
          id: b.id,
          blogId: b.blogId,
          nickname: b.nickname,
          category: b.category,
          grade: b.grade,
          overallRank: b.overallRank,
          avatarColor: b.avatarColor,
        };
      }
    }

    return NextResponse.json(
      {
        question: {
          ...created,
          targetBlogger,
          answers: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create question:", error);
    return NextResponse.json(
      { error: "질문 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
