import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/mvp3-api";
import {
  type DocumentItem,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  DOC_VISIBILITIES,
  DOC_VISIBILITY_LABEL,
} from "@/lib/documents-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileStack, Copy } from "lucide-react";

type Tab = "all" | "templates" | "archived";

const TEMPLATE_STARTERS: Record<string, string> = {
  meeting_note: `# 회의록\n\n- 일시:\n- 참석자:\n\n## 안건\n- \n\n## 결정사항\n- \n\n## 액션 아이템\n- [ ] \n`,
  event_checklist: `# 행사 체크리스트\n\n## D-7\n- [ ] 회의실 예약\n- [ ] 참가자 안내\n\n## D-1\n- [ ] 자료 준비\n- [ ] 음료/간식\n\n## 당일\n- [ ] 출석 체크\n- [ ] 사진 촬영\n\n## 사후\n- [ ] 회고 작성\n`,
  recruitment_checklist: `# 모집 체크리스트\n\n## 공지\n- [ ] 모집 글 작성\n- [ ] SNS 업로드\n\n## 서류\n- [ ] 지원서 검토\n- [ ] 합격자 통보\n\n## 면접\n- [ ] 일정 조율\n- [ ] 평가표 준비\n`,
  finance: `# 재무 템플릿\n\n| 항목 | 금액 | 비고 |\n| --- | --- | --- |\n|  |  |  |\n\n## 총계\n- 수입:\n- 지출:\n- 잔액:\n`,
  onboarding: `# 신규 온보딩\n\n## 첫째 주\n- [ ] 환영 인사\n- [ ] 동아리 소개\n\n## 둘째 주\n- [ ] 멘토 매칭\n- [ ] 첫 과제\n`,
  general: "",
  other: "",
};

export default function AdminDocumentsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    docType: "general" as (typeof DOC_TYPES)[number],
    isTemplate: false,
    visibility: "admin_only" as (typeof DOC_VISIBILITIES)[number],
    contentMd: "",
  });

  const queryKey = useMemo(
    () => ["admin-documents", tab, typeFilter, q] as const,
    [tab, typeFilter, q],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (tab === "templates") qs.set("isTemplate", "true");
      else if (tab === "all") qs.set("isTemplate", "false");
      else if (tab === "archived") qs.set("archived", "true");
      if (typeFilter) qs.set("type", typeFilter);
      if (q.trim()) qs.set("q", q.trim());
      return api<{ items: DocumentItem[] }>(
        `/admin/documents?${qs.toString()}`,
      );
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api<DocumentItem>("/admin/documents", {
        method: "POST",
        body: {
          title: form.title,
          docType: form.docType,
          isTemplate: form.isTemplate,
          visibility: form.visibility,
          contentMd: form.contentMd,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "문서가 생성되었습니다." });
      setOpen(false);
      setForm({
        title: "",
        docType: "general",
        isTemplate: false,
        visibility: "admin_only",
        contentMd: "",
      });
    },
    onError: (e: any) =>
      toast({
        title: "저장 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const clone = useMutation({
    mutationFn: (id: number) =>
      api<DocumentItem>(`/admin/documents/${id}/clone`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "템플릿이 복제되었습니다." });
    },
    onError: (e: any) =>
      toast({
        title: "복제 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const openNew = (asTemplate: boolean) => {
    setForm({
      title: "",
      docType: "general",
      isTemplate: asTemplate,
      visibility: "admin_only",
      contentMd: "",
    });
    setOpen(true);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <FileStack className="w-7 h-7 text-primary" />
            문서 & 템플릿
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            내부 운영 문서는 Markdown이 원본입니다. 학생에게는 노출되지 않습니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNew(true)} data-testid="btn-new-template">
            + 새 템플릿
          </Button>
          <Button onClick={() => openNew(false)} data-testid="btn-new-document">
            + 새 문서
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">문서</TabsTrigger>
          <TabsTrigger value="templates">템플릿</TabsTrigger>
          <TabsTrigger value="archived">보관</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Input
          placeholder="제목/내용 검색…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={typeFilter || "_all"}
          onValueChange={(v) => setTypeFilter(v === "_all" ? "" : v)}
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 유형</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg bg-card border border-border elev-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead className="w-32">유형</TableHead>
              <TableHead className="w-32">공개 범위</TableHead>
              <TableHead className="w-40">최종 수정</TableHead>
              {tab === "templates" ? <TableHead className="w-20"></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  {tab === "templates"
                    ? "템플릿이 없습니다. 정기모임/행사 체크리스트 등을 만들어 보세요."
                    : tab === "archived"
                    ? "보관된 문서가 없습니다."
                    : "문서가 없습니다. 첫 문서를 작성해 보세요."}
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className="font-medium text-primary hover:underline"
                      data-testid={`link-doc-${doc.id}`}
                    >
                      {doc.title}
                    </Link>
                    {doc.isTemplate ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        템플릿
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {DOC_TYPE_LABEL[doc.docType] ?? doc.docType}
                  </TableCell>
                  <TableCell className="text-sm">
                    {DOC_VISIBILITY_LABEL[doc.visibility] ?? doc.visibility}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(doc.updatedAt).toLocaleString("ko-KR")}
                  </TableCell>
                  {tab === "templates" ? (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clone.mutate(doc.id)}
                        disabled={clone.isPending}
                        data-testid={`btn-clone-${doc.id}`}
                      >
                        <Copy className="w-3 h-3 mr-1" /> 복제
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.isTemplate ? "새 템플릿" : "새 문서"} 작성
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="d-title">제목 *</Label>
              <Input
                id="d-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={
                  form.isTemplate
                    ? "예: 정기모임 체크리스트"
                    : "예: 2026 봄 OT 운영 노트"
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>유형</Label>
                <Select
                  value={form.docType}
                  onValueChange={(v) => {
                    const next = v as (typeof DOC_TYPES)[number];
                    setForm((f) => ({
                      ...f,
                      docType: next,
                      // Seed starter content if user hasn't typed anything yet AND this is a template
                      contentMd:
                        f.isTemplate && f.contentMd.trim().length === 0
                          ? (TEMPLATE_STARTERS[next] ?? "")
                          : f.contentMd,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {DOC_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>공개 범위</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      visibility: v as (typeof DOC_VISIBILITIES)[number],
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {DOC_VISIBILITY_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="d-content">내용 (Markdown)</Label>
              <Textarea
                id="d-content"
                rows={10}
                value={form.contentMd}
                onChange={(e) => setForm({ ...form, contentMd: e.target.value })}
                className="font-mono text-sm"
                placeholder="# 제목&#10;&#10;본문…"
              />
              <p className="text-xs text-muted-foreground mt-1">
                체크리스트는 `- [ ] 항목` 형식을 사용하세요.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.title.trim() || create.isPending}
              data-testid="btn-save-document"
            >
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
