"use client";

import { useMemo, useState } from "react";
import { QA_CATEGORIES } from "@/lib/blog-analyzer";
import {
  type MentorSummary,
  type QuestionItem,
  formatDateTimeKo,
} from "@/lib/ui-helpers";
import { ChevronDown, ChevronUp, Loader2, ThumbsUp } from "lucide-react";

interface QaLoungeSectionProps {
  questions: QuestionItem[];
  mentors: MentorSummary[];
  onOpenAskModal: (targetBloggerId?: number | null) => void;
  onSubmitAnswer: (
    questionId: number,
    payload: {
      bloggerId?: number | null;
      authorNickname?: string;
      content: string;
    }
  ) => Promise<void>;
  onLikeQuestion: (questionId: number, answerId?: number) => Promise<void>;
}

export function QaLoungeSection({
  questions,
  mentors,
  onOpenAskModal,
  onSubmitAnswer,
  onLikeQuestion,
}: QaLoungeSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [selectedMentorFilter, setSelectedMentorFilter] =
    useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [answerDrafts, setAnswerDrafts] = useState<
    Record<
      number,
      {
        mode: "community" | "mentor";
        mentorId: number;
        nickname: string;
        content: string;
        submitting: boolean;
      }
    >
  >({});

  const filteredQuestions = useMemo(() => {
    return questions.filter((item) => {
      if (selectedCategory !== "전체" && item.category !== selectedCategory) {
        return false;
      }
      if (
        selectedMentorFilter !== "all" &&
        item.targetBloggerId !== Number(selectedMentorFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [questions, selectedCategory, selectedMentorFilter]);

  const isExpanded = (q: QuestionItem, idx: number): boolean => {
    if (q.id in expandedIds) return Boolean(expandedIds[q.id]);
    return idx < 2;
  };

  const toggleExpand = (q: QuestionItem, idx: number) => {
    const curr = isExpanded(q, idx);
    setExpandedIds((prev) => ({ ...prev, [q.id]: !curr }));
  };

  const getDraft = (q: QuestionItem) => {
    return (
      answerDrafts[q.id] ?? {
        mode: q.targetBloggerId ? "mentor" : "community",
        mentorId: q.targetBloggerId ?? mentors[0]?.id ?? 1,
        nickname: "",
        content: "",
        submitting: false,
      }
    );
  };

  const updateDraft = (
    q: QuestionItem,
    patch: Partial<ReturnType<typeof getDraft>>
  ) => {
    const base = getDraft(q);
    setAnswerDrafts((prev) => ({ ...prev, [q.id]: { ...base, ...patch } }));
  };

  const handleAnswerSubmit = async (e: React.FormEvent, q: QuestionItem) => {
    e.preventDefault();
    const draft = getDraft(q);
    if (!draft.content.trim() || draft.submitting) return;
    updateDraft(q, { submitting: true });
    try {
      await onSubmitAnswer(q.id, {
        bloggerId: draft.mode === "mentor" ? draft.mentorId : null,
        authorNickname:
          draft.mode === "community"
            ? draft.nickname.trim() || "익명 블로거"
            : undefined,
        content: draft.content.trim(),
      });
      setAnswerDrafts((prev) => ({
        ...prev,
        [q.id]: { ...draft, content: "", submitting: false },
      }));
      setExpandedIds((prev) => ({ ...prev, [q.id]: true }));
    } catch {
      updateDraft(q, { submitting: false });
    }
  };

  return (
    <section className="pt-12 pb-20 sm:pt-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Clean Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              블로거 Q&A
            </h1>
            <p className="mt-1.5 text-[14px] text-[#86868B]">
              상위 블로거에게 운영 고민을 질문하고 답변을 받아보세요.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenAskModal(
                selectedMentorFilter !== "all"
                  ? Number(selectedMentorFilter)
                  : null
              )
            }
            className="shrink-0 rounded-full bg-[#0071E3] px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            새 질문 작성
          </button>
        </div>

        {/* Clean Filters */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {QA_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[#1D1D1F] text-white"
                      : "bg-white text-[#86868B] border border-black/[0.05] hover:text-[#1D1D1F]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <select
            value={selectedMentorFilter}
            onChange={(e) => setSelectedMentorFilter(e.target.value)}
            aria-label="멘토별 질문 보기"
            className="rounded-full border border-black/[0.06] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none"
          >
            <option value="all">모든 멘토 질문</option>
            {mentors.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.overallRank}위 {m.nickname}
              </option>
            ))}
          </select>
        </div>

        {/* Question Cards */}
        <div className="mt-6 space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-[24px] bg-white py-16 text-center text-[14px] text-[#86868B] border border-black/[0.05]">
              아직 등록된 질문이 없습니다.
            </div>
          ) : (
            filteredQuestions.map((q, index) => {
              const expanded = isExpanded(q, index);
              const draft = getDraft(q);

              return (
                <article
                  key={q.id}
                  className="rounded-[24px] border border-black/[0.05] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgb(0,0,0,0.02)]"
                >
                  {/* Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#86868B]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          q.isResolved ? "text-[#0071E3]" : "text-[#86868B]"
                        }`}
                      >
                        {q.isResolved ? "답변완료" : "대기중"}
                      </span>
                      <span>·</span>
                      <span>{q.category}</span>
                      {q.targetBlogger && (
                        <>
                          <span>·</span>
                          <span className="font-medium text-[#1D1D1F]">
                            To. {q.targetBlogger.nickname}
                          </span>
                        </>
                      )}
                    </div>
                    <span>{formatDateTimeKo(q.createdAt)}</span>
                  </div>

                  {/* Title & Body */}
                  <h2
                    onClick={() => toggleExpand(q, index)}
                    className="mt-2.5 text-[17px] font-semibold text-[#1D1D1F] cursor-pointer hover:text-[#0071E3]"
                  >
                    {q.title}
                  </h2>

                  <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#1D1D1F]/80">
                    {q.content}
                  </p>

                  {/* Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-black/[0.05] pt-4 text-[12px] text-[#86868B]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[#1D1D1F]">
                        {q.authorNickname}
                      </span>
                      {q.authorGrade && <span>· {q.authorGrade}</span>}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onLikeQuestion(q.id)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] cursor-pointer"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span className="font-num">{q.likesCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpand(q, index)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] cursor-pointer"
                      >
                        <span>답변 {q.answers.length}</span>
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Thread */}
                  {expanded && (
                    <div className="mt-4 space-y-3 rounded-2xl bg-[#F5F5F7]/75 p-4 sm:p-5">
                      {q.answers.map((ans) => (
                        <div
                          key={ans.id}
                          className="rounded-xl bg-white p-4 border border-black/[0.04]"
                        >
                          <div className="flex items-center justify-between text-[12px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1D1D1F]">
                                {ans.authorNickname}
                              </span>
                              {ans.isMentorAnswer ? (
                                <span className="rounded-full bg-[#0071E3]/10 px-2 py-0.5 text-[11px] font-medium text-[#0071E3]">
                                  {ans.authorBadge}
                                </span>
                              ) : (
                                <span className="text-[#86868B]">
                                  {ans.authorBadge}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onLikeQuestion(q.id, ans.id)}
                              className="inline-flex items-center gap-1 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                            >
                              <ThumbsUp className="h-3 w-3" />
                              <span className="font-num">{ans.likesCount}</span>
                            </button>
                          </div>

                          <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-[#1D1D1F]/85">
                            {ans.content}
                          </p>
                        </div>
                      ))}

                      {/* Minimal Reply Input */}
                      <form
                        onSubmit={(e) => handleAnswerSubmit(e, q)}
                        className="pt-1 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                          <div className="inline-flex rounded-full bg-white p-0.5 border border-black/[0.05]">
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(q, { mode: "community" })
                              }
                              className={`rounded-full px-3 py-1 font-medium cursor-pointer ${
                                draft.mode === "community"
                                  ? "bg-[#1D1D1F] text-white"
                                  : "text-[#86868B]"
                              }`}
                            >
                              일반 답변
                            </button>
                            <button
                              type="button"
                              onClick={() => updateDraft(q, { mode: "mentor" })}
                              className={`rounded-full px-3 py-1 font-medium cursor-pointer ${
                                draft.mode === "mentor"
                                  ? "bg-[#0071E3] text-white"
                                  : "text-[#86868B]"
                              }`}
                            >
                              멘토 답변
                            </button>
                          </div>

                          {draft.mode === "mentor" ? (
                            <select
                              value={draft.mentorId}
                              onChange={(e) =>
                                updateDraft(q, {
                                  mentorId: Number(e.target.value),
                                })
                              }
                              aria-label="멘토 선택"
                              className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12px] font-medium text-[#1D1D1F] focus:outline-none"
                            >
                              {mentors.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.overallRank}위 {m.nickname}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={draft.nickname}
                              onChange={(e) =>
                                updateDraft(q, { nickname: e.target.value })
                              }
                              placeholder="닉네임"
                              className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12px] text-[#1D1D1F] focus:outline-none"
                            />
                          )}
                        </div>

                        <div className="flex gap-2">
                          <textarea
                            rows={2}
                            value={draft.content}
                            onChange={(e) =>
                              updateDraft(q, { content: e.target.value })
                            }
                            placeholder="답변 내용을 입력하세요"
                            className="flex-1 resize-none rounded-2xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={draft.submitting || !draft.content.trim()}
                            className="self-end rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40 cursor-pointer"
                          >
                            {draft.submitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "등록"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
