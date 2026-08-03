import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import {
  resolveActivationToken,
  consumeActivationToken,
} from "../lib/activation";
import { hashPassword, requireAdmin } from "../lib/auth";
import { audit } from "../lib/audit";
import { createRateLimit } from "../lib/rate-limit";

const router: IRouter = Router();

/**
 * 20 requests / 60s per IP across both activation endpoints. Token entropy is
 * 256 bits, so this is scanner noise suppression rather than the real defence.
 */
const rateLimit = createRateLimit({ windowMs: 60_000, max: 20 });

// Public: inspect an activation token (no auth) — used by the activation page
// to show the user's email/name before they pick a password.
router.get("/activation/:token", rateLimit, async (req, res) => {
  const r = await resolveActivationToken(String(req.params.token));
  if (r.status !== "ok" || !r.user) {
    res.status(r.status === "not_found" ? 404 : 410).json({
      status: r.status,
    });
    return;
  }
  res.json({
    status: "ok",
    email: r.user.email,
    name: r.user.name,
    expiresAt: r.expiresAt!.toISOString(),
  });
});

const ConsumeBody = z.object({
  password: z.string().min(8).max(200),
});

// Public: consume the token to set the user's password and activate the account.
router.post("/activation/:token", rateLimit, async (req, res) => {
  const parsed = ConsumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const r = await resolveActivationToken(String(req.params.token));
  if (r.status !== "ok" || !r.user || r.tokenRowId == null) {
    res.status(r.status === "not_found" ? 404 : 410).json({
      status: r.status,
    });
    return;
  }
  // Atomic consume — guards against double-use races.
  const won = await consumeActivationToken(r.tokenRowId);
  if (!won) {
    res.status(410).json({ status: "used" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await db
    .update(usersTable)
    .set({ passwordHash, isActive: true, updatedAt: new Date() })
    .where(eq(usersTable.id, r.user.id));
  res.json({ ok: true });
});

// Admin: re-issue an activation link for an existing user (e.g. expired).
router.post(
  "/admin/users/:id/activation-token",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { issueActivationToken } = await import("../lib/activation");
    const { token, expiresAt } = await issueActivationToken({
      userId: id,
      createdBy: req.sessionUser!.id,
    });
    // The token itself is never audited — only the fact that one was issued.
    audit({
      action: "account_activation",
      req,
      targetType: "user",
      targetId: id,
      note: "activation token re-issued (latest-wins)",
    });
    res.status(201).json({
      activationToken: token,
      activationPath: `/activate/${token}`,
      expiresAt: expiresAt.toISOString(),
    });
  },
);

export default router;
