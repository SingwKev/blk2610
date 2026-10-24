import type { BlogPostDiagnostic, DailyVisitorPoint } from "@/db/schema";
import { TOTAL_TRACKED_BLOGS } from "@/lib/blog-analyzer";

export type ScoringMode = "practical" | "authority" | "strict_agency";

export interface ScoreAxisItem {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface CalibratedEvaluation {
  mode: ScoringMode;
  modeLabel: string;
  exposureScore: number;
  cRankScore: number;
  diaScore: number;
  grade: string;
  overallRank: number;
  topPercent: number;
  effectiveDailyVisitors: number;
  visitorEstimationNote: string;
  axes: ScoreAxisItem[];
  summaryReason: string;
}

/**
 * Estimates full-day KST traffic when the 5-day XML widget is hidden
 * and only `todayVisitors` (since 00:00 KST) is exposed.
 */
export function estimateEffectiveDailyVisitors(params: {
  rawDailyVisitors: number;
  todayVisitors: number;
  totalVisitors: number;
  subscriberCount: number;
  visitorWidgetPublic: boolean;
  visitorHistory: DailyVisitorPoint[];
  analyzedAt?: Date;
}): { effectiveDaily: number; note: string } {
  const {
    rawDailyVisitors,
    todayVisitors,
    totalVisitors,
    subscriberCount,
    visitorWidgetPublic,
    visitorHistory,
    analyzedAt = new Date(),
  } = params;

  if (visitorWidgetPublic && visitorHistory.length >= 2) {
    const completed = visitorHistory.slice(0, -1);
    const avg = Math.round(
      completed.reduce((sum, d) => sum + d.count, 0) / completed.length
    );
    return {
      effectiveDaily: Math.max(avg, todayVisitors),
      note: `최근 ${completed.length}일 완결 방문자 실측 평균`,
    };
  }

  if (todayVisitors > 0) {
    const kstMs = analyzedAt.getTime() + 9 * 3_600_000;
    const kstDate = new Date(kstMs);
    const kstHour = kstDate.getUTCHours() + kstDate.getUTCMinutes() / 60;

    let cumulativeShare = 1.0;
    if (kstHour < 6) {
      cumulativeShare = 0.06 + (kstHour / 6) * 0.06;
    } else if (kstHour < 12) {
      cumulativeShare = 0.12 + ((kstHour - 6) / 6) * 0.28;
    } else if (kstHour < 18) {
      cumulativeShare = 0.4 + ((kstHour - 12) / 6) * 0.34;
    } else {
      cumulativeShare = 0.74 + ((kstHour - 18) / 6) * 0.26;
    }

    const projected = Math.round(
      todayVisitors / Math.max(0.1, cumulativeShare)
    );
    return {
      effectiveDaily: Math.max(todayVisitors, projected),
      note: `위젯 비공개 · KST ${Math.floor(
        kstHour
      )}시 오늘 방문(${todayVisitors.toLocaleString("ko-KR")}명) 기반 24시간 보정`,
    };
  }

  if (rawDailyVisitors > 0) {
    return {
      effectiveDaily: rawDailyVisitors,
      note: "방문자 기본 집계치",
    };
  }

  const conservativeFallback = Math.min(
    1500,
    Math.round(
      subscriberCount * 0.08 + Math.sqrt(Math.max(0, totalVisitors)) * 0.15
    )
  );
  return {
    effectiveDaily: conservativeFallback,
    note: "방문자 전체 비공개 · 이웃/누적 기반 보수적 추정",
  };
}

/**
 * Multiplier based on how many competing documents exist on Naver for the keyword.
 * Prevents rare 15-doc diary phrases from getting the same #1 bonus as 1,000+ doc commercial keywords!
 */
export function getCompetitionWeight(competingDocs?: number): number {
  if (typeof competingDocs !== "number" || competingDocs <= 0) return 0.75;
  if (competingDocs < 30) return 0.35; // 고유 일상 제목 (초저경쟁)
  if (competingDocs < 120) return 0.62; // 소형 니치 키워드
  if (competingDocs < 500) return 0.85; // 중경쟁 세부 키워드
  return 1.0; // 고경쟁 핵심 키워드 (500~1,000+ 문서)
}

export function computeCalibratedPostScore(params: {
  charCountNoSpaces: number;
  imageCount: number;
  sympathyCount: number;
  commentCount: number;
  effectivelyIndexed: boolean;
  unifiedRank: number | null;
  blogTabRank: number | null;
  competingDocs?: number;
}): number {
  const {
    charCountNoSpaces,
    imageCount,
    sympathyCount,
    commentCount,
    effectivelyIndexed,
    unifiedRank,
    blogTabRank,
    competingDocs,
  } = params;

  if (!effectivelyIndexed) {
    const rawDraft = Math.min(18, Math.round(charCountNoSpaces / 150));
    return Math.max(12, Math.min(28, 10 + rawDraft));
  }

  const indexBase = 26;

  let charPts = 0;
  if (charCountNoSpaces < 250) {
    charPts = 3;
  } else if (charCountNoSpaces < 700) {
    charPts = 4 + ((charCountNoSpaces - 250) / 450) * 6;
  } else if (charCountNoSpaces <= 2800) {
    charPts = 10 + Math.min(10, ((charCountNoSpaces - 700) / 1100) * 10);
  } else {
    charPts = Math.max(16, 20 - (charCountNoSpaces - 3500) / 1500);
  }

  let imgPts = 0;
  if (imageCount === 0) imgPts = 1;
  else if (imageCount <= 14) imgPts = Math.min(12, imageCount * 0.95);
  else imgPts = 12;

  // Capped at 6 pts so 서이추 공감 품앗이 never inflates non-ranking posts
  const engagePts = Math.min(
    6,
    Math.log10(1 + sympathyCount * 1.5 + commentCount * 2) * 2.8
  );

  // Max before search rank = 64 pts
  let rawRankBonus = 0;
  if (unifiedRank !== null) {
    if (unifiedRank === 1) rawRankBonus = 35;
    else if (unifiedRank <= 3) rawRankBonus = 33 - (unifiedRank - 1);
    else if (unifiedRank <= 7) rawRankBonus = 29 - (unifiedRank - 3);
    else if (unifiedRank <= 15) rawRankBonus = 23 - (unifiedRank - 7) * 0.7;
    else rawRankBonus = Math.max(12, 17 - (unifiedRank - 15) * 0.3);
  } else if (blogTabRank !== null) {
    if (blogTabRank <= 5) rawRankBonus = 22 - (blogTabRank - 1) * 1.2;
    else if (blogTabRank <= 15) rawRankBonus = 16 - (blogTabRank - 5) * 0.7;
    else rawRankBonus = Math.max(6, 9 - (blogTabRank - 15) * 0.2);
  }

  const compWeight = getCompetitionWeight(competingDocs);
  const rankBonus = rawRankBonus * compWeight;

  return Math.max(
    15,
    Math.min(
      99,
      Math.round(indexBase + charPts + imgPts + engagePts + rankBonus)
    )
  );
}

export interface BlogMetricsInput {
  blogId: string;
  officialBlog?: boolean;
  powerBlog?: boolean;
  isInfluencer?: boolean;
  dailyVisitors: number;
  todayVisitors: number;
  totalVisitors: number;
  visitorWidgetPublic: boolean;
  visitorHistory: DailyVisitorPoint[];
  subscriberCount: number;
  totalPosts: number;
  recentPosts: BlogPostDiagnostic[];
}

export function evaluateBlogMetrics(
  input: BlogMetricsInput,
  mode: ScoringMode = "practical"
): CalibratedEvaluation {
  const { effectiveDaily, note: visitorEstimationNote } =
    estimateEffectiveDailyVisitors({
      rawDailyVisitors: input.dailyVisitors,
      todayVisitors: input.todayVisitors,
      totalVisitors: input.totalVisitors,
      subscriberCount: input.subscriberCount,
      visitorWidgetPublic: input.visitorWidgetPublic,
      visitorHistory: input.visitorHistory,
    });

  const posts = input.recentPosts || [];
  const postCount = posts.length;
  const unifiedPosts = posts.filter((p) => p.status === "통검 상위노출");
  const blogTabPosts = posts.filter((p) => p.status === "블로그탭 노출");
  const missingPosts = posts.filter((p) => p.status === "검색 누락");
  const indexedPosts = posts.filter((p) => p.status !== "검색 누락");

  let daysSinceLatest = 3;
  if (postCount > 0 && posts[0]?.publishedAt) {
    const parsed = new Date(posts[0].publishedAt).getTime();
    if (!Number.isNaN(parsed)) {
      daysSinceLatest = Math.max(
        0,
        Math.floor((Date.now() - parsed) / 86_400_000)
      );
    }
  }

  // Axis 1: Active Daily Traffic (0~100)
  // 40/day -> 32, 150/day -> 47, 450/day -> 60, 1,500/day -> 74, 5,000/day -> 87, 15,000/day -> 95, 40,000/day -> 99.5
  let trafficNorm = 0;
  if (effectiveDaily > 0) {
    trafficNorm = Math.min(
      99.5,
      Math.max(10, (Math.log10(effectiveDaily + 4) - 0.35) * 24.8)
    );
  }

  // Axis 2: Live Search Exposure Power (0~100), weighted by keyword competition!
  let searchNorm = 28;
  if (postCount > 0) {
    let weightedHits = 0;
    for (const p of posts) {
      const cw = getCompetitionWeight(p.competingDocs);
      if (p.status === "통검 상위노출") {
        const rankFactor =
          p.searchRank && p.searchRank <= 3
            ? 1.05
            : p.searchRank && p.searchRank <= 5
            ? 0.92
            : 0.78;
        weightedHits += rankFactor * cw;
      } else if (p.status === "블로그탭 노출") {
        weightedHits += 0.58 * cw;
      } else if (p.status !== "검색 누락") {
        weightedHits += 0.22;
      }
    }

    const hitRatio = Math.min(1.0, weightedHits / postCount);
    const measuredSearch = Math.min(99, 24 + hitRatio * 78);

    // High active daily traffic proves strong existing search/homefeed exposure across older posts
    const impliedSearchFloor = Math.min(
      91,
      Math.max(0, (Math.log10(effectiveDaily + 2) - 1.35) * 29.5)
    );

    searchNorm = Math.max(measuredSearch, impliedSearchFloor);

    if (missingPosts.length > 0) {
      const missingRatio = missingPosts.length / postCount;
      searchNorm = Math.max(10, searchNorm - missingRatio * 36);
    }
  }

  // Axis 3: Manuscript Content Depth (0~100)
  let contentNorm = 42;
  if (postCount > 0) {
    const avgChars =
      posts.reduce((s, p) => s + (p.charCount || 0), 0) / postCount;
    const avgImages =
      posts.reduce((s, p) => s + (p.imageCount || 0), 0) / postCount;

    const charPart =
      avgChars < 300
        ? 18
        : avgChars <= 2600
        ? 26 + Math.min(48, ((avgChars - 300) / 1450) * 48)
        : 71;
    const imgPart = Math.min(25, avgImages * 2.1);
    contentNorm = Math.min(99, charPart + imgPart);
  }

  // Axis 4: Cumulative Authority & Scale (0~100)
  const cumVisitPart = Math.min(
    42,
    Math.max(0, (Math.log10(input.totalVisitors + 10) - 2.0) * 7.8)
  );
  const subPart = Math.min(
    32,
    Math.max(0, (Math.log10(input.subscriberCount + 5) - 0.7) * 8.6)
  );
  const postCntPart = Math.min(
    22,
    Math.max(0, Math.log10(input.totalPosts + 2) * 7.2)
  );
  const authorityBonus =
    input.officialBlog || input.powerBlog ? 6 : input.isInfluencer ? 3 : 0;
  const authorityNorm = Math.min(
    99.5,
    cumVisitPart + subPart + postCntPart + authorityBonus
  );

  // Axis 5: Activity Recency & Index Health (0~100)
  let healthNorm = 85;
  if (postCount === 0) {
    healthNorm = 20;
  } else {
    if (daysSinceLatest <= 3) healthNorm = 96;
    else if (daysSinceLatest <= 10) healthNorm = 89;
    else if (daysSinceLatest <= 30) healthNorm = 76;
    else if (daysSinceLatest <= 90) healthNorm = 54;
    else healthNorm = 28;

    if (missingPosts.length > 0) {
      const penaltyPerMissing = mode === "strict_agency" ? 26 : 18;
      healthNorm = Math.max(
        5,
        healthNorm - missingPosts.length * penaltyPerMissing
      );
    }
  }

  const weights =
    mode === "authority"
      ? {
          label: "체급 중심",
          traffic: 35,
          search: 18,
          content: 12,
          authority: 27,
          health: 8,
        }
      : mode === "strict_agency"
      ? {
          label: "섭외 기준",
          traffic: 30,
          search: 32,
          content: 18,
          authority: 8,
          health: 12,
        }
      : {
          label: "실전 노출",
          traffic: 28,
          search: 34,
          content: 18,
          authority: 10,
          health: 10,
        };

  const axisTraffic = Number(
    ((trafficNorm / 100) * weights.traffic).toFixed(1)
  );
  const axisSearch = Number(((searchNorm / 100) * weights.search).toFixed(1));
  const axisContent = Number(
    ((contentNorm / 100) * weights.content).toFixed(1)
  );
  const axisAuthority = Number(
    ((authorityNorm / 100) * weights.authority).toFixed(1)
  );
  const axisHealth = Number(((healthNorm / 100) * weights.health).toFixed(1));

  let rawTotal =
    axisTraffic + axisSearch + axisContent + axisAuthority + axisHealth;

  if (mode === "strict_agency") {
    if (effectiveDaily < 150) rawTotal = Math.min(rawTotal, 55);
    else if (effectiveDaily < 450) rawTotal = Math.min(rawTotal, 68);
    if (missingPosts.length >= 2) rawTotal -= 8;
  }

  if (daysSinceLatest > 120 && effectiveDaily < 100) {
    rawTotal = Math.min(rawTotal, 50);
  }

  const exposureScore = Number(
    Math.min(99.2, Math.max(14.0, rawTotal)).toFixed(1)
  );

  const cRankScore = Number(
    Math.min(
      99.4,
      Math.max(
        15.0,
        trafficNorm * 0.46 + authorityNorm * 0.38 + healthNorm * 0.16
      )
    ).toFixed(1)
  );
  const diaScore = Number(
    Math.min(
      99.5,
      Math.max(15.0, searchNorm * 0.58 + contentNorm * 0.32 + healthNorm * 0.1)
    ).toFixed(1)
  );

  const highCompUnifiedHits = unifiedPosts.filter(
    (p) => (p.competingDocs ?? 0) >= 150
  ).length;

  let grade = "준최2";
  if (
    postCount >= 3 &&
    missingPosts.length === postCount &&
    effectiveDaily < 80
  ) {
    grade = "저품질";
  } else if (input.officialBlog || input.blogId === "naverofficial") {
    grade = "NB";
  } else if (
    input.powerBlog ||
    (exposureScore >= 84 &&
      input.totalVisitors >= 15_000_000 &&
      input.totalPosts >= 350 &&
      effectiveDaily >= 2_500 &&
      daysSinceLatest <= 45)
  ) {
    grade = "최적";
  } else if (exposureScore >= 83 && effectiveDaily >= 3_000) {
    grade = "준최7";
  } else if (
    exposureScore >= 73 &&
    (effectiveDaily >= 380 || highCompUnifiedHits >= 3)
  ) {
    grade = "준최6";
  } else if (
    exposureScore >= 64 &&
    (effectiveDaily >= 150 || highCompUnifiedHits >= 1)
  ) {
    grade = "준최5";
  } else if (
    exposureScore >= 54 &&
    (effectiveDaily >= 50 || unifiedPosts.length >= 1)
  ) {
    grade = "준최4";
  } else if (
    exposureScore >= 44 ||
    (indexedPosts.length >= 2 && input.totalPosts >= 25)
  ) {
    grade = "준최3";
  } else {
    grade = "준최2";
  }

  let topPercent: number;
  if (exposureScore >= 90) {
    topPercent = 0.01 + ((99.5 - exposureScore) / 9.5) * 0.19;
  } else if (exposureScore >= 80) {
    topPercent = 0.2 + ((90 - exposureScore) / 10) * 2.3;
  } else if (exposureScore >= 70) {
    topPercent = 2.5 + ((80 - exposureScore) / 10) * 6.5;
  } else if (exposureScore >= 60) {
    topPercent = 9.0 + ((70 - exposureScore) / 10) * 13.0;
  } else if (exposureScore >= 48) {
    topPercent = 22.0 + ((60 - exposureScore) / 12) * 17.0;
  } else {
    topPercent = 39.0 + ((48 - exposureScore) / 34) * 58.0;
  }

  topPercent = Number(
    Math.max(0.005, Math.min(99.0, topPercent)).toFixed(
      topPercent < 1 ? 3 : topPercent < 10 ? 2 : 1
    )
  );
  const overallRank = Math.max(
    1,
    Math.round((topPercent / 100) * TOTAL_TRACKED_BLOGS)
  );

  const avgCharsDisplay =
    postCount > 0
      ? Math.round(posts.reduce((s, p) => s + p.charCount, 0) / postCount)
      : 0;

  const axes: ScoreAxisItem[] = [
    {
      key: "search",
      label: "실시간 검색 노출력",
      score: axisSearch,
      maxScore: weights.search,
      detail:
        postCount > 0
          ? `최근 ${postCount}글 중 상단노출 ${unifiedPosts.length}건 · 블로그탭 ${blogTabPosts.length}건 (경쟁도 반영)`
          : "공개된 최근 글 없음",
    },
    {
      key: "traffic",
      label: "일일 활성 트래픽",
      score: axisTraffic,
      maxScore: weights.traffic,
      detail: `유효 일방문 약 ${effectiveDaily.toLocaleString("ko-KR")}명 (${visitorEstimationNote})`,
    },
    {
      key: "content",
      label: "원고 분량·시각 밀도",
      score: axisContent,
      maxScore: weights.content,
      detail:
        postCount > 0
          ? `평균 공백제외 ${avgCharsDisplay.toLocaleString("ko-KR")}자`
          : "본문 표본 없음",
    },
    {
      key: "authority",
      label: "누적 체급·이웃 규모",
      score: axisAuthority,
      maxScore: weights.authority,
      detail: `누적 ${input.totalVisitors.toLocaleString("ko-KR")}명 · 이웃 ${input.subscriberCount.toLocaleString("ko-KR")}명 · 글 ${input.totalPosts.toLocaleString("ko-KR")}개`,
    },
    {
      key: "health",
      label: "발행 주기·색인 건전성",
      score: axisHealth,
      maxScore: weights.health,
      detail:
        missingPosts.length > 0
          ? `최근 글 누락 ${missingPosts.length}건 · 최근 발행 ${daysSinceLatest}일 전`
          : `누락 없음(정상 색인) · 최근 발행 ${
              daysSinceLatest === 0 ? "오늘" : `${daysSinceLatest}일 전`
            }`,
    },
  ];

  const lowCompOnly =
    unifiedPosts.length > 0 && highCompUnifiedHits === 0;

  let summaryReason = "";
  if (lowCompOnly) {
    summaryReason =
      "상위 노출된 글이 있으나 경쟁 문서 수가 적은 고유 문구 위주여서 점수 거품 방지를 위해 저경쟁 가중치가 적용되었습니다.";
  } else if (highCompUnifiedHits >= 1 && input.subscriberCount < 600) {
    summaryReason =
      "이웃·누적 체급은 아직 작지만 경쟁 문서가 많은 실전 키워드에서 상위 노출을 잡는 '강소형 블로그'로 평가되었습니다.";
  } else if (!input.visitorWidgetPublic) {
    summaryReason =
      "방문자 그래프 위젯이 비공개 상태여서 조회 시각 기준 오늘 방문자수를 24시간 트래픽으로 시간대 보정하여 억울한 감점을 방지했습니다.";
  } else if (input.totalVisitors >= 1_000_000 && unifiedPosts.length === 0 && effectiveDaily < 500) {
    summaryReason =
      "과거 누적 방문자는 높으나 현재 일일 유입과 최근 글의 상위 노출 타율이 낮아 거품을 제거한 실전 점수가 산출되었습니다.";
  } else {
    summaryReason =
      "실측 일일 방문자, 키워드 경쟁도가 반영된 실제 검색 순위, 본문 원고 밀도, 색인 건전성을 균형 있게 반영한 점수입니다.";
  }

  return {
    mode,
    modeLabel: weights.label,
    exposureScore,
    cRankScore,
    diaScore,
    grade,
    overallRank,
    topPercent,
    effectiveDailyVisitors: effectiveDaily,
    visitorEstimationNote,
    axes,
    summaryReason,
  };
}
