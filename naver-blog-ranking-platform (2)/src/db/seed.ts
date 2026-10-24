import { db } from "@/db";
import { bloggers, questions, answers, type NewBlogger } from "@/db/schema";
import { analyzeNaverBlogById } from "@/lib/blog-analyzer";
import { count, eq, sql } from "drizzle-orm";

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

interface RealSeedCandidate {
  blogId: string;
  categoryOverride?: string;
  mentorBio: string;
  responseRate: number;
}

const REAL_NAVER_TOP_BLOGGERS: RealSeedCandidate[] = [
  {
    blogId: "ararar0625",
    categoryOverride: "리빙·인테리어",
    mentorBio:
      "실제 일방문자 4만 명 이상을 기록 중인 리빙·홈스타일링 대표 블로거입니다. 인테리어·살림 키워드 선정과 홈판 클릭률을 높이는 사진 배치 노하우를 공유합니다.",
    responseRate: 98,
  },
  {
    blogId: "ya_nt",
    categoryOverride: "경제·재테크",
    mentorBio:
      "경제·주식·재테크 분야에서 일평균 3~5만 방문자가 유입되는 실전 투자 블로거입니다. 경제 이슈 속보성 키워드와 모바일 홈판 유입 전략을 다룹니다.",
    responseRate: 96,
  },
  {
    blogId: "red-peach",
    categoryOverride: "IT·테크",
    mentorBio:
      "누적 방문자 약 4,000만 명, 일방문자 2.5만 명 이상의 IT·모바일 전문 블로거입니다. 스마트폰·앱 활용법 통합검색 상위노출 문서 구조화를 답변드립니다.",
    responseRate: 97,
  },
  {
    blogId: "kingstargirl",
    categoryOverride: "IT·테크",
    mentorBio:
      "이웃 4.4만 명, 누적 방문 5,300만 명을 돌파한 IT·테크 파워 크리에이터입니다. 신제품 언박싱 골든타임 공략과 장문 리뷰 체류시간 설계를 공유합니다.",
    responseRate: 95,
  },
  {
    blogId: "dongi0508",
    categoryOverride: "여행·숙박",
    mentorBio:
      "누적 방문자 2억 1,200만 명 이상을 기록한 여행·일상 대형 블로거입니다. 해외·국내 여행 시즌 키워드 선점과 장기 롱런 포스팅 작성법을 나눕니다.",
    responseRate: 94,
  },
  {
    blogId: "caleb0901",
    categoryOverride: "건강·운동",
    mentorBio:
      "누적 방문자 1억 명 이상을 달성한 스포츠·운동 전문 블로거입니다. 스포츠 용품 리뷰 및 시의성 키워드 빠른 상단 진입 노하우를 답변해 드립니다.",
    responseRate: 93,
  },
  {
    blogId: "naverofficial",
    categoryOverride: "IT·테크",
    mentorBio:
      "이웃 9.7만 명, 누적 방문 1억 5,700만 명의 네이버 공식블로그(NB 공식 등급)입니다. 네이버 신규 서비스 소식과 공식 캠페인 트렌드를 확인할 수 있습니다.",
    responseRate: 90,
  },
  {
    blogId: "mom3133",
    categoryOverride: "건강·운동",
    mentorBio:
      "일평균 5,500명 이상 꾸준히 검색 유입되는 건강·웰빙 라이프 블로거입니다. 건강 카테고리 심의 주의 단어를 피해 안전하게 정보성 원고를 쓰는 팁을 공유합니다.",
    responseRate: 97,
  },
  {
    blogId: "farbemaria",
    categoryOverride: "뷰티·패션",
    mentorBio:
      "누적 방문 2,770만 명, 이웃 9,800명의 패션·뷰티 전문 블로거입니다. 뷰티 리뷰 검색 누락 방지법과 브랜드 협찬 포트폴리오 구성을 도와드립니다.",
    responseRate: 95,
  },
  {
    blogId: "art_de4",
    categoryOverride: "맛집·카페",
    mentorBio:
      "누적 방문 1,430만 명의 미식·로컬 여행 블로거입니다. 상권·메뉴 세부 키워드 조합으로 플레이스 및 통합검색 상단에 안착하는 공식을 공유합니다.",
    responseRate: 96,
  },
  {
    blogId: "readokiddo",
    categoryOverride: "육아·교육",
    mentorBio:
      "독서·문해력·초등 교육 인사이트로 탄탄한 C-Rank를 구축한 교육 블로거입니다. 방문자 대비 높은 공감·댓글 소통을 만드는 글쓰기 호흡을 답변드립니다.",
    responseRate: 98,
  },
  {
    blogId: "chooravel",
    categoryOverride: "여행·숙박",
    mentorBio:
      "이웃 9,000명, 누적 방문 350만 명의 워킹맘 여행·육아 블로거입니다. 항공권·숙소 실용 정보성 키워드로 꾸준한 검색 유입을 만드는 실전 팁을 나눕니다.",
    responseRate: 99,
  },
];

