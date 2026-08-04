import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PeopleGrid } from "@/components/PeopleGrid";
import { PEOPLE_KINDS, type PeopleKind } from "@/lib/mvp3-api";
import { Cover } from "@/components/annual";

const PATH_TO_KIND: Record<string, PeopleKind> = {
  "/mentors": "mentor",
  "/staff": "staff",
  "/members": "member",
  "/people": "mentor",
};

function kindFromPath(path: string): PeopleKind {
  return PATH_TO_KIND[path] ?? "mentor";
}

export default function PeoplePage() {
  const [location, setLocation] = useLocation();
  const [kind, setKind] = useState<PeopleKind>(() => kindFromPath(location));

  useEffect(() => {
    const k = kindFromPath(location);
    if (PEOPLE_KINDS.includes(k)) setKind(k);
  }, [location]);

  function handleChange(k: PeopleKind) {
    setKind(k);
    // Sync URL without a full reload so deep links keep working.
    const target =
      k === "mentor" ? "/mentors" : k === "staff" ? "/staff" : "/members";
    if (location !== target) setLocation(target, { replace: true });
  }

  return (
    <PublicLayout>
      {/* 연감의 인물 판. 그리드 자체는 PeopleGrid가 그대로 갖는다 — 인물 상세로
          가는 상호작용이 이미 검증돼 있어 표제만 연감 규칙으로 얹는다. */}
      <Cover
        title="사람들"
        intro="Seeds를 만드는 멘토진과 운영진, 그리고 함께하는 회원들입니다."
      />
      <PeopleGrid kind={kind} onKindChange={handleChange} />
    </PublicLayout>
  );
}
