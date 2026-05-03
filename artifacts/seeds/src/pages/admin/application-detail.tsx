import { AdminLayout } from "@/components/layout/AdminLayout";
import { useParams, Link } from "wouter";
import { useGetApplication, useUpdateApplication, getGetApplicationQueryKey, getListApplicationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ApplicationStatus } from "@workspace/api-zod";

const statusLabels: Record<string, string> = {
  submitted: "제출 완료",
  reviewing: "검토 중",
  interview: "면접 대상",
  accepted: "최종 합격",
  rejected: "불합격",
  waitlisted: "예비 후보",
  withdrawn: "지원 취소",
};

export default function AdminApplicationDetail() {
  const { id } = useParams();
  const appId = id ? parseInt(id, 10) : 0;
  const { data: application, isLoading } = useGetApplication(appId, {
    query: { enabled: !!appId, queryKey: getGetApplicationQueryKey(appId) }
  });
  
  const updateMutation = useUpdateApplication();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setAdminNote(application.adminNote || "");
    }
  }, [application]);

  const handleSave = () => {
    if (!status) return;
    
    updateMutation.mutate({
      id: appId,
      data: {
        status: status as ApplicationStatus,
        adminNote: adminNote || null
      }
    }, {
      onSuccess: () => {
        toast({
          title: "저장 완료",
          description: "지원서 정보가 업데이트 되었습니다.",
        });
        queryClient.invalidateQueries({ queryKey: getGetApplicationQueryKey(appId) });
        queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
      },
      onError: () => {
        toast({
          title: "저장 실패",
          description: "업데이트 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      }
    });
  };

  if (isLoading || !application) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/applications">
            <Button variant="outline" size="icon" className="rounded-none">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-bold">{application.name} 지원서</h1>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="rounded-none">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          저장하기
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-card border border-border p-6 space-y-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">기본 정보</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <div className="text-sm text-muted-foreground mb-1">이름</div>
                <div className="font-medium">{application.name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">이메일</div>
                <div className="font-medium">{application.email}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">연락처</div>
                <div className="font-medium">{application.phone}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">출생연도</div>
                <div className="font-medium">{application.birthYear}년생</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">학교</div>
                <div className="font-medium">{application.school}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">학년</div>
                <div className="font-medium">{application.grade}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-muted-foreground mb-1">관심 분야</div>
                <div className="font-medium">{application.interestArea}</div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 space-y-6">
            <h2 className="text-lg font-serif font-bold border-b border-border pb-2">상세 응답</h2>
            
            <div className="space-y-6">
              <div>
                <div className="text-sm font-semibold mb-2">지원 동기</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
                  {application.motivation}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">관련 경험</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
                  {application.experience}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">문제 인식</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
                  {application.problemAwareness}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Seeds에서 기대하는 점</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 p-4 border border-border/50">
                  {application.expectation}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-muted border border-border p-6 sticky top-24">
            <h2 className="text-lg font-serif font-bold mb-4">관리자 도구</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">지원 상태</label>
                <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
                  <SelectTrigger className="rounded-none bg-background">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">관리자 메모</label>
                <Textarea 
                  className="min-h-[200px] rounded-none bg-background resize-none"
                  placeholder="지원자에 대한 평가나 메모를 작성하세요 (지원자에게는 보이지 않습니다)"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
