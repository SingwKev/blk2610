import type { Blogger, BlogPostDiagnostic } from "@/db/schema";
import type { GradeDistributionItem } from "@/lib/blog-analyzer";

export interface RankedBloggerItem extends Blogger {
  questionCount: number;
  mentorAnswerCount: number;
}

export interface MentorSummary {
  id: number;
  blogId: string;
  nickname: string;
  category: string;
  grade: string;
  overallRank: number;
  avatarColor: string;
  responseRate: number;
}

export interface AnswerItem {
  id: number;
  questionId: number;
  bloggerId: number | null;
  authorNickname: string;
  authorBadge: string;
  isMentorAnswer: boolean;
  content: string;
  likesCount: number;
  createdAt: string;
}

export interface QuestionItem {
  id: number;
  targetBloggerId: number | null;
  authorNickname: string;
  authorBlogId: string | null;
  authorGrade: string | null;
  category: string;
  title: string;
  content: string;
  likesCount: number;
  viewsCount: number;
  isResolved: boolean;
  createdAt: string;
  targetBlogger: {
    id: number;
    blogId: string;
    nickname: string;
    category: string;
    grade: string;
    overallRank: number;
    avatarColor: string;
  } | null;
  answers: AnswerItem[];
}

export interface AnalyzeResponse {
  blog: Blogger;
  dataSource: "naver-live-verified" | "verified-ranker";
  advice: string[];
}

export interface PlatformStats {
  totalTrackedBlogs: number;
  gradeDistribution: GradeDistributionItem[];
  totalQuestions: number;
  resolvedQuestions: number;
  totalAnswers: number;
}

export function getGradeBadgeStyle(grade: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (grade) {
    case "최적":
    case "NB":
      return {
        bg: "bg-[#1D1D1F]",
        text: "text-white",
        border: "border-[#1D1D1F]",
        dot: "bg-white",
      };
    case "준최7":
    case "준최6":
      return {
        bg: "bg-[#0071E3]/10",
        text: "text-[#0071E3]",
        border: "border-[#0071E3]/20",
        dot: "bg-[#0071E3]",
      };
    case "준최5":
    case "준최4":
      return {
        bg: "bg-zinc-100",
        text: "text-[#1D1D1F]",
        border: "border-zinc-200/80",
        dot: "bg-zinc-600",
      };
    case "저품질":
      return {
        bg: "bg-red-50",
        text: "text-red-600",
        border: "border-red-200/80",
        dot: "bg-red-500",
      };
    default:
      return {
        bg: "bg-zinc-100/80",
        text: "text-[#86868B]",
        border: "border-zinc-200/60",
        dot: "bg-zinc-400",
      };
  }
}

export function getPostStatusStyle(status: BlogPostDiagnostic["status"]): {
  badge: string;
  label: string;
} {
  switch (status) {
    case "통검 상위노출":
      return {
        badge: "bg-[#0071E3]/10 text-[#0071E3]",
        label: "상위노출",
      };
    case "블로그탭 노출":
      return {
        badge: "bg-zinc-100 text-[#1D1D1F]",
        label: "블로그탭",
      };
    case "검색 누락":
      return {
        badge: "bg-red-50 text-red-600",
        label: "누락",
      };
    default:
      return {
        badge: "bg-zinc-100 text-[#86868B]",
        label: "정상색인",
      };
  }
}

export function formatKoreanCompact(num: number): string {
  if (num >= 100_000_000) {
    const eok = num / 100_000_000;
    return `${eok.toFixed(1)}억`;
  }
  if (num >= 10_000) {
    const man = num / 10_000;
    return `${man >= 100 ? Math.round(man).toLocaleString("ko-KR") : man.toFixed(1)}만`;
  }
  return num.toLocaleString("ko-KR");
}

export function formatDateTimeKo(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "방금 전";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "방금 전";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

const COMMERCIAL_RISK_WORDS = [
  "최저가",
  "즉시할인",
  "무료체험",
  "100%환불",
  "원금보장",
  "대출승인",
  "특가링크",
  "수익보장",
  "부업추천",
  "완치",
  "부작용없는",
  "당일입금",
];

export interface ManuscriptCheckResult {
  withSpaces: number;
  withoutSpaces: number;
  paragraphCount: number;
  keywordCount: number;
  detectedRiskWords: string[];
  topTokens: Array<{ word: string; count: number }>;
  estimatedGauge: number;
  verdict: string;
}

export function analyzeManuscriptText(
  text: string,
  targetKeyword: string
): ManuscriptCheckResult {
  const trimmed = text.trim();
  const withSpaces = trimmed.length;
  const withoutSpaces = trimmed.replace(/\s+/g, "").length;
  const paragraphCount = trimmed
    ? trimmed.split(/\n\s*\n|\n/).filter((p) => p.trim().length > 0).length
    : 0;

  const cleanKeyword = targetKeyword.trim();
  let keywordCount = 0;
  if (cleanKeyword.length >= 2 && trimmed) {
    const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = trimmed.match(new RegExp(escaped, "gi"));
    keywordCount = matches ? matches.length : 0;
  }

  const detectedRiskWords = COMMERCIAL_RISK_WORDS.filter((w) =>
    trimmed.includes(w)
  );

  const tokenFreq = new Map<string, number>();
  const words = trimmed
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  for (const w of words) {
    tokenFreq.set(w, (tokenFreq.get(w) ?? 0) + 1);
  }

  const topTokens = Array.from(tokenFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word, count]) => ({ word, count }));

  let score = 40;
  if (withoutSpaces >= 1400 && withoutSpaces <= 2800) score += 32;
  else if (withoutSpaces >= 800) score += 20;
  else if (withoutSpaces >= 300) score += 10;

  if (cleanKeyword) {
    if (keywordCount >= 3 && keywordCount <= 7) score += 20;
    else if (keywordCount >= 1 && keywordCount <= 10) score += 10;
    else if (keywordCount > 11) score -= 12;
  } else {
    score += 10;
  }

  if (paragraphCount >= 5) score += 8;
  score -= detectedRiskWords.length * 14;

  const overusedCount = topTokens.filter((t) => t.count >= 12).length;
  score -= overusedCount * 8;

  const estimatedGauge = Math.max(12, Math.min(99, score));
  let verdict = "원고 분량을 1,500자(공백 제외) 내외로 보강해 보세요.";
  if (detectedRiskWords.length > 0) {
    verdict =
      "상업성·심의 주의 단어가 감지되었습니다. 완곡한 표현으로 대체하면 누락 위험이 크게 줄어듭니다.";
  } else if (estimatedGauge >= 85) {
    verdict =
      "통합검색 상위 노출에 최적화된 안정적인 형태소·분량 밸런스입니다!";
  } else if (estimatedGauge >= 68) {
    verdict =
      "양호한 원고입니다. 핵심 키워드를 소제목과 첫 문단에 4~6회 자연스럽게 배치해 보세요.";
  }

  return {
    withSpaces,
    withoutSpaces,
    paragraphCount,
    keywordCount,
    detectedRiskWords,
    topTokens,
    estimatedGauge,
    verdict,
  };
}
