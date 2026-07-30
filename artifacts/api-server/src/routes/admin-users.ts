import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  CreateUserBody,
  UpdateUserBody,
  type UserRole,
} from "@workspace/api-zod";
import {
  db,
  usersTable,
  evaluationAssignmentsTable,
  USER_ROLES,
  OPS_ROLES,
  type OpsRole,
} from "@workspace/db";
import { hashPassword, requireAdmin, requireOpsRole } from "../lib/auth";
import { audit, diffFields } from "../lib/audit";

const router: IRouter = Router();

// ADR-002: account + role administration belongs to the system function role.
// GET stays open to any admin (read-wide) — the evaluator picker depends on it.
const requireSystem = requireOpsRole("system");

function sanitizeExtraRoles(
  primary: UserRole,
  raw: unknown,
): UserRole[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<UserRole>();
  for (const r of raw) {
    if (
      typeof r === "string" &&
      (USER_ROLES as readonly string[]).includes(r) &&
      r !== primary
    ) {
      set.add(r as UserRole);
    }
  }
  return Array.from(set);
}

function sanitizeOpsRoles(raw: unknown): OpsRole[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<OpsRole>();
  for (const r of raw) {
    if (typeof r === "string" && (OPS_ROLES as readonly string[]).includes(r)) {
      set.add(r as OpsRole);
    }
  }
  return Array.from(set);
}

/**
 * Refuse to drop the last program_lead. Without this, an admin can lock every
 * account out of role administration with a single PATCH and leave no in-app
 * way back (recovery would need direct DB access).
 */
async function wouldOrphanProgramLead(
  targetUserId: number,
  nextOpsRoles: OpsRole[],
): Promise<boolean> {
  if (nextOpsRoles.includes("program_lead")) return false;
  const [{ others }] = await db
    .select({ others: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(
      sql`${usersTable.id} <> ${targetUserId}
          AND ${usersTable.isActive}
          AND 'program_lead' = ANY(${usersTable.opsRoles})`,
    );
  return others === 0;
}

function publicUser(u: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  extraRoles: UserRole[] | null;
  opsRoles: OpsRole[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  assignedCount: number;
  completedCount: number;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    extraRoles: u.extraRoles ?? [],
    opsRoles: u.opsRoles ?? [],
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    assignedCount: u.assignedCount,
    completedCount: u.completedCount,
  };
}

router.get("/admin/users", requireAdmin, async (req, res) => {
  const roleParam = req.query.role;
  const filters: any[] = [];
  // Filter by EFFECTIVE role: primary role match OR role present in extra_roles[].
  // Lets multi-role accounts (e.g. student with extraRoles=['evaluator']) appear
  // in role-scoped admin pickers like the evaluator selector.
  if (typeof roleParam === "string" && (USER_ROLES as readonly string[]).includes(roleParam)) {
    filters.push(
      sql`(${usersTable.role} = ${roleParam} OR ${roleParam} = ANY(${usersTable.extraRoles}))`,
    );
  }

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      extraRoles: usersTable.extraRoles,
      opsRoles: usersTable.opsRoles,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      assignedCount: sql<number>`(
        select count(*)::int from ${evaluationAssignmentsTable}
        where ${evaluationAssignmentsTable.evaluatorId} = ${usersTable.id}
      )`,
      completedCount: sql<number>`(
        select count(*)::int from ${evaluationAssignmentsTable}
        where ${evaluationAssignmentsTable.evaluatorId} = ${usersTable.id}
          and ${evaluationAssignmentsTable.status} = 'completed'
      )`,
    })
    .from(usersTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(usersTable.id));

  res.json({
    items: rows.map(publicUser),
    total: rows.length,
  });
});

router.post("/admin/users", requireSystem, async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user data" });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const body = req.body as Record<string, unknown>;
  const extraRoles = sanitizeExtraRoles(parsed.data.role, body?.extraRoles);
  const opsRoles = sanitizeOpsRoles(body?.opsRoles);
  const [row] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name.trim(),
      email,
      passwordHash,
      role: parsed.data.role,
      extraRoles,
      opsRoles,
      isActive: true,
    })
    .returning();
  res.status(201).json(
    publicUser({
      ...row,
      assignedCount: 0,
      completedCount: 0,
    }),
  );
});

router.patch("/admin/users/:id", requireSystem, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update" });
    return;
  }
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined)
    update.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
  if (parsed.data.password !== undefined)
    update.passwordHash = await hashPassword(parsed.data.password);

  const body = req.body as Record<string, unknown>;
  const rawExtra = body?.extraRoles;
  const rawOps = body?.opsRoles;

  if (rawExtra !== undefined || rawOps !== undefined) {
    const [current] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (rawExtra !== undefined) {
      update.extraRoles = sanitizeExtraRoles(current.role, rawExtra);
    }
    if (rawOps !== undefined) {
      const nextOps = sanitizeOpsRoles(rawOps);
      if (await wouldOrphanProgramLead(id, nextOps)) {
        res.status(409).json({
          error:
            "마지막 총괄(program_lead) 권한은 해제할 수 없습니다. 다른 사용자에게 먼저 부여하세요.",
        });
        return;
      }
      update.opsRoles = nextOps;
    }
  }

  // Deactivating the last program_lead is the same lockout by another route.
  if (parsed.data.isActive === false) {
    const [target] = await db
      .select({ opsRoles: usersTable.opsRoles })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    const nextOps = (update.opsRoles as OpsRole[] | undefined) ?? target?.opsRoles ?? [];
    if (nextOps.includes("program_lead") && (await wouldOrphanProgramLead(id, []))) {
      res.status(409).json({
        error:
          "마지막 총괄(program_lead) 계정은 비활성화할 수 없습니다. 다른 사용자에게 먼저 부여하세요.",
      });
      return;
    }
  }

  // Snapshot before the write so the audit records an actual diff.
  const [prev] = await db
    .select({
      extraRoles: usersTable.extraRoles,
      opsRoles: usersTable.opsRoles,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  const [row] = await db
    .update(usersTable)
    .set(update)
    .where(eq(usersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Only role/activation changes are auditable — name/email/password edits are
  // not sensitive in the ADR-002 sense and would just add noise.
  if (prev && (update.extraRoles || update.opsRoles || update.isActive !== undefined)) {
    const { before, after } = diffFields(
      { extraRoles: prev.extraRoles, opsRoles: prev.opsRoles, isActive: prev.isActive },
      { extraRoles: row.extraRoles, opsRoles: row.opsRoles, isActive: row.isActive },
    );
    if (Object.keys(after).length > 0) {
      audit({ action: "role_change", req, targetType: "user", targetId: id, before, after });
    }
  }

  res.json(publicUser({ ...row, assignedCount: 0, completedCount: 0 }));
});

export default router;
