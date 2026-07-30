import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { MarkdownEditor } from "@/components/markdown/MarkdownEditor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api, ApiError } from "@/lib/mvp3-api";
import {
  type DocumentDetail,
  type DocumentVersionDetail,
  DOC_TYPE_LABEL,
  DOC_VISIBILITY_LABEL,
  DOC_TYPES,
  DOC_VISIBILITIES,
} from "@/lib/documents-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Save,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  History,
} from "lucide-react";

export default function AdminDocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DocumentDetail, ApiError>({
    queryKey: ["admin-document", id],
    queryFn: () => api<DocumentDetail>(`/admin/documents/${id}`),
    enabled: Number.isFinite(id),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    contentMd: "",
    docType: "general" as (typeof DOC_TYPES)[number],
    visibility: "admin_only" as (typeof DOC_VISIBILITIES)[number],
    isTemplate: false,
  });

  // Hydrate draft whenever a fresh `data` arrives and we're not actively editing
  useEffect(() => {
    if (data && !editing) {
      setDraft({
        title: data.title,
        contentMd: data.contentMd,
        docType: data.docType,
        visibility: data.visibility,
        isTemplate: data.isTemplate,
      });
    }
  }, [data, editing]);

  const save = useMutation({
    mutationFn: () =>
      api<DocumentDetail>(`/admin/documents/${id}`, {
        method: "PATCH",
        body: draft,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-document", id] });
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "저장됨" });
      setEditing(false);
    },
    onError: (e: any) =>
      // IMPORTANT: do NOT close editor on error — preserves draft content
      toast({
        title: "저장 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const clone = useMutation({
    mutationFn: () =>
      api<{ id: number }>(`/admin/documents/${id}/clone`, { method: "POST" }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "복제되었습니다." });
      setLocation(`/admin/documents/${d.id}`);
    },
    onError: (e: any) =>
      toast({
        title: "복제 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const toggleArchive = useMutation({
    mutationFn: (archived: boolean) =>
      api<DocumentDetail>(`/admin/documents/${id}`, {
        method: "PATCH",
        body: { archived },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-document", id] });
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/admin/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      setLocation("/admin/documents");
    },
    onError: (e: any) =>
      toast({
        title: "삭제 실패",
        description: e?.data?.error ?? e.message,
        variant: "destructive",
      }),
  });

  const [viewVno, setViewVno] = useState<number | null>(null);
  const versionQ = useQuery<DocumentVersionDetail, ApiError>({
    queryKey: ["admin-document-version", id, viewVno],
    queryFn: () =>
      api<DocumentVersionDetail>(`/admin/documents/${id}/versions/${viewVno}`),
    enabled: Number.isFinite(id) && viewVno !== null,
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <Loader2 className="w-6 h-6 animate-spin" />
      </AdminLayout>
    );
  }
  if (error || !data) {
    return (
      <AdminLayout>
        <div className="text-muted-foreground">문서를 찾을 수 없습니다.</div>
        <Link
          href="/admin/documents"
          className="text-primary text-sm mt-4 inline-block"
        >
          ← 목록으로
        </Link>
      </AdminLayout>
    );
  }

  const isArchived = data.archivedAt !== null;

  return (
    <AdminLayout>
      <Link
        href="/admin/documents"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> 문서 목록
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {editing ? (
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="text-2xl font-bold h-auto py-2"
            />
          ) : (
            <h1 className="text-3xl font-serif font-bold">{data.title}</h1>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline">{DOC_TYPE_LABEL[data.docType]}</Badge>
            <Badge variant="outline">{DOC_VISIBILITY_LABEL[data.visibility]}</Badge>
            {data.isTemplate ? <Badge>템플릿</Badge> : null}
            {isArchived ? (
              <Badge variant="outline" className="text-amber-700 border-amber-500">
                보관됨
              </Badge>
            ) : null}
            <span>·</span>
            <span>버전 {data.versions.length}개</span>
            <span>·</span>
            <span>
              최종 수정 {new Date(data.updatedAt).toLocaleString("ko-KR")}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setDraft({
                    title: data.title,
                    contentMd: data.contentMd,
                    docType: data.docType,
                    visibility: data.visibility,
                    isTemplate: data.isTemplate,
                  });
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => save.mutate()}
                disabled={!draft.title.trim() || save.isPending}
                data-testid="btn-save-doc"
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                저장
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditing(true)} data-testid="btn-edit-doc">
                편집
              </Button>
              <Button variant="outline" onClick={() => clone.mutate()}>
                <Copy className="w-4 h-4 mr-1" /> 복제
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleArchive.mutate(!isArchived)}
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 mr-1" /> 복원
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-1" /> 보관
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "이 문서를 영구 삭제하시겠습니까? 버전 히스토리도 함께 삭제됩니다. (보관만 하려면 '보관' 버튼을 사용하세요.)",
                    )
                  ) {
                    remove.mutate();
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">편집 (Markdown)</CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={draft.docType}
                  onValueChange={(v) =>
                    setDraft({ ...draft, docType: v as (typeof DOC_TYPES)[number] })
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {DOC_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={draft.visibility}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      visibility: v as (typeof DOC_VISIBILITIES)[number],
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">
                        {DOC_VISIBILITY_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.isTemplate}
                    onChange={(e) =>
                      setDraft({ ...draft, isTemplate: e.target.checked })
                    }
                  />
                  템플릿
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              <MarkdownEditor
                rows={28}
                value={draft.contentMd}
                onChange={(contentMd) => setDraft({ ...draft, contentMd })}
                showPreviewToggle={false}
                uploadTarget={{ linkedObjectType: "document", linkedObjectId: Number(id) }}
                data-testid="doc-editor"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">미리보기</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {draft.contentMd.trim() ? (
                  <ReactMarkdown>{draft.contentMd}</ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">비어있음</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {data.contentMd.trim() ? (
                <ReactMarkdown>{data.contentMd}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">비어있음</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> 버전 히스토리
            <Badge variant="secondary">{data.versions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              버전 기록이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.versions.map((v) => (
                <li
                  key={v.id}
                  className="py-2 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">v{v.versionNo}</span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {v.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span>{v.editorName ?? v.editorEmail ?? "—"}</span>
                    <span>{new Date(v.createdAt).toLocaleString("ko-KR")}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewVno(v.versionNo)}
                      data-testid={`btn-view-version-${v.versionNo}`}
                    >
                      보기
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewVno !== null} onOpenChange={(o) => !o && setViewVno(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              v{viewVno} 미리보기
              {versionQ.data ? ` · ${versionQ.data.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          {versionQ.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : versionQ.data ? (
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">미리보기</TabsTrigger>
                <TabsTrigger value="source">원본</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {versionQ.data.contentMd.trim() ? (
                    <ReactMarkdown>{versionQ.data.contentMd}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">비어있음</p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="source">
                <pre className="text-xs bg-muted p-3 rounded overflow-auto whitespace-pre-wrap font-mono">
                  {versionQ.data.contentMd}
                </pre>
              </TabsContent>
            </Tabs>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewVno(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
