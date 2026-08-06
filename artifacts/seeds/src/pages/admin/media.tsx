import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Link2,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/mvp3-api";
import { toast } from "@/hooks/use-toast";

/**
 * W8 — `/admin/media`. Also where W7 finally gets a screen.
 *
 * Only `external_links` is listed. `attachments` deliberately has no index here:
 * every attachment route is admin-scoped and reached from the object it hangs
 * off (a meeting note, a receipt), and `private` ones are owner-only. A flat
 * media index would suggest a browsing surface the permission model does not
 * actually grant.
 *
 * Reads go through `GET /admin/external-links`, which applies the parent
 * reachability intersection (visibility-policy §5.1). Nothing here re-derives
 * access client-side — the list simply shows what the server returned.
 */

const LINK_TYPES = [
  "github_repo",
  "github_pr",
  "github_issue",
  "readme",
  "release",
  "demo",
  "deck",
  "drive",
  "notion",
  "discord",
  "figma",
  "issue_board",
  "blog",
  "other",
] as const;

const LINK_TYPE_LABEL: Record<(typeof LINK_TYPES)[number], string> = {
  github_repo: "GitHub 저장소",
  github_pr: "GitHub PR",
  github_issue: "GitHub 이슈",
  readme: "README",
  release: "릴리스",
  demo: "데모",
  deck: "발표자료",
  drive: "Drive",
  notion: "Notion",
  discord: "Discord",
  figma: "Figma",
  issue_board: "이슈 보드",
  blog: "블로그",
  other: "기타",
};

const VISIBILITIES = [
  "admin_only",
  "team_visible",
  "cohort_visible",
  "private",
] as const;

const VISIBILITY_LABEL: Record<(typeof VISIBILITIES)[number], string> = {
  admin_only: "운영진만",
  team_visible: "팀 공개",
  cohort_visible: "기수 공개",
  private: "나만",
};

const VISIBILITY_STYLE: Record<(typeof VISIBILITIES)[number], string> = {
  admin_only: "text-muted-foreground",
  team_visible: "border-emerald-500 text-emerald-700 dark:text-emerald-400",
  cohort_visible: "border-blue-500 text-blue-700 dark:text-blue-400",
  private: "border-amber-500 text-amber-700 dark:text-amber-400",
};

/**
 * Parent types that accept a link. Mirrors LINKABLE_PARENTS on the server; the
 * server is still the authority and answers 422, this list only keeps the form
 * from offering a choice that is certain to fail.
 */
const PARENT_TYPES = [
  "project",
  "study",
  "session",
  "cohort",
  "program",
  "meeting",
  "document",
  "application",
  "finance_record",
  "ops_task",
  "student",
  "user",
] as const;

const PARENT_LABEL: Record<(typeof PARENT_TYPES)[number], string> = {
  project: "프로젝트",
  study: "스터디",
  session: "모임",
  cohort: "기수",
  program: "프로그램",
  meeting: "회의",
  document: "문서",
  application: "지원서",
  finance_record: "회계 기록",
  ops_task: "작업",
  student: "학생",
  user: "사용자",
};

/**
 * Which visibilities the parent can actually serve. Same table the server
 * enforces — showing `cohort_visible` for a `meeting` would just produce a 422,
 * and the point of W7 was to stop offering audiences that do not exist.
 */
function allowedVisibilities(
  parent: (typeof PARENT_TYPES)[number],
): (typeof VISIBILITIES)[number][] {
  switch (parent) {
    case "project":
    case "study":
      return ["admin_only", "team_visible", "cohort_visible", "private"];
    case "session":
    case "cohort":
    case "program":
      return ["admin_only", "cohort_visible", "private"];
    default:
      return ["admin_only", "private"];
  }
}

type ExternalLink = {
  id: number;
  url: string;
  title: string;
  linkType: (typeof LINK_TYPES)[number];
  description: string | null;
  linkedObjectType: (typeof PARENT_TYPES)[number];
  linkedObjectId: number;
  ownerId: number | null;
  visibility: (typeof VISIBILITIES)[number];
  freshnessCheckedAt: string | null;
  createdAt: string;
  parentLabel: string | null;
};

function blankForm() {
  return {
    url: "",
    title: "",
    linkType: "other" as (typeof LINK_TYPES)[number],
    description: "",
    linkedObjectType: "project" as (typeof PARENT_TYPES)[number],
    linkedObjectId: "",
    visibility: "admin_only" as (typeof VISIBILITIES)[number],
  };
}

