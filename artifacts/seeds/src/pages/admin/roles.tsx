import { AdminLayout } from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Info, Wrench } from "lucide-react";
import { Link } from "wouter";
import { OPS_ROLE_LABELS, type OpsRoleCode } from "@/lib/admin-nav";

type OpsRoleRow = {
  code: OpsRoleCode;
  staffRole: string;
  unlocks: string;
  restricted?: boolean;
};

/** Mirrors docs/design/01-role-permissions.md §3.1. */
const OPS_ROLE_ROWS: OpsRoleRow[] = [
  { code: "program_lead", staffRole: "Program Lead", unlocks: "전체 접근 — 다른 모든 기능 역할을 포함합니다." },
  { code: "ops", staffRole: "Ops Manager", unlocks: "회의 · 작업 · 행사/세션 · 운영 문서 · 운영 대시보드" },
  { code: "recruiting", staffRole: "Recruiting Lead", unlocks: "모집 · 지원자 · 평가 배정 · 면접 · 최종 결정", restricted: true },
  { code: "finance", staffRole: "Finance/Admin Lead", unlocks: "재정 · 정산 · 증빙", restricted: true },
  { code: "growth", staffRole: "Growth/Experience Lead", unlocks: "프로젝트 · 활동기록 · 피드백 · 스터디" },
  { code: "community", staffRole: "Community Lead", unlocks: "공지 · 사람 디렉터리 · 사이트 콘텐츠" },
  { code: "system", staffRole: "System/Product Lead", unlocks: "계정 생성 · 역할 변경 · 감사 로그", restricted: true },
];

type RoleRow = {
  code: string;
  ko: string;
  description: string;
  capabilities: string[];
  examples: string;
};

const ROLES: RoleRow[] = [
  {
    code: "admin",
    ko: "운영진",
    description: "플랫폼 전체 운영 권한. 모든 관리자 화면(/admin/*)에 접근하고, 사용자·기수·재정·문서 등을 생성/수정할 수 있습니다.",
    capabilities: [
      "모든 /admin 라우트 접근",
      "회원·기수·세션·과제·공지·재정·문서 CRUD",
      "지원자 평가 배정 및 최종 합격 결정",
      "다른 사용자의 추가 역할(extra_roles) 토글",
    ],
    examples: "ADMIN_EMAIL 부트스트랩 계정, 추가로 임명된 운영팀",
  },
  {
    code: "mentor",
    ko: "멘토",
    description: "선배 개발자 멘토 권한. 본인 프로필을 편집하고, 평가 담당자로 배정된 지원서에 한해 평가 기능을 사용합니다.",
    capabilities: [
      "/mentor 라우트 접근",
      "본인 people_profiles(mentor) 편집",
      "평가 배정된 지원서에 한해 /evaluator/applications/:id 접근",
    ],
    examples: "현직 개발자 멘토",
  },
  {
    code: "student",
    ko: "학생",
    description: "동아리 정회원. 본인 활동 기록·과제·산출물·피드백을 열람하고 본인 프로필을 편집합니다.",
    capabilities: [
      "/student 라우트 접근",
      "본인 활동 기록·타임라인·리포트 열람",
      "참여 프로젝트의 산출물·피드백 열람 (visibility 규칙 준수)",
      "본인 과제 제출 및 출석 확인",
    ],
    examples: "합격 후 전환된 학생 계정",
  },
];

