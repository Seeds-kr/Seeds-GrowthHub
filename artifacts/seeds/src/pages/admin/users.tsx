import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { api } from "@/lib/mvp3-api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, UserCog, ExternalLink, ShieldCheck } from "lucide-react";
import {
  OPS_ROLE_LABELS,
  hasOpsRole,
  type OpsRoleCode,
} from "@/lib/admin-nav";
import { ApiError } from "@/lib/mvp3-api";

const OPS_ROLE_ORDER: OpsRoleCode[] = [
  "program_lead",
  "ops",
  "recruiting",
  "finance",
  "growth",
  "community",
  "system",
];

/** Which menus each role unlocks — shown inline so assignment is not guesswork. */
const OPS_ROLE_HINT: Record<OpsRoleCode, string> = {
  program_lead: "전체 접근. 다른 모든 기능 역할을 포함합니다.",
  ops: "회의 · 작업 · 행사 · 운영 문서",
  recruiting: "모집 · 지원자 · 평가 배정 · 면접 · 합격 결정",
  finance: "재정 · 정산 · 증빙",
  growth: "프로젝트 · 활동기록 · 피드백",
  community: "공지 · 사람 디렉터리 · 사이트 콘텐츠",
  system: "계정 · 역할 변경 · 감사 로그",
};

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "mentor" | "student";
  extraRoles: string[];
  opsRoles: string[];
  isActive: boolean;
  createdAt: string;
  assignedCount: number;
  completedCount: number;
};

const ROLE_LABEL: Record<string, string> = {
  admin: "운영진",
  mentor: "멘토",
  student: "학생",
};

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  mentor: "border-blue-500 text-blue-700 dark:text-blue-400",
  student: "border-slate-400 text-slate-600 dark:text-slate-300",
};


function OpsRolesDialog({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<OpsRoleCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected((user?.opsRoles ?? []) as OpsRoleCode[]);
    setError(null);
  }, [user]);

  const save = useMutation({
    mutationFn: (opsRoles: OpsRoleCode[]) =>
      api(`/admin/users/${user!.id}`, {
        method: "PATCH",
        body: { opsRoles },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
    // 409 = last program_lead guard. Surface the server message verbatim.
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError && e.data?.error
          ? String(e.data.error)
          : "저장하지 못했습니다.";
      setError(msg);
    },
  });

  const toggle = (code: OpsRoleCode) =>
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const isAdmin =
    user !== null && (user.role === "admin" || user.extraRoles.includes("admin"));

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            운영 기능 권한
          </DialogTitle>
          <DialogDescription>
            {user?.name} · {user?.email}
          </DialogDescription>
        </DialogHeader>

        {!isAdmin && (
          <p className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            이 계정은 운영진(admin) 역할이 없어 기능 권한이 적용되지 않습니다.
            먼저 워크스페이스 접근에 운영진을 부여하세요.
          </p>
        )}

        <div className="space-y-2">
          {OPS_ROLE_ORDER.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-start gap-3 rounded border p-2.5 hover:bg-muted/40"
            >
              <Checkbox
                checked={selected.includes(code)}
                onCheckedChange={() => toggle(code)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {OPS_ROLE_LABELS[code]}
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    {code}
                  </span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {OPS_ROLE_HINT[code]}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <p className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            취소
          </Button>
          <Button onClick={() => save.mutate(selected)} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  // Editing ops roles is server-gated on `system`; mirror that here so the
  // button does not appear for admins who would just get a 403.
  const { data: me } = useAdminMe();
  const canEditRoles = hasOpsRole(me?.opsRoles, "system");

  const { data, isLoading, isError } = useQuery<{ items: AdminUser[] }>({
    queryKey: ["admin", "users", roleFilter],
    queryFn: () =>
      api<{ items: AdminUser[] }>(
        roleFilter === "all" ? "/admin/users" : `/admin/users?role=${roleFilter}`,
      ),
  });

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!q.trim()) return items;
    const lo = q.trim().toLowerCase();
    return items.filter(
      (u) => u.name.toLowerCase().includes(lo) || u.email.toLowerCase().includes(lo),
    );
  }, [data, q]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <UserCog className="h-6 w-6 text-primary" />
              사용자
            </h1>
            <p className="text-sm text-muted-foreground">
              플랫폼 계정 단위 사용자 목록 — 기본 역할, 추가 역할(extra_roles), 활성 상태를 한눈에 확인합니다.
              세부 편집은 학생 상세(/admin/students/:id) 또는 평가 담당자(/admin/evaluators)에서 진행합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 역할</SelectItem>
              <SelectItem value="admin">운영진(Admin)</SelectItem>
              <SelectItem value="mentor">멘토(Mentor)</SelectItem>
              <SelectItem value="student">학생(Student)</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="이름·이메일 검색"
            className="w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Badge variant="secondary" className="ml-auto">
            {filtered.length}명
          </Badge>
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 불러오는 중…
          </div>
        )}
        {isError && (
          <p className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            사용자를 불러오지 못했습니다.
          </p>
        )}

        {filtered.length === 0 && !isLoading && !isError && (
          <p className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
            조건에 맞는 사용자가 없습니다.
          </p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">이메일</th>
                  <th className="px-3 py-2 text-left">기본 역할</th>
                  <th className="px-3 py-2 text-left">추가 역할</th>
                  <th className="px-3 py-2 text-left">운영 기능 권한</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-left">평가 배정/완료</th>
                  <th className="px-3 py-2 text-left">바로가기</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{u.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2">
                      <Badge className={ROLE_BADGE[u.role] ?? ""}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {u.extraRoles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.extraRoles.map((r) => (
                            <Badge key={r} variant="outline" className="text-xs">
                              {ROLE_LABEL[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {u.opsRoles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          u.opsRoles.map((r) => (
                            <Badge
                              key={r}
                              variant="outline"
                              className={
                                r === "program_lead"
                                  ? "border-primary text-primary text-xs"
                                  : "text-xs"
                              }
                            >
                              {OPS_ROLE_LABELS[r as OpsRoleCode] ?? r}
                            </Badge>
                          ))
                        )}
                        {canEditRoles && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => setEditing(u)}
                          >
                            편집
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          비활성
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {u.assignedCount === 0 ? "—" : `${u.completedCount}/${u.assignedCount}`}
                    </td>
                    <td className="px-3 py-2">
                      {u.role === "student" || u.extraRoles.includes("student") ? (
                        <Link href={`/admin/students`}>
                          <Button size="sm" variant="ghost" className="h-7 gap-1">
                            학생 상세 <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/admin/evaluators">
                          <Button size="sm" variant="ghost" className="h-7 gap-1">
                            평가자 관리 <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          ※ 워크스페이스 접근(기본·추가 역할)은 학생 상세 또는 합격자 전환 흐름에서 변경합니다.
          운영 기능 권한은 이 화면에서 편집하며, <code>system</code> 기능 역할이 필요합니다.
          총괄(<code>program_lead</code>)은 모든 기능 권한을 포함하며 마지막 1명은 해제할 수 없습니다.
          scope 기반 권한(role_assignments)은 도입하지 않았습니다 — 담당 기수·프로젝트 단위 제한은 표현되지 않습니다.
        </p>

        <OpsRolesDialog user={editing} onClose={() => setEditing(null)} />
      </div>
    </>
  );
}
