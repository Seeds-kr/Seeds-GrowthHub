import { useState } from "react";
import {
  useListMyAssignments,
  type EvaluatorAssignmentItem,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { stageLabels } from "@/lib/seeds-labels";
import { Button } from "@/components/ui/button";

/**
 * 평가위원 홈.
 *
 * 전에는 배정을 **만들어진 순서 그대로** 한 표에 늘어놓았다. 전부 사실이지만
 * 평가위원이 이 화면에서 묻는 것은 하나다 — **아직 뭐가 남았나.** 배정이 서른
 * 건쯤 되면 끝낸 것과 안 끝낸 것이 섞여 있어서 눈으로 훑어야 알 수 있었고,
 * 정렬도 필터도 없었다.
 *
 * 학생 대시보드에는 이미 같은 기준이 서 있었다(`student/dashboard.tsx`).
 * 이 화면에만 그 생각이 안 갔다.
 *
 * 지금은 남은 것이 위에 있고, 끝낸 것은 접혀 있다. 접어 두는 이유는 숨기려는
 * 게 아니라 **끝낸 일이 남은 일을 밀어내지 않게** 하려는 것이다 — 필요하면 펴서
 * 다시 볼 수 있다.
 *
 * `상태`(배정됨/완료) 컬럼은 뺐다. `평가서`(제출됨/미제출)와 거의 같은 것을
 * 두 번 말하고 있었고, 둘이 어긋날 때 어느 쪽이 진짜인지 화면이 답하지 못했다.
 * 평가위원에게 의미 있는 것은 **내가 썼는가** 하나다.
 */
export default function EvaluatorDashboard() {
  const { data, isLoading } = useListMyAssignments();
  const [showDone, setShowDone] = useState(false);

  const items = data?.items ?? [];
  const todo = items.filter((a) => !a.hasEvaluation);
  const done = items.filter((a) => a.hasEvaluation);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-3xl font-serif font-bold">내 평가 배정</h1>
          <p className="text-sm text-muted-foreground mt-2">
            나에게 배정된 지원서를 확인하고 평가서를 작성하세요.
          </p>
        </div>
        {!isLoading && items.length > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-todo-count">
            아직 안 쓴 평가 <strong className="text-foreground">{todo.length}</strong>건
            {done.length > 0 ? ` · 완료 ${done.length}건` : ""}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지원자</TableHead>
              <TableHead>학교</TableHead>
              <TableHead>단계</TableHead>
              <TableHead>평가서</TableHead>
              <TableHead>배정일</TableHead>
              <TableHead className="text-right">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  배정된 지원서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {todo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      배정된 평가를 모두 마쳤습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  todo.map((a) => <AssignmentRow key={a.assignmentId} a={a} />)
                )}

                {/* 끝낸 것. 기본은 접혀 있다 — 남은 일을 밀어내지 않게. */}
                {done.length > 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="py-2">
                      <button
                        type="button"
                        onClick={() => setShowDone((v) => !v)}
                        aria-expanded={showDone}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-done"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${showDone ? "rotate-90" : ""}`}
                          aria-hidden="true"
                        />
                        완료 {done.length}건
                      </button>
                    </TableCell>
                  </TableRow>
                ) : null}
                {showDone ? done.map((a) => <AssignmentRow key={a.assignmentId} a={a} done />) : null}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function AssignmentRow({ a, done }: { a: EvaluatorAssignmentItem; done?: boolean }) {
  return (
    <TableRow
      key={a.assignmentId}
      data-testid={`row-assignment-${a.assignmentId}`}
      className={done ? "text-muted-foreground" : undefined}
    >
      <TableCell className={done ? "font-normal" : "font-medium"}>{a.applicantName}</TableCell>
      <TableCell>{a.applicantSchool}</TableCell>
      <TableCell>{stageLabels[a.stage] ?? a.stage}</TableCell>
      <TableCell>
        {a.hasEvaluation ? (
          <Badge className="font-normal">제출됨</Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            미제출
          </Badge>
        )}
      </TableCell>
      <TableCell>{format(new Date(a.assignedAt), "yyyy-MM-dd")}</TableCell>
      <TableCell className="text-right">
        <Link href={`/evaluator/applications/${a.applicationId}`}>
          <Button
            size="sm"
            variant={done ? "ghost" : "outline"}
            className=""
            data-testid={`button-open-${a.applicationId}`}
          >
            열기
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}
