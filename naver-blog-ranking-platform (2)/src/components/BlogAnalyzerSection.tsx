"use client";

import { useEffect, useMemo, useState } from "react";
import type { Blogger } from "@/db/schema";
import {
  evaluateBlogMetrics,
  type ScoringMode,
} from "@/lib/scoring-engine";
import {
  type AnalyzeResponse,
  formatKoreanCompact,
  getGradeBadgeStyle,
  getPostStatusStyle,
} from "@/lib/ui-helpers";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";

interface BlogAnalyzerSectionProps {
  analyzedResult: AnalyzeResponse | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  recentAnalyzed: Blogger[];
  onRunAnalyze: (blogInput: string) => Promise<void>;
  onAskMentorWithBlog: (blog: Blogger) => void;
}

const SAMPLE_IDS = [
  { id: "ararar0625", name: "김뉴니" },
  { id: "chooravel", name: "츄장" },
  { id: "jjoori_", name: "쭈리" },
  { id: "cosreader", name: "화읽남" },
  { id: "naverofficial", name: "네이버공식" },
];

const MODES: Array<{ id: ScoringMode; label: string }> = [
  { id: "practical", label: "실전 노출" },
  { id: "authority", label: "체급 중심" },
  { id: "strict_agency", label: "섭외 기준" },
];

