import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTeamLinks,
  createTeamLink,
  deleteTeamLink,
  LINK_TYPES,
  LINK_TYPE_LABEL,
  STUDENT_LINK_VISIBILITY_LABEL,
  type TeamOwnerType,
  type TeamViewer,
} from "@/lib/team-api";

/**
 * Team reference links — Drive folders, repos, issue boards (design 06 §7).
 *
 * `linkType` is the "tag" the team picks; it is a fixed server-side vocabulary
 * rather than free text so the list stays groupable and a typo cannot invent a
 * category of one.
 *
 * Students only ever see two visibility choices. `admin_only` would create a
 * row they cannot read back, and `private` on a team parent is a contradiction
 * — the server rejects both, so offering them here would only produce errors.
 */
export function TeamLinks({
  viewer,
  ownerType,
  ownerId,
}: {
  viewer: TeamViewer;
  ownerType: TeamOwnerType;
  ownerId: number;
}) {
  const qc = useQueryClient();
  const canEdit = viewer === "student";
  const key = ["team-links", viewer, ownerType, ownerId];

  const { data: items, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listTeamLinks(viewer, ownerType, ownerId),
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [linkType, setLinkType] = useState("drive");
  const [visibility, setVisibility] = useState("team_visible");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setTitle("");
    setUrl("");
    setLinkType("drive");
    setVisibility("team_visible");
    setError(null);
  };

  const add = useMutation({
    mutationFn: () =>
      createTeamLink({ ownerType, ownerId, title, url, linkType, visibility }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      reset();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "추가하지 못했습니다."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteTeamLink(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          참고 링크
          {items?.length ? <Badge variant="secondary">{items.length}</Badge> : null}
        </CardTitle>
        {canEdit && !open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="button-new-team-link">
            <Plus className="mr-1 h-4 w-4" /> 링크 추가
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {open && canEdit && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input
              placeholder="이름 — 예: 팀 드라이브 폴더"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-team-link-title"
            />
            <Input
              placeholder="https://drive.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-team-link-url"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger className="w-44" data-testid="select-team-link-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LINK_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="w-44" data-testid="select-team-link-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STUDENT_LINK_VISIBILITY_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!title.trim() || !url.trim() || add.isPending}
                onClick={() => add.mutate()}
                data-testid="button-save-team-link"
              >
                {add.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                추가
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="mr-1 h-4 w-4" /> 취소
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "드라이브 폴더나 저장소 주소를 걸어 두면 팀원이 함께 찾습니다."
              : "등록된 링크가 없습니다."}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    data-testid={`team-link-${l.id}`}
                  >
                    {l.title} <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="truncate text-xs text-muted-foreground">{l.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {LINK_TYPE_LABEL[l.linkType] ?? l.linkType}
                  </Badge>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`"${l.title}" 링크를 지웁니다.`)) remove.mutate(l.id);
                      }}
                      aria-label="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
