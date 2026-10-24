"use client";

import { useEffect, useState } from "react";
import { QA_CATEGORIES } from "@/lib/blog-analyzer";
import type { MentorSummary } from "@/lib/ui-helpers";
import { Loader2, X } from "lucide-react";

interface AskQuestionModalProps {
  isOpen: boolean;
  initialTargetBloggerId: number | null;
  prefillBlogId?: string;
  prefillGrade?: string;
  mentors: MentorSummary[];
  onClose: () => void;
  onCreateQuestion: (payload: {
    targetBloggerId: number | null;
    authorNickname: string;
    authorBlogId: string;
    authorGrade: string;
    category: string;
    title: string;
    content: string;
  }) => Promise<void>;
}

const GRADES = [
  "준최2",
  "준최3",
  "준최4",
  "준최5",
  "준최6",
  "준최7",
  "최적",
  "미확인",
];

export function AskQuestionModal({
  isOpen,
  initialTargetBloggerId,
  prefillBlogId = "",
  prefillGrade = "준최2",
  mentors,
  onClose,
  onCreateQuestion,
}: AskQuestionModalProps) {
  const [targetId, setTargetId] = useState<string>(
    initialTargetBloggerId ? String(initialTargetBloggerId) : "open"
  );
  const [category, setCategory] = useState<string>("상위노출·로직");
  const [authorNickname, setAuthorNickname] = useState("");
  const [authorBlogId, setAuthorBlogId] = useState(prefillBlogId);
  const [authorGrade, setAuthorGrade] = useState(prefillGrade || "준최2");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTargetId(
        initialTargetBloggerId ? String(initialTargetBloggerId) : "open"
      );
      if (prefillBlogId) setAuthorBlogId(prefillBlogId);
      if (prefillGrade) setAuthorGrade(prefillGrade);
      setErrorMsg(null);
    }
  }, [isOpen, initialTargetBloggerId, prefillBlogId, prefillGrade]);

  if (!isOpen) return null;

  const selectedMentor =
    targetId !== "open"
      ? mentors.find((m) => m.id === Number(targetId)) ?? null
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorNickname.trim() || !title.trim() || !content.trim()) {
      setErrorMsg("닉네임, 제목, 내용을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onCreateQuestion({
        targetBloggerId: targetId === "open" ? null : Number(targetId),
        authorNickname: authorNickname.trim(),
        authorBlogId: authorBlogId.trim(),
        authorGrade,
        category,
        title: title.trim(),
        content: content.trim(),
      });
      setTitle("");
      setContent("");
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-6 right-6 rounded-full bg-[#F5F5F7] p-2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-xl font-semibold text-[#1D1D1F]">
          {selectedMentor ? `${selectedMentor.nickname}님에게 질문` : "질문 작성"}
        </h3>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
                질문 대상
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3 py-2.5 text-[13px] font-medium text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              >
                <option value="open">전체 공개 질문</option>
                {mentors.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.overallRank}위 {m.nickname} ({m.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
                주제
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3 py-2.5 text-[13px] font-medium text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              >
                {QA_CATEGORIES.filter((c) => c !== "전체").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
                닉네임
              </label>
              <input
                type="text"
                value={authorNickname}
                onChange={(e) => setAuthorNickname(e.target.value)}
                placeholder="닉네임"
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
                블로그 ID (선택)
              </label>
              <input
                type="text"
                value={authorBlogId}
                onChange={(e) => setAuthorBlogId(e.target.value)}
                placeholder="blog_id"
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3 py-2 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
                내 등급
              </label>
              <select
                value={authorGrade}
                onChange={(e) => setAuthorGrade(e.target.value)}
                className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3 py-2 text-[13px] font-medium text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="질문 제목"
              className="w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 px-3.5 py-2.5 text-[14px] text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#86868B] mb-1.5">
              내용
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="궁금한 점을 작성해 주세요."
              className="w-full resize-none rounded-xl border border-black/[0.08] bg-[#F5F5F7]/70 p-3.5 text-[14px] leading-relaxed text-[#1D1D1F] focus:border-[#0071E3] focus:bg-white focus:outline-none"
            />
          </div>

          {errorMsg && (
            <p className="text-[12px] font-medium text-red-600">{errorMsg}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0071E3] px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>등록</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
