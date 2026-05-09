import { PublicLayout } from "@/components/layout/PublicLayout";
import { PeopleGrid } from "@/components/PeopleGrid";

export default function MembersPage() {
  return (
    <PublicLayout>
      <PeopleGrid
        kind="member"
        title="학생"
        subtitle="Seeds에서 함께 배우고 만드는 학생들입니다. 본인이 공개에 동의한 경우에만 표시됩니다."
        emptyText="아직 공개에 동의한 학생이 없습니다."
      />
    </PublicLayout>
  );
}
