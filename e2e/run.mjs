import { chromium } from "playwright";

/**
 * Browser verification for the responsive tiers (design/05 §6) and the role
 * navigation.
 *
 * Why this exists: every §6 acceptance criterion is a statement about what a
 * browser does at a given width, and none of it can be checked by reading code.
 * Two defects got shipped precisely because they were "verified" statically —
 * the mobile nav vanishing below `md` (breaking the A tier), and visibility
 * enum values with no reader. Static review kept saying pass.
 *
 * Run against anything:
 *   BASE_URL=http://127.0.0.1:8088 pnpm --filter @workspace/e2e run verify
 *
 * Credentials come from the environment so this file carries none.
 */

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:8088").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "";
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? "";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}
function skip(name, why) {
  results.push({ name, skipped: true });
  console.log(`SKIP  ${name}\n      ${why}`);
}

/**
 * Page-level horizontal scroll — what §6.4 forbids for A and B. Reports the
 * widest offending element so a failure is actionable instead of just red.
 */
async function overflow(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    let worst = null;
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && (!worst || r.right > worst.right)) {
        worst = {
          right: Math.round(r.right),
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 70),
        };
      }
    }
    return { scrollW: document.documentElement.scrollWidth, clientW: w, worst };
  });
}

/**
 * Sign in through the real form.
 *
 * The wait on `main` is load-bearing: `isVisible()` and `count()` do NOT
 * auto-wait, so querying right after `networkidle` reads the tree before React
 * mounts the role layout and invents a failure. `main` is the one element every
 * role layout renders — the mobile header is `lg:hidden` in AdminLayout and
 * would never be visible at desktop width.
 */
async function login(page, email, password) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button:has-text("로그인")').first().click();
  await page
    .waitForFunction(() => !location.pathname.startsWith("/login"), null, {
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.locator("main").first().waitFor({ state: "visible", timeout: 15000 });
  return page.url();
}

const browser = await chromium.launch();

// ---- A tier, public, 375px -------------------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  for (const p of ["/", "/about", "/program", "/people", "/recruit", "/faq"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
    const o = await overflow(page);
    record(
      `A tier 375px no h-scroll ${p}`,
      o.scrollW <= o.clientW + 1,
      `scrollW=${o.scrollW} clientW=${o.clientW}` +
        (o.worst ? ` culprit=${o.worst.tag}.${o.worst.cls}` : ""),
    );
  }

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const trigger = page.getByTestId("btn-mobile-nav");
  const vis = await trigger
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  record("public mobile nav trigger visible", vis, `visible=${vis}`);

  if (vis) {
    await trigger.click();
    const links = await page.locator('aside[role="dialog"] nav a').allTextContents();
    record("public drawer lists all nav items", links.length === 5, `${links.length}: ${links.join(" / ")}`);
    await page.locator('aside[role="dialog"] nav a').first().click();
    await page.waitForTimeout(400);
    const open = await page.locator('aside[role="dialog"]').isVisible().catch(() => false);
    record("drawer closes on navigate", !open, `stillOpen=${open}`);
  }
  await ctx.close();
}

// ---- Desktop: nav shown, trigger hidden ------------------------------------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const hamburger = await page.getByTestId("btn-mobile-nav").isVisible().catch(() => false);
  const navLinks = await page.locator("header nav a").count();
  record(
    "desktop 1440px shows nav, hides trigger",
    !hamburger && navLinks >= 5,
    `trigger=${hamburger} headerNavLinks=${navLinks}`,
  );
  await ctx.close();
}

// ---- Student (needs credentials) -------------------------------------------
if (STUDENT_EMAIL && STUDENT_PASSWORD) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const url = await login(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  record("student login", url.includes("/student"), `url=${url}`);

  const trigger = page.getByTestId("btn-mobile-nav");
  const vis = await trigger
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  record("student mobile nav trigger visible", vis, `visible=${vis}`);
  if (vis) {
    await trigger.click();
    const links = await page.locator('aside[role="dialog"] nav a').allTextContents();
    record("student drawer lists all 13 items", links.length === 13, `${links.length}: ${links.join(" / ")}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const open = await page.locator('aside[role="dialog"]').isVisible().catch(() => false);
    record("drawer closes on Escape", !open, `stillOpen=${open}`);
  }

  for (const p of ["/student", "/student/reflections", "/student/attendance", "/student/report"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const o = await overflow(page);
    record(
      `A tier 375px no h-scroll ${p}`,
      o.scrollW <= o.clientW + 1,
      `scrollW=${o.scrollW} clientW=${o.clientW}` +
        (o.worst ? ` culprit=${o.worst.tag}.${o.worst.cls}` : ""),
    );
  }
  await ctx.close();
} else {
  skip("student checks", "E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD 미설정");
}

// ---- C tier guard + drag and drop (needs admin) ----------------------------
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
    const page = await ctx.newPage();
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(BASE + "/admin/tasks", { waitUntil: "networkidle" });
    const guard = await page.getByTestId("desktop-only-guard").isVisible().catch(() => false);
    // Asserting the board is ABSENT, not merely hidden — DesktopOnly must not
    // render children, or the blocked tree keeps contributing overflow.
    const boardCount = await page.getByTestId("task-column-todo").count();
    record(
      "C tier blocked at 900px, board not rendered",
      guard && boardCount === 0,
      `guard=${guard} boardNodes=${boardCount}`,
    );
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(BASE + "/admin/tasks", { waitUntil: "networkidle" });
    const guard = await page.getByTestId("desktop-only-guard").isVisible().catch(() => false);
    record("board renders at 1440px", !guard, `guard=${guard}`);

    const card = page.locator('[data-testid^="task-card-"]').first();
    if (await card.count()) {
      const id = (await card.getAttribute("data-testid")).replace("task-card-", "");
      const columnOf = (cid) =>
        page.evaluate(
          (c) =>
            document
              .querySelector(`[data-testid="task-card-${c}"]`)
              ?.closest("[data-testid^='task-column-']")
              ?.getAttribute("data-testid"),
          cid,
        );
      const before = await columnOf(id);
      const target = before === "task-column-review" ? "task-column-done" : "task-column-review";
      await card.dragTo(page.getByTestId(target));
      await page.waitForTimeout(1500);
      const after = await columnOf(id);
      record("drag moves card between columns", after === target, `${before} -> ${after}`);

      // Reload to prove the move was persisted, not just reordered client-side.
      await page.reload({ waitUntil: "networkidle" });
      const persisted = await columnOf(id);
      record("move survives reload", persisted === target, `after reload=${persisted}`);
    } else {
      skip("drag and drop", "작업 카드가 없다 — 먼저 ops_task를 하나 만들 것");
    }
    await ctx.close();
  }
} else {
  skip("admin checks", "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD 미설정");
}

await browser.close();

const failed = results.filter((r) => r.pass === false).length;
const passed = results.filter((r) => r.pass === true).length;
const skipped = results.filter((r) => r.skipped).length;
console.log(`\n=== pass ${passed} / fail ${failed} / skip ${skipped} ===`);
process.exit(failed > 0 ? 1 : 0);