export default function AdminRoles() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            역할 & 권한
          </h1>
          <p className="text-sm text-muted-foreground">
            권한은 두 축입니다 — <strong>워크스페이스 접근</strong>(role + extra_roles)과{" "}
            <strong>운영 기능 권한</strong>(ops_roles). 아래는 읽기 전용 개요입니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r.code}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Badge className="bg-primary text-primary-foreground">{r.code}</Badge>
                  <span>{r.ko}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{r.description}</p>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">권한</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {r.capabilities.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">예:</span> {r.examples}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-primary" />
              운영 기능 권한(ops_roles)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <code className="rounded bg-muted px-1 text-xs">users.ops_roles text[]</code> — 운영진 세부 역할입니다.
              위의 워크스페이스 역할과 <strong>독립된 축</strong>이며, <Badge variant="outline">admin</Badge> 역할을 가진
              계정에만 적용됩니다. 멘토·학생은 이 값이 무엇이든 관리자 기능을 얻지 못합니다.
            </p>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">코드</th>
                    <th className="px-3 py-2 text-left">운영진 역할</th>
                    <th className="px-3 py-2 text-left">열리는 영역</th>
                  </tr>
                </thead>
                <tbody>
                  {OPS_ROLE_ROWS.map((r) => (
                    <tr key={r.code} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <Badge
                          variant="outline"
                          className={r.code === "program_lead" ? "border-primary text-primary" : ""}
                        >
                          {OPS_ROLE_LABELS[r.code]}
                        </Badge>
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.code}</div>
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">{r.staffRole}</td>
                      <td className="px-3 py-2 align-top text-xs">
                        {r.unlocks}
                        {r.restricted && (
                          <span className="ml-1.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                            제한 열람
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                • <strong>제한 열람</strong> 영역은 담당 기능 역할 + 총괄만 접근합니다. 그 외 관리자 화면은 모든 운영진이 읽을 수 있습니다
                (운영 투명성 우선).
              </p>
              <p>
                • 총괄(<code>program_lead</code>)은 모든 검사를 통과하며, <strong>마지막 1명은 해제·비활성화할 수 없습니다.</strong>
              </p>
              <p>
                • 평가 표면(<code>/evaluator/*</code>)은 <code>recruiting</code>과 <strong>별개 축</strong>입니다 —
                배정받은 멘토는 기능 역할 없이도 평가를 수행합니다.
              </p>
              <p>
                • 부여·회수는{" "}
                <Link href="/admin/users" className="underline underline-offset-2">
                  사용자(Users)
                </Link>{" "}
                화면에서 하며 <code>system</code> 기능 역할이 필요합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              추가 역할(extra_roles)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <code className="rounded bg-muted px-1 text-xs">users.extra_roles text[]</code> 컬럼에 보조 역할을 추가할 수 있습니다.
              유효 역할(effective roles) = <code className="text-xs">unique(union([role, ...extraRoles]))</code>.
            </p>
            <p>
              예: 기본 <Badge variant="outline">student</Badge> 계정에 <Badge variant="outline">mentor</Badge>를 추가하면
              해당 사용자는 <code className="text-xs">/student</code>·<code className="text-xs">/mentor</code> 양쪽 모두에 접근하고,
              상단의 역할 전환 버튼으로 자유롭게 이동합니다.
            </p>
            <p>
              추가 역할 토글은 <strong>학생 상세(/admin/students/:id)</strong>의 권한 카드에서 수행합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              평가자(Evaluator) 표면
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              평가는 별도 역할이 아닌 <strong>지원서 단위 배정</strong>으로 작동합니다.
              <code className="rounded bg-muted px-1 text-xs">evaluation_assignments</code> 테이블에 등록된 사용자만
              <code className="text-xs">/evaluator/applications/:id</code>에 접근할 수 있으며,
              admin/mentor 역할을 가진 사용자가 배정 대상입니다 (학생 단독 계정은 평가자가 될 수 없습니다).
            </p>
            <p>
              배정 관리: <strong>/admin/evaluators</strong> 및 지원서 상세의 평가 담당자 섹션.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              향후 범위 (Deferred)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>• scope 기반 권한(role_assignments) — 기능 역할은 도입했으나 <strong>담당 범위</strong>는 아직 표현하지 못합니다. "3기 담당 회계"처럼 기수·프로젝트 단위 제한이 필요해지면 도입합니다.</p>
            <p>• 권한 변경 감사 로그 — 현재 최종 합격 결정만 decision_logs에 기록됨. audit_logs 테이블 도입 후 확장.</p>
            <p>• UI에서 추가 역할 일괄 부여/회수.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
