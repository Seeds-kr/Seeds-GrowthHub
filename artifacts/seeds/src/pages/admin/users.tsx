import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layout/AdminLayout";
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
import { Loader2, UserCog, ExternalLink } from "lucide-react";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "mentor" | "student";
  extraRoles: string[];
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

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery<{ items: AdminUser[] }>({
    queryKey: ["admin", "users", roleFilter],
    queryFn: () =>
      api<{ items: AdminUser[] }>(
        roleFilter === "all" ? "/api/admin/users" : `/api/admin/users?role=${roleFilter}`,
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
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <UserCog className="h-6 w-6 text-primary" />
              사용자(Users)
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
          ※ 이 화면은 읽기 전용 인덱스입니다. 계정 생성·비밀번호 재설정·역할 변경은 합격자 전환 흐름 또는 학생 상세에서 수행하세요.
          scope 기반 권한(role_assignments)은 향후 도입 예정입니다.
        </p>
      </div>
    </AdminLayout>
  );
}
