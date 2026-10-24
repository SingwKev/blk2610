"use client";

import {
  type QuestionItem,
  type RankedBloggerItem,
  formatKoreanCompact,
  getGradeBadgeStyle,
  getPostStatusStyle,
} from "@/lib/ui-helpers";
import { ArrowUpRight, X } from "lucide-react";

interface BloggerDetailModalProps {
  blogger: RankedBloggerItem | null;
  relatedQuestions: QuestionItem[];
  onClose: () => void;
  onAskThisBlogger: (bloggerId: number) => void;
}

export function BloggerDetailModal({
  blogger,
  relatedQuestions,
  onClose,
  onAskThisBlogger,
}: BloggerDetailModalProps) {
  if (!blogger) return null;

  const gStyle = getGradeBadgeStyle(blogger.grade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-6 right-6 rounded-full bg-[#F5F5F7] p-2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 pr-8">
          {blogger.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blogger.profileImageUrl}
              alt={blogger.nickname}
              className="h-14 w-14 shrink-0 rounded-full border border-black/[0.06] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-lg font-semibold text-white">
              {blogger.nickname.slice(0, 1)}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-num text-[12px] font-semibold text-[#0071E3]">
                {blogger.overallRank}위
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${gStyle.bg} ${gStyle.text}`}
              >
                {blogger.grade}
              </span>
              <span className="text-[12px] text-[#86868B]">
                {blogger.category}
              </span>
            </div>
            <h3 className="mt-1 text-xl font-semibold text-[#1D1D1F]">
              {blogger.nickname}
            </h3>
            <a
              href={`https://blog.naver.com/${blogger.blogId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[13px] text-[#86868B] hover:text-[#1D1D1F]"
            >
              <span>{blogger.blogTitle}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Clean Metrics */}
        <div className="mt-6 grid grid-cols-4 gap-2.5">
          <div className="rounded-2xl bg-[#F5F5F7]/80 p-3.5 text-center">
            <div className="text-[11px] text-[#86868B]">일평균 방문</div>
            <div className="font-num mt-1 text-[15px] font-semibold text-[#1D1D1F]">
              {formatKoreanCompact(blogger.dailyVisitors)}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F5F5F7]/80 p-3.5 text-center">
            <div className="text-[11px] text-[#86868B]">누적 방문</div>
            <div className="font-num mt-1 text-[15px] font-semibold text-[#1D1D1F]">
              {formatKoreanCompact(blogger.totalVisitors)}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F5F5F7]/80 p-3.5 text-center">
            <div className="text-[11px] text-[#86868B]">이웃</div>
            <div className="font-num mt-1 text-[15px] font-semibold text-[#1D1D1F]">
              {formatKoreanCompact(blogger.subscriberCount)}
            </div>
          </div>
          <div className="rounded-2xl bg-[#F5F5F7]/80 p-3.5 text-center">
            <div className="text-[11px] text-[#86868B]">점수</div>
            <div className="font-num mt-1 text-[15px] font-semibold text-[#0071E3]">
              {blogger.exposureScore.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        {blogger.recentPosts.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[13px] font-semibold text-[#1D1D1F]">
              최근 발행 글
            </h4>
            <div className="mt-2.5 divide-y divide-black/[0.05] rounded-2xl border border-black/[0.05] px-4">
              {blogger.recentPosts.map((p, idx) => {
                const st = getPostStatusStyle(p.status);
                return (
                  <a
                    key={idx}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 py-3 text-[13px] hover:text-[#0071E3]"
                  >
                    <span className="truncate font-medium text-[#1D1D1F]">
                      {p.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.badge}`}
                    >
                      {st.label}
                      {p.searchRank ? ` ${p.searchRank}위` : ""}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Related Questions */}
        {relatedQuestions.length > 0 && (
          <div className="mt-6">
            <h4 className="text-[13px] font-semibold text-[#1D1D1F]">
              받은 질문 ({relatedQuestions.length})
            </h4>
            <div className="mt-2.5 space-y-2">
              {relatedQuestions.slice(0, 2).map((q) => (
                <div
                  key={q.id}
                  className="rounded-2xl bg-[#F5F5F7]/80 p-3.5 text-[13px]"
                >
                  <div className="font-medium text-[#1D1D1F]">{q.title}</div>
                  {q.answers[0] && (
                    <p className="mt-1 line-clamp-2 text-[12px] text-[#86868B]">
                      {q.answers[0].content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onAskThisBlogger(blogger.id);
            }}
            className="rounded-full bg-[#0071E3] px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            질문 남기기
          </button>
        </div>
      </div>
    </div>
  );
}
