import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answers } from "@/db/schema";
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
        { error: "유효하지 않은 번호입니다." },
        { status: 400 }
      );
    }

    let answerId: number | null = null;
    try {
      const body = (await request.json()) as { answerId?: number };
      if (typeof body?.answerId === "number") {
        answerId = body.answerId;
      }
    } catch {
      // Empty body means question like
    }

    if (answerId && answerId > 0) {
      const updated = await db
        .update(answers)
        .set({ likesCount: sql`${answers.likesCount} + 1` })
        .where(eq(answers.id, answerId))
        .returning();
      return NextResponse.json({
        likesCount: updated[0]?.likesCount ?? 0,
      });
    }

    const updated = await db
      .update(questions)
      .set({ likesCount: sql`${questions.likesCount} + 1` })
      .where(eq(questions.id, questionId))
      .returning();

    return NextResponse.json({
      likesCount: updated[0]?.likesCount ?? 0,
    });
  } catch (error) {
    console.error("Failed to like:", error);
    return NextResponse.json(
      { error: "공감 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