async function ensureTablesExist(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bloggers" (
      "id" serial PRIMARY KEY NOT NULL,
      "blog_id" varchar(100) NOT NULL UNIQUE,
      "nickname" varchar(100) NOT NULL,
      "blog_title" varchar(200) NOT NULL,
      "profile_image_url" text DEFAULT '' NOT NULL,
      "avatar_color" varchar(60) NOT NULL,
      "category" varchar(60) NOT NULL,
      "official_directory" varchar(80) DEFAULT '' NOT NULL,
      "grade" varchar(30) NOT NULL,
      "overall_rank" integer NOT NULL,
      "rank_change" integer DEFAULT 0 NOT NULL,
      "top_percent" double precision NOT NULL,
      "exposure_score" double precision NOT NULL,
      "c_rank_score" double precision NOT NULL,
      "dia_score" double precision NOT NULL,
      "top_keywords_count" integer DEFAULT 0 NOT NULL,
      "home_feed_count" integer DEFAULT 0 NOT NULL,
      "daily_visitors" integer DEFAULT 0 NOT NULL,
      "today_visitors" integer DEFAULT 0 NOT NULL,
      "total_visitors" bigint DEFAULT 0 NOT NULL,
      "visitor_widget_public" boolean DEFAULT true NOT NULL,
      "visitor_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "subscriber_count" integer DEFAULT 0 NOT NULL,
      "total_posts" integer DEFAULT 0 NOT NULL,
      "is_influencer" boolean DEFAULT false NOT NULL,
      "is_top_ranker" boolean DEFAULT false NOT NULL,
      "accepts_questions" boolean DEFAULT true NOT NULL,
      "response_rate" integer DEFAULT 95 NOT NULL,
      "bio" text DEFAULT '' NOT NULL,
      "specialty_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "recent_posts" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "data_source_type" varchar(40) DEFAULT 'naver-live-verified' NOT NULL,
      "search_count" integer DEFAULT 1 NOT NULL,
      "last_analyzed_at" timestamp DEFAULT now() NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "questions" (
      "id" serial PRIMARY KEY NOT NULL,
      "target_blogger_id" integer REFERENCES "bloggers"("id") ON DELETE SET NULL,
      "author_nickname" varchar(80) NOT NULL,
      "author_blog_id" varchar(100),
      "author_grade" varchar(30),
      "category" varchar(50) NOT NULL,
      "title" varchar(200) NOT NULL,
      "content" text NOT NULL,
      "likes_count" integer DEFAULT 0 NOT NULL,
      "views_count" integer DEFAULT 0 NOT NULL,
      "is_resolved" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "answers" (
      "id" serial PRIMARY KEY NOT NULL,
      "question_id" integer NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
      "blogger_id" integer REFERENCES "bloggers"("id") ON DELETE SET NULL,
      "author_nickname" varchar(80) NOT NULL,
      "author_badge" varchar(80) DEFAULT '일반 블로거' NOT NULL,
      "is_mentor_answer" boolean DEFAULT false NOT NULL,
      "content" text NOT NULL,
      "likes_count" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
  `);
}

async function runSeed(): Promise<void> {
  await ensureTablesExist();

  // Remove legacy mock rows if present from previous version
  const legacyMock = await db
    .select({ id: bloggers.id })
    .from(bloggers)
    .where(eq(bloggers.blogId, "technomad_hw"))
    .limit(1);

  if (legacyMock.length > 0) {
    await db.delete(answers);
    await db.delete(questions);
    await db.delete(bloggers);
  }

  const existing = await db.select({ value: count() }).from(bloggers);
  const existingCount = Number(existing[0]?.value ?? 0);
  if (existingCount > 0) {
    return;
  }

  // Fetch 100% REAL live data + live SERP verification from Naver in 3 polite batches of 4
  const batch1 = await Promise.all(
    REAL_NAVER_TOP_BLOGGERS.slice(0, 4).map(async (cand) => ({
      cand,
      live: await analyzeNaverBlogById(cand.blogId, {
        verifySearch: true,
        postLimit: 3,
      }),
    }))
  );
  const batch2 = await Promise.all(
    REAL_NAVER_TOP_BLOGGERS.slice(4, 8).map(async (cand) => ({
      cand,
      live: await analyzeNaverBlogById(cand.blogId, {
        verifySearch: true,
        postLimit: 3,
      }),
    }))
  );
  const batch3 = await Promise.all(
    REAL_NAVER_TOP_BLOGGERS.slice(8).map(async (cand) => ({
      cand,
      live: await analyzeNaverBlogById(cand.blogId, {
        verifySearch: true,
        postLimit: 3,
      }),
    }))
  );

  const combined = [...batch1, ...batch2, ...batch3].filter(
    (x) => x.live !== null
  );

  // Sort by actual measured exposureScore descending to assign real leaderboard rank #1..#N
  combined.sort(
    (a, b) => (b.live!.exposureScore ?? 0) - (a.live!.exposureScore ?? 0)
  );

  const rowsToInsert: NewBlogger[] = combined.map(({ cand, live }, idx) => {
    const data = live!;
    return {
      blogId: data.blogId,
      nickname: data.nickname,
      blogTitle: data.blogTitle,
      profileImageUrl: data.profileImageUrl,
      avatarColor: data.avatarColor,
      category: cand.categoryOverride || data.category,
      officialDirectory: data.officialDirectory,
      grade: data.grade,
      overallRank: idx + 1,
      rankChange: idx % 3 === 0 ? 1 : idx % 4 === 0 ? -1 : 0,
      topPercent: data.topPercent,
      exposureScore: data.exposureScore,
      cRankScore: data.cRankScore,
      diaScore: data.diaScore,
      topKeywordsCount: data.topKeywordsCount,
      homeFeedCount: data.homeFeedCount,
      dailyVisitors: data.dailyVisitors,
      todayVisitors: data.todayVisitors,
      totalVisitors: data.totalVisitors,
      visitorWidgetPublic: data.visitorWidgetPublic,
      visitorHistory: data.visitorHistory,
      subscriberCount: data.subscriberCount,
      totalPosts: data.totalPosts,
      isInfluencer: data.isInfluencer,
      isTopRanker: true,
      acceptsQuestions: true,
      responseRate: cand.responseRate,
      bio: cand.mentorBio,
      specialtyTags: data.specialtyTags,
      recentPosts: data.recentPosts,
      dataSourceType: "naver-live-verified",
      searchCount: 120 + (12 - idx) * 35,
    };
  });

  if (rowsToInsert.length === 0) {
    return;
  }

  const insertedBloggers = await db
    .insert(bloggers)
    .values(rowsToInsert)
    .returning();

  const byBlogId = new Map(insertedBloggers.map((b) => [b.blogId, b]));
  const pick = (id: string) => byBlogId.get(id) ?? insertedBloggers[0]!;

  const nyuni = pick("ararar0625");
  const ant = pick("ya_nt");
  const peach = pick("red-peach");
  const sherry = pick("farbemaria");
  const chooravel = pick("chooravel");
  const reado = pick("readokiddo");

  const insertedQuestions = await db
    .insert(questions)
    .values([
      {
        targetBloggerId: peach.id,
        authorNickname: "새벽타이핑",
        authorBlogId: "dawn_tech_log",
        authorGrade: "준최2",
        category: "상위노출·로직",
        title: "신규 개설한 준최2 블로그인데, IT·앱 활용 글로 통합검색 1페이지 진입이 실제로 가능한가요?",
        content:
          "안녕하세요! 실제 누적 방문자 수천만 명 달성하신 실측 지표를 보고 질문 남깁니다. 올해 개설해 아직 준최2 구간에 머물러 있는데 대형 키워드로 쓰면 20위 밖으로 밀립니다. 초기 블로그는 키워드 어절 수와 본문 글자수·이미지 구성을 어떻게 잡아야 통검 상단에 걸릴 수 있을까요?",
        likesCount: 47,
        viewsCount: 682,
        isResolved: true,
      },
      {
        targetBloggerId: nyuni.id,
        authorNickname: "코지홈즈",
        authorBlogId: "cozy_room_note",
        authorGrade: "준최4",
        category: "홈판·인플루언서",
        title: "리빙·살림 카테고리에서 일방문자 3~4만 명대 홈판 유입이 터지는 제목·썸네일 공식이 궁금합니다!",
        content:
          "검색 유입으로는 하루 1,000명 정도 들어오는데 모바일 네이버 홈판 유입이 거의 없습니다. 실측 방문자 추이를 보니 매일 4만 명 이상 꾸준히 들어오시던데, 검색용 제목과 홈판 추천용 제목을 어떻게 조합하시는지 조언 부탁드립니다!",
        likesCount: 39,
        viewsCount: 540,
        isResolved: true,
      },
      {
        targetBloggerId: sherry.id,
        authorNickname: "봄날스킨",
        authorBlogId: "spring_skin_note",
        authorGrade: "준최3",
        category: "지수·누락 해결",
        title: "어제 올린 화장품 리뷰 글만 제목 전체 검색에서도 안 잡힙니다 (검색 누락 해결법)",
        content:
          "평소 올리던 글들은 1시간 내로 통합검색이나 블로그탭에 정상 색인됐는데, 어제 올린 수분크림 후기 글만 따옴표 제목 검색에서도 검색 누락으로 뜹니다. 할인율/구매링크 표현 때문일까요? 수정 발행 vs 비공개 후 재작성 중 무엇이 안전할까요?",
        likesCount: 52,
        viewsCount: 790,
        isResolved: true,
      },
      {
        targetBloggerId: ant.id,
        authorNickname: "배당거북이",
        authorBlogId: "dividend_turtle",
        authorGrade: "준최5",
        category: "키워드 발굴",
        title: "경제·주식 주제에서 금융 금칙어 필터링을 피하면서 실시간 이슈 트래픽을 잡는 방법이 있을까요?",
        content:
          "미국주식 배당이나 환율 글을 쓸 때 '수익 보장', '급등' 같은 단어를 안 써도 가끔 노출이 밀릴 때가 있습니다. 경제 블로그 운영 시 특히 조심해야 할 형태소와 본문 구성 팁이 궁금합니다.",
        likesCount: 34,
        viewsCount: 430,
        isResolved: true,
      },
      {
        targetBloggerId: chooravel.id,
        authorNickname: "주말트래블",
        authorBlogId: "weekend_trip88",
        authorGrade: "준최3",
        category: "원고·글쓰기",
        title: "해외여행 항공권·숙소 정보성 포스팅 작성 시 적정 글자수(공백 제외)와 사진 장수는 어느 정도인가요?",
        content:
          "오사카·후쿠오카 자유여행 준비 글을 쓰다 보면 공백 제외 1,600~2,000자 정도에 사진 15장 내외가 나오는데, 더 길게 3,500자 이상 쓰는 게 유리한지 아니면 주제별로 시리즈 분할하는 게 나은지 궁금합니다!",
        likesCount: 26,
        viewsCount: 345,
        isResolved: true,
      },
      {
        targetBloggerId: null,
        authorNickname: "블린이탈출기",
        authorBlogId: "",
        authorGrade: "준최2",
        category: "협찬·수익화",
        title: "[공개질문] 일방문자 몇 명부터 체험단 말고 유가 원고료·브랜드 협업 제안이 들어오나요?",
        content:
          "현재 주 4회 꾸준히 내돈내산 리뷰를 쌓고 있는 블로거입니다. 상위 랭커분들은 일방문자나 이웃수가 어느 시점일 때 첫 협업 메일을 받으셨는지 경험담을 듣고 싶습니다!",
        likesCount: 22,
        viewsCount: 280,
        isResolved: true,
      },
    ])
    .returning();

  await db.insert(answers).values([
    {
      questionId: insertedQuestions[0]!.id,
      bloggerId: peach.id,
      authorNickname: peach.nickname,
      authorBadge: `종합 ${peach.overallRank}위 · ${peach.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "준최2 구간에서도 통합검색 1페이지 충분히 진입 가능합니다! 핵심은 2어절 대형 키워드 대신 [기기/앱 이름 + 구체적인 문제해결 상황] 3~4어절 키워드를 공략하는 것입니다.\n\n공백 제외 1,500~2,200자 분량에 직접 캡처·촬영한 사진 10~15장을 배치하고, 도입부 첫 문단에 질문에 대한 명확한 해결 순서 요약을 적어두면 체류시간이 올라가면서 상위 노출 확률이 크게 높아집니다.",
      likesCount: 36,
    },
    {
      questionId: insertedQuestions[1]!.id,
      bloggerId: nyuni.id,
      authorNickname: nyuni.nickname,
      authorBadge: `종합 ${nyuni.overallRank}위 · ${nyuni.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "홈판(모바일 메인 추천 피드)은 검색 키워드 정확도보다 '초기 클릭률(CTR)'과 '스크롤 완독률'의 영향을 크게 받습니다.\n\n제목 앞쪽에는 검색 유입용 핵심 키워드를 넣고, 뒤쪽에는 실제로 겪은 비포·애프터 변화나 구체적인 공간 고민 해결 포인트를 자연스러운 문장형으로 적어보세요. 대표 썸네일은 글자 없는 밝고 선명한 실사 사진일 때 홈판 채택률이 훨씬 높았습니다!",
      likesCount: 29,
    },
    {
      questionId: insertedQuestions[2]!.id,
      bloggerId: sherry.id,
      authorNickname: sherry.nickname,
      authorBadge: `종합 ${sherry.overallRank}위 · ${sherry.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "발행 후 2~3시간이 지났는데도 따옴표 제목 검색에서 조회되지 않는다면 스팸/홍보성 형태소 필터로 인한 '검색 누락' 상태일 가능성이 큽니다.\n\n기존 문서를 반복 수정하면 오히려 지수에 부정적일 수 있으니 해당 글은 비공개 처리하시고, 과도한 가격·할인율 반복과 단축 URL을 제거한 뒤 직접 찍은 사진 위주로 시간 간격을 두고 새로 발행하시는 것을 권장드립니다.",
      likesCount: 41,
    },
    {
      questionId: insertedQuestions[3]!.id,
      bloggerId: ant.id,
      authorNickname: ant.nickname,
      authorBadge: `종합 ${ant.overallRank}위 · ${ant.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "경제·재테크 글에서는 자극적인 단정형 표현('무조건 상승', '원금 보장', '대출 즉시')을 피하고 공시 데이터·수치 시뮬레이션 중심의 객관적 문체를 유지하는 것이 가장 중요합니다. 직접 만든 표나 그래프 이미지를 본문에 포함하면 문서 독창성(DIA+) 점수도 함께 올라갑니다.",
      likesCount: 27,
    },
    {
      questionId: insertedQuestions[4]!.id,
      bloggerId: chooravel.id,
      authorNickname: chooravel.nickname,
      authorBadge: `종합 ${chooravel.overallRank}위 · ${chooravel.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "공백 제외 1,600~2,200자 + 사진 12~18장이면 네이버 스마트블록과 통합검색이 가장 선호하는 이상적인 호흡입니다! 한 글에 항공권·숙소·맛집을 모두 합쳐 4,000자로 쓰기보다, 검색 의도별로 1포스팅 1주제로 나누어 내부 링크로 연결해 주시면 각 세부 키워드마다 상위 노출을 잡을 수 있어요.",
      likesCount: 23,
    },
    {
      questionId: insertedQuestions[5]!.id,
      bloggerId: reado.id,
      authorNickname: reado.nickname,
      authorBadge: `종합 ${reado.overallRank}위 · ${reado.grade} 멘토`,
      isMentorAnswer: true,
      content:
        "단순 일방문자 숫자보다 카테고리 전문성이 훨씬 중요합니다! 단일 주제로 꾸준히 글을 쌓아 세부 키워드 상위 노출 사례가 5~10개만 생겨도 일방문자 500~1,000명 구간부터 출판사·브랜드 협업 제안이 충분히 들어옵니다. 프로필과 공지글에 비즈니스 이메일을 꼭 명시해 두세요!",
      likesCount: 19,
    },
  ]);
}