export default function AdminMediaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [filterType, setFilterType] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-external-links"],
    queryFn: () => api<{ items: ExternalLink[]; total: number }>("/admin/external-links"),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin-external-links"] });

  const fail = (e: any) =>
    toast({
      title: "실패",
      description: e?.data?.error ?? e.message,
      variant: "destructive",
    });

  const create = useMutation({
    mutationFn: () =>
      api<ExternalLink>("/admin/external-links", {
        method: "POST",
        body: {
          url: form.url.trim(),
          title: form.title.trim(),
          linkType: form.linkType,
          description: form.description.trim() || null,
          linkedObjectType: form.linkedObjectType,
          linkedObjectId: Number(form.linkedObjectId),
          visibility: form.visibility,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "링크가 추가되었습니다." });
      setOpen(false);
      setForm(blankForm());
    },
    onError: fail,
  });

  const patch = useMutation({
    mutationFn: (vars: { id: number; body: Record<string, unknown> }) =>
      api<ExternalLink>(`/admin/external-links/${vars.id}`, {
        method: "PATCH",
        body: vars.body,
      }),
    onSuccess: () => invalidate(),
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/admin/external-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: "링크가 삭제되었습니다." });
    },
    onError: fail,
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filterType ? all.filter((l) => l.linkType === filterType) : all;
  }, [data, filterType]);

  const visChoices = allowedVisibilities(form.linkedObjectType);
  // Switching to a narrower parent can strand an invalid visibility in state.
  const visValue = visChoices.includes(form.visibility)
    ? form.visibility
    : "admin_only";

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-2">
            <Link2 className="w-7 h-7 text-primary" />
            미디어 / 링크
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            운영 맥락을 유지하는 외부 참조 링크입니다. 학생이 만든 성장 증거는
            산출물(/admin/artifacts)에 있습니다.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="btn-new-link">
          <Plus className="w-4 h-4 mr-1" /> 링크 추가
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Label className="text-xs">유형</Label>
        <Select
          value={filterType || "_all"}
          onValueChange={(v) => setFilterType(v === "_all" ? "" : v)}
        >
          <SelectTrigger className="w-48 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            {LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LINK_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border rounded p-12 text-center text-muted-foreground">
          링크가 없습니다. 운영 자료(Drive·Notion·Discord)나 참고 문서를 등록해 보세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">제목</th>
                <th className="p-3 font-medium">유형</th>
                <th className="p-3 font-medium">연결 대상</th>
                <th className="p-3 font-medium">공개 범위</th>
                <th className="p-3 font-medium">확인</th>
                <th className="p-3 font-medium sr-only">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t border-border" data-testid={`link-row-${l.id}`}>
                  <td className="p-3">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {l.title}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    {l.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {l.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {LINK_TYPE_LABEL[l.linkType]}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {PARENT_LABEL[l.linkedObjectType]}
                    {" · "}
                    {/* Server returns null for deleted parents (design/04 §2
                        rule 3) and for application/finance_record, whose titles
                        would sidestep the recruiting/finance gates. */}
                    {l.parentLabel ?? (
                      <span className="italic">#{l.linkedObjectId}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Select
                      value={l.visibility}
                      onValueChange={(v) =>
                        patch.mutate({ id: l.id, body: { visibility: v } })
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedVisibilities(l.linkedObjectType).map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            {VISIBILITY_LABEL[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {l.freshnessCheckedAt ? (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${VISIBILITY_STYLE.team_visible}`}
                      >
                        {new Date(l.freshnessCheckedAt).toLocaleDateString("ko-KR")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="아직 유효한 링크임을 수동으로 확인 (자동 검사 없음)"
                        onClick={() =>
                          patch.mutate({
                            id: l.id,
                            body: { freshnessChecked: true },
                          })
                        }
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`"${l.title}" 링크를 삭제할까요?`)) {
                            remove.mutate(l.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>링크 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="l-title">제목 *</Label>
              <Input
                id="l-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 3기 운영 드라이브"
              />
            </div>
            <div>
              <Label htmlFor="l-url">URL *</Label>
              <Input
                id="l-url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>유형</Label>
                <Select
                  value={form.linkType}
                  onValueChange={(v) =>
                    setForm({ ...form, linkType: v as (typeof LINK_TYPES)[number] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LINK_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>공개 범위</Label>
                <Select
                  value={visValue}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      visibility: v as (typeof VISIBILITIES)[number],
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visChoices.map((v) => (
                      <SelectItem key={v} value={v}>
                        {VISIBILITY_LABEL[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>연결 대상</Label>
                <Select
                  value={form.linkedObjectType}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      linkedObjectType: v as (typeof PARENT_TYPES)[number],
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PARENT_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="l-pid">대상 ID *</Label>
                <Input
                  id="l-pid"
                  value={form.linkedObjectId}
                  onChange={(e) =>
                    setForm({ ...form, linkedObjectId: e.target.value })
                  }
                  placeholder="예: 1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              공개 범위는 연결 대상이 가진 청중까지만 넓힐 수 있습니다. 회의·문서처럼
              학생 청중이 없는 대상에는 팀·기수 공개를 쓸 수 없습니다.
            </p>
            <div>
              <Label htmlFor="l-desc">설명</Label>
              <Textarea
                id="l-desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                !form.title.trim() ||
                !form.url.trim() ||
                !form.linkedObjectId.trim() ||
                create.isPending
              }
              data-testid="btn-save-link"
            >
              {create.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
