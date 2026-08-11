import { useQuery } from "@tanstack/react-query";
import { api, type SessionItem } from "@/lib/mvp3-api";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import { ATTENDANCE_STATUS_LABEL } from "@/lib/admin-labels";

type AttendanceResp = {
  items: {
    id: number;
    sessionId: number;
    sessionTitle: string;
    scheduledAt: string;
    status: string;
    note: string | null;
  }[];
  summary: { present: number; late: number; absent: number; excused: number; total: number };
};

const STATUS_STYLE: Record<string, string> = {
  present: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  late: "border-amber-500 text-amber-700 dark:text-amber-400",
  absent: "border-destructive text-destructive",
  excused: "text-muted-foreground",
};

/**
 * 모임 — 일정과 내 출석을 한 화면에서.
 *
 * 전에는 `/student/sessions` 와 `/student/attendance` 가 따로였다. 학생이 묻는
 * 것은 "언제 모이지"와 "내가 갔었나" 두 가지인데, 그 답이 같은 모임에 대한
 * 것인데도 화면이 갈려 있어서 왔다 갔다 해야 했다. 표를 둘로 쌓는 대신 모임
 * 행에 내 출석 상태를 붙였다 — 같은 줄에서 답이 끝난다.
 */
export default function StudentSessions() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["student-sessions"],
    queryFn: () => api<{ items: SessionItem[] }>("/student/sessions"),
  });
  const { data: attendance } = useQuery({
    queryKey: ["student-attendance"],
    queryFn: () => api<AttendanceResp>("/student/attendance"),
  });

  const bySession = new Map(
    (attendance?.items ?? []).map((r) => [r.sessionId, r]),
  );
  const s = attendance?.summary;

  return (
    <>
      <h1 className="mb-2 font-serif text-3xl font-bold">모임</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        예정된 모임과 내 출석 상태입니다.
      </p>

      {s && s.total > 0 && (
        // W11 (design/05 §6.4) — 375px 에서 5칸 고정은 카드가 화면보다 넓어진다.
        <Card className="mb-6">
          <CardContent className="grid grid-cols-2 gap-2 pt-6 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div>총: <strong>{s.total}</strong></div>
            <div>출석: <strong>{s.present}</strong></div>
            <div>지각: <strong>{s.late}</strong></div>
            <div>결석: <strong>{s.absent}</strong></div>
            <div>인정: <strong>{s.excused}</strong></div>
          </CardContent>
        </Card>
      )}

      <div className="elev-1 rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead>일시</TableHead>
              <TableHead>장소/링크</TableHead>
              <TableHead>내 출석</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto animate-spin" />
                </TableCell>
              </TableRow>
            ) : sessions?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    title="모임이 없습니다."
                    hint="모임이 열리면 여기에 일정과 출석이 함께 뜹니다."
                  />
                </TableCell>
              </TableRow>
            ) : (
              sessions?.items.map((item) => {
                const rec = bySession.get(item.id);
                return (
                  <TableRow key={item.id} data-testid={`student-session-${item.id}`}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{format(new Date(item.scheduledAt), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>{item.locationOrLink ?? "-"}</TableCell>
                    <TableCell>
                      {rec ? (
                        <span className="inline-flex items-center gap-2">
                          {/* 상태는 서버에서 온 문자열이라 enum 으로 좁혀지지
                              않는다. 모르는 값이 와도 색만 빠지고 라벨은 원문이
                              그대로 나오도록 둔다 — 화면이 죽는 것보다 낫다. */}
                          <Badge
                            variant="outline"
                            className={STATUS_STYLE[rec.status as keyof typeof STATUS_STYLE]}
                          >
                            {ATTENDANCE_STATUS_LABEL[
                              rec.status as keyof typeof ATTENDANCE_STATUS_LABEL
                            ] ?? rec.status}
                          </Badge>
                          {rec.note && (
                            <span className="text-xs text-muted-foreground">{rec.note}</span>
                          )}
                        </span>
                      ) : (
                        // 아직 안 찍힌 것과 결석은 다르다. 지난 모임이라도
                        // 운영진이 입력하기 전이면 "결석"이라고 말하면 안 된다.
                        <span className="text-xs text-muted-foreground">기록 전</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