export function BlogAnalyzerSection({
  analyzedResult,
  isAnalyzing,
  analyzeError,
  recentAnalyzed,
  onRunAnalyze,
  onAskMentorWithBlog,
}: BlogAnalyzerSectionProps) {
  const [inputVal, setInputVal] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("practical");
  const [showScoreDetail, setShowScoreDetail] = useState(false);

  const [customKw, setCustomKw] = useState("");
  const [customKwLoading, setCustomKwLoading] = useState(false);
  const [customKwResult, setCustomKwResult] = useState<{
    keyword: string;
    unifiedRank: number | null;
    blogTabRank: number | null;
    matchedPostUrl: string | null;
  } | null>(null);

  const blog = analyzedResult?.blog ?? null;

  useEffect(() => {
    setCustomKwResult(null);
    setCustomKw("");
  }, [blog?.blogId]);

  const calibrated = useMemo(() => {
    if (!blog) return null;
    return evaluateBlogMetrics(
      {
        blogId: blog.blogId,
        officialBlog: blog.grade === "NB",
        isInfluencer: blog.isInfluencer,
        dailyVisitors: blog.dailyVisitors,
        todayVisitors: blog.todayVisitors,
        totalVisitors: blog.totalVisitors,
        visitorWidgetPublic: blog.visitorWidgetPublic,
        visitorHistory: blog.visitorHistory,
        subscriberCount: blog.subscriberCount,
        totalPosts: blog.totalPosts,
        recentPosts: blog.recentPosts,
      },
      scoringMode
    );
  }, [blog, scoringMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isAnalyzing) return;
    await onRunAnalyze(inputVal.trim());
  };

  const handleQuickClick = async (blogId: string) => {
    setInputVal(blogId);
    await onRunAnalyze(blogId);
  };

  const handleCustomKeywordCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blog || !customKw.trim() || customKwLoading) return;
    setCustomKwLoading(true);
    try {
      const res = await fetch("/api/keyword-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blogId: blog.blogId,
          keyword: customKw.trim(),
        }),
      });
      if (res.ok) {
        setCustomKwResult(await res.json());
      }
    } finally {
      setCustomKwLoading(false);
    }
  };

  const gradeStyle =
    blog && calibrated ? getGradeBadgeStyle(calibrated.grade) : null;
  const maxVisitorBar =
    blog && blog.visitorHistory.length > 0
      ? Math.max(...blog.visitorHistory.map((d) => d.count), 1)
      : 1;

  return (
    <section className="pt-14 pb-20 sm:pt-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Clean Minimal Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] sm:text-[44px] sm:leading-[1.15]">
            네이버 블로그 지수와 노출 진단.
          </h1>
          <p className="mt-3 text-[15px] text-[#86868B]">
            아이디 또는 주소만 입력하세요.
          </p>

          {/* Apple Spotlight-style Pill Search Bar */}
          <form onSubmit={handleSubmit} className="mt-8">
            <div className="mx-auto flex max-w-xl items-center rounded-full border border-black/[0.08] bg-white p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow focus-within:border-[#0071E3]/50 focus-within:shadow-[0_8px_30px_rgb(0,113,227,0.08)]">
              <Search className="ml-4 h-4 w-4 shrink-0 text-[#86868B]" />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="블로그 아이디 또는 URL (예: chooravel)"
                className="w-full bg-transparent px-3 py-2.5 text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isAnalyzing}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0071E3] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>조회 중</span>
                  </>
                ) : (
                  <span>조회</span>
                )}
              </button>
            </div>
          </form>

          {analyzeError && (
            <p className="mx-auto mt-3 max-w-xl text-[13px] font-medium text-red-600">
              {analyzeError}
            </p>
          )}

          {/* Subtle Sample Chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {SAMPLE_IDS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleQuickClick(s.id)}
                className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#86868B] border border-black/[0.05] transition-colors hover:text-[#1D1D1F] hover:border-black/15 cursor-pointer"
              >
                {s.name} <span className="font-num opacity-75">@{s.id}</span>
              </button>
            ))}
            {recentAnalyzed.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={isAnalyzing}
                onClick={() => handleQuickClick(item.blogId)}
                className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#86868B] border border-black/[0.05] transition-colors hover:text-[#1D1D1F] cursor-pointer"
              >
                @{item.blogId}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Apple Bento Report Card */}
        {blog && calibrated && gradeStyle && (
          <div className="mt-12 rounded-[28px] border border-black/[0.05] bg-white p-6 sm:p-9 shadow-[0_8px_40px_rgb(0,0,0,0.03)]">
            {/* Profile & Mode Switcher Row */}
            <div className="flex flex-col gap-5 border-b border-black/[0.06] pb-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {blog.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={blog.profileImageUrl}
                    alt={blog.nickname}
                    className="h-14 w-14 shrink-0 rounded-full border border-black/[0.06] object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-lg font-semibold text-white">
                    {blog.nickname.slice(0, 1)}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-[#1D1D1F] sm:text-2xl">
                      {blog.blogTitle}
                    </h2>
                    <a
                      href={`https://blog.naver.com/${blog.blogId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[#86868B] hover:text-[#1D1D1F]"
                      title="블로그 열기"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#86868B]">
                    <span className="font-medium text-[#1D1D1F]">
                      {blog.nickname}
                    </span>
                    <span className="font-num">@{blog.blogId}</span>
                    <span>·</span>
                    <span>{blog.officialDirectory || blog.category}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Segmented Mode Control */}
                <div className="inline-flex rounded-full bg-[#F5F5F7] p-1">
                  {MODES.map((m) => {
                    const active = scoringMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setScoringMode(m.id)}
                        className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                          active
                            ? "bg-white text-[#1D1D1F] shadow-2xs"
                            : "text-[#86868B] hover:text-[#1D1D1F]"
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onAskMentorWithBlog(blog)}
                  className="rounded-full border border-black/15 px-4 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] cursor-pointer"
                >
                  멘토에게 질문
                </button>
              </div>
            </div>

            {/* 4 Clean Bento Metric Tiles */}
            <div className="mt-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {/* Grade */}
              <div className="rounded-2xl bg-[#F5F5F7]/80 p-5">
                <div className="text-[12px] font-medium text-[#86868B]">
                  추정 등급
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[15px] font-semibold ${gradeStyle.bg} ${gradeStyle.text}`}
                  >
                    {calibrated.grade}
                  </span>
                  <span className="font-num text-[13px] font-medium text-[#86868B]">
                    상위 {calibrated.topPercent}%
                  </span>
                </div>
              </div>

              {/* Exposure Score */}
              <div className="rounded-2xl bg-[#F5F5F7]/80 p-5">
                <div className="text-[12px] font-medium text-[#86868B]">
                  노출 점수
                </div>
                <div className="mt-2.5 flex items-baseline gap-1">
                  <span className="font-num text-3xl font-semibold text-[#1D1D1F]">
                    {calibrated.exposureScore.toFixed(1)}
                  </span>
                  <span className="font-num text-[13px] text-[#86868B]">
                    / 100
                  </span>
                </div>
                <div className="mt-2 font-num text-[12px] text-[#86868B]">
                  C-Rank {calibrated.cRankScore} · DIA+ {calibrated.diaScore}
                </div>
              </div>

              {/* Daily Visitors */}
              <div className="rounded-2xl bg-[#F5F5F7]/80 p-5">
                <div className="flex items-center justify-between text-[12px] font-medium text-[#86868B]">
                  <span>일평균 방문</span>
                  <span className="font-num">
                    오늘 {blog.todayVisitors.toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="mt-2.5 font-num text-3xl font-semibold text-[#1D1D1F]">
                  {calibrated.effectiveDailyVisitors.toLocaleString("ko-KR")}
                </div>
                {blog.visitorHistory.length > 0 ? (
                  <div className="mt-2.5 flex items-end gap-1 h-4">
                    {blog.visitorHistory.map((pt, i) => {
                      const h = Math.max(
                        20,
                        Math.round((pt.count / maxVisitorBar) * 100)
                      );
                      const isToday = i === blog.visitorHistory.length - 1;
                      return (
                        <div
                          key={pt.date}
                          title={`${pt.date}: ${pt.count.toLocaleString("ko-KR")}명`}
                          className={`flex-1 rounded-xs ${
                            isToday ? "bg-[#0071E3]" : "bg-black/20"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-[#86868B]">
                    위젯 비공개 · 시간대 보정
                  </div>
                )}
              </div>

              {/* Neighbors & Total Posts */}
              <div className="rounded-2xl bg-[#F5F5F7]/80 p-5">
                <div className="text-[12px] font-medium text-[#86868B]">
                  이웃 · 누적 방문
                </div>
                <div className="mt-2.5 font-num text-3xl font-semibold text-[#1D1D1F]">
                  {formatKoreanCompact(blog.subscriberCount)}
                </div>
                <div className="mt-2 font-num text-[12px] text-[#86868B]">
                  누적 {formatKoreanCompact(blog.totalVisitors)} · 글{" "}
                  {blog.totalPosts.toLocaleString("ko-KR")}개
                </div>
              </div>
            </div>

            {/* Collapsible Score Detail + Custom Keyword Check */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowScoreDetail((v) => !v)}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              >
                <span>세부 점수 항목 및 키워드 직접 검증</span>
                {showScoreDetail ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showScoreDetail && (
                <div className="mt-3 rounded-2xl bg-[#F5F5F7]/70 p-5 space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                    {calibrated.axes.map((ax) => {
                      const pct = Math.min(
                        100,
                        Math.round((ax.score / Math.max(1, ax.maxScore)) * 100)
                      );
                      return (
                        <div key={ax.key} className="rounded-xl bg-white p-3.5">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium text-[#1D1D1F]">
                              {ax.label}
                            </span>
                            <span className="font-num font-semibold text-[#1D1D1F]">
                              {ax.score.toFixed(1)}/{ax.maxScore}
                            </span>
                          </div>
                          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
                            <div
                              className="h-full rounded-full bg-[#1D1D1F]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Minimal Keyword Rank Verifier */}
                  <form
                    onSubmit={handleCustomKeywordCheck}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <input
                      type="text"
                      value={customKw}
                      onChange={(e) => setCustomKw(e.target.value)}
                      placeholder="특정 키워드 노출 순위 확인 (예: 잠실 아기사진)"
                      className="flex-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#0071E3] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={customKwLoading || customKw.trim().length < 2}
                      className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40 cursor-pointer"
                    >
                      {customKwLoading ? "확인 중..." : "순위 확인"}
                    </button>
                  </form>

                  {customKwResult && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1D1D1F]">
                          &lsquo;{customKwResult.keyword}&rsquo;
                        </span>
                        <span className="text-[#86868B]">→</span>
                        {customKwResult.unifiedRank !== null ? (
                          <span className="font-num font-semibold text-[#0071E3]">
                            통합검색 {customKwResult.unifiedRank}위
                          </span>
                        ) : customKwResult.blogTabRank !== null ? (
                          <span className="font-num font-medium text-[#1D1D1F]">
                            블로그탭 {customKwResult.blogTabRank}위
                          </span>
                        ) : (
                          <span className="text-[#86868B]">30위권 밖</span>
                        )}
                      </div>
                      {customKwResult.matchedPostUrl && (
                        <a
                          href={customKwResult.matchedPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-medium text-[#0071E3] hover:underline"
                        >
                          원문 보기
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clean Recent Posts List */}
            <div className="mt-8 border-t border-black/[0.06] pt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                  최근 발행 글 노출 현황
                </h3>
                <span className="text-[12px] text-[#86868B]">
                  최근 {blog.recentPosts.length}건
                </span>
              </div>

              {blog.recentPosts.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#86868B]">
                  공개된 최근 글이 없습니다.
                </p>
              ) : (
                <div className="divide-y divide-black/[0.05]">
                  {blog.recentPosts.map((post, idx) => {
                    const st = getPostStatusStyle(post.status);
                    const naverVerifyUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(
                      post.keyword
                    )}`;

                    return (
                      <div
                        key={`${post.logNo || idx}`}
                        className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${st.badge}`}
                            >
                              {st.label}
                              {post.searchRank
                                ? ` ${post.searchRank}위`
                                : post.blogTabRank
                                ? ` ${post.blogTabRank}위`
                                : ""}
                            </span>
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[14px] font-medium text-[#1D1D1F] hover:text-[#0071E3]"
                            >
                              {post.title}
                            </a>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#86868B]">
                            <a
                              href={naverVerifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#1D1D1F] hover:underline"
                            >
                              #{post.keyword}
                            </a>
                            <span className="font-num">
                              {post.charCount.toLocaleString("ko-KR")}자
                            </span>
                            <span className="font-num">
                              사진 {post.imageCount}장
                            </span>
                            <span className="font-num">{post.publishedAt}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-4 sm:pl-4">
                          <span className="font-num text-[14px] font-semibold text-[#1D1D1F]">
                            {post.score}점
                          </span>
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#86868B] hover:text-[#1D1D1F]"
                            title="글 열기"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
