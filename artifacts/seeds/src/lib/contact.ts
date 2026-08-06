/**
 * 운영진 연락처, 한 곳.
 *
 * 이 주소가 소개 페이지·멘토 프로필 안내 등 여러 화면에 하드코딩되기 시작했다.
 * 바뀔 때 한 군데만 고치면 나머지가 조용히 옛 주소를 가리킨다.
 *
 * FAQ 는 이걸 쓰지 않는다 — 거기서는 운영진이 관리자 화면에서 고칠 수 있는
 * 본문(`site-content`)에서 읽어낸다. 원본이 둘로 갈리는 게 아니라, 운영진이
 * 고칠 수 있는 자리가 있으면 그쪽이 항상 우선이고 여기는 그럴 자리가 없는
 * 화면들의 기본값이다.
 */
export const OPS_EMAIL = "seeds.code@gmail.com";
export const OPS_KAKAO = "https://open.kakao.com/o/sqpmEzEf";

/** `mailto:` 링크. 제목은 받는 쪽이 무슨 건인지 바로 알게 채운다. */
export function opsMailto(subject: string): string {
  return `mailto:${OPS_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
