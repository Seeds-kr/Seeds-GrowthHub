import crypto from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

const COOKIE_NAME = "seeds_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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

export function createSessionToken(email: string): string {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
): { email: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = sign(encoded);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    )
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as { email?: string; exp?: number };
    if (
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, email: string): void {
  const token = createSessionToken(email);
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

export function getSession(req: Request): { email: string } | null {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    COOKIE_NAME
  ];
  return verifySessionToken(token);
}

export function verifyAdminCredentials(
  email: string,
  password: string,
): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  const emailMatch =
    email.length === adminEmail.length &&
    crypto.timingSafeEqual(
      Buffer.from(email),
      Buffer.from(adminEmail),
    );
  const passwordMatch =
    password.length === adminPassword.length &&
    crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(adminPassword),
    );
  return emailMatch && passwordMatch;
}

export const requireAdmin: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { admin?: { email: string } }).admin = session;
  next();
};
