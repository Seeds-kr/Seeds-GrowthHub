import { AdminLayout } from "@/components/layout/AdminLayout";
import { useApplicationStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const statusLabels: Record<string, string> = {
  submitted: "제출 완료",
  reviewing: "검토 중",
  interview: "면접 대상",
  accepted: "최종 합격",
  rejected: "불합격",
  waitlisted: "예비 후보",
  withdrawn: "지원 취소",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = useApplicationStats();

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif font-bold">대시보드</h1>
        <div className="flex gap-4">
          <Link href="/admin/applications">
            <Button>지원서 목록 보기</Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">총 지원자 수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}명</div>
            </CardContent>
          </Card>
          
          {stats.byStatus.map((stat) => (
            <Card key={stat.status} className="rounded-none border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {statusLabels[stat.status] || stat.status}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.count}명</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </AdminLayout>
  );
}
