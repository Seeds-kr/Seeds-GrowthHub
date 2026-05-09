export const SITE_CONTENT_KEYS = [
  "page.home",
  "page.about",
  "page.program",
  "page.faq",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export const SITE_CONTENT_LABELS: Record<SiteContentKey, string> = {
  "page.home": "홈 페이지 (/)",
  "page.about": "소개 페이지 (/about)",
  "page.program": "프로그램 페이지 (/program)",
  "page.faq": "FAQ 페이지 (/faq)",
};

export const SITE_CONTENT_DEFAULTS: Record<SiteContentKey, unknown> = {
  "page.home": {
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
  },
  "page.about": {
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
  },
  "page.program": {
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
  },
  "page.faq": {
    title: "자주 묻는 질문",
    items: [
      { q: "지원 자격은 어떻게 되나요?", a: "대한민국에 거주 중인 고등학생 및 대학생 누구나 지원 가능합니다. 특정 전공이나 성적 제한은 없으나, 프로그램에 대한 열정과 성실한 참여 의지가 중요합니다." },
      { q: "면접은 어떻게 진행되나요?", a: "서류 합격자에 한해 온라인 화상 면접으로 진행됩니다. 면접 시간은 약 30분 내외이며, 지원서에 작성하신 내용을 바탕으로 심층적인 질문이 주어집니다." },
      { q: "프로그램 참가 비용이 있나요?", a: "아니오, Seeds 프로그램은 전액 무료로 운영됩니다. 최종 선발된 학생들에게는 교육, 멘토링 등 모든 혜택이 무상으로 제공됩니다." },
      { q: "해외 거주자도 지원 가능한가요?", a: "모든 프로그램 일정이 한국 시간에 맞춰 진행되며 주요 오프라인 행사가 있을 수 있어, 원칙적으로 국내 거주자를 우선적으로 선발하고 있습니다." },
    ],
  },
};

export async function bootstrapSiteContents(
  db: typeof import("@workspace/db").db,
  siteContentsTable: typeof import("@workspace/db").siteContentsTable,
) {
  const { sql } = await import("drizzle-orm");
  for (const key of SITE_CONTENT_KEYS) {
    const label = SITE_CONTENT_LABELS[key];
    const value = SITE_CONTENT_DEFAULTS[key];
    await db
      .insert(siteContentsTable)
      .values({ key, label, value: value as object })
      .onConflictDoNothing({ target: siteContentsTable.key });
    // Always refresh the label (cheap, keeps admin display fresh).
    await db.execute(
      sql`UPDATE site_contents SET label = ${label} WHERE key = ${key}`,
    );
  }
}
