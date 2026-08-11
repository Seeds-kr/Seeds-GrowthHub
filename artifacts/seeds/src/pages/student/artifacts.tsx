import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api, ARTIFACT_TYPE_LABEL, ARTIFACT_VISIBILITY_LABEL,
  type Mvp4Artifact,
} from "@/lib/mvp3-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type Parents = {
  projects: { id: number; title: string }[];
  studies: { id: number; title: string }[];
};

/** 학생이 고를 수 있는 공개범위. `admin_only` 는 자기가 못 읽으므로 없다. */
const VISIBILITIES = ["private", "student_visible", "cohort_visible"] as const;
const TYPES = ["link", "document", "presentation", "video", "code", "image", "report", "other"] as const;

/** 팀 선택용 값. Radix Select 가 빈 문자열 값을 거부한다. */
const NONE = "__none__";

export default function StudentArtifacts() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["student-artifacts"],
    queryFn: () => api<{ items: Mvp4Artifact[] }>("/student/artifacts"),
  });
  const { data: parents } = useQuery({
    queryKey: ["student-artifact-parents"],
    queryFn: () => api<Parents>("/student/artifacts/parents"),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [artifactType, setArtifactType] = useState<string>("link");
  const [visibility, setVisibility] = useState<string>("student_visible");
  const [parent, setParent] = useState<string>(NONE);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setTitle("");
    setUrl("");
    setArtifactType("link");
    setVisibility("student_visible");
    setParent(NONE);
    setDescription("");
    setError(null);
  };

  const create = useMutation({
    mutationFn: () => {
      // "project:3" / "study:1" 한 값으로 두 필드를 고른다. 드롭다운을 둘로
      // 나누면 "프로젝트도 스터디도 고른" 상태가 표현돼 버린다.
      const [kind, rawId] = parent === NONE ? [null, null] : parent.split(":");
      return api("/student/artifacts", {
        method: "POST",
        body: {
          title,
          url,
          artifactType,
          visibility,
          description: description || null,
          projectId: kind === "project" ? Number(rawId) : null,
          studyId: kind === "study" ? Number(rawId) : null,
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["student-artifacts"] });
      reset();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "등록하지 못했습니다."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/student/artifacts/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["student-artifacts"] }),
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold">내 아티팩트</h1>
          <p className="text-sm text-muted-foreground">
            내가 만든 것 — 코드·발표자료·데모·기획서 링크를 모아 둡니다.
            기수가 끝나면 리포트에 그대로 실립니다.
          </p>
        </div>
        {!open && (
          <Button onClick={() => setOpen(true)} data-testid="button-new-artifact">
            <Plus className="mr-1 h-4 w-4" /> 산출물 등록
          </Button>
        )}
      </div>

      {open && (
        <Card className="mb-6">
          <CardContent className="space-y-3 pt-6">
            <Input
              placeholder="이름 — 예: 출석앱 발표자료"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-artifact-title"
            />
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-artifact-url"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={artifactType} onValueChange={setArtifactType}>
                <SelectTrigger className="w-40" data-testid="select-artifact-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{ARTIFACT_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger className="w-52" data-testid="select-artifact-parent">
                  <SelectValue placeholder="팀 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>개인 산출물</SelectItem>
                  {parents?.projects.map((p) => (
                    <SelectItem key={`p${p.id}`} value={`project:${p.id}`}>
                      프로젝트 · {p.title}
                    </SelectItem>
                  ))}
                  {parents?.studies.map((s) => (
                    <SelectItem key={`s${s.id}`} value={`study:${s.id}`}>
                      스터디 · {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="w-44" data-testid="select-artifact-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((v) => (
                    <SelectItem key={v} value={v}>{ARTIFACT_VISIBILITY_LABEL[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={2}
              placeholder="설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                disabled={!title.trim() || !url.trim() || create.isPending}
                onClick={() => create.mutate()}
                data-testid="button-save-artifact"
              >
                {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                등록
              </Button>
              <Button variant="ghost" onClick={reset}>
                <X className="mr-1 h-4 w-4" /> 취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Loader2 className="mx-auto animate-spin" />
      ) : items.length === 0 ? (
        <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
          아직 등록한 산출물이 없습니다. 만든 것을 링크로 남겨 두면 나중에 찾기 쉽습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((a) => (
            <Card key={a.id} data-testid={`artifact-${a.id}`}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href={a.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {a.title} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <span className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline">{ARTIFACT_TYPE_LABEL[a.artifactType]}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="삭제"
                      onClick={() => {
                        if (confirm(`"${a.title}" 을(를) 지웁니다.`)) remove.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div>{a.description ?? ""}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ARTIFACT_VISIBILITY_LABEL[a.visibility]}</Badge>
                  <span>{format(new Date(a.createdAt), "yyyy-MM-dd")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
