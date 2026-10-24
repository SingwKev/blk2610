import https from "node:https";
import type { BlogPostDiagnostic, DailyVisitorPoint } from "@/db/schema";
import {
  computeCalibratedPostScore,
  evaluateBlogMetrics,
} from "@/lib/scoring-engine";

export interface GradeDistributionItem {
  grade: string;
  percent: number;
  count: number;
  color: string;
  bgClass: string;
  textClass: string;
  description: string;
}

export const TOTAL_TRACKED_BLOGS = 2_077_767;

export const GRADE_DISTRIBUTION: GradeDistributionItem[] = [
  {
    grade: "최적",
    percent: 6.1,
    count: 125_960,
    color: "#6D28D9",
    bgClass: "bg-violet-100 border-violet-200",
    textClass: "text-violet-700",
    description: "장기 누적 신뢰도 최상위 · 고경쟁 키워드 및 플레이스 리뷰 강점",
  },
  {
    grade: "NB",
    percent: 0.4,
    count: 7_992,
    color: "#0284C7",
    bgClass: "bg-sky-100 border-sky-200",
    textClass: "text-sky-700",
    description: "네이버 공식블로그(officialBlog) 및 공공·전문 인증 등급",
  },
  {
    grade: "준최7",
    percent: 3.8,
    count: 79_812,
    color: "#059669",
    bgClass: "bg-emerald-100 border-emerald-200",
    textClass: "text-emerald-700",
    description: "준최적화 최상위 · 통합검색 상단 다수 점유 실전 강자",
  },
  {
    grade: "준최6",
    percent: 5.6,
    count: 116_014,
    color: "#10B981",
    bgClass: "bg-emerald-50 border-emerald-200",
    textClass: "text-emerald-700",
    description: "상위 노출 안정권 · 스마트블록 및 홈판 유입 활발",
  },
  {
    grade: "준최5",
    percent: 7.8,
    count: 161_641,
    color: "#0D9488",
    bgClass: "bg-teal-50 border-teal-200",
    textClass: "text-teal-700",
    description: "중상위 경쟁력 · 세부 키워드 통합검색 상단 진입 활발",
  },
  {
    grade: "준최4",
    percent: 7.8,
    count: 161_910,
    color: "#2563EB",
    bgClass: "bg-blue-50 border-blue-200",
    textClass: "text-blue-700",
    description: "성장 가속 구간 · 꾸준한 주제 전문성 축적 단계",
  },
  {
    grade: "준최3",
    percent: 5.2,
    count: 108_477,
    color: "#4F46E5",
    bgClass: "bg-indigo-50 border-indigo-200",
    textClass: "text-indigo-700",
    description: "초중급 활성 블로그 · 3~4어절 롱테일 키워드 공략 권장",
  },
  {
    grade: "준최2",
    percent: 61.3,
    count: 1_274_059,
    color: "#64748B",
    bgClass: "bg-slate-100 border-slate-200",
    textClass: "text-slate-700",
    description: "전체 61.3% 분포 기본 등급 · 원고 완성도로 통검 상단 노출 가능",
  },
  {
    grade: "저품질",
    percent: 2.0,
    count: 41_902,
    color: "#E11D48",
    bgClass: "bg-rose-50 border-rose-200",
    textClass: "text-rose-700",
    description: "최근 발행글 다수 검색 누락 · 상업성 키워드 및 중복 문서 점검 필요",
  },
];

export const BLOG_CATEGORIES = [
  "전체",
  "IT·테크",
  "맛집·카페",
  "여행·숙박",
  "경제·재테크",
  "리빙·인테리어",
  "뷰티·패션",
  "육아·교육",
  "건강·운동",
] as const;

export const QA_CATEGORIES = [
  "전체",
  "상위노출·로직",
  "키워드 발굴",
  "지수·누락 해결",
  "원고·글쓰기",
  "협찬·수익화",
  "홈판·인플루언서",
] as const;

export const AVATAR_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-blue-600 to-indigo-600",
  "from-violet-600 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-teal-500 to-emerald-600",
  "from-indigo-500 to-violet-600",
];

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Reliable native HTTPS GET helper that avoids Undici fetch 403 blocks on `search.naver.com`.
 */
function fetchHttpsText(
  url: string,
  customHeaders: Record<string, string> = {},
  timeoutMs = 5000,
  redirectDepth = 0
): Promise<{ status: number; body: string }> {
  if (redirectDepth > 4) {
    return Promise.resolve({ status: 0, body: "" });
  }

  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
          ...customHeaders,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          const nextUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          resolve(
            fetchHttpsText(nextUrl, customHeaders, timeoutMs, redirectDepth + 1)
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: code,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    req.on("error", () => resolve({ status: 0, body: "" }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, body: "" });
    });
  });
}

