"use client";

import { useMemo, useState } from "react";
import { BLOG_CATEGORIES, type LiveKeywordRankItem } from "@/lib/blog-analyzer";
import {
  type RankedBloggerItem,
  formatKoreanCompact,
  getGradeBadgeStyle,
} from "@/lib/ui-helpers";
import { ArrowUpRight, Loader2, Search } from "lucide-react";

interface LeaderboardSectionProps {
  bloggers: RankedBloggerItem[];
  onSelectBloggerDetail: (blogger: RankedBloggerItem) => void;
  onAskBlogger: (bloggerId: number) => void;
  onAnalyzeBlogger: (blogId: string) => void;
}

export function LeaderboardSection({
  bloggers,
  onSelectBloggerDetail,
  onAskBlogger,
  onAnalyzeBlogger,
}: LeaderboardSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [sortBy, setSortBy] = useState<"rank" | "visitors" | "score">("rank");
  const [searchQuery, setSearchQuery] = useState("");

  // Optional clean live keyword search inside Ranking tab
  const [kwInput, setKwInput] = useState("");
  const [kwItems, setKwItems] = useState<LiveKeywordRankItem[]>([]);
  const [kwLoading, setKwLoading] = useState(false);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = bloggers.filter((b) => {
      if (selectedCategory !== "전체" && b.category !== selectedCategory) {
        return false;
      }
      if (q) {
        const hay = `${b.nickname} ${b.blogId} ${b.blogTitle} ${b.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "visitors") return b.dailyVisitors - a.dailyVisitors;
      if (sortBy === "score") return b.exposureScore - a.exposureScore;
      return a.overallRank - b.overallRank;
    });
  }, [bloggers, selectedCategory, sortBy, searchQuery]);

  const handleKeywordScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kwInput.trim() || kwLoading) return;
    setKwLoading(true);
    try {
      const res = await fetch(
        `/api/keyword-rank?keyword=${encodeURIComponent(kwInput.trim())}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setKwItems(data.items || []);
      }
    } finally {
      setKwLoading(false);
    }
  };

  return (
    <section className="pt-12 pb-20 sm:pt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Clean Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              상위 블로거 랭킹
            </h1>
            <p className="mt-1.5 text-[14px] text-[#86868B]">
              분야별 상위 블로거 순위를 확인하고 직접 질문해 보세요.
            </p>
          </div>

          <div className="inline-flex rounded-full bg-white border border-black/[0.06] p-1 self-start sm:self-auto">
            {[
              { id: "rank", label: "종합순" },
              { id: "visitors", label: "방문자순" },
              { id: "score", label: "점수순" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setSortBy(s.id as "rank" | "visitors" | "score")
                }
                className={`rounded-full px-3.5 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                  sortBy === s.id
                    ? "bg-[#1D1D1F] text-white"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills + Search */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {BLOG_CATEGORIES.map((cat) => {
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

          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[#86868B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="블로거 검색"
              className="w-full rounded-full border border-black/[0.06] bg-white py-1.5 pr-3.5 pl-9 text-[13px] text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none"
            />
          </div>
        </div>

        {/* Minimal Apple List Card */}
        <div className="mt-5 overflow-hidden rounded-[24px] border border-black/[0.05] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          {filteredList.length === 0 ? (
            <div className="py-16 text-center text-[14px] text-[#86868B]">
              해당하는 블로거가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {filteredList.map((b) => {
                const gStyle = getGradeBadgeStyle(b.grade);
                return (
                  <div
                    key={b.id}
                    className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[#F5F5F7]/50 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5"
                  >
                    {/* Left: Rank + Avatar + Name */}
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-num w-6 shrink-0 text-center text-[15px] font-semibold text-[#1D1D1F]">
                        {b.overallRank}
                      </span>

                      <button
                        type="button"
                        onClick={() => onSelectBloggerDetail(b)}
                        className="shrink-0 cursor-pointer"
                      >
                        {b.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.profileImageUrl}
                            alt={b.nickname}
                            className="h-11 w-11 rounded-full border border-black/[0.06] object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1D1D1F] text-sm font-semibold text-white">
                            {b.nickname.slice(0, 1)}
                          </div>
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectBloggerDetail(b)}
                            className="truncate text-[15px] font-semibold text-[#1D1D1F] hover:text-[#0071E3] cursor-pointer"
                          >
                            {b.nickname}
                          </button>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${gStyle.bg} ${gStyle.text}`}
                          >
                            {b.grade}
                          </span>
                          <span className="text-[12px] text-[#86868B]">
                            {b.category}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[13px] text-[#86868B]">
                          {b.blogTitle} ·{" "}
                          <span className="font-num">@{b.blogId}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Clean Numbers + Actions */}
                    <div className="flex items-center justify-between gap-6 pl-10 sm:pl-0">
                      <div className="flex items-center gap-5 text-right">
                        <div>
                          <div className="text-[11px] text-[#86868B]">
                            일방문
                          </div>
                          <div className="font-num text-[14px] font-semibold text-[#1D1D1F]">
                            {formatKoreanCompact(b.dailyVisitors)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#86868B]">이웃</div>
                          <div className="font-num text-[14px] font-medium text-[#1D1D1F]">
                            {formatKoreanCompact(b.subscriberCount)}
                          </div>
                        </div>
                        <div className="hidden md:block">
                          <div className="text-[11px] text-[#86868B]">점수</div>
                          <div className="font-num text-[14px] font-semibold text-[#0071E3]">
                            {b.exposureScore.toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAnalyzeBlogger(b.blogId)}
                          className="rounded-full border border-black/12 px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] cursor-pointer"
                        >
                          진단
                        </button>
                        <button
                          type="button"
                          onClick={() => onAskBlogger(b.id)}
                          className="rounded-full bg-[#0071E3] px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 cursor-pointer"
                        >
                          질문
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Minimal Keyword Live Top Blog Finder */}
        <div className="mt-10 rounded-[24px] border border-black/[0.05] bg-white p-6 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
                키워드별 실시간 상위 블로그
              </h2>
              <p className="mt-0.5 text-[13px] text-[#86868B]">
                특정 검색어 상단에 노출 중인 블로그를 확인합니다.
              </p>
            </div>

            <form
              onSubmit={handleKeywordScan}
              className="flex w-full max-w-sm items-center gap-2"
            >
              <input
                type="text"
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                placeholder="키워드 입력 (예: 성수동 브런치)"
                className="flex-1 rounded-full border border-black/[0.08] bg-[#F5F5F7]/70 px-4 py-2 text-[13px] text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={kwLoading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50 cursor-pointer"
              >
                {kwLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>검색</span>
              </button>
            </form>
          </div>

          {kwItems.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kwItems.map((item) => (
                <div
                  key={`${item.blogId}-${item.logNo}`}
                  className="flex items-center justify-between rounded-2xl bg-[#F5F5F7]/80 p-4"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-num text-[12px] font-semibold text-[#0071E3]">
                        {item.rank}위
                      </span>
                      <span className="truncate text-[14px] font-semibold text-[#1D1D1F]">
                        {item.nickname}
                      </span>
                      <span className="text-[11px] text-[#86868B]">
                        {item.estimatedGrade}
                      </span>
                    </div>
                    <div className="mt-1 font-num text-[12px] text-[#86868B]">
                      일방문 {formatKoreanCompact(item.dailyVisitors)} · 이웃{" "}
                      {formatKoreanCompact(item.subscriberCount)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAnalyzeBlogger(item.blogId)}
                      className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#1D1D1F] border border-black/[0.06] hover:bg-zinc-50 cursor-pointer"
                    >
                      진단
                    </button>
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#86868B] hover:text-[#1D1D1F]"
                      title="원문 보기"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
