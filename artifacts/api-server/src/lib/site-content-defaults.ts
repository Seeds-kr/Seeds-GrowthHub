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

const RECRUIT_DEFAULT = {
  hero: {
    eyebrow: "Seeds Leadership Program",
    headlineLine1: "차세대를 이끌어갈",
    headlineLine2: "리더들의 첫 걸음",
    body: "Seeds는 뛰어난 잠재력을 가진 학생들을 발굴하고 육성하는 프리미엄 교육 프로그램입니다. 최고의 멘토진과 함께 당신의 한계를 넘어보세요.",
    ctaLabel: "지원하기",
  },
  intro: {
    eyebrow: "What is Seeds",
    title: "Seeds는 어떤 프로그램인가요?",
    body: "Seeds는 사회적 임팩트를 만들고자 하는 고등학생과 대학생을 선발하여, 6개월간 체계적인 멘토링·프로젝트 실습·동료 네트워크를 제공하는 비영리 리더십 프로그램입니다. 매기수 소수정예로 운영되며, 졸업생들은 다양한 분야에서 변화를 만들어가고 있습니다.",
    features: [
      { title: "1:1 멘토링", desc: "각 분야 전문가와 함께하는 개인 맞춤 멘토링 세션" },
      { title: "임팩트 프로젝트", desc: "팀 단위로 사회 문제를 정의하고 해결책을 실행" },
      { title: "글로벌 네트워크", desc: "국내외 졸업생, 파트너 기관과의 지속적 연결" },
    ],
  },
  applicants: {
    eyebrow: "Who Should Apply",
    title: "이런 분들을 찾고 있습니다",
    items: [
      "사회 문제에 대한 자신만의 관점과 실행 의지가 있는 학생",
      "학교·동아리·지역사회에서 주도적으로 활동해 본 경험이 있는 학생",
      "단기 결과보다 깊이 있는 성장을 추구하는 학생",
      "팀워크와 다양성을 존중하고, 함께 배워나갈 준비가 된 학생",
      "고등학교 1학년부터 대학교 4학년까지 (만 16–24세 권장)",
      "프로그램 일정에 성실히 참여할 수 있는 학생",
    ],
  },
  flow: {
    eyebrow: "Program Flow",
    title: "6개월의 여정",
    steps: [
      { month: "Month 1", title: "온보딩", desc: "오리엔테이션, 동료 매칭, 자기 진단" },
      { month: "Month 2-3", title: "기초 역량", desc: "리더십·문제정의·커뮤니케이션 워크숍" },
      { month: "Month 4-5", title: "프로젝트 실행", desc: "팀 기반 임팩트 프로젝트 + 멘토링" },
      { month: "Month 6", title: "발표 & 졸업", desc: "최종 발표회와 알럼나이 네트워크 합류" },
    ],
  },
  schedule: {
    eyebrow: "Recruitment Schedule",
    title: "모집 일정",
    steps: [
      { phase: "서류 접수", date: "10.01 — 10.15", desc: "온라인 지원서 제출" },
      { phase: "서류 심사", date: "10.16 — 10.20", desc: "지원서 종합 평가" },
      { phase: "심층 면접", date: "10.25 — 10.27", desc: "1:1 온라인 면접" },
      { phase: "최종 합격", date: "11.01", desc: "개별 안내 및 OT" },
    ],
  },
  faqTeaser: {
    eyebrow: "FAQ",
    title: "자주 묻는 질문",
    items: [
      { q: "참가비가 있나요?", a: "Seeds는 비영리 프로그램으로, 선발된 모든 참가자에게 참가비를 받지 않습니다." },
      { q: "온라인으로만 진행되나요?", a: "주요 세션은 온라인으로 진행되며, 일부 워크숍과 발표회는 오프라인으로 운영됩니다." },
      { q: "재지원이 가능한가요?", a: "이전 기수에 합격하지 못한 경우에도 재지원이 가능합니다. 새로운 경험과 성장을 담아주세요." },
    ],
    ctaLabel: "전체 FAQ 보기",
  },
  cta: {
    title: "준비된 당신의 첫 걸음을 기다립니다",
    body: "지원서 작성에 30분이면 충분합니다. 형식보다는 당신의 진솔한 이야기를 담아주세요.",
    ctaLabel: "지원하기",
  },
};