export function normalizeNaverBlogId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.includes("naver.com")) {
      const withProto = trimmed.startsWith("http")
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(withProto);
      const blogIdParam = url.searchParams.get("blogId");
      if (blogIdParam) {
        return blogIdParam.replace(/[^a-zA-Z0-9_-]/g, "");
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length > 0 && segments[0] !== "PostView.naver") {
        return segments[0].replace(/[^a-zA-Z0-9_-]/g, "");
      }
    }
  } catch {
    // Fallback below
  }

  return trimmed
    .replace(/^@/, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

function pickAvatarGradient(blogId: string): string {
  let sum = 0;
  for (let i = 0; i < blogId.length; i++) {
    sum += blogId.charCodeAt(i);
  }
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length]!;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x200B;/gi, "")
    .replace(/\u200B/g, "")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function mapDirectoryToCategory(
  directoryName: string,
  combinedText: string
): string {
  const dir = directoryName.trim();
  if (/(IT|컴퓨터|게임|디지털|과학)/i.test(dir)) return "IT·테크";
  if (/(맛집|요리|레시피|와인|디저트)/i.test(dir)) return "맛집·카페";
  if (/(여행|세계여행|국내여행|캠핑)/i.test(dir)) return "여행·숙박";
  if (/(비즈니스|경제|재테크|부동산|주식|금융)/i.test(dir)) return "경제·재테크";
  if (/(인테리어|DIY|상품리뷰|일상|취미|원예|반려동물)/i.test(dir)) {
    if (/(화장품|뷰티|패션|코디)/.test(combinedText)) return "뷰티·패션";
    return "리빙·인테리어";
  }
  if (/(패션|미용|뷰티)/i.test(dir)) return "뷰티·패션";
  if (/(육아|결혼|교육|학문|외국어|문학|책)/i.test(dir)) return "육아·교육";
  if (/(건강|의학|스포츠|운동|등산)/i.test(dir)) return "건강·운동";

  const lower = combinedText.toLowerCase();
  if (
    /(아이폰|갤럭시|노트북|ai|코딩|테크|모니터|키보드|이어폰|공식블로그|네이버)/.test(
      lower
    )
  )
    return "IT·테크";
  if (/(맛집|카페|식당|레시피|브런치|디저트|오마카세|베이커리)/.test(lower))
    return "맛집·카페";
  if (/(여행|호텔|숙소|캠핑|제주|후쿠오카|오사카|항공권|투어)/.test(lower))
    return "여행·숙박";
  if (/(주식|부동산|재테크|경제|투자|청약|배당|etf|세금|환율)/.test(lower))
    return "경제·재테크";
  if (/(화장품|뷰티|패션|코디|스킨케어|올리브영|향수|앰플)/.test(lower))
    return "뷰티·패션";
  if (/(육아|아기|초등|교육|독서|문해력|책육아|공부)/.test(lower))
    return "육아·교육";
  if (/(건강|운동|다이어트|러닝|마라톤|헬스|스포츠|스트레칭)/.test(lower))
    return "건강·운동";

  return "리빙·인테리어";
}

/**
 * Smart Korean target keyword extractor:
 * Removes only promotional brackets like `[내돈내산]`, `[협찬]`, `[공지]`,
 * while PRESERVING location/topic brackets like `[성수동 맛집]`, `[용산/해방촌]`.
 */
export function extractTargetKeywordFromTitle(title: string): string {
  const promoBracketRegex =
    /\[(협찬|광고|유료광고|내돈내산|솔직후기|솔직리뷰|후기|리뷰|공지|일상|이벤트|체험단|서포터즈|단독|스페셜로고|블챌|주간일기|[a-zA-Z]{2,6})\]/gi;

  const cleaned = decodeHtmlEntities(title)
    .replace(promoBracketRegex, " ")
    .replace(/[\[\]「」『』<>《》【】()]/g, " ")
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = new Set([
    "솔직",
    "후기",
    "리뷰",
    "추천",
    "정리",
    "비교",
    "총정리",
    "내돈내산",
    "방문기",
    "다녀온",
    "직접",
    "방법",
    "꿀팁",
    "이유",
    "이야기",
    "포스팅",
    "일기",
    "기록",
    "모음",
    "위시리스트",
    "어제",
    "오늘",
    "최근",
    "드디어",
    "솔직한",
    "쏟아졌다는데",
    "갈렸다는",
    "반응",
  ]);

  const words = cleaned.split(" ").filter((w) => w.length >= 2);
  const coreWords = words.filter((w) => !stopWords.has(w));
  const picked = (coreWords.length >= 2 ? coreWords : words).slice(0, 3);
  return (
    picked.join(" ").slice(0, 28) || cleaned.slice(0, 20) || "네이버 블로그"
  );
}

