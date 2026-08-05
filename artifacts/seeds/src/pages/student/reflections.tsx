import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor, MarkdownView } from "@/components/markdown/MarkdownEditor";
import { Loader2, NotebookPen, Lock, Trash2, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/mvp3-api";
import { toast } from "@/hooks/use-toast";

type Visibility = "private" | "team_visible" | "mentor_visible" | "cohort_visible";
type ReflectionType = "personal" | "team" | "project" | "study" | "event" | "cohort_end";

type Reflection = {
  id: number;
  reflectionType: ReflectionType;
  title: string | null;
  contentMd: string;
  visibility: Visibility;
  reflectedOn: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Narrow → wide. The picker lists them in this order so `private` reads first. */
const VISIBILITY_ORDER: Visibility[] = [
  "private",
  "team_visible",
  "mentor_visible",
  "cohort_visible",
];

const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "나만 보기",
  team_visible: "팀원까지",
  mentor_visible: "담당 멘토까지",
  cohort_visible: "같은 기수까지",
};

/**
 * Cumulative and exact — each level includes the ones above it.
 * `cohort_visible` also exposes the reflection to 운영진 (visibility-policy §5),
 * so it must say so: a student widening this far deserves to know who lands in
 * the audience, not a friendlier half-truth.
 */
const VISIBILITY_HINT: Record<Visibility, string> = {
  private: "나만 볼 수 있습니다",
  team_visible: "나 + 같은 프로젝트·스터디 멤버가 볼 수 있습니다",
  mentor_visible: "위 + 담당 멘토가 볼 수 있습니다",
  cohort_visible: "위 + 같은 기수 전체와 운영진이 볼 수 있습니다",
};

const TYPE_LABEL: Record<ReflectionType, string> = {
  personal: "개인 회고",
  team: "팀 회고",
  project: "프로젝트 회고",
  study: "스터디 회고",
  event: "행사 후 회고",
  cohort_end: "기수 종료 회고",
};

/** Prompts are suggestions in the placeholder — never a required form. */
const TYPE_PROMPT: Record<ReflectionType, string> = {
  personal: "이번 기간에 무엇을 해봤나요?\n무엇이 어려웠나요?\n다음엔 무엇을 다르게 해보고 싶나요?",
  team: "팀에서 잘 굴러간 건 무엇이었나요?\n아쉬웠던 협업은 무엇인가요?\n다음 스프린트에 바꾸고 싶은 것은?",
  project: "이 프로젝트에서 내가 맡은 건 무엇이었나요?\n가장 많이 배운 지점은 어디인가요?\n다시 한다면 무엇을 바꾸겠나요?",
  study: "이번 주 스터디에서 이해한 것은?\n아직 모호한 것은?\n다음 주에 파고들 것은?",
  event: "이 행사에서 인상 깊었던 건?\n내게 남은 질문은?",
  cohort_end: "이번 기수 시작할 때의 나와 지금의 나는 무엇이 다른가요?\n가장 기억에 남는 순간은?\n다음에 하고 싶은 것은?",
};

function VisibilityPicker({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {VISIBILITY_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
              value === v
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border hover:bg-muted/50"
            }`}
          >
            {VISIBILITY_LABEL[v]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{VISIBILITY_HINT[value]}</p>
    </div>
  );
}

type SharedReflection = {
  id: number;
  authorName: string;
  reflectionType: ReflectionType;
  title: string | null;
  contentMd: string;
  visibility: Visibility;
  createdAt: string;
};

/** Reflections peers chose to share. Never includes anyone's `private`. */
function SharedTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["student-reflections-shared"],
    queryFn: () =>
      api<{ items: SharedReflection[]; total: number }>("/student/reflections/shared"),
  });

  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
        공유된 회고가 없습니다. 팀원이나 같은 기수 동료가 공개하면 여기에 나타납니다.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {data.items.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {TYPE_LABEL[r.reflectionType]}
              </Badge>
              <span className="text-sm font-medium">{r.authorName}</span>
              {r.title && <span className="text-sm">{r.title}</span>}
              <span className="text-xs text-muted-foreground">
                {format(new Date(r.createdAt), "yyyy.MM.dd")}
              </span>
            </div>
            <MarkdownView source={r.contentMd} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function StudentReflections() {
  const qc = useQueryClient();
  const [type, setType] = useState<ReflectionType>("personal");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-reflections"],
    queryFn: () => api<{ items: Reflection[]; total: number }>("/student/reflections"),
  });

  const reset = () => {
    setTitle("");
    setContent("");
    setVisibility("private");
    setType("personal");
    setEditingId(null);
  };

  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/student/reflections/${editingId}`, {
            method: "PATCH",
            body: { title: title || null, contentMd: content, visibility, reflectionType: type },
          })
        : api("/student/reflections", {
            method: "POST",
            body: { title: title || null, contentMd: content, visibility, reflectionType: type },
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-reflections"] });
      reset();
      toast({ title: "저장되었습니다." });
    },
    onError: (e: any) =>
      toast({ title: "실패", description: e?.data?.error ?? e.message, variant: "destructive" }),
  });

  const changeVisibility = useMutation({
    mutationFn: (v: { id: number; visibility: Visibility }) =>
      api(`/student/reflections/${v.id}`, { method: "PATCH", body: { visibility: v.visibility } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-reflections"] });
      toast({ title: "공개 범위가 변경되었습니다." });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/student/reflections/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-reflections"] });
      toast({ title: "삭제되었습니다." });
    },
  });

  return (
    <>
      <div className="space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <NotebookPen className="h-6 w-6 text-primary" />내 회고
          </h1>
          <p className="mt-1 flex items-start gap-1.5 rounded border border-primary/30 bg-primary/5 p-2.5 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>회고는 평가에 사용되지 않습니다.</strong> 공개 범위는 직접 정하고
              언제든 다시 좁힐 수 있습니다. 기본값은 &ldquo;나만 보기&rdquo;입니다.
            </span>
          </p>
        </div>

        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine" className="gap-1">
              <NotebookPen className="h-3.5 w-3.5" /> 내 회고
            </TabsTrigger>
            <TabsTrigger value="shared" className="gap-1">
              <Users className="h-3.5 w-3.5" /> 공유된 회고
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shared" className="mt-4">
            <SharedTab />
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-5">
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap gap-2">
              <Select value={type} onValueChange={(v) => setType(v as ReflectionType)}>
                <SelectTrigger className="w-40 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="flex-1"
                placeholder="제목 (선택)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <MarkdownEditor
              rows={10}
              value={content}
              onChange={setContent}
              placeholder={TYPE_PROMPT[type]}
            />

            <VisibilityPicker value={visibility} onChange={setVisibility} />

            <div className="flex gap-2">
              <Button disabled={!content.trim() || save.isPending} onClick={() => save.mutate()}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "수정 저장" : "회고 저장"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={reset}>
                  취소
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            아직 작성한 회고가 없습니다.
          </p>
        )}

        <div className="space-y-3">
          {data?.items.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABEL[r.reflectionType]}
                  </Badge>
                  {r.title && <span className="font-medium">{r.title}</span>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.createdAt), "yyyy.MM.dd")}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Select
                      value={r.visibility}
                      onValueChange={(v) =>
                        changeVisibility.mutate({ id: r.id, visibility: v as Visibility })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_ORDER.map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            {VISIBILITY_LABEL[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setEditingId(r.id);
                        setTitle(r.title ?? "");
                        setContent(r.contentMd);
                        setVisibility(r.visibility);
                        setType(r.reflectionType);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive"
                      onClick={() => {
                        if (confirm("이 회고를 삭제할까요? 되돌릴 수 없습니다.")) {
                          remove.mutate(r.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <MarkdownView source={r.contentMd} />
              </CardContent>
            </Card>
          ))}
        </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
