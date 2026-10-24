"use client";

import { useState } from "react";
import type { Blogger } from "@/db/schema";
import type {
  AnalyzeResponse,
  MentorSummary,
  PlatformStats,
  QuestionItem,
  RankedBloggerItem,
} from "@/lib/ui-helpers";
import { Navbar, type ActiveTab } from "@/components/Navbar";
import { BlogAnalyzerSection } from "@/components/BlogAnalyzerSection";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { QaLoungeSection } from "@/components/QaLoungeSection";
import { AskQuestionModal } from "@/components/AskQuestionModal";
import { BloggerDetailModal } from "@/components/BloggerDetailModal";

interface BlaiRankAppProps {
  initialTopBloggers: RankedBloggerItem[];
  initialMentors: MentorSummary[];
  initialRecentAnalyzed: Blogger[];
  initialQuestions: QuestionItem[];
  initialStats: PlatformStats;
  initialFeaturedAnalysis: AnalyzeResponse | null;
}

export function BlaiRankApp({
  initialTopBloggers,
  initialMentors,
  initialRecentAnalyzed,
  initialQuestions,
  initialStats,
  initialFeaturedAnalysis,
}: BlaiRankAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("analyze");

  const [topBloggers, setTopBloggers] =
    useState<RankedBloggerItem[]>(initialTopBloggers);
  const [recentAnalyzed, setRecentAnalyzed] = useState<Blogger[]>(
    initialRecentAnalyzed
  );
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions);
  const [stats, setStats] = useState<PlatformStats>(initialStats);

  const [analyzedResult, setAnalyzedResult] = useState<AnalyzeResponse | null>(
    initialFeaturedAnalysis
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askTargetBloggerId, setAskTargetBloggerId] = useState<number | null>(
    null
  );
  const [prefillBlogId, setPrefillBlogId] = useState("");
  const [prefillGrade, setPrefillGrade] = useState("준최2");

  const [detailBlogger, setDetailBlogger] =
    useState<RankedBloggerItem | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const refreshData = async () => {
    try {
      const [rankRes, qaRes] = await Promise.all([
        fetch("/api/rankings", { cache: "no-store" }),
        fetch("/api/questions", { cache: "no-store" }),
      ]);
      if (rankRes.ok) {
        const rankData = await rankRes.json();
        setTopBloggers(rankData.topBloggers);
        setRecentAnalyzed(rankData.recentAnalyzed);
        setStats(rankData.stats);
      }
      if (qaRes.ok) {
        const qaData = await qaRes.json();
        setQuestions(qaData.questions);
      }
    } catch {
      // Non-blocking
    }
  };

  const handleRunAnalyze = async (blogInput: string) => {
    setActiveTab("analyze");
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || "블로그를 찾지 못했습니다.");
        return;
      }
      setAnalyzedResult(data as AnalyzeResponse);
      await refreshData();
    } catch {
      setAnalyzeError("일시적인 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenAskModal = (targetBloggerId: number | null = null) => {
    setAskTargetBloggerId(targetBloggerId);
    setAskModalOpen(true);
  };

  const handleAskMentorWithBlog = (blog: Blogger) => {
    if (blog.isTopRanker) {
      setAskTargetBloggerId(blog.id);
      setPrefillBlogId("");
      setPrefillGrade("준최2");
    } else {
      setAskTargetBloggerId(null);
      setPrefillBlogId(blog.blogId);
      setPrefillGrade(blog.grade);
    }
    setAskModalOpen(true);
  };

  const handleCreateQuestion = async (payload: {
    targetBloggerId: number | null;
    authorNickname: string;
    authorBlogId: string;
    authorGrade: string;
    category: string;
    title: string;
    content: string;
  }) => {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "질문 등록에 실패했습니다.");
    }
    setQuestions((prev) => [data.question as QuestionItem, ...prev]);
    await refreshData();
    setActiveTab("qa");
    showToast("질문이 등록되었습니다.");
  };

  const handleSubmitAnswer = async (
    questionId: number,
    payload: {
      bloggerId?: number | null;
      authorNickname?: string;
      content: string;
    }
  ) => {
    const res = await fetch(`/api/questions/${questionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "답변 등록 실패");
    }
    await refreshData();
    showToast("답변이 등록되었습니다.");
  };

  const handleLikeQuestion = async (questionId: number, answerId?: number) => {
    const res = await fetch(`/api/questions/${questionId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answerId ? { answerId } : {}),
    });
    if (res.ok) {
      const data = await res.json();
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          if (answerId) {
            return {
              ...q,
              answers: q.answers.map((a) =>
                a.id === answerId ? { ...a, likesCount: data.likesCount } : a
              ),
            };
          }
          return { ...q, likesCount: data.likesCount };
        })
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalQuestions={stats.totalQuestions}
        onOpenAskModal={handleOpenAskModal}
      />

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      <main className="flex-1">
        {activeTab === "analyze" && (
          <BlogAnalyzerSection
            analyzedResult={analyzedResult}
            isAnalyzing={isAnalyzing}
            analyzeError={analyzeError}
            recentAnalyzed={recentAnalyzed}
            onRunAnalyze={handleRunAnalyze}
            onAskMentorWithBlog={handleAskMentorWithBlog}
          />
        )}

        {activeTab === "ranking" && (
          <LeaderboardSection
            bloggers={topBloggers}
            onSelectBloggerDetail={(b) => setDetailBlogger(b)}
            onAskBlogger={(bloggerId) => handleOpenAskModal(bloggerId)}
            onAnalyzeBlogger={(blogId) => handleRunAnalyze(blogId)}
          />
        )}

        {activeTab === "qa" && (
          <QaLoungeSection
            questions={questions}
            mentors={initialMentors}
            onOpenAskModal={handleOpenAskModal}
            onSubmitAnswer={handleSubmitAnswer}
            onLikeQuestion={handleLikeQuestion}
          />
        )}
      </main>

      <footer className="border-t border-black/[0.06] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 text-[12px] text-[#86868B] sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1D1D1F]">BLNK</span>
            <span>·</span>
            <span>네이버 공개 데이터 기반 비공식 블로그 분석</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/blnk-github-files.zip"
              download="blnk-github-files.zip"
              className="font-medium text-[#0071E3] hover:underline"
            >
              GitHub 업로드용 파일 받기 (.zip)
            </a>
            <button
              type="button"
              onClick={() => setActiveTab("analyze")}
              className="hover:text-[#1D1D1F] cursor-pointer"
            >
              진단
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ranking")}
              className="hover:text-[#1D1D1F] cursor-pointer"
            >
              랭킹
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("qa")}
              className="hover:text-[#1D1D1F] cursor-pointer"
            >
              질문
            </button>
          </div>
        </div>
      </footer>

      <AskQuestionModal
        isOpen={askModalOpen}
        initialTargetBloggerId={askTargetBloggerId}
        prefillBlogId={prefillBlogId}
        prefillGrade={prefillGrade}
        mentors={initialMentors}
        onClose={() => setAskModalOpen(false)}
        onCreateQuestion={handleCreateQuestion}
      />

      <BloggerDetailModal
        blogger={detailBlogger}
        relatedQuestions={
          detailBlogger
            ? questions.filter((q) => q.targetBloggerId === detailBlogger.id)
            : []
        }
        onClose={() => setDetailBlogger(null)}
        onAskThisBlogger={(bloggerId) => handleOpenAskModal(bloggerId)}
      />
    </div>
  );
}