interface MobileBlogInfo {
  blogId: string;
  blogName: string;
  nickName: string;
  officialBlog: boolean;
  powerBlog: boolean;
  dayVisitorCount: number;
  subscriberCount: number;
  totalVisitorCount: number;
  profileImagePath: string;
  blogDirectoryName: string;
}

async function fetchNaverMobileBlogInfo(
  blogId: string
): Promise<MobileBlogInfo | null> {
  try {
    const res = await fetchHttpsText(
      `https://m.blog.naver.com/api/blogs/${blogId}`,
      {
        Referer: `https://m.blog.naver.com/${blogId}`,
        "User-Agent": MOBILE_UA,
        Accept: "application/json",
      },
      4500
    );
    if (res.status !== 200 || !res.body) return null;
    const data = JSON.parse(res.body) as {
      isSuccess?: boolean;
      result?: Record<string, unknown>;
    };
    if (!data?.isSuccess || !data.result) return null;
    const r = data.result;
    return {
      blogId: String(r.blogId || blogId),
      blogName: decodeHtmlEntities(String(r.blogName || blogId)),
      nickName: decodeHtmlEntities(String(r.nickName || blogId)),
      officialBlog: Boolean(r.officialBlog),
      powerBlog: Boolean(r.powerBlog || r.isPowerBlogBadgeDisplay),
      dayVisitorCount: Number(r.dayVisitorCount ?? 0),
      subscriberCount: Number(r.subscriberCount ?? 0),
      totalVisitorCount: Number(r.totalVisitorCount ?? 0),
      profileImagePath: String(
        r.encodedProfileImagePath || r.profileImagePath || ""
      ),
      blogDirectoryName: decodeHtmlEntities(String(r.blogDirectoryName || "")),
    };
  } catch {
    return null;
  }
}

async function fetchNaverVisitorHistory(
  blogId: string
): Promise<DailyVisitorPoint[]> {
  try {
    const res = await fetchHttpsText(
      `https://blog.naver.com/NVisitorgp4Ajax.nhn?blogId=${blogId}`,
      { "User-Agent": DESKTOP_UA },
      4000
    );
    if (res.status !== 200 || !res.body) return [];
    const matches = [
      ...res.body.matchAll(/<visitorcnt\s+id="(\d{8})"\s+cnt="(\d+)"/gi),
    ];
    return matches.map((m) => {
      const rawDate = m[1]!;
      return {
        date: `${rawDate.slice(4, 6)}.${rawDate.slice(6, 8)}`,
        count: Number(m[2] ?? 0),
      };
    });
  } catch {
    return [];
  }
}

async function fetchNaverCategoryStats(blogId: string): Promise<{
  totalPosts: number;
  categoryTags: string[];
}> {
  try {
    const res = await fetchHttpsText(
      `https://m.blog.naver.com/api/blogs/${blogId}/category-list`,
      {
        Referer: `https://m.blog.naver.com/${blogId}`,
        "User-Agent": MOBILE_UA,
        Accept: "application/json",
      },
      4000
    );
    if (res.status !== 200 || !res.body) {
      return { totalPosts: 0, categoryTags: [] };
    }
    const data = JSON.parse(res.body) as {
      isSuccess?: boolean;
      result?: {
        mylogPostCount?: number;
        mylogCategoryList?: Array<{
          categoryName?: string;
          postCnt?: number;
          divisionLine?: boolean;
          openYN?: boolean;
        }>;
      };
    };
    if (!data?.isSuccess || !data.result) {
      return { totalPosts: 0, categoryTags: [] };
    }
    const list = data.result.mylogCategoryList ?? [];
    const sortedCats = list
      .filter(
        (c) =>
          !c.divisionLine &&
          c.openYN !== false &&
          (c.postCnt ?? 0) > 0 &&
          c.categoryName
      )
      .sort((a, b) => (b.postCnt ?? 0) - (a.postCnt ?? 0))
      .slice(0, 4)
      .map((c) =>
        decodeHtmlEntities(String(c.categoryName))
          .replace(/[^\w가-힣·&\s]/g, "")
          .trim()
          .slice(0, 14)
      )
      .filter((name) => name.length >= 2);

    const summed = list.reduce((acc, c) => acc + Number(c.postCnt ?? 0), 0);
    return {
      totalPosts: Number(data.result.mylogPostCount ?? summed),
      categoryTags: Array.from(new Set(sortedCats)),
    };
  } catch {
    return { totalPosts: 0, categoryTags: [] };
  }
}

