import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { DesktopOnly } from "@/components/DesktopOnly";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/mvp3-api";
import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABEL } from "@/lib/admin-labels";
import { toast } from "@/hooks/use-toast";

type Roster = {
  studentId: number;
  name: string;
  email: string;
  status: string | null;
  note: string | null;
  recordId: number | null;
};
type Resp = {
  session: { id: number; title: string; scheduledAt: string; locationOrLink: string | null };
  roster: Roster[];
};

/**
 * 출석 입력 표. 모임 상세 안에서 쓴다.
 *
 * 전에는 `/admin/sessions/:id/attendance` 라는 별도 화면이었다. 모임 상세에
 * 이미 출석 요약과 "출석 관리 →" 링크가 있었으므로, 요약을 보고 고칠 것이
 * 생기면 화면을 한 번 더 넘어가야 했다 — 보는 곳과 고치는 곳이 갈려 있었다.
 *
 * 표 자체는 그대로다. C 등급(design/05 §6.2) 판정도 유지한다 — 명단 전체에
 * 상태와 메모를 다는 격자는 폰에서 입력할 수 없다.
 */
export function AttendanceGrid({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-session-attendance", String(sessionId)],
    queryFn: () => api<Resp>(`/admin/sessions/${sessionId}/attendance`),
  });
  const [draft, setDraft] = useState<Record<number, { status: string; note: string }>>({});

  useEffect(() => {
    if (!data) return;
    const d: Record<number, { status: string; note: string }> = {};
    for (const r of data.roster) {
      d[r.studentId] = { status: r.status ?? "present", note: r.note ?? "" };
    }
    setDraft(d);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/sessions/${sessionId}/attendance`, {
        method: "PUT",
        body: {
          records: Object.entries(draft).map(([sid, v]) => ({
            studentId: Number(sid),
            status: v.status,
            note: v.note || null,
          })),
        },
      }),
    onSuccess: () => {
      // 상세의 출석 요약도 같이 되돌려야 한다. 안 그러면 방금 저장한 값과
      // 위쪽 요약이 어긋난 채로 남는다.
      void qc.invalidateQueries({ queryKey: ["admin-session-attendance", String(sessionId)] });
      void qc.invalidateQueries({ queryKey: ["admin-session", String(sessionId)] });
      toast({ title: "저장됨" });
    },
    onError: (e: unknown) =>
      toast({
        title: "실패",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (!data || data.roster.length === 0) {
    return <p className="text-sm text-muted-foreground">이 모임의 기수에 학생이 없습니다.</p>;
  }

  return (
    <DesktopOnly feature="일괄 출석 입력">
      <div className="mb-4 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>학생</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>출석 상태</TableHead>
              <TableHead>메모</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.roster.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <Select
                    value={draft[r.studentId]?.status ?? "present"}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        [r.studentId]: {
                          ...(draft[r.studentId] ?? { status: "present", note: "" }),
                          status: v,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="메모 (선택)"
                    value={draft[r.studentId]?.note ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [r.studentId]: {
                          ...(draft[r.studentId] ?? { status: "present", note: "" }),
                          note: e.target.value,
                        },
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button
        disabled={save.isPending}
        onClick={() => save.mutate()}
        data-testid="button-save-attendance"
      >
        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        출석 저장
      </Button>
    </DesktopOnly>
  );
}
