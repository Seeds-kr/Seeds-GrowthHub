import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Resp = {
  items: { id: number; sessionId: number; sessionTitle: string; scheduledAt: string; status: string; note: string | null }[];
  summary: { present: number; late: number; absent: number; excused: number; total: number };
};

export default function StudentAttendance() {
  const { data, isLoading } = useQuery({ queryKey: ["student-attendance"], queryFn: () => api<Resp>("/student/attendance") });
  if (isLoading || !data) return <StudentLayout><Loader2 className="animate-spin mx-auto" /></StudentLayout>;
  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">출석 현황</h1>
      <Card className="rounded-none mb-6"><CardHeader><CardTitle>요약</CardTitle></CardHeader><CardContent className="grid grid-cols-5 gap-2 text-sm">
        <div>총: <strong>{data.summary.total}</strong></div>
        <div>출석: <strong>{data.summary.present}</strong></div>
        <div>지각: <strong>{data.summary.late}</strong></div>
        <div>결석: <strong>{data.summary.absent}</strong></div>
        <div>인정: <strong>{data.summary.excused}</strong></div>
      </CardContent></Card>
      <div className="bg-card border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>모임</TableHead><TableHead>일시</TableHead><TableHead>상태</TableHead><TableHead>노트</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.items.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">출석 기록이 없습니다.</TableCell></TableRow>
            : data.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.sessionTitle}</TableCell>
                <TableCell>{format(new Date(r.scheduledAt), "yyyy-MM-dd HH:mm")}</TableCell>
                <TableCell><Badge className="rounded-none">{r.status}</Badge></TableCell>
                <TableCell>{r.note ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </StudentLayout>
  );
}
