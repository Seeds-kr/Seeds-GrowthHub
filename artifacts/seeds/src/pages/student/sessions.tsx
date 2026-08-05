import { StudentLayout } from "@/components/layout/StudentLayout";
import { useQuery } from "@tanstack/react-query";
import { api, type SessionItem } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

export default function StudentSessions() {
  const { data, isLoading } = useQuery({ queryKey: ["student-sessions"], queryFn: () => api<{ items: SessionItem[] }>("/student/sessions") });
  return (
    <StudentLayout>
      <h1 className="text-3xl font-serif font-bold mb-6">모임</h1>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>일시</TableHead><TableHead>장소/링크</TableHead><TableHead>유형</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={5} className="p-0">
                <EmptyState title="모임이 없습니다."
                  hint="모임을 만들면 출석 체크를 할 수 있습니다." />
              </TableCell></TableRow>
            : data?.items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>{format(new Date(s.scheduledAt), "yyyy-MM-dd HH:mm")}</TableCell>
                <TableCell>{s.locationOrLink ?? "-"}</TableCell>
                <TableCell>{s.sessionType}</TableCell>
                <TableCell><Badge className="">{s.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </StudentLayout>
  );
}
