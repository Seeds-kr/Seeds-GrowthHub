import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  evaluator: "/evaluator",
  student: "/student",
};

const LABEL_BY_ROLE: Record<string, string> = {
  admin: "운영진",
  evaluator: "평가위원",
  student: "학생",
};

export function RoleSwitcher({
  roles,
  current,
}: {
  roles: string[];
  current: "admin" | "evaluator" | "student";
}) {
  const others = roles.filter((r) => r !== current && HOME_BY_ROLE[r]);
  if (others.length === 0) return null;
  return (
    <div className="hidden md:flex items-center gap-2 mr-2 pr-3 border-r border-border">
      <span className="text-xs text-muted-foreground">화면 전환:</span>
      {others.map((r) => (
        <Link key={r} href={HOME_BY_ROLE[r]}>
          <Button variant="outline" size="sm" className="rounded-none h-7 text-xs">
            {LABEL_BY_ROLE[r] ?? r}
          </Button>
        </Link>
      ))}
    </div>
  );
}

export function effectiveRoles(me: { role: string; roles?: string[] | null }): string[] {
  if (Array.isArray(me.roles) && me.roles.length > 0) return me.roles;
  return [me.role];
}

export function pickRedirectFor(roles: string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("student")) return "/student";
  if (roles.includes("evaluator")) return "/evaluator";
  return "/login";
}