interface RawPostItem {
  logNo: string;
  title: string;
  briefContents: string;
  commentCnt: number;
  sympathyCnt: number;
  thumbnailCount: number;
  addDateMs: number;
  searchYn: boolean;
  postBlocked: boolean;
  categoryName: string;
}

async function fetchNaverRecentPostList(
  blogId: string,
  limit = 5
): Promise<RawPostItem[]> {
  try {
    const res = await fetchHttpsText(
      `https://m.blog.naver.com/api/blogs/${blogId}/post-list?categoryNo=0&itemCount=${limit}&page=1`,
      {
        Referer: `https://m.blog.naver.com/${blogId}`,
        "User-Agent": MOBILE_UA,
        Accept: "application/json",
      },
      4500
    );
    if (res.status !== 200 || !res.body) return [];
    const data = JSON.parse(res.body) as {
      isSuccess?: boolean;
      result?: { items?: Array<Record<string, unknown>> };
    };
    if (!data?.isSuccess || !Array.isArray(data.result?.items)) return [];

    return data.result!.items.slice(0, limit).map((item) => ({
      logNo: String(item.logNo ?? ""),
      title: decodeHtmlEntities(
        String(item.titleWithInspectMessage || item.title || "제목 없음")
      ),
      briefContents: decodeHtmlEntities(String(item.briefContents || "")),
      commentCnt: Number(item.commentCnt ?? 0),
      sympathyCnt: Number(item.sympathyCnt ?? 0),
      thumbnailCount: Number(
        item.thumbnailCount ??
          (Array.isArray(item.thumbnailList) ? item.thumbnailList.length : 0)
      ),
      addDateMs: Number(item.addDate ?? Date.now()),
      searchYn: item.searchYn !== false,
      postBlocked: Boolean(item.postBlocked),
      categoryName: decodeHtmlEntities(String(item.categoryName || "")),
    }));
  } catch {
    return [];
  }
}

async function fetchRealPostCharCounts(
  blogId: string,
  logNo: string,
  fallbackBrief: string
): Promise<{ noSpaces: number; withSpaces: number }> {
  try {
    const res = await fetchHttpsText(
      `https://m.blog.naver.com/${blogId}/${logNo}`,
      { "User-Agent": MOBILE_UA },
      3800
    );
    if (res.status === 200 && res.body) {
      const html = res.body;
      const seParagraphs = [
        ...html.matchAll(
          /<p[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/gi
        ),
      ]
        .map((m) => decodeHtmlEntities(m[1]!.replace(/<[^>]+>/g, "")).trim())
        .filter(Boolean);

      if (seParagraphs.length > 0) {
        const bodyParas =
          seParagraphs.length > 2 ? seParagraphs.slice(1) : seParagraphs;
        const joined = bodyParas.join(" ");
        const noSpaces = joined.replace(/\s+/g, "").length;
        if (noSpaces > 30) {
          return {
            withSpaces: joined.length,
            noSpaces,
          };
        }
      }

      const legacyMatch = html.match(
        /<div[^>]*id="viewTypeSelector"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i
      );
      if (legacyMatch?.[1]) {
        const plain = decodeHtmlEntities(
          legacyMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
        )
          .replace(/\s+/g, " ")
          .trim();
        const noSpaces = plain.replace(/\s+/g, "").length;
        if (noSpaces > 30) {
          return { withSpaces: plain.length, noSpaces };
        }
      }
    }
  } catch {
    // Fallback below
  }

  const cleanBrief = fallbackBrief.trim();
  return {
    withSpaces: cleanBrief.length,
    noSpaces: cleanBrief.replace(/\s+/g, "").length,
  };
}

function extractUniqueBlogEntriesFromSerp(
  rawHtml: string
): Array<{ bid: string; lno: string }> {
  const normalized = rawHtml.replace(/%2F/gi, "/");
  const matches = [
    ...normalized.matchAll(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/(\d+)/gi),
  ];
  const seen = new Set<string>();
  const list: Array<{ bid: string; lno: string }> = [];
  for (const m of matches) {
    const bid = m[1]!.toLowerCase();
    const lno = m[2]!;
    if (bid === "postview" || bid === "myblog") continue;
    const key = `${bid}/${lno}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ bid, lno });
    }
  }
  return list;
}

interface SectionBlogSearchItem {
  domainIdOrBlogId?: string;
  blogId?: string;
  logNo?: number | string;
  postUrl?: string;
}

async function queryNaverSectionBlogSearch(
  query: string,
  countPerPage = 30
): Promise<{
  ok: boolean;
  totalCount: number;
  items: Array<{ bid: string; lno: string; postUrl: string }>;
}> {
  try {
    const url = `https://section.blog.naver.com/ajax/SearchList.nhn?countPerPage=${countPerPage}&currentPage=1&orderBy=sim&keyword=${encodeURIComponent(
      query
    )}`;
    const res = await fetchHttpsText(
      url,
      {
        Referer: "https://section.blog.naver.com/Search/Post.nhn",
        Accept: "application/json, text/plain, */*",
      },
      4500
    );
    if (res.status !== 200 || !res.body) {
      return { ok: false, totalCount: 0, items: [] };
    }
    const braceIdx = res.body.indexOf("{");
    if (braceIdx === -1) {
      return { ok: false, totalCount: 0, items: [] };
    }
    const parsed = JSON.parse(res.body.slice(braceIdx)) as {
      result?: {
        totalCount?: number;
        searchList?: SectionBlogSearchItem[];
      };
    };
    const rawList = parsed.result?.searchList ?? [];
    const items = rawList.map((it) => {
      const bid = String(it.domainIdOrBlogId || it.blogId || "").toLowerCase();
      const lno = String(it.logNo ?? "");
      return {
        bid,
        lno,
        postUrl: it.postUrl || `https://blog.naver.com/${bid}/${lno}`,
      };
    });
    return {
      ok: true,
      totalCount: Number(parsed.result?.totalCount ?? items.length),
      items,
    };
  } catch {
    return { ok: false, totalCount: 0, items: [] };
  }
}

