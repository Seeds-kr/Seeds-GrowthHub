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
