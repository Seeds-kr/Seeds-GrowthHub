import { useQuery } from "@tanstack/react-query";
import { api } from "./mvp3-api";

export const SITE_CONTENT_KEYS = [
  "page.home",
  "page.recruit",
  "page.about",
  "page.program",
  "page.faq",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export type SiteContentRow = {
  key: string;
  label: string;
  value: unknown;
  updatedAt: string | null;
  updatedBy: number | null;
};

export type HomeContent = {
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
  stats: { eyebrow: string; title: string; items: { value: string; label: string }[] };
  about: { eyebrow: string; title: string; body: string; ctaLabel: string; ctaHref: string };
  projects: {
    eyebrow: string;
    title: string;
    body: string;
    items: { title: string; summary: string; status: string }[];
  };
  activities: {
    eyebrow: string;
    title: string;
    items: { date: string; title: string; summary: string }[];
  };
  recruitBanner: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
};

export type RecruitContent = {
  hero: { eyebrow: string; headlineLine1: string; headlineLine2: string; body: string; ctaLabel: string };
  intro: { eyebrow: string; title: string; body: string; features: { title: string; desc: string }[] };
  applicants: { eyebrow: string; title: string; items: string[] };
  flow: { eyebrow: string; title: string; steps: { month: string; title: string; desc: string }[] };
  schedule: { eyebrow: string; title: string; steps: { phase: string; date: string; desc: string }[] };
  faqTeaser: { eyebrow: string; title: string; items: { q: string; a: string }[]; ctaLabel: string };
  cta: { title: string; body: string; ctaLabel: string };
};

export type AboutContent = {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  values: { label: string; desc: string }[];
};

export type ProgramContent = {
  title: string;
  curriculum: { heading: string; items: { title: string; desc: string }[] };
  benefits: { heading: string; items: string[] };
};

export type FaqContent = {
  title: string;
  items: { q: string; a: string }[];
};

export const HOME_DEFAULT: HomeContent = {
  hero: {
    eyebrow: "Student Developer Club",
    title: "함께 코드를 심고, 함께 자랍니다",
    body: "Seeds는 학생 개발자들이 모여 매 학기 함께 스터디하고, 사이드 프로젝트를 만들고, 해커톤에 나가는 동아리입니다. 졸업한 선배들은 다양한 회사와 팀에서 개발자로 일하고 있습니다.",
    primaryCtaLabel: "모집 알아보기",
    primaryCtaHref: "/recruit",
    secondaryCtaLabel: "활동 보기",
    secondaryCtaHref: "/program",
  },
  stats: {
    eyebrow: "By the Numbers",
    title: "숫자로 보는 Seeds",
    items: [
      { value: "5", label: "기수 운영" },
      { value: "120+", label: "누적 부원" },
      { value: "24", label: "사이드 프로젝트" },
      { value: "8", label: "수상 해커톤" },
    ],
  },
  about: {
    eyebrow: "About Seeds",
    title: "Seeds가 만드는 것",
    body: "Seeds는 강의를 듣는 동아리가 아니라, 직접 손으로 무언가를 만들어 보는 동아리입니다. 매주 모여 함께 배우고, 한 학기 동안 팀을 이뤄 사이드 프로젝트를 빌드하고, 학기말에 데모 데이로 공유합니다. 졸업 후에도 알럼나이 채널에서 꾸준히 연결됩니다.",
    ctaLabel: "더 알아보기",
    ctaHref: "/about",
  },
  projects: {
    eyebrow: "Featured Projects",
    title: "이번 학기 사이드 프로젝트",
    body: "현재 활동 중인 부원 팀들이 만들고 있는 제품을 소개합니다.",
    items: [
      { title: "캠퍼스 출결 모바일 앱", summary: "교내 강의실 NFC 태그로 한 번에 출결을 처리하는 앱. 베타 사용자 200명 모집 중.", status: "진행 중" },
      { title: "동아리 운영 관리 SaaS", summary: "출결·과제·발표 자료를 한 곳에서 관리하는 동아리용 도구. 교내 4개 동아리에 시범 도입.", status: "완료" },
      { title: "오픈소스 문서 번역 봇", summary: "GitHub PR로 영어 문서를 한국어로 번역해 주는 LLM 기반 봇. v0.2 공개.", status: "진행 중" },
    ],
  },
  activities: {
    eyebrow: "Recent Activities",
    title: "최근 활동",
    items: [
      { date: "2025.04", title: "5기 데모 데이", summary: "8개 팀의 한 학기 사이드 프로젝트 결과를 공유했습니다." },
      { date: "2025.03", title: "교내 해커톤 우승", summary: "Seeds 연합팀이 24시간 해커톤에서 1위와 산업혁신 특별상을 받았습니다." },
      { date: "2025.02", title: "신입 부원 OT", summary: "5기 신입 부원 28명이 합류해 트랙별 스터디를 시작했습니다." },
    ],
  },
  recruitBanner: {
    eyebrow: "다음 기수 모집",
    title: "Seeds와 함께 만들 준비가 되셨나요?",
    body: "다음 기수 모집 일정과 지원 방법을 확인해 보세요.",
    ctaLabel: "모집 페이지로",
    ctaHref: "/recruit",
  },
};

export const RECRUIT_DEFAULT: RecruitContent = {
  hero: {
    eyebrow: "Student Developer Club",
    headlineLine1: "함께 만들",
    headlineLine2: "학생 개발자를 찾습니다",
    body: "Seeds는 학생 개발자들이 모여 매 학기 함께 스터디하고, 사이드 프로젝트를 만들고, 해커톤에 나가는 동아리입니다. 배운 것을 코드로 옮기고 싶은 분이라면 누구나 환영합니다.",
    ctaLabel: "지원하기",
  },
  intro: {
    eyebrow: "What is Seeds",
    title: "Seeds는 어떤 동아리인가요?",
    body: "Seeds는 학생 자치 개발 동아리입니다. 매 학기 새로운 부원을 모집해 정기 스터디·사이드 프로젝트·해커톤·선배 멘토링으로 한 학기를 함께 보내고, 학기 끝에 데모 데이로 결과물을 공유합니다.",
    features: [
      { title: "정기 스터디", desc: "주 1회 모여 언어·프레임워크·CS 기초를 함께 학습" },
      { title: "사이드 프로젝트", desc: "기획·디자인·개발이 한 팀이 되어 한 학기 동안 제품을 빌드" },
      { title: "선배 네트워크", desc: "현직 개발자가 된 졸업생들의 코드 리뷰·커리어 멘토링" },
    ],
  },
  applicants: {
    eyebrow: "Who Should Apply",
    title: "이런 분들을 찾고 있습니다",
    items: [
      "코드를 좋아하고, 손으로 무언가를 만들어 보고 싶은 학생",
      "기획·디자인·개발 중 어느 역할이든 끝까지 마무리해 본 경험(또는 의지)이 있는 학생",
      "혼자보다 팀으로 같이 배우는 게 더 즐거운 학생",
      "주 1회 정기 모임과 학기말 데모 데이에 꾸준히 참여 가능한 학생",
      "고등학생·대학생 누구나 (전공 무관, 비전공자 환영)",
      "전공·학년·실력보다 꾸준함과 호기심이 더 중요합니다",
    ],
  },
  flow: {
    eyebrow: "Semester Flow",
    title: "한 학기의 흐름",
    steps: [
      { month: "Week 1-2", title: "온보딩 & 팀 빌딩", desc: "OT, 자기소개, 관심 스택별 팀 매칭" },
      { month: "Week 3-6", title: "정기 스터디", desc: "프론트/백엔드/CS 트랙별 주간 스터디 + 토이 프로젝트" },
      { month: "Week 7-11", title: "사이드 프로젝트", desc: "팀별로 한 학기 동안 제품을 기획·디자인·개발" },
      { month: "Week 12", title: "데모 데이", desc: "한 학기 결과물을 부원·선배·외부 게스트에게 공유" },
    ],
  },
  schedule: {
    eyebrow: "Recruitment Schedule",
    title: "모집 일정",
    steps: [
      { phase: "지원 접수", date: "10.01 — 10.15", desc: "온라인 지원서 제출" },
      { phase: "서류 검토", date: "10.16 — 10.20", desc: "포트폴리오·지원서 종합 검토" },
      { phase: "커피챗 면접", date: "10.25 — 10.27", desc: "운영진과의 30분 가벼운 대화" },
      { phase: "최종 합격 발표", date: "11.01", desc: "개별 안내 및 OT 일정 공지" },
    ],
  },
  faqTeaser: {
    eyebrow: "FAQ",
    title: "자주 묻는 질문",
    items: [
      { q: "회비가 있나요?", a: "Seeds는 학생 자치 동아리로 별도의 정기 회비는 없습니다. 일부 활동(외부 컨퍼런스 등)은 자율 분담입니다." },
      { q: "비전공자도 가능한가요?", a: "환영합니다. 부원의 약 1/3이 비전공/복수전공 학생입니다." },
      { q: "다음 학기에 다시 지원해도 되나요?", a: "물론입니다. 이번에 인연이 닿지 않더라도 다음 기수에 다시 만나요." },
    ],
    ctaLabel: "전체 FAQ 보기",
  },
  cta: {
    title: "함께 만들 사람을 기다립니다",
    body: "지원서 작성에 20분이면 충분합니다. 지금까지 만들어 본 것·만들어 보고 싶은 것을 솔직하게 적어주세요.",
    ctaLabel: "지원하기",
  },
};

export const ABOUT_DEFAULT: AboutContent = {
  title: "Seeds 소개",
  intro: "Seeds는 함께 만들고 배우는 학생 개발자 동아리입니다. 정기 스터디·사이드 프로젝트·해커톤·선배 멘토링을 통해 학생들이 직접 손으로 제품을 만들어 보는 경험을 쌓아갑니다.",
  sections: [
    { heading: "우리의 미션", body: "혼자 강의를 듣는 것을 넘어, 동료와 함께 코드를 짜고 제품을 끝까지 만들어 보는 경험을 제공합니다. 전공·학년·실력보다 호기심과 꾸준함을 더 중요하게 생각합니다." },
  ],
  values: [
    { label: "함께 짓기", desc: "혼자 빠른 것보다, 함께 끝까지 가는 것을 선택합니다." },
    { label: "꾸준함", desc: "한 번의 폭발보다 매주의 작은 PR을 더 신뢰합니다." },
    { label: "오픈", desc: "배운 것은 회고로, 만든 것은 오픈소스로 공유합니다." },
  ],
};

export const PROGRAM_DEFAULT: ProgramContent = {
  title: "활동 안내",
  curriculum: {
    heading: "한 학기 흐름",
    items: [
      { title: "Week 1-2: 온보딩 & 팀 빌딩", desc: "OT, 자기소개, 관심 스택별 팀 매칭" },
      { title: "Week 3-6: 정기 스터디", desc: "프론트/백엔드/CS 트랙별 주간 스터디 + 토이 프로젝트" },
      { title: "Week 7-11: 사이드 프로젝트", desc: "팀별로 한 학기 제품을 기획·디자인·개발" },
      { title: "Week 12: 데모 데이", desc: "한 학기 결과물을 부원·선배·외부 게스트에게 공유" },
    ],
  },
  benefits: {
    heading: "활동 혜택",
    items: [
      "교내 동아리방 자유 사용 + 정기 모임 장소 지원",
      "현직 개발자 졸업생의 코드 리뷰 & 커리어 멘토링",
      "외부 해커톤·컨퍼런스 참가비 일부 지원",
      "스터디 도서/유료 강의 일부 지원",
      "졸업생 알럼나이 채널 가입 자격",
    ],
  },
};

export const FAQ_DEFAULT: FaqContent = {
  title: "자주 묻는 질문",
  items: [
    { q: "지원 자격은 어떻게 되나요?", a: "고등학생·대학생 누구나 지원 가능합니다. 전공이나 학년 제한은 없으며, 비전공자도 환영합니다. 코드에 대한 호기심과 꾸준히 참여할 의지가 가장 중요합니다." },
    { q: "면접은 어떻게 진행되나요?", a: "서류 통과자에 한해 운영진과 30분 정도의 가벼운 커피챗 형태로 진행됩니다. 지금까지 만들어 본 것이나 만들어 보고 싶은 것에 대해 자유롭게 이야기합니다." },
    { q: "회비나 참가비가 있나요?", a: "Seeds는 학생 자치 동아리로 별도의 정기 회비는 없습니다. 일부 활동(외부 컨퍼런스 참가 등)은 자율적으로 분담합니다." },
    { q: "해외에서도 활동할 수 있나요?", a: "정기 모임과 데모 데이가 한국 시간 기준으로 진행되며 일부 오프라인 행사가 있어, 원칙적으로 국내에서 활동 가능한 분을 우선 선발합니다." },
  ],
};

function isShapeCompatible(value: unknown, ref: unknown): boolean {
  if (ref === null || ref === undefined) return true;
  if (Array.isArray(ref)) return Array.isArray(value);
  if (typeof ref === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    for (const k of Object.keys(ref as Record<string, unknown>)) {
      if (!isShapeCompatible((value as Record<string, unknown>)[k], (ref as Record<string, unknown>)[k])) {
        return false;
      }
    }
    return true;
  }
  return typeof value === typeof ref;
}

export function useSiteContent<T>(key: SiteContentKey, fallback: T) {
  const q = useQuery({
    queryKey: ["site-content", key],
    queryFn: () => api<SiteContentRow>(`/site-content/${encodeURIComponent(key)}`),
  });
  const fetched = q.data?.value as T | undefined;
  const value = fetched !== undefined && isShapeCompatible(fetched, fallback) ? fetched : fallback;
  return { value, isLoading: q.isLoading, isError: q.isError };
}

export function useAdminSiteContents() {
  return useQuery({
    queryKey: ["admin", "site-content"],
    queryFn: () => api<{ items: SiteContentRow[] }>(`/admin/site-content`),
  });
}

export async function saveSiteContent(key: string, value: unknown) {
  return api<SiteContentRow>(`/admin/site-content/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: { value },
  });
}
