import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PeopleGrid } from "@/components/PeopleGrid";
import { PEOPLE_KINDS, type PeopleKind } from "@/lib/mvp3-api";

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
      <PeopleGrid kind={kind} onKindChange={handleChange} />
    </PublicLayout>
  );
}
