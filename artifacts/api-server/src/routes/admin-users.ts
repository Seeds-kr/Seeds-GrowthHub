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
} from "@workspace/db";
import { hashPassword, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

function publicUser(u: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
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
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    assignedCount: u.assignedCount,
    completedCount: u.completedCount,
  };
}

router.get("/admin/users", requireAdmin, async (req, res) => {
  const roleParam = req.query.role;
  const filters = [] as ReturnType<typeof eq>[];
  if (typeof roleParam === "string" && (USER_ROLES as readonly string[]).includes(roleParam)) {
    filters.push(eq(usersTable.role, roleParam as UserRole));
  }

  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
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

router.post("/admin/users", requireAdmin, async (req, res) => {
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
  const [row] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name.trim(),
      email,
      passwordHash,
      role: parsed.data.role,
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

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
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

  const [row] = await db
    .update(usersTable)
    .set(update)
    .where(eq(usersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(publicUser({ ...row, assignedCount: 0, completedCount: 0 }));
});

export default router;