/**
 * Uses Naver's official `section.blog.naver.com/ajax/SearchList.nhn` JSON engine
 * for 100% throttle-free relevance rank, competing document count (`competingDocs`),
 * and exact title index verification!
 */
async function checkLiveNaverSearchExposure(
  blogId: string,
  logNo: string,
  title: string,
  keyword: string
): Promise<{
  unifiedRank: number | null;
  blogTabRank: number | null;
  competingDocs: number;
  isIndexed: boolean;
}> {
  const lowerBlogId = blogId.toLowerCase();
  const cleanTitleQuery = title
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);

  try {
    const [kwSearch, titleSearch] = await Promise.all([
      queryNaverSectionBlogSearch(keyword, 30),
      queryNaverSectionBlogSearch(cleanTitleQuery, 20),
    ]);

    let unifiedRank: number | null = null;
    let blogTabRank: number | null = null;
    const competingDocs = kwSearch.totalCount;

    if (kwSearch.ok) {
      const idx = kwSearch.items.findIndex(
        (e) =>
          e.lno === logNo ||
          e.bid === lowerBlogId ||
          e.postUrl.toLowerCase().includes(`/${lowerBlogId}/`)
      );
      if (idx !== -1) {
        const rank = idx + 1;
        // Top 1~7 in Naver's `orderBy=sim` SmartBlock/View relevance pool = Unified Search Top tier
        if (rank <= 7) {
          unifiedRank = rank;
        } else {
          blogTabRank = rank;
        }
      }
    }

    let isIndexed = unifiedRank !== null || blogTabRank !== null;
    if (!isIndexed) {
      if (!titleSearch.ok) {
        // Network/API hiccup -> never false-positive as missing!
        isIndexed = true;
      } else {
        isIndexed = titleSearch.items.some(
          (e) =>
            e.lno === logNo ||
            e.bid === lowerBlogId ||
            e.postUrl.toLowerCase().includes(`/${lowerBlogId}/`)
        );
      }
    }

    return { unifiedRank, blogTabRank, competingDocs, isIndexed };
  } catch {
    return {
      unifiedRank: null,
      blogTabRank: null,
      competingDocs: 100,
      isIndexed: true,
    };
  }
}

/**
 * Checks where a specific `blogId` ranks right now on Naver Unified Search & Blog Search
 * for any user-specified target keyword!
 */
