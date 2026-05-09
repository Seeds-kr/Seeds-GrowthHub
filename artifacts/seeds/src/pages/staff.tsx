import { PublicLayout } from "@/components/layout/PublicLayout";
import { PeopleGrid } from "@/components/PeopleGrid";

export default function StaffPage() {
  return (
    <PublicLayout>
      <PeopleGrid
        kind="staff"
        title="운영진"
        subtitle="Seeds 프로그램을 기획·운영하는 운영진입니다."
        emptyText="아직 공개된 운영진이 없습니다."
      />
    </PublicLayout>
  );
}