const HOME_DEFAULT = {
  hero: {
    eyebrow: "Seeds Leadership Program",
    title: "씨앗을 심고, 함께 자랍니다",
    body: "Seeds는 사회를 바꾸려는 학생들이 모여 배우고 실험하는 비영리 리더십 커뮤니티입니다. 매기수 새로운 프로젝트가 시작되고, 졸업생들이 각자의 자리에서 변화를 만들어가고 있습니다.",
    primaryCtaLabel: "모집 알아보기",
    primaryCtaHref: "/recruit",
    secondaryCtaLabel: "프로그램 보기",
    secondaryCtaHref: "/program",
  },
  stats: {
    eyebrow: "By the Numbers",
    title: "숫자로 보는 Seeds",
    items: [
      { value: "5", label: "기수 운영" },
      { value: "120+", label: "누적 졸업생" },
      { value: "24", label: "진행/완료 프로젝트" },
      { value: "12", label: "파트너 기관" },
    ],
  },
  about: {
    eyebrow: "About Seeds",
    title: "Seeds가 만드는 변화",
    body: "Seeds는 단순한 교육 프로그램을 넘어, 학생들이 자신의 문제 의식을 실제 프로젝트로 풀어내고 동료·멘토와 함께 성장할 수 있는 장을 제공합니다. 졸업 후에도 알럼나이 네트워크를 통해 지속적으로 연결됩니다.",
    ctaLabel: "더 알아보기",
    ctaHref: "/about",
  },
  projects: {
    eyebrow: "Featured Projects",
    title: "지금 진행 중인 프로젝트",
    body: "현재 활동 중인 학생 팀들의 임팩트 프로젝트를 소개합니다.",
    items: [
      {
        title: "청소년 정서 케어 챗봇",
        summary: "또래 상담이 어려운 청소년을 위한 익명 대화 챗봇을 설계하고 베타 테스트 중입니다.",
        status: "진행 중",
      },
      {
        title: "지역 도서관 디지털 전환",
        summary: "공공 도서관의 도서 추천·예약 시스템을 리뉴얼하여 3개 지역에 시범 도입했습니다.",
        status: "완료",
      },
      {
        title: "다문화 가정 진로 멘토링",
        summary: "다문화 가정 청소년과 대학생 멘토를 매칭하는 플랫폼을 운영하고 있습니다.",
        status: "진행 중",
      },
    ],
  },
  activities: {
    eyebrow: "Recent Activities",
    title: "최근 활동",
    items: [
      { date: "2025.04", title: "5기 최종 발표회", summary: "12개 팀의 6개월 프로젝트 결과를 공유했습니다." },
      { date: "2025.03", title: "멘토 합동 워크숍", summary: "30명의 현직 멘토진과 함께한 콘텐츠 디자인 세션." },
      { date: "2025.02", title: "신규 파트너십 체결", summary: "지역 공익 재단 두 곳과 협력 협약을 체결했습니다." },
    ],
  },
  recruitBanner: {
    eyebrow: "다음 기수 모집",
    title: "Seeds와 함께 시작할 준비가 되셨나요?",
    body: "다음 기수 모집 일정과 지원 자격을 확인해보세요.",
    ctaLabel: "모집 페이지로",
    ctaHref: "/recruit",
  },
};

const ABOUT_DEFAULT = {
  title: "Seeds 소개",
  intro:
    "Seeds는 대한민국의 우수한 학생들을 선발하여 글로벌 리더로 성장할 수 있도록 지원하는 프리미엄 교육 프로그램입니다.",
  sections: [
    {
      heading: "우리의 미션",
      body: "단순한 학업 성취를 넘어, 사회적 문제에 공감하고 이를 해결할 수 있는 실천적 리더를 양성합니다. 다양한 분야의 전문가 멘토링과 실무 프로젝트를 통해 학생들의 잠재력을 최대한 끌어냅니다.",
    },
  ],
  values: [
    { label: "탁월함", desc: "끊임없는 학습과 성장을 추구합니다." },
    { label: "책임감", desc: "자신이 속한 공동체에 긍정적인 영향을 미칩니다." },
    { label: "혁신", desc: "새로운 관점으로 문제를 바라보고 해결책을 제시합니다." },
  ],
};

const PROGRAM_DEFAULT = {
  title: "프로그램 안내",
  curriculum: {
    heading: "커리큘럼",
    items: [
      { title: "1주차: 리더십 기초", desc: "자아 탐색 및 리더십 이론 학습" },
      { title: "2주차: 문제 해결 방법론", desc: "디자인 씽킹과 데이터 분석 기반 의사결정" },
      { title: "3주차: 팀 프로젝트", desc: "사회 문제 해결을 위한 협업 프로젝트 기획" },
      { title: "4주차: 최종 발표", desc: "프로젝트 결과물 발표 및 멘토 피드백" },
    ],
  },
  benefits: {
    heading: "참여 혜택",
    items: [
      "프로그램 전 과정 전액 무상 지원",
      "업계 최고 수준의 전문가 1:1 멘토링",
      "우수 수료자 대상 장학금 지급",
      "수료증 및 활동 증명서 발급",
      "알룸나이 네트워크 가입 자격 부여",
    ],
  },
};

const FAQ_DEFAULT = {
  title: "자주 묻는 질문",
  items: [
    { q: "지원 자격은 어떻게 되나요?", a: "대한민국에 거주 중인 고등학생 및 대학생 누구나 지원 가능합니다. 특정 전공이나 성적 제한은 없으나, 프로그램에 대한 열정과 성실한 참여 의지가 중요합니다." },
    { q: "면접은 어떻게 진행되나요?", a: "서류 합격자에 한해 온라인 화상 면접으로 진행됩니다. 면접 시간은 약 30분 내외이며, 지원서에 작성하신 내용을 바탕으로 심층적인 질문이 주어집니다." },
    { q: "프로그램 참가 비용이 있나요?", a: "아니오, Seeds 프로그램은 전액 무료로 운영됩니다. 최종 선발된 학생들에게는 교육, 멘토링 등 모든 혜택이 무상으로 제공됩니다." },
    { q: "해외 거주자도 지원 가능한가요?", a: "모든 프로그램 일정이 한국 시간에 맞춰 진행되며 주요 오프라인 행사가 있을 수 있어, 원칙적으로 국내 거주자를 우선적으로 선발하고 있습니다." },
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
}