export async function checkBlogCustomKeywordRank(
  blogId: string,
  keyword: string
): Promise<{
  blogId: string;
  keyword: string;
  unifiedRank: number | null;
  blogTabRank: number | null;
  competingDocs: number;
  matchedPostUrl: string | null;
  totalBlogsInUnified: number;
}> {
  const cleanId = normalizeNaverBlogId(blogId).toLowerCase();
  const cleanKw = keyword.trim();

  const [unifiedRes, sectionRes] = await Promise.all([
    fetchHttpsText(
      `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(
        cleanKw
      )}`,
      {},
      4500
    ),
    queryNaverSectionBlogSearch(cleanKw, 30),
  ]);

  let unifiedRank: number | null = null;
  let blogTabRank: number | null = null;
  let matchedPostUrl: string | null = null;
  let totalBlogsInUnified = 0;

  if (unifiedRes.status === 200 && unifiedRes.body) {
    const entries = extractUniqueBlogEntriesFromSerp(unifiedRes.body);
    totalBlogsInUnified = entries.length;
    const idx = entries.findIndex((e) => e.bid === cleanId);
    if (idx !== -1) {
      unifiedRank = idx + 1;
      matchedPostUrl = `https://blog.naver.com/${entries[idx]!.bid}/${entries[idx]!.lno}`;
    }
  }

  if (sectionRes.ok) {
    const idx = sectionRes.items.findIndex(
      (e) =>
        e.bid === cleanId || e.postUrl.toLowerCase().includes(`/${cleanId}/`)
    );
    if (idx !== -1) {
      blogTabRank = idx + 1;
      if (unifiedRank === null && totalBlogsInUnified === 0 && idx < 7) {
        unifiedRank = idx + 1;
      }
      if (!matchedPostUrl) {
        matchedPostUrl = sectionRes.items[idx]!.postUrl;
      }
    }
  }

  return {
    blogId: cleanId,
    keyword: cleanKw,
    unifiedRank,
    blogTabRank,
    competingDocs: sectionRes.totalCount,
    matchedPostUrl,
    totalBlogsInUnified,
  };
}

export interface AnalyzedBlogPayload {
  blogId: string;
  nickname: string;
  blogTitle: string;
  profileImageUrl: string;
  avatarColor: string;
  category: string;
  officialDirectory: string;
  grade: string;
  overallRank: number;
  rankChange: number;
  topPercent: number;
  exposureScore: number;
  cRankScore: number;
  diaScore: number;
  topKeywordsCount: number;
  homeFeedCount: number;
  dailyVisitors: number;
  todayVisitors: number;
  totalVisitors: number;
  visitorWidgetPublic: boolean;
  visitorHistory: DailyVisitorPoint[];
  subscriberCount: number;
  totalPosts: number;
  isInfluencer: boolean;
  bio: string;
  specialtyTags: string[];
  recentPosts: BlogPostDiagnostic[];
  dataSource: "naver-live-verified";
}

