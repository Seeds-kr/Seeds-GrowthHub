/**
 * 전 라우트 훑기.
 *
 * 유저 스토리(`stories.mjs`)는 "일을 끝낼 수 있는가"를 보지만 29개라 화면의
 * 절반쯤만 지난다. 라우팅처럼 **모든 화면에 동시에 영향을 주는 변경** 앞뒤로는
 * 전 화면이 여전히 렌더되는지 싸게 확인할 수단이 필요하다.
 *
 * 각 라우트를 열어 세 가지만 본다: 본문이 비지 않았는지, 콘솔 오류가 없는지,
 * 가로 스크롤이 없는지. 기능은 안 본다 — 그건 스토리의 몫이다.
 *
 *   node routes.mjs > before.txt     # 변경 전
 *   node routes.mjs > after.txt      # 변경 후
 *   diff before.txt after.txt
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "https://seeds.harvester.kr";

const PUBLIC = ["/", "/about", "/program", "/people", "/recruit", "/faq", "/apply"];

const ADMIN = [
  "/admin", "/admin/applications", "/admin/evaluators", "/admin/students",
  "/admin/cohorts", "/admin/programs", "/admin/sessions", "/admin/assignments",
  "/admin/announcements", "/admin/activity-records", "/admin/projects",
  "/admin/artifacts", "/admin/feedback", "/admin/tags", "/admin/site-content",
  "/admin/meetings", "/admin/tasks", "/admin/documents", "/admin/finance",
  "/admin/ops-dashboard", "/admin/people", "/admin/roles", "/admin/users",
  "/admin/media", "/admin/interviews", "/admin/attendance", "/admin/reports",
  "/admin/studies", "/admin/team-status", "/admin/audit-logs",
];

const MENTOR = ["/mentor", "/mentor/teams", "/mentor/feedback", "/mentor/profile"];
const EVALUATOR = ["/evaluator"];
const STUDENT = [
  "/student", "/student/sessions", "/student/assignments", "/student/announcements",
  "/student/attendance", "/student/timeline", "/student/projects", "/student/studies",
  "/student/artifacts", "/student/reflections", "/student/feedback", "/student/report",
  "/student/profile",
];

async function login(page, path, email, password) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(1600);
  return !page.url().includes("/login");
}

async function sweep(page, label, paths) {
  console.log(`\n── ${label} ──`);
  for (const path of paths) {
    const errors = [];
    const onErr = (e) => errors.push(String(e).slice(0, 90));
    const onMsg = (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 90)); };
    page.on("pageerror", onErr);
    page.on("console", onMsg);
    try {
      // 한 번은 봐준다. 세 스위트를 연달아 돌리면(ops/verify.sh) 이따금
      // ERR_NETWORK_CHANGED 로 항해가 끊기는데, 그게 ✗ 로 찍히면 제품 결함과
      // 구분이 안 된다. 두 번 다 실패하면 진짜다.
      try {
        await page.goto(BASE + path, { waitUntil: "networkidle" });
      } catch (first) {
        errors.length = 0;
        await page.waitForTimeout(1200);
        await page.goto(BASE + path, { waitUntil: "networkidle" });
      }
      await page.waitForTimeout(900);
      const main = await page.locator("main").first().innerText().catch(() => "");
      const len = main.replace(/\s+/g, " ").trim().length;
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      // 길이를 그대로 찍으면 데이터가 한 건만 늘어도 diff 가 요동친다.
      // 자릿수만 남겨 "비었는가 / 렌더됐는가" 만 비교한다.
      const bucket = len === 0 ? "빈화면" : len < 60 ? "짧음" : "정상";
      const flag = errors.length || over > 1 || len === 0 ? "✗" : "·";
      console.log(
        `${flag} ${path.padEnd(28)} ${bucket}${over > 1 ? ` 가로+${over}px` : ""}` +
        (errors.length ? ` 오류:${errors.length} ${errors[0]}` : ""),
      );
    } catch (e) {
      console.log(`✗ ${path.padEnd(28)} 예외 ${String(e.message).slice(0, 70)}`);
    }
    page.off("pageerror", onErr);
    page.off("console", onMsg);
  }
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await sweep(page, "공개", PUBLIC);

if (process.env.E2E_ADMIN_EMAIL && await login(page, "/admin/login", process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD)) {
  await sweep(page, "운영진", ADMIN);
} else {
  console.log("\n── 운영진 ── 계정 없음, 건너뜀");
}
await ctx.close();

const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await c2.newPage();
if (process.env.E2E_MENTOR_EMAIL && await login(p2, "/admin/login", process.env.E2E_MENTOR_EMAIL, process.env.E2E_MENTOR_PASSWORD)) {
  await sweep(p2, "멘토", MENTOR);
  await sweep(p2, "평가위원", EVALUATOR);
} else {
  console.log("\n── 멘토·평가위원 ── 계정 없음, 건너뜀");
}
await c2.close();

const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p3 = await c3.newPage();
if (process.env.E2E_STUDENT_EMAIL && await login(p3, "/student/login", process.env.E2E_STUDENT_EMAIL, process.env.E2E_STUDENT_PASSWORD)) {
  await sweep(p3, "학생", STUDENT);
} else {
  console.log("\n── 학생 ── 계정 없음, 건너뜀");
}
await c3.close();

await b.close();
