import { z } from "zod";

/**
 * 검증 실패 문구를 한국어로 바꾼다.
 *
 * 공개 지원서에서 빈 칸을 두고 제출하면 지원자가 이런 걸 봤다:
 *
 *   String must contain at least 1 character(s)
 *   Invalid email
 *
 * 한국 고등학생·대학생이 쓰는 화면이고, 지원서는 이 사이트에서 가장 중요한
 * 폼이다. 여기서 영어 오류가 뜨면 "고장 났나" 로 읽히고 그대로 이탈한다.
 *
 * 스키마(`@workspace/api-zod`)는 서버와 공유하므로 건드리지 않는다. 대신
 * 화면 쪽에서 오류 문구만 갈아 끼운다 — 검증 규칙 자체는 그대로다.
 *
 * `zodResolver(schema, { errorMap: koErrorMap })` 로 넘긴다.
 */
export const koErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "필수 항목입니다" };
      }
      if (issue.expected === "number") return { message: "숫자로 입력해 주세요" };
      return { message: "형식이 올바르지 않습니다" };

    case z.ZodIssueCode.too_small:
      // 문자열의 최소 1자는 사실상 "비어 있음"이다. 글자 수를 말하면 더
      // 헷갈리므로 필수 항목이라고만 알린다.
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: "필수 항목입니다" }
          : { message: `${issue.minimum}자 이상 입력해 주세요` };
      }
      if (issue.type === "number") return { message: `${issue.minimum} 이상이어야 합니다` };
      if (issue.type === "array") return { message: `${issue.minimum}개 이상 선택해 주세요` };
      return { message: "값이 너무 작습니다" };

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `${issue.maximum}자 이내로 입력해 주세요` };
      if (issue.type === "number") return { message: `${issue.maximum} 이하여야 합니다` };
      if (issue.type === "array") return { message: `${issue.maximum}개 이하로 선택해 주세요` };
      return { message: "값이 너무 큽니다" };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "이메일 주소 형식이 아닙니다" };
      if (issue.validation === "url") return { message: "주소(URL) 형식이 아닙니다" };
      return { message: "형식이 올바르지 않습니다" };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: "목록에서 선택해 주세요" };

    case z.ZodIssueCode.invalid_literal:
      // 약관 동의처럼 특정 값을 요구하는 자리다.
      return { message: "동의가 필요합니다" };

    default:
      // 여기까지 오면 zod 기본 문구가 나간다. 영어가 남을 수 있으므로,
      // 새 검증 규칙을 추가할 때 이 스위치도 같이 늘려야 한다.
      return { message: ctx.defaultError };
  }
};