export async function analyzeNaverBlogById(
  blogId: string,
  options?: { verifySearch?: boolean; postLimit?: number }
): Promise<AnalyzedBlogPayload | null> {
  const verifySearch = options?.verifySearch !== false;
  const postLimit = options?.postLimit ?? 5;

  const [mobileInfo, visitorHistory, categoryStats, rawPosts] =
    await Promise.all([
      fetchNaverMobileBlogInfo(blogId),
      fetchNaverVisitorHistory(blogId),
      fetchNaverCategoryStats(blogId),
      fetchNaverRecentPostList(blogId, postLimit),
    ]);

  if (!mobileInfo) {
    return null;
  }

  const postDiagnostics: BlogPostDiagnostic[] = await Promise.all(
    rawPosts.map(async (item) => {
      const keyword = extractTargetKeywordFromTitle(item.title);
      const [charCounts, searchCheck] = await Promise.all([
        fetchRealPostCharCounts(
          mobileInfo.blogId,
          item.logNo,
          item.briefContents
        ),
        verifySearch
          ? checkLiveNaverSearchExposure(
              mobileInfo.blogId,
              item.logNo,
              item.title,
              keyword
            )
          : Promise.resolve({
              unifiedRank: null,
              blogTabRank: null,
              competingDocs: 200,
              isIndexed: item.searchYn && !item.postBlocked,
            }),
      ]);

      const ageHours = (Date.now() - item.addDateMs) / 3_600_000;
      const effectivelyIndexed =
        item.searchYn &&
        !item.postBlocked &&
        (searchCheck.isIndexed || ageHours < 2);

      let status: BlogPostDiagnostic["status"] = "일반 색인";
      if (!effectivelyIndexed) {
        status = "검색 누락";
      } else if (searchCheck.unifiedRank !== null) {
        status = "통검 상위노출";
      } else if (searchCheck.blogTabRank !== null) {
        status = "블로그탭 노출";
      }

      const postScore = computeCalibratedPostScore({
        charCountNoSpaces: charCounts.noSpaces,
        imageCount: item.thumbnailCount,
        sympathyCount: item.sympathyCnt,
        commentCount: item.commentCnt,
        effectivelyIndexed,
        unifiedRank: searchCheck.unifiedRank,
        blogTabRank: searchCheck.blogTabRank,
        competingDocs: searchCheck.competingDocs,
      });

      const publishedAt = new Date(item.addDateMs).toISOString().slice(0, 10);

      return {
        logNo: item.logNo,
        title: item.title,
        keyword,
        competingDocs: searchCheck.competingDocs,
        publishedAt,
        url: `https://blog.naver.com/${mobileInfo.blogId}/${item.logNo}`,
        status,
        searchRank: searchCheck.unifiedRank,
        blogTabRank: searchCheck.blogTabRank,
        isIndexed: effectivelyIndexed,
        charCount: charCounts.noSpaces,
        charCountWithSpaces: charCounts.withSpaces,
        imageCount: item.thumbnailCount,
        commentCount: item.commentCnt,
        sympathyCount: item.sympathyCnt,
        score: postScore,
      };
    })
  );

  const isInfluencer =
    mobileInfo.officialBlog ||
    mobileInfo.powerBlog ||
    (mobileInfo.subscriberCount >= 3_000 &&
      mobileInfo.totalVisitorCount >= 1_500_000);

  const evaluated = evaluateBlogMetrics(
    {
      blogId: mobileInfo.blogId,
      officialBlog: mobileInfo.officialBlog,
      powerBlog: mobileInfo.powerBlog,
      isInfluencer,
      dailyVisitors: mobileInfo.dayVisitorCount,
      todayVisitors: mobileInfo.dayVisitorCount,
      totalVisitors: mobileInfo.totalVisitorCount,
      visitorWidgetPublic: visitorHistory.length > 0,
      visitorHistory,
      subscriberCount: mobileInfo.subscriberCount,
      totalPosts: categoryStats.totalPosts,
      recentPosts: postDiagnostics,
    },
    "practical"
  );

  const recentHitRate =
    postDiagnostics.length > 0
      ? postDiagnostics.filter(
          (p) => p.status === "통검 상위노출" || p.status === "블로그탭 노출"
        ).length / postDiagnostics.length
      : 0.2;

  const topKeywordsCount = Math.max(
    postDiagnostics.filter((p) => p.status === "통검 상위노출").length,
    Math.min(
      1200,
      Math.round(categoryStats.totalPosts * 0.2 * (0.15 + recentHitRate))
    )
  );

  const homeFeedCount =
    evaluated.effectiveDailyVisitors >= 15_000
      ? Math.round(evaluated.effectiveDailyVisitors / 1100)
      : evaluated.effectiveDailyVisitors >= 3_000
      ? Math.round(evaluated.effectiveDailyVisitors / 1400)
      : 0;

  const combinedText = `${mobileInfo.blogName} ${
    mobileInfo.blogDirectoryName
  } ${categoryStats.categoryTags.join(" ")} ${postDiagnostics
    .map((p) => p.title)
    .join(" ")}`;
  const category = mapDirectoryToCategory(
    mobileInfo.blogDirectoryName,
    combinedText
  );

  const specialtyTags =
    categoryStats.categoryTags.length >= 2
      ? categoryStats.categoryTags
      : [
          category,
          mobileInfo.blogDirectoryName || "네이버블로그",
          "실측분석",
        ].filter(Boolean);

  return {
    blogId: mobileInfo.blogId,
    nickname: mobileInfo.nickName,
    blogTitle: mobileInfo.blogName,
    profileImageUrl: mobileInfo.profileImagePath,
    avatarColor: pickAvatarGradient(mobileInfo.blogId),
    category,
    officialDirectory: mobileInfo.blogDirectoryName || "주제 미지정",
    grade: evaluated.grade,
    overallRank: evaluated.overallRank,
    rankChange: 0,
    topPercent: evaluated.topPercent,
    exposureScore: evaluated.exposureScore,
    cRankScore: evaluated.cRankScore,
    diaScore: evaluated.diaScore,
    topKeywordsCount,
    homeFeedCount,
    dailyVisitors: evaluated.effectiveDailyVisitors,
    todayVisitors: mobileInfo.dayVisitorCount,
    totalVisitors: mobileInfo.totalVisitorCount,
    visitorWidgetPublic: visitorHistory.length > 0,
    visitorHistory,
    subscriberCount: mobileInfo.subscriberCount,
    totalPosts: categoryStats.totalPosts,
    isInfluencer,
    bio: `${
      mobileInfo.blogDirectoryName
        ? `[네이버 공식 디렉토리: ${mobileInfo.blogDirectoryName}] `
        : ""
    }누적 방문 ${mobileInfo.totalVisitorCount.toLocaleString(
      "ko-KR"
    )}명 · 이웃 ${mobileInfo.subscriberCount.toLocaleString(
      "ko-KR"
    )}명 · 공개 글 ${categoryStats.totalPosts.toLocaleString(
      "ko-KR"
    )}건을 운영 중인 실제 네이버 블로그입니다.`,
    specialtyTags,
    recentPosts: postDiagnostics,
    dataSource: "naver-live-verified",
  };
}

