import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";

type Item = {
  id: number; title: string; description: string | null; dueAt: string | null; status: string;
  mySubmission: { id: number; status: string; submittedAt: string | null; feedback: string | null } | null;
};

export default function StudentAssignments() {
  const { data, isLoading } = useQuery({ queryKey: ["student-assignments"], queryFn: () => api<{ items: Item[] }>("/student/assignments") });
  return (
    <>
      <h1 className="text-3xl font-serif font-bold mb-6">과제</h1>
      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader><TableRow><TableHead>제목</TableHead><TableHead>마감일</TableHead><TableHead>상태</TableHead><TableHead>제출 상태</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            : data?.items.length === 0 ? <TableRow><TableCell colSpan={4} className="p-0">
                <EmptyState title="과제가 없습니다."
                  hint="과제를 만들고 [게시]까지 해야 학생에게 보입니다." />
              </TableCell></TableRow>
            : data?.items.map((a) => (
              <TableRow key={a.id} className="cursor-pointer relative focus-within:bg-muted/60 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-[hsl(var(--ring))]">
                <TableCell className="font-medium">
                  <Link
                    href={`/student/assignments/${a.id}`}
                    aria-label={`${a.title} 과제 열기`}
                    className="absolute inset-0 z-10 focus-visible:outline-none"
                  />
                  {a.title}
                </TableCell>
                <TableCell>{a.dueAt ? format(new Date(a.dueAt), "yyyy-MM-dd HH:mm") : "-"}</TableCell>
                <TableCell><Badge className="">{a.status}</Badge></TableCell>
                <TableCell>{a.mySubmission ? <Badge className="">{a.mySubmission.status}</Badge> : <Badge variant="outline" className="">미제출</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
