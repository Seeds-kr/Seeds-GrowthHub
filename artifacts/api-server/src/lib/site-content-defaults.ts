import { eq, sql } from "drizzle-orm";

export const SITE_CONTENT_KEYS = [
  "page.home",
  "page.recruit",
  "page.about",
  "page.program",
  "page.faq",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export const SITE_CONTENT_LABELS: Record<SiteContentKey, string> = {
  "page.home": "홈 페이지 (/) — 브랜드/현황/활동",
  "page.recruit": "모집 페이지 (/recruit) — 지원 대상/일정/CTA",
  "page.about": "소개 페이지 (/about)",
  "page.program": "프로그램 페이지 (/program)",
  "page.faq": "FAQ 페이지 (/faq)",
};

const HOME_DEFAULT = {
  hero: {
    eyebrow: "STUDENT DEVELOPER CLUB",
    title: "함께 배우고 도전하는\n학생 개발자들의 작은 생태계",
    body: "Seeds는 씨앗으로 시작해 새싹과 묘목을 지나 튼튼한 나무로 나아가는 과정을 함께합니다. 현업 10년차 이상의 멘토님과 SW마에스트로 출신 운영진이 함께하는 연합 코딩 동아리예요.",
    primaryCtaLabel: "모집 알아보기",
    primaryCtaHref: "/recruit",
    secondaryCtaLabel: "활동 보기",
    secondaryCtaHref: "/program",
  },
  stats: {
    eyebrow: "BY THE NUMBERS",
    title: "숫자로 보는 Seeds",
    items: [
      { value: "3년+", label: "운영 기간" },
      { value: "20+", label: "운영 프로젝트" },
      { value: "96명", label: "멘토·운영진·회원" },
      { value: "10개월", label: "프로젝트 주기" },
    ],
  },
  about: {
    eyebrow: "ABOUT SEEDS",
    title: "Seeds가 만드는 것",
    body: "기능 구현에 그치지 않고, 기획·설계·구현·테스트·배포로 이어지는 SDLC 전 과정을 멘토님과 함께 경험합니다. 하드스킬뿐 아니라 의사소통 같은 소프트스킬도 함께 익혀요. 졸업 후에도 정기모임과 네트워킹으로 꾸준히 연결됩니다.",
    ctaLabel: "더 알아보기",
    ctaHref: "/about",
  },
  projects: {
    eyebrow: "ACTIVITIES",
    title: "Seeds의 4가지 활동",
    body: "프로젝트, 스터디, 강의·콘테스트, 네트워킹 — Seeds에서는 네 가지 흐름이 동시에 움직입니다.",
    items: [
      { title: "창의도전 프로젝트", summary: "매년 2~11월 10개월간 진행되는 팀 프로젝트. SDLC 전 과정을 멘토와 함께 경험합니다.", status: "10개월" },
      { title: "자유 제안 스터디", summary: "언어·프레임워크 기초부터 디자인 패턴·DevOps·AI Agent까지 자유롭게 주제를 제안하고 운영합니다.", status: "기초·기술" },
      { title: "강의·세미나·콘테스트", summary: "AI 특강, 서비스 기획 세미나, 팀/학교 대항 콘테스트로 지식과 실력을 함께 끌어올려요.", status: "부스트업" },
      { title: "커뮤니티 네트워킹", summary: "프로젝트 회원, 졸업 회원, 운영진, 멘토진이 함께하는 월간 정기모임으로 인사이트와 진로를 나눠요.", status: "월간 모임" },
    ],
  },
  activities: {
    eyebrow: "YEARS",
    title: "년도별 활동",
    items: [
      { date: "2026", title: "2026 Seeds", summary: "차년도 정기 모집 예정." },
      { date: "2025", title: "2025 Seeds", summary: "프로젝트 활동 · 자유 스터디 · 콘테스트 · 정기모임 운영 중." },
      { date: "2024", title: "2024 Seeds", summary: "프로젝트 활동과 콘테스트, 정기모임을 통해 성장." },
      { date: "2023", title: "2023 Seeds", summary: "Seeds 첫 출발 — 멘토진과 운영진이 함께 첫 기수 프로젝트를 진행." },
    ],
  },
  recruitBanner: {
    eyebrow: "RECRUITMENT",
    title: "다음 기수와 함께할 학생 개발자를 기다립니다",
    body: "정기 모집은 매년 12월. 정기모임·스터디·팀 합류는 수시로도 함께할 수 있어요.",
    ctaLabel: "모집 페이지로",
    ctaHref: "/recruit",
  },
};

const RECRUIT_DEFAULT = {
  hero: {
    eyebrow: "RECRUITMENT",
    headlineLine1: "함께 자랄",
    headlineLine2: "학생 개발자를 기다립니다",
    body: "씨앗에서 나무로 — 현업 10년차 이상 멘토님과 함께 10개월 프로젝트, 자유 스터디, 콘테스트, 네트워킹을 통해 성장합니다.",
    ctaLabel: "지원하기",
  },
  intro: {
    eyebrow: "WHAT IS SEEDS",
    title: "Seeds는 어떤 동아리인가요?",
    body: "Seeds는 현업 10년차 이상 멘토님과 SW마에스트로 출신 운영진이 함께하는 연합 코딩 동아리입니다. 매년 2월부터 11월까지 10개월간 프로젝트를 진행하며, 자유 스터디·세미나·콘테스트·정기모임을 통해 함께 성장합니다.",
    features: [
      { title: "10개월 프로젝트", desc: "기획부터 배포까지 SDLC 전 과정을 멘토와 함께" },
      { title: "자유 제안 스터디", desc: "기초 언어부터 AI·DevOps·디자인 패턴까지 자유롭게" },
      { title: "월간 정기모임", desc: "강연·진로 상담·네트워킹의 자리" },
    ],
  },
  applicants: {
    eyebrow: "WHO SHOULD APPLY",
    title: "이런 분들을 기다립니다",
    items: [
      "스터디부터 팀 프로젝트 수행까지 가능하신 분",
      "SW 분야 최고 전문가의 멘토링을 받으며 성장하고 싶으신 분",
      "활동 기간 내 Seeds 활동에 몰입할 수 있으신 분",
      "혼자보다 팀으로 함께 배우는 게 더 즐거우신 분",
      "고등학생·대학생 누구나 (전공 무관, 비전공자 환영)",
    ],
  },
  flow: {
    eyebrow: "PROJECT FLOW",
    title: "10개월 프로젝트의 흐름",
    steps: [
      { month: "2월", title: "팀 빌딩 & 기획", desc: "관심 주제·기술 스택으로 팀을 꾸리고 멘토와 함께 기획" },
      { month: "3-5월", title: "설계 & 초기 구현", desc: "요구사항·아키텍처 설계와 핵심 기능 구현" },
      { month: "6-9월", title: "본격 개발 & 멘토링", desc: "기능 확장과 코드 품질·성능·배포 고민. 정기 코드 리뷰" },
      { month: "10-11월", title: "테스트·배포·공유", desc: "사용자 테스트와 배포 마무리, 콘테스트·정기모임에서 공유" },
    ],
  },
  schedule: {
    eyebrow: "RECRUITMENT SCHEDULE",
    title: "모집 일정",
    steps: [
      { phase: "🗓️ 정기모집", date: "매년 12월", desc: "차년도 프로젝트 활동을 함께할 분 (지금은 정기 모집 기간이 아니에요)" },
      { phase: "☀️ 수시모집", date: "상시", desc: "정기모임·스터디·팀 합류를 원하는 분 (팀 단위 지원도 가능)" },
      { phase: "📬 문의", date: "이메일 · 오픈채팅", desc: "seeds.code@gmail.com / 카카오톡 오픈채팅" },
    ],
  },
  faqTeaser: {
    eyebrow: "FAQ",
    title: "자주 묻는 질문",
    items: [
      { q: "Seeds는 어떤 동아리인가요?", a: "학생 개발자들이 함께 배우고 도전하는 연합 코딩 동아리입니다. SW마에스트로 출신 운영진과 현업 10년 이상 멘토님들과 함께 프로젝트·스터디·세미나·네트워킹으로 성장합니다." },
      { q: "프로젝트는 어떻게 진행되나요?", a: "매년 2월부터 11월까지 10개월간 진행됩니다. 멘토님과 함께 기획·설계·구현·테스트·배포까지 SDLC 전 과정을 경험해요." },
      { q: "졸업 후에도 참여할 수 있나요?", a: "네, Seeds는 졸업 후에도 정기모임이나 세미나에 참여하고 후배에게 도움을 줄 수 있는 지속 커뮤니티입니다." },
    ],
    ctaLabel: "전체 FAQ 보기",
  },
  cta: {
    title: "함께 만들 학생 개발자를 기다립니다",
    body: "지원서 작성에 20분이면 충분합니다. 지금까지 만들어 본 것과 만들어 보고 싶은 것을 솔직하게 적어주세요.",
    ctaLabel: "지원하기",
  },
};

const ABOUT_DEFAULT = {
  title: "Seeds 소개",
  intro:
    "Seeds는 씨앗으로 시작해 새싹과 묘목을 지나 튼튼한 나무로 나아가는 과정이라는 의미를 담고 있습니다. 함께 배우고 도전하는 학생 개발자들의 작은 생태계예요.\n\n현업 10년차 이상의 학생 양성에 진심이신 멘토님들과, SW마에스트로 수료생 운영진이 함께하는 연합 코딩 동아리입니다.",
  sections: [
    {
      heading: "1. 창의도전 프로젝트를 통한 성장",
      body: "매년 2월부터 11월까지 10개월간 진행되는 프로젝트를 통해 기획·설계·구현·테스트·배포로 이어지는 SDLC 전 과정을 경험합니다.\n\n현업 10년차 이상의 멘토님과 함께하여 수준 높은 프로젝트를 수행하며, 설계 같은 하드스킬뿐 아니라 의사소통 등 소프트스킬도 함께 배워요. 나아가 프로젝트를 고도화하며 필요한 기술을 고민하고 연구해 보는 기회도 가질 수 있어요.",
    },
    {
      heading: "2. 각자에게 딱 맞는 스터디",
      body: "언어·프레임워크 등 기초 스터디와 디자인 패턴, 아키텍처 스타일, DevOps, AI Agent, CV 등 기술 스터디까지 — 각자에게 맞는 스터디로 성장해요. 자유롭게 스터디 주제를 제안하고 진행할 수 있어요.",
    },
    {
      heading: "3. 강의·세미나·콘테스트로 부스트업",
      body: "AI 기술 특강, 서비스 기획 세미나 등 다양한 형식의 지식 공유회를 통해 멘토님·선배·동료 학생 사이에서 지식을 나눠요.\n\n팀 대항전·학교 대항전·개인전 등 콘테스트 형태로 디버깅, 성능 최적화, 코드 취약점, 디자인 패턴, IT 트렌드 같은 개발자에게 필요한 기술과 개념을 익혀요.",
    },
    {
      heading: "4. 커뮤니티 네트워킹",
      body: "프로젝트 활동 회원, 졸업 회원, 운영진, 멘토진까지 다양한 구성원으로 이루어진 Seeds는 네트워킹을 통해 멋진 시너지를 낸다고 믿어요.\n\n매월 알찬 콘텐츠로 준비된 정기모임을 통해 친분을 쌓고, 정규 활동에서 채우지 못한 인사이트 공유와 진로 고민에 대한 이야기를 나눠요.",
    },
    {
      heading: "Seeds의 구성",
      body: "SW마에스트로 멘토님과 IT 전문가로 이루어진 멘토진, 그리고 SW마에스트로 출신 운영진이 함께합니다.",
    },
  ],
  values: [
    { label: "만들어보기", desc: "강의 대신 직접 손으로 만들어 보는 것을 더 신뢰합니다." },
    { label: "함께 리뷰하기", desc: "코드는 혼자 쓰지만, 같이 읽을 때 더 좋아져요." },
    { label: "꾸준히", desc: "한 번의 폭발보다 매주의 작은 PR을 더 신뢰합니다." },
  ],
};

const PROGRAM_DEFAULT = {
  title: "활동 안내",
  curriculum: {
    heading: "10개월 프로젝트의 흐름",
    items: [
      { title: "2월 — 팀 빌딩 & 기획", desc: "관심 주제·기술 스택으로 팀을 꾸리고, 멘토와 함께 기획을 시작합니다." },
      { title: "3-5월 — 설계 & 초기 구현", desc: "요구사항·아키텍처 설계를 거쳐 핵심 기능 구현에 들어가요." },
      { title: "6-9월 — 본격 개발 & 멘토링", desc: "기능을 키우며 코드 품질·성능·배포까지 고민합니다. 정기 코드 리뷰가 진행돼요." },
      { title: "10-11월 — 테스트·배포·공유", desc: "사용자 테스트와 배포를 마무리하고, 콘테스트·정기모임에서 결과를 공유합니다." },
    ],
  },
  benefits: {
    heading: "함께 얻는 것",
    items: [
      "현업 10년차 이상 멘토님의 코드 리뷰와 설계 피드백",
      "기획·설계·구현·테스트·배포 SDLC 전 과정 경험",
      "기초·기술 스터디를 자유롭게 제안하고 운영할 권한",
      "팀 대항전·개인전 콘테스트로 실력 점검",
      "졸업 후에도 이어지는 정기모임과 네트워킹",
    ],
  },
};

const FAQ_DEFAULT = {
  title: "자주 묻는 질문",
  items: [
    { q: "Seeds는 어떤 동아리인가요?", a: "Seeds는 학생 개발자들이 함께 배우고 도전하는 연합 코딩 동아리입니다. SW마에스트로 출신 운영진과 10년 이상의 현업 경험을 가진 멘토님들과 함께 프로젝트·스터디·세미나·네트워킹으로 성장할 수 있습니다." },
    { q: "어떤 활동을 하나요?", a: "프로젝트 활동(기획부터 배포까지 SDLC 기반), 자유 제안 스터디(기초 언어부터 고급 기술까지), 세미나 & 콘테스트(AI·서비스 기획·IT 트렌드 강의와 실력 부스트업), 네트워킹(정기모임 교류)의 네 가지가 동시에 운영됩니다." },
    { q: "프로젝트는 어떻게 진행되나요?", a: "2월부터 11월까지 10개월간 진행됩니다. 멘토님들과 함께 수준 높은 프로젝트를 수행하며 단순 기능 구현을 넘어 설계·코드 품질·배포까지 고려하고, 필요한 소프트스킬도 함께 배워요." },
    { q: "스터디는 어떻게 참여하나요?", a: "Seeds 내에서 원하는 주제를 자유롭게 제안하고 팀을 꾸려 진행할 수 있습니다. 기초 스터디(언어·프레임워크)부터 AI·DevOps·디자인 패턴 같은 심화 주제까지 선택할 수 있어요. Java·TS·Spring Boot·React.js 같은 주축 언어/프레임워크 스터디는 기본 개설됩니다." },
    { q: "정기 모임은 어떤 형식인가요?", a: "매월 진행되는 정기모임에서는 개발 강연, 프로젝트 공유, 진로 고민 상담 등 다양한 주제로 진행됩니다. Seeds 구성원 간 네트워킹의 중요한 자리예요." },
    { q: "멘토링은 어떻게 이루어지나요?", a: "현업에서 10년 이상의 경험을 가진 멘토님들이 프로젝트와 세미나를 통해 기술적·커리어적 조언을 제공합니다. 직접 코드 리뷰를 받거나 특정 주제에 대한 심층 가이드를 받을 수도 있어요." },
    { q: "졸업 후에도 참여할 수 있나요?", a: "네! Seeds는 단순한 학생 모임이 아니라 지속적으로 네트워킹할 수 있는 커뮤니티입니다. 졸업 후에도 정기모임이나 세미나에 참여하고, 후배에게 도움을 줄 수 있어요." },
    { q: "가입은 어떻게 하나요?", a: "Seeds 모집 공고를 통해 지원서를 작성하고, 운영진과 간단한 인터뷰를 거쳐 최종 선발됩니다. 모집 일정은 공식 채널(홈페이지·SNS 등)을 통해 공지됩니다." },
    { q: "문의처를 알려주세요!", a: "카카오톡 오픈채팅(https://open.kakao.com/o/sqpmEzEf) 또는 이메일(seeds.code@gmail.com)로 연락 주세요." },
  ],
};

export const SITE_CONTENT_DEFAULTS: Record<SiteContentKey, unknown> = {
  "page.home": HOME_DEFAULT,
  "page.recruit": RECRUIT_DEFAULT,
  "page.about": ABOUT_DEFAULT,
  "page.program": PROGRAM_DEFAULT,
  "page.faq": FAQ_DEFAULT,
};

function isOldHomeShape(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "applicants" in (value as Record<string, unknown>) &&
    "schedule" in (value as Record<string, unknown>)
  );
}

