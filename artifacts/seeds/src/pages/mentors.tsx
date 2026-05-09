import { PublicLayout } from "@/components/layout/PublicLayout";
import { PeopleGrid } from "@/components/PeopleGrid";

export default function MentorsPage() {
  return (
    <PublicLayout>
      <PeopleGrid
        kind="mentor"
        title="멘토"
        subtitle="Seeds 학생들의 성장을 함께하는 분야별 멘토를 소개합니다."
        emptyText="아직 공개된 멘토가 없습니다."
      />
    </PublicLayout>
  );
}
