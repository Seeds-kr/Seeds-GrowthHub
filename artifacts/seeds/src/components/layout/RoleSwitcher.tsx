import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  mentor: "/mentor",
  student: "/student",
};

const LABEL_BY_ROLE: Record<string, string> = {
  admin: "운영진",
  mentor: "멘토",
  student: "학생",
};

export function RoleSwitcher({
  roles,
  current,
}: {
  roles: string[];
  current: "admin" | "mentor" | "student";
}) {
  const others = roles.filter((r) => r !== current && HOME_BY_ROLE[r]);
  if (others.length === 0) return null;
  return (
    <div className="px-3 py-1 space-y-1">
      <div className="text-xs text-muted-foreground">다른 역할로 전환</div>
      <div className="flex flex-wrap gap-1.5">
        {others.map((r) => (
          <Link key={r} href={HOME_BY_ROLE[r]}>
            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
              {LABEL_BY_ROLE[r] ?? r}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function effectiveRoles(me: { role: string; roles?: string[] | null }): string[] {
  if (Array.isArray(me.roles) && me.roles.length > 0) return me.roles;
  return [me.role];
}

export function pickRedirectFor(roles: string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("mentor")) return "/mentor";
  if (roles.includes("student")) return "/student";
  return "/login";
}