// Detect pre-Notion-rewrite copy so it can be overwritten with the new
// student-developer-club defaults. We *only* match phrases that were verbatim
// in the previously-shipped defaults and that an admin is extremely unlikely
// to type by themselves — otherwise an admin-edited row could be silently
// reset every boot. Common Korean words (데모 데이, 커피챗, 탁월함, 학기말, …)
// are intentionally NOT in this list.
const LEGACY_COPY_SIGNATURES = [
  "Seeds Leadership Program",
  "실천적 리더를 양성",
  "글로벌 리더로 성장",
  "프리미엄 교육 프로그램",
] as const;

function isPreNotionCopy(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const flat = JSON.stringify(value);
  return LEGACY_COPY_SIGNATURES.some((sig) => flat.includes(sig));
}

export async function bootstrapSiteContents(
  db: typeof import("@workspace/db").db,
  siteContentsTable: typeof import("@workspace/db").siteContentsTable,
) {
  // One-time migration: if page.home still has the old (now-recruit) shape,
  // copy its current value to page.recruit (so any admin edits are preserved),
  // then reset page.home to the new defaults.
  const existing = await db.select().from(siteContentsTable);
  const byKey = new Map(existing.map((r) => [r.key, r]));
  const home = byKey.get("page.home");
  if (home && isOldHomeShape(home.value)) {
    if (!byKey.get("page.recruit")) {
      await db
        .insert(siteContentsTable)
        .values({
          key: "page.recruit",
          label: SITE_CONTENT_LABELS["page.recruit"],
          value: home.value as object,
        })
        .onConflictDoNothing({ target: siteContentsTable.key });
    }
    await db
      .update(siteContentsTable)
      .set({
        value: HOME_DEFAULT as object,
        label: SITE_CONTENT_LABELS["page.home"],
        updatedAt: new Date(),
      })
      .where(eq(siteContentsTable.key, "page.home"));
  }

  // Standard bootstrap: insert defaults if missing, refresh label.
  for (const key of SITE_CONTENT_KEYS) {
    const label = SITE_CONTENT_LABELS[key];
    const value = SITE_CONTENT_DEFAULTS[key];
    await db
      .insert(siteContentsTable)
      .values({ key, label, value: value as object })
      .onConflictDoNothing({ target: siteContentsTable.key });
    await db.execute(
      sql`UPDATE site_contents SET label = ${label} WHERE key = ${key}`,
    );
  }

  // One-time positioning migration: if any page still has pre-Notion-rewrite
  // copy (Leadership Program / 리더십 / 프리미엄 / placeholder student-club
  // text), reset it to the new Notion-sourced defaults. This overwrites admin
  // edits that still match the legacy copy — once an admin has customized
  // away from it, we leave it.
  const fresh = await db.select().from(siteContentsTable);
  for (const row of fresh) {
    if (!isPreNotionCopy(row.value)) continue;
    const key = row.key as SiteContentKey;
    if (!SITE_CONTENT_KEYS.includes(key)) continue;
    await db
      .update(siteContentsTable)
      .set({
        value: SITE_CONTENT_DEFAULTS[key] as object,
        updatedAt: new Date(),
      })
      .where(eq(siteContentsTable.key, key));
  }
}
