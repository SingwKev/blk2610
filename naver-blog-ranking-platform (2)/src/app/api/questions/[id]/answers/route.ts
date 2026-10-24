import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bloggers, questions, answers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const questionId = Number(id);
    if (Number.isNaN(questionId) || questionId <= 0) {
      return NextResponse.json(
        { error: "유효하지 않은 질문 번호입니다." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      bloggerId?: number | null;
      authorNickname?: string;
      authorBadge?: string;
      content?: string;
    };

    const content = (body.content ?? "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "답변 내용을 입력해 주세요." },
        { status: 400 }
      );
    }

    let finalNickname = (body.authorNickname ?? "").trim() || "익명 블로거";
    let finalBadge = (body.authorBadge ?? "").trim() || "커뮤니티 블로거";
    let isMentorAnswer = false;
    let mentorRecord = null;

    if (typeof body.bloggerId === "number" && body.bloggerId > 0) {
      const bRows = await db
        .select()
        .from(bloggers)
        .where(eq(bloggers.id, body.bloggerId))
        .limit(1);
      if (bRows[0]) {
        mentorRecord = bRows[0];
        finalNickname = mentorRecord.nickname;
        finalBadge = `종합 ${mentorRecord.overallRank}위 · ${mentorRecord.grade} 멘토`;
        isMentorAnswer = true;
      }
    }

    const inserted = await db
      .insert(answers)
      .values({
        questionId,
        bloggerId: mentorRecord ? mentorRecord.id : null,
        authorNickname: finalNickname.slice(0, 80),
        authorBadge: finalBadge.slice(0, 80),
        isMentorAnswer,
        content,
        likesCount: 0,
      })
      .returning();

    if (isMentorAnswer) {
      await db
        .update(questions)
        .set({
          isResolved: true,
          viewsCount: sql`${questions.viewsCount} + 1`,
        })
        .where(eq(questions.id, questionId));
    } else {
      await db
        .update(questions)
        .set({
          viewsCount: sql`${questions.viewsCount} + 1`,
        })
        .where(eq(questions.id, questionId));
    }

    return NextResponse.json(
      {
        answer: {
          ...inserted[0]!,
          mentorBlogger: mentorRecord,
        },
        isResolved: isMentorAnswer ? true : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create answer:", error);
    return NextResponse.json(
      { error: "답변 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
