/**
 * 실제 활동 사진.
 *
 * 원본은 저장소의 `images/` 에 있고, 여기 있는 것은 웹용으로 줄인 것이다
 * (합계 61MB → 1.8MB). 4000px·44MB 짜리를 그대로 번들에 넣으면 첫 로딩이 무너진다.
 *
 * `attached_assets` 는 건드리지 않는다(그쪽은 Replit 시절 산출물이라 손대지 말라는
 * 지시가 있다). 새 사진은 전부 이 폴더에 둔다.
 *
 * 대체 텍스트를 사진마다 같이 둔다. 쓰는 쪽에서 매번 지어내면 화면마다 달라지고,
 * 사람이 찍힌 사진이라 설명이 어긋나면 곤란하다.
 */
import cohortGroup from "./cohort-group.jpg";
import awards from "./awards.jpg";
import seminarRoom from "./seminar-room.jpg";
import projectShowcase from "./project-showcase.jpg";
import talkCode from "./talk-code.jpg";
import sessionSlide from "./session-slide.jpg";
import workDevroute from "./work-devroute.jpg";
import workArchitecture from "./work-architecture.jpg";
import workMobile from "./work-mobile.jpg";
import workCctv from "./work-cctv.jpg";
import mentoringTeam from "./mentoring-team.jpg";
import lectureHall from "./lecture-hall.jpg";

export type Photo = { src: string; alt: string };

/** 활동 사진 — 사람이 찍힌 것. */
export const PHOTOS = {
  cohortGroup: { src: cohortGroup, alt: "Seeds 기수 단체 사진" },
  awards: { src: awards, alt: "수료식에서 상장을 받은 학생들" },
  seminarRoom: { src: seminarRoom, alt: "세미나가 진행 중인 강의실" },
  projectShowcase: { src: projectShowcase, alt: "프로젝트 결과를 발표하는 모습" },
  talkCode: { src: talkCode, alt: "코드를 함께 보는 세션" },
  sessionSlide: { src: sessionSlide, alt: "웹 기초와 보안을 다룬 세션 슬라이드" },
  mentoringTeam: { src: mentoringTeam, alt: "멘토와 팀이 함께 작업하는 모습" },
  lectureHall: { src: lectureHall, alt: "강의를 듣는 학생들" },
} satisfies Record<string, Photo>;

/**
 * 학생들이 실제로 만든 것.
 *
 * 설명은 화면에 보이는 것만 적는다 — 팀 이름이나 성과는 지어내지 않는다.
 */
export const WORKS: (Photo & { title: string; note: string })[] = [
  {
    src: workCctv,
    alt: "드론 카메라 영상에서 헬멧 착용 여부를 인식하는 화면",
    title: "지능형 CCTV 해상 안전 모니터링",
    note: "YOLOv8 로 헬멧 착용 여부를 인식한다.",
  },
  {
    src: workDevroute,
    alt: "기업 정보를 검색하는 웹 화면",
    title: "기업 정보 검색 서비스",
    note: "채용 공고와 기업 정보를 한 화면에서 훑는다.",
  },
  {
    src: workMobile,
    alt: "여러 화면이 나열된 모바일 앱 시연 이미지",
    title: "모바일 앱",
    note: "기록·타이머·커뮤니티를 담은 앱.",
  },
  {
    src: workArchitecture,
    alt: "프런트엔드·백엔드·데이터베이스 구성을 그린 아키텍처 다이어그램",
    title: "아키텍처 설계",
    note: "기능만 만들지 않는다. 구조를 그리고 시작한다.",
  },
];
