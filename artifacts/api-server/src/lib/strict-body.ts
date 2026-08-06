import type { z } from "zod";

/**
 * 스키마가 모르는 키가 오면 400 으로 되돌린다.
 *
 * zod 의 기본 동작은 모르는 키를 **조용히 버리는** 것이다. 그래서 필드명을 틀린
 * 호출자가 200 과 함께 멀쩡한 응답 본문을 받고, 실제로는 아무것도 안 바뀐다.
 *
 * 실제로 걸린 사례:
 *   PATCH /admin/applications/28  {"finalDecision":"accepted"}
 *   → 200, 지원서 전체를 돌려줌. final_decision 은 그대로 pending.
 *   올바른 경로는 PATCH /admin/applications/:id/final-decision 이었다.
 *   보낸 쪽에는 틀렸다는 신호가 하나도 없었다.
 *
 * **전 엔드포인트에 일괄 적용하지 않는다.** 일부 핸들러는 스키마 밖 필드를
 * 일부러 읽는다 — `POST /admin/users` 의 `extraRoles`·`opsRoles` 가 그렇다.
 * 그런 곳에 strict 를 걸면 멀쩡한 요청이 400 이 된다. 붙이기 전에 그 엔드포인트의
 * 호출자가 무엇을 보내는지 확인하고, 한 곳씩 넓힌다.
 *
 * 스펙(`lib/api-spec/openapi.yaml`)에 `additionalProperties: false` 를 넣는 길도
 * 있지만, 지금 스펙에는 그 키가 한 번도 안 쓰였고 바꾸면 생성된 두 패키지의
 * 계약이 전부 달라진다. 그건 따로 합의할 일이라 여기서는 호출 지점에서만 조인다.
 *
 * `error` 에 어떤 키가 문제였는지 담는다. 이게 없으면 400 을 받아도 여전히
 * 무엇을 고쳐야 할지 모른다.
 */
export function parseStrict<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  body: unknown,
):
  | { ok: true; data: z.infer<z.ZodObject<T>> }
  | { ok: false; error: string } {
  const known = new Set(Object.keys(schema.shape));
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const unknown = Object.keys(body as Record<string, unknown>).filter(
      (k) => !known.has(k),
    );
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
      };
    }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid update" };
  return { ok: true, data: parsed.data };
}