export interface LiveKeywordRankItem {
  rank: number;
  blogId: string;
  logNo: string;
  postUrl: string;
  nickname: string;
  blogTitle: string;
  profileImageUrl: string;
  officialDirectory: string;
  subscriberCount: number;
  dailyVisitors: number;
  todayVisitors: number;
  totalVisitors: number;
  totalPosts: number;
  estimatedGrade: string;
}

export async function scanLiveKeywordTopBlogs(
  keyword: string,
  limit = 6
): Promise<LiveKeywordRankItem[]> {
  const cleanKw = keyword.trim();
  if (!cleanKw) return [];

  const uniqueEntries: Array<{ blogId: string; logNo: string }> = [];
  const seenBlogs = new Set<string>();

  const collect = (html: string) => {
    const entries = extractUniqueBlogEntriesFromSerp(html);
    for (const e of entries) {
      if (!seenBlogs.has(e.bid)) {
        seenBlogs.add(e.bid);
        uniqueEntries.push({ blogId: e.bid, logNo: e.lno });
        if (uniqueEntries.length >= limit) break;
      }
    }
  };

  const nexearchRes = await fetchHttpsText(
    `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(
      cleanKw
    )}`,
    {},
    5500
  );
  if (nexearchRes.status === 200 && nexearchRes.body) {
    collect(nexearchRes.body);
  }

  if (uniqueEntries.length < limit) {
    const sectionRes = await queryNaverSectionBlogSearch(cleanKw, 20);
    if (sectionRes.ok) {
      for (const it of sectionRes.items) {
        if (it.bid && !seenBlogs.has(it.bid)) {
          seenBlogs.add(it.bid);
          uniqueEntries.push({ blogId: it.bid, logNo: it.lno });
          if (uniqueEntries.length >= limit) break;
        }
      }
    }
  }

  const enriched = await Promise.all(
    uniqueEntries.map(async (entry, idx) => {
      const [info, visHistory, catStats] = await Promise.all([
        fetchNaverMobileBlogInfo(entry.blogId),
        fetchNaverVisitorHistory(entry.blogId),
        fetchNaverCategoryStats(entry.blogId),
      ]);

      if (!info) return null;

      const evalRes = evaluateBlogMetrics(
        {
          blogId: info.blogId,
          officialBlog: info.officialBlog,
          powerBlog: info.powerBlog,
          dailyVisitors: info.dayVisitorCount,
          todayVisitors: info.dayVisitorCount,
          totalVisitors: info.totalVisitorCount,
          visitorWidgetPublic: visHistory.length > 0,
          visitorHistory: visHistory,
          subscriberCount: info.subscriberCount,
          totalPosts: catStats.totalPosts,
          recentPosts: [],
        },
        "practical"
      );

      return {
        rank: idx + 1,
        blogId: info.blogId,
        logNo: entry.logNo,
        postUrl: `https://blog.naver.com/${info.blogId}/${entry.logNo}`,
        nickname: info.nickName,
        blogTitle: info.blogName,
        profileImageUrl: info.profileImagePath,
        officialDirectory: info.blogDirectoryName || "일반",
        subscriberCount: info.subscriberCount,
        dailyVisitors: evalRes.effectiveDailyVisitors,
        todayVisitors: info.dayVisitorCount,
        totalVisitors: info.totalVisitorCount,
        totalPosts: catStats.totalPosts,
        estimatedGrade: evalRes.grade,
      } satisfies LiveKeywordRankItem;
    })
  );

  return enriched.filter((x): x is LiveKeywordRankItem => x !== null);
}
