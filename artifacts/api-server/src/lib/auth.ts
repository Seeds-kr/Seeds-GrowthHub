import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  USER_ROLES,
  getEffectiveRoles,
  getOpsRoles,
  hasOpsRole,
  type User,
  type UserRole,
  type OpsRole,
} from "@workspace/db";
import { logger } from "./logger";
import { audit } from "./audit";

const COOKIE_NAME = "seeds_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Session payload. Identity only — NOT an authority record.
 *
 * `opsRoles` is deliberately NOT carried here. Every capability check reads the
 * user row fresh via getCurrentUser(), so revoking an ops role takes effect on
 * the next request rather than the next login. A copy in the cookie would be a
 * stale grant with no upside (the UI already reads /admin/me).
 */
export type Session = {
  userId: number;
  role: UserRole;
  roles: UserRole[];
};
export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  roles: UserRole[];
  opsRoles: OpsRole[];
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be set");
  }
  return secret;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSessionToken(session: Session): string {
  const payload = JSON.stringify({
    ...session,
    exp: Date.now() + SESSION_TTL_MS,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
): Session | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = sign(encoded);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as {
      userId?: number;
      role?: UserRole;
      roles?: UserRole[];
      exp?: number;
    };
    if (
      typeof payload.userId !== "number" ||
      typeof payload.role !== "string" ||
      !(USER_ROLES as readonly string[]).includes(payload.role) ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    const role = payload.role as UserRole;
    // Backwards-compat: tokens issued before multi-role support lack `roles`.
    let roles: UserRole[];
    if (Array.isArray(payload.roles)) {
      roles = payload.roles.filter((r): r is UserRole =>
        (USER_ROLES as readonly string[]).includes(r),
      );
      if (!roles.includes(role)) roles.unshift(role);
    } else {
      roles = [role];
    }
    return { userId: payload.userId, role, roles };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, session: Session): void {
  const token = createSessionToken(session);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getSession(req: Request): Session | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  return verifySessionToken(token);
}

export async function getCurrentUser(req: Request): Promise<User | null> {
  const session = getSession(req);
  if (!session) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  if (!user || !user.isActive) return null;
  return user;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);
  if (!user || !user.isActive) {
    await bcrypt.compare(password, "$2a$10$invalidsaltinvalidsaltinvalidsaO");
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionUser?: User;
    }
  }
}

function makeRequireRole(allowed: UserRole[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const effective = getEffectiveRoles(user);
    if (!allowed.some((r) => effective.includes(r))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.sessionUser = user;
    next();
  };
}

export const requireAuth: RequestHandler = makeRequireRole([
  "admin",
  "mentor",
  "student",
]);
export const requireAdmin: RequestHandler = makeRequireRole(["admin"]);
export const requireMentor: RequestHandler = makeRequireRole(["mentor"]);
export const requireStudent: RequestHandler = makeRequireRole(["student"]);
// Anyone who can carry out an evaluation assignment. The evaluator-role concept
// was removed (the club has no external evaluators); admins assign other
// admins/mentors to evaluate applications. Per-application assignment ownership
// is enforced inside the route handler.
export const requireAdminOrMentor: RequestHandler = makeRequireRole([
  "admin",
  "mentor",
]);

/**
 * Gate a route on a functional ops role (ADR-002). Implies requireAdmin.
 *
 * Capability is read from the DB on every request — never from the session
 * cookie — so role changes take effect immediately. `program_lead` passes
 * every check.
 *
 * NOTE: do NOT use this on /evaluator/*. The evaluation surface is a separate
 * axis (requireAdminOrMentor + per-application assignment ownership); gating it
 * on `recruiting` would lock out the mentors who were assigned to evaluate.
 */
export function requireOpsRole(code: OpsRole): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!getEffectiveRoles(user).includes("admin")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!hasOpsRole(user, code)) {
      logger.warn(
        { userId: user.id, required: code, held: getOpsRoles(user) },
        "ops role denied",
      );
      // Repeated denials usually mean a role was mis-assigned, not an attack.
      req.sessionUser = user;
      audit({
        action: "permission_denied",
        req,
        targetType: "user",
        targetId: user.id,
        note: `required=${code} held=${getOpsRoles(user).join(",") || "none"} path=${req.path}`,
      });
      res.status(403).json({ error: "Forbidden", requiredOpsRole: code });
      return;
    }
    req.sessionUser = user;
    next();
  };
}

/**
 * optionalAuth: populate req.sessionUser if a valid session cookie is present,
 * but do NOT 401 if none is — used for endpoints that return more data to
 * logged-in members (e.g. /people including phone numbers).
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const user = await getCurrentUser(req);
  if (user) req.sessionUser = user;
  next();
};

/**
 * One-time backfill for ADR-002: grant `program_lead` to every existing admin
 * so that introducing requireOpsRole() does not lock anyone out.
 *
 * MUST run before any requireOpsRole gate serves traffic — index.ts calls it
 * during startup, ahead of listen().
 *
 * Runs only while NOT A SINGLE user holds any ops role, i.e. exactly once, on
 * the first boot after the column is pushed. Guarding on "this user has none"
 * instead would silently re-grant program_lead to an admin whose roles were
 * deliberately narrowed to zero — a privilege escalation.
 */
export async function backfillOpsRolesOnce(): Promise<void> {
  const [{ withRoles }] = await db
    .select({
      withRoles: sql<number>`count(*)::int`,
    })
    .from(usersTable)
    .where(sql`cardinality(${usersTable.opsRoles}) > 0`);

  if (withRoles > 0) return; // already initialised — never run again

  const result = await db
    .update(usersTable)
    .set({ opsRoles: ["program_lead"], updatedAt: new Date() })
    .where(sql`${usersTable.role} = 'admin' OR 'admin' = ANY(${usersTable.extraRoles})`)
    .returning({ id: usersTable.id });

  logger.info(
    { count: result.length },
    "backfilled ops_roles=program_lead for existing admins",
  );
}

/**
 * Bootstrap an admin user from ADMIN_EMAIL / ADMIN_PASSWORD env vars on startup.
 * Idempotent: creates the user if missing, or updates the password hash if the
 * env password has changed. This preserves MVP1's env-based admin login flow.
 */
export async function bootstrapAdminFromEnv(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    logger.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap");
    return;
  }
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail))
    .limit(1);
  if (!existing) {
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(usersTable).values({
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
      // The bootstrap admin must always be able to administer ops roles,
      // otherwise a misconfigured backfill could lock everyone out.
      opsRoles: ["program_lead"],
      isActive: true,
    });
    logger.info({ email: adminEmail }, "bootstrapped admin user");
    return;
  }
  const ok = await verifyPassword(adminPassword, existing.passwordHash);
  const updates: Partial<User> = {};
  if (!ok) updates.passwordHash = await hashPassword(adminPassword);
  if (existing.role !== "admin") updates.role = "admin";
  if (!existing.isActive) updates.isActive = true;
  if (!(existing.opsRoles ?? []).includes("program_lead")) {
    updates.opsRoles = Array.from(
      new Set<OpsRole>([...(existing.opsRoles ?? []), "program_lead"]),
    );
  }
  if (Object.keys(updates).length > 0) {
    await db
      .update(usersTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(usersTable.id, existing.id));
    logger.info(
      { email: adminEmail, fields: Object.keys(updates) },
      "updated bootstrap admin",
    );
  }
}
