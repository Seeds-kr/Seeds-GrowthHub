import { useListMyAssignments } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { stageLabels, assignmentStatusLabels } from "@/lib/seeds-labels";
import { Button } from "@/components/ui/button";

export default function EvaluatorDashboard() {
  const { data, isLoading } = useListMyAssignments();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold">내 평가 배정</h1>
        <p className="text-sm text-muted-foreground mt-2">
          나에게 배정된 지원서를 확인하고 평가서를 작성하세요.
        </p>
      </div>

      <div className="rounded-lg bg-card border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>지원자</TableHead>
              <TableHead>학교</TableHead>
              <TableHead>단계</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>평가서</TableHead>
              <TableHead>배정일</TableHead>
              <TableHead className="text-right">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : (data?.items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  배정된 지원서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map((a) => (
                <TableRow key={a.assignmentId} data-testid={`row-assignment-${a.assignmentId}`}>
                  <TableCell className="font-medium">{a.applicantName}</TableCell>
                  <TableCell>{a.applicantSchool}</TableCell>
                  <TableCell>{stageLabels[a.stage] ?? a.stage}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {assignmentStatusLabels[a.assignmentStatus] ?? a.assignmentStatus}
                    </Badge>
                  </TableCell>
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
                        variant="outline"
                        className=""
                        data-testid={`button-open-${a.applicationId}`}
                      >
                        열기
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
