export const statusLabels: Record<string, string> = {
  submitted: "제출 완료",
  reviewing: "검토 중",
  interview: "면접 대상",
  accepted: "최종 합격",
  rejected: "불합격",
  waitlisted: "예비 후보",
  withdrawn: "지원 취소",
};

export const lifecycleLabels: Record<string, string> = {
  submitted: "접수",
  document_review: "서류 검토 중",
  document_review_completed: "서류 검토 완료",
  interview: "면접 단계",
  interview_scheduled: "면접 예정",
  interview_completed: "면접 완료",
  final_decision_made: "최종 결정",
  withdrawn: "지원 취소",
};

export const finalDecisionLabels: Record<string, string> = {
  pending: "미정",
  accepted: "합격",
  rejected: "불합격",
  waitlisted: "예비",
  withdrawn: "취소",
};

/**
 * 운영진이 드롭다운에서 **직접** 고르는 단계.
 *
 * 나머지 단계는 자동으로 온다 — 면접 예정·면접 완료는 면접 폼이, 최종 결정과
 * 지원 취소는 최종 결정 버튼이 쓴다. 한 사실에 쓰는 주체를 하나로 두지 않으면
 * 두 곳이 서로 다른 말을 하게 된다(레거시 `status` 가 정확히 그랬다).
 */
export const MANUAL_LIFECYCLE_STAGES = [
  "submitted",
  "document_review",
  "document_review_completed",
  "interview",
] as const;

export const interviewStatusLabels: Record<string, string> = {
  not_scheduled: "미배정",
  scheduled: "예정",
  completed: "완료",
  no_show: "불참",
  cancelled: "취소",
};

export const stageLabels: Record<string, string> = {
  document_review: "서류 평가",
  interview: "면접 평가",
};

export const recommendationLabels: Record<string, string> = {
  strong_accept: "적극 합격",
  accept: "합격",
  hold: "보류",
  reject: "불합격",
  strong_reject: "적극 불합격",
};

export const assignmentStatusLabels: Record<string, string> = {
  assigned: "배정됨",
  in_progress: "진행 중",
  completed: "완료",
};


/**
 * 제출 상태·모임 상태. 2026-08-25 추가.
 *
 * **여기에 새 사전을 더하기 전에 `lib/admin-labels.ts` 를 먼저 보라.** 이미
 * 27벌이 있고(과제·출석·기수·프로젝트·회계·운영 태스크 …), 모르고 또 만들면
 * 같은 값에 두 이름이 생겨 갈린다. 실제로 2026-08-25 에 여덟 벌을 더했다가
 * 다섯이 중복이라 도로 지웠다 — 기존 것이 값도 더 정확했다(회계는 7개 값인데
 * 새로 만든 건 5개였다).
 *
 * 아래 둘은 그때 **정말 없던 것**이다.
 *
 * 값은 `lib/db/src/schema/*.ts` 의 열거형에서 뽑았다. DB 에 CHECK 제약이 없어
 * 코드가 유일한 근거다.
 *
 * 사전에 없는 값은 `?? 원값` 으로 흘려보낸다. 빈칸으로 두면 "상태가 없다" 로
 * 읽히는데, 모르는 값이 온 것과 값이 없는 것은 다른 사건이다.
 */
export const submissionStatusLabels: Record<string, string> = {
  not_submitted: "미제출",
  submitted: "제출 완료",
  late: "지각 제출",
  reviewed: "확인함",
};

export const sessionStatusLabels: Record<string, string> = {
  scheduled: "예정",
  completed: "완료",
  cancelled: "취소",
};
