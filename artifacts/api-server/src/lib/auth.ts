import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  USER_ROLES,
  getEffectiveRoles,
  type User,
  type UserRole,
} from "@workspace/db";
import { logger } from "./logger";

const COOKIE_NAME = "seeds_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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
  "evaluator",
  "student",
]);
export const requireAdmin: RequestHandler = makeRequireRole(["admin"]);
export const requireEvaluator: RequestHandler = makeRequireRole(["evaluator"]);
export const requireStudent: RequestHandler = makeRequireRole(["student"]);

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
