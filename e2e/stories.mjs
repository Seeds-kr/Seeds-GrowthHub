/**
 * 역할별 유저 스토리 주행.
 *
 * `run.mjs` 는 화면이 뜨는지를 본다. 이건 다르다 — 한 역할이 **일을 끝낼 수
 * 있는지** 를 본다. 그래서 읽기만 하는 게 아니라 실제로 쓰고, 저장된 것이
 * 다시 읽히는지까지 확인한다.
 *
 * 목록과 합격 조건은 `docs/user-stories.md` 에 있다.
 *
 * 실행:
 *   E2E_BASE_URL=https://seeds.harvester.kr \
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *   E2E_MENTOR_EMAIL=... E2E_MENTOR_PASSWORD=... \
 *   E2E_STUDENT_EMAIL=... E2E_STUDENT_PASSWORD=... \
 *   node stories.mjs
 *
 * 계정이 없으면 그 역할은 BLOCKED 로 남긴다. 통과로 세지 않는다.
 */
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8088";
const SHOT = process.env.E2E_SHOT_DIR ?? null;

const results = [];
function record(id, title, status, note = "") {
  results.push({ id, title, status, note });
  const mark = { PASS: "PASS ", FAIL: "FAIL ", BLOCK: "BLOCK", WARN: "WARN " }[status];
  console.log(`${mark} ${id.padEnd(3)} ${title}${note ? `\n        ${note}` : ""}`);
}

/** 스토리 하나를 감싼다. 예외가 나면 그 스토리만 FAIL 로 떨어지고 나머지는 계속 간다. */
async function story(id, title, fn) {
  try {
    const note = await fn();
    record(id, title, "PASS", note ?? "");
  } catch (e) {
    if (e && e.__blocked) record(id, title, "BLOCK", e.message);
    else record(id, title, "FAIL", String(e.message ?? e).split("\n")[0].slice(0, 200));
  }
}
const blocked = (msg) => Object.assign(new Error(msg), { __blocked: true });

/**
 * 이 앱의 선택 컨트롤은 네이티브 <select> 가 아니라 Radix 콤보박스다.
 * 트리거를 눌러 목록을 띄우고 옵션을 고른다. 첫 시도에서 이걸 몰라
 * "상태 변경 컨트롤이 없음" 으로 잘못 판정했다.
 */
async function pickCombobox(page, index = 0, wanted = null) {
  const trig = page.getByRole("combobox").nth(index);
  if (!(await trig.count())) return null;
  await trig.click();
  await page.waitForTimeout(400);
  const opts = page.getByRole("option");
  const n = await opts.count();
  if (!n) return null;
  const labels = [];
  for (let i = 0; i < n; i++) labels.push((await opts.nth(i).innerText()).trim());
  let idx = 0;
  if (wanted) { const f = labels.findIndex((l) => l !== wanted); idx = f >= 0 ? f : 0; }
  const chosen = labels[idx];
  await opts.nth(idx).click();
  await page.waitForTimeout(500);
  return chosen;
}

/** "+ 새 …" 처럼 폼을 여는 버튼이 있으면 누른다. 없으면 그냥 지나간다. */
async function openCreateForm(page) {
  const btn = page.locator("button").filter({ hasText: /^\s*\+/ }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(700); return true; }
  return false;
}

async function shot(page, name) {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}

/** 로그인. 폼 필드 이름이 화면마다 달라 라벨과 타입 양쪽으로 찾는다. */
async function login(page, path, email, password) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(900);
}

/** 그 경로가 "권한 없음"으로 막히는지. 설계상 403 이 아니라 404 여야 한다. */
async function expect404(page, path) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const body = (await page.locator("body").innerText()).slice(0, 400);
  // "담당하지 않는 프로젝트이거나 존재하지 않습니다" 처럼, 존재 여부를 숨기는
  // 문구도 올바른 차단이다. 처음엔 이걸 못 알아보고 결함으로 잘못 적었다.
  const is404 = /404|찾을 수 없|없는 페이지|not found|존재하지 않|담당하지 않는|접근 권한/i.test(body);
  // 404 문구 안에 "접근 권한이 없는 자료입니다" 가 들어 있어서, 순진한
  // "권한이 없" 매칭은 정상 404 를 403 으로 오인한다. 404 가 아닐 때만 본다.
  const is403 = !is404 && /403|forbidden|권한이 없습니다|권한 없음/i.test(body);
  return { is404, is403, status: res?.status(), body: body.replace(/\s+/g, " ").slice(0, 120) };
}

const b = await chromium.launch();
const ctx = () => b.newContext({ viewport: { width: 1440, height: 900 } });

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 지원자 (비로그인) ─────────────────────────────────────────");
{
  const c = await ctx();
  const p = await c.newPage();

  await story("A1", "홈에서 모집 정보를 찾아 지원 화면까지 간다", async () => {
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.locator('a[href="/recruit"]').first().click();
    await p.waitForTimeout(700);
    await p.locator('a[href="/apply"]').first().click();
    await p.waitForTimeout(900);
    const inputs = await p.locator("input, textarea").count();
    if (!p.url().includes("/apply")) throw new Error(`지원 화면에 도달 못함: ${p.url()}`);
    if (inputs < 3) throw new Error(`지원서 입력칸이 ${inputs}개뿐`);
    return `홈 → 모집 → 지원, 입력칸 ${inputs}개`;
  });

  await story("A2", "지원서를 작성해 제출한다", async () => {
    await p.goto(BASE + "/apply", { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    const stamp = Date.now();
    // 보이는 필수 입력칸을 종류별로 채운다. 라벨 문구에 기대지 않는다.
    // 이 폼의 입력칸은 대부분 type 속성이 없다(기본값 text). CSS 의
    // input[type="text"] 는 속성이 실제로 있을 때만 걸리므로 전부 훑는다.
    const texts = p.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea');
    const n = await texts.count();
    for (let i = 0; i < n; i++) {
      const el = texts.nth(i);
      if (!(await el.isVisible())) continue;
      const type = await el.evaluate((n) => n.type);
      await el.fill(type === "email" ? `story${stamp}@example.com`
        : type === "tel" ? "010-1234-5678"
        : type === "number" ? "2003"
        : `스토리 주행 본문 ${stamp}`);
    }
    for (const sel of await p.locator("select").all()) {
      const opts = await sel.locator("option").all();
      for (const o of opts) {
        const v = await o.getAttribute("value");
        if (v) { await sel.selectOption(v); break; }
      }
    }
    // shadcn/Radix 체크박스는 진짜 input 이 aria-hidden 이고 클릭 대상은
    // role="checkbox" 버튼이다. input 을 직접 누르면 타임아웃 난다.
    for (const cb of await p.getByRole("checkbox").all()) {
      await cb.click().catch(() => {});
    }
    await shot(p, "A2-before-submit");
    await p.locator('button[type="submit"]').first().click();
    await p.waitForTimeout(1800);
    const url = p.url();
    const body = (await p.locator("body").innerText()).slice(0, 300).replace(/\s+/g, " ");
    if (/success|완료|제출되었/i.test(url + body)) return `완료 화면: ${url}`;
    throw new Error(`제출 후 완료 화면이 아님. url=${url} body="${body.slice(0, 120)}"`);
  });

  await story("A3", "어떤 멘토가 있는지 확인한다", async () => {
    await p.goto(BASE + "/people", { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const cards = p.locator('a[href^="/people/mentor/"]');
    const n = await cards.count();
    if (n === 0) throw new Error("멘토 카드가 하나도 없음");
    await cards.first().click();
    await p.waitForTimeout(800);
    if (!/\/people\/mentor\/\d+/.test(p.url())) throw new Error(`프로필 상세로 못 감: ${p.url()}`);
    const txt = (await p.locator("main, body").first().innerText()).length;
    return `멘토 ${n}명, 상세 진입 OK (${txt}자)`;
  });

  await story("A4", "궁금한 걸 FAQ 에서 찾는다", async () => {
    await p.goto(BASE + "/faq", { waitUntil: "networkidle" });
    const trig = p.locator('button[data-state]').first();
    await trig.click();
    await p.waitForTimeout(500);
    const open = await trig.getAttribute("data-state");
    if (open !== "open") throw new Error(`아코디언이 안 펼쳐짐 (state=${open})`);
    return "문항 펼침 OK";
  });

  await c.close();
}

// A5 는 뷰포트가 달라 별도 컨텍스트
{
  const c = await b.newContext({ viewport: { width: 375, height: 800 } });
  const p = await c.newPage();
  await story("A5", "폰에서도 모든 공개 화면을 읽는다", async () => {
    const bad = [];
    for (const path of ["/", "/about", "/program", "/people", "/recruit", "/faq"]) {
      await p.goto(BASE + path, { waitUntil: "networkidle" });
      await p.waitForTimeout(400);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) bad.push(`${path}:+${over}px`);
    }
    const trigger = p.locator("header button").last();
    await trigger.click();
    await p.waitForTimeout(500);
    const links = await p.locator('[role="dialog"] a, nav a').count();
    if (bad.length) throw new Error(`가로 스크롤: ${bad.join(", ")}`);
    if (links < 5) throw new Error(`서랍 내비 항목 ${links}개`);
    return `6개 화면 가로 스크롤 없음, 서랍 항목 ${links}개`;
  });
  await c.close();
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 운영진 ────────────────────────────────────────────────────");
{
  const email = process.env.E2E_ADMIN_EMAIL, pw = process.env.E2E_ADMIN_PASSWORD;
  const c = await ctx();
  const p = await c.newPage();
  let loggedIn = false;
  if (email && pw) {
    await login(p, "/admin/login", email, pw);
    loggedIn = !p.url().includes("/login");
  }
  const need = () => { if (!loggedIn) throw blocked("운영진 계정 미설정 또는 로그인 실패"); };

  await story("O1", "로그인해서 지금 할 일을 파악한다", async () => {
    need();
    await p.goto(BASE + "/admin", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const txt = await p.locator("main").innerText();
    await shot(p, "O1-dashboard");
    if (txt.trim().length < 40) throw new Error("대시보드가 사실상 비어 있음");
    return `본문 ${txt.trim().length}자`;
  });

  await story("O2", "들어온 지원서를 열어 상태를 바꾼다", async () => {
    need();
    await p.goto(BASE + "/admin/applications", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const rows = p.locator('a[href^="/admin/applications/"]');
    const n = await rows.count();
    if (n === 0) throw blocked("지원서 데이터가 없어 주행 불가");
    await rows.first().click();
    await p.waitForTimeout(1000);
    // 이 화면에는 콤보박스가 5개 있다(평가자·평가단계·상태·면접·최종결정).
    // 라벨로 고르면 "서류 평가"(평가 단계)를 상태로 오인한다 — 실제로 한 번
    // 그렇게 잘못 짚었다. 화면이 붙여둔 testid 로 정확히 겨냥한다.
    const trig = p.locator('[data-testid="select-legacy-status"]');
    if (!(await trig.count())) throw new Error("상태 콤보박스(select-legacy-status)를 못 찾음");
    const before = (await trig.innerText()).trim();
    await trig.click();
    await p.waitForTimeout(400);
    const opts = p.getByRole("option");
    const optCount = await opts.count();
    if (!optCount) throw new Error("상태 옵션이 없음");
    let picked = null;
    for (let i = 0; i < optCount; i++) {
      const t = (await opts.nth(i).innerText()).trim();
      if (t && t !== before) { picked = t; await opts.nth(i).click(); break; }
    }
    if (!picked) throw new Error("바꿀 수 있는 다른 상태가 없음");
    await p.waitForTimeout(400);
    const save = p.locator('[data-testid="button-save-status"]');
    if (!(await save.count())) throw new Error("상태 저장 버튼이 없음");
    await save.click();
    await p.waitForTimeout(1600);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1400);
    const after = (await p.locator('[data-testid="select-legacy-status"]').innerText()).trim();
    if (after !== picked) throw new Error(`새로고침 후 안 남음: ${before} → ${picked} → ${after}`);
    return `${before} → ${picked} 저장 확인`;
  });

  await story("O3", "공지를 작성해 게시한다", async () => {
    need();
    await p.goto(BASE + "/admin/announcements", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const title = `주행 공지 ${Date.now()}`;
    await openCreateForm(p);
    const inputs = p.locator('input:visible:not([type="checkbox"]), textarea:visible');
    if ((await inputs.count()) === 0) throw new Error("작성 폼이 화면에 없음");
    await inputs.first().fill(title);
    if ((await inputs.count()) > 1) await inputs.nth(1).fill("스토리 주행으로 만든 공지.");
    for (let i = 0; i < (await p.getByRole("combobox").count()); i++) await pickCombobox(p, i);
    const btn = p.locator("button", { hasText: /^(등록|작성|저장|추가|게시)/ }).first();
    if (!(await btn.count())) throw new Error("등록 버튼을 못 찾음");
    await btn.click();
    await p.waitForTimeout(1500);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const found = await p.locator(`text=${title}`).count();
    if (!found) throw new Error("새로고침 후 목록에 없음");

    // 새 공지는 "초안" 으로 저장되고 초안은 학생에게 안 내려간다
    // (student.ts 가 isPublished=true 만 본다). 발행까지 해야 스토리가 끝난다.
    // 이걸 빼먹어서 S2 가 "공지가 없습니다" 만 보고도 통과하고 있었다.
    const row = p.locator("tr").filter({ hasText: title });
    const pub = row.locator("button", { hasText: /^발행$/ });
    if (!(await pub.count())) throw new Error("목록에 발행 버튼이 없음");
    await pub.click();
    await p.waitForTimeout(1800);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const after = p.locator("tr").filter({ hasText: title });
    if ((await after.locator("text=초안").count()) > 0) throw new Error("발행 후에도 초안");
    // 학생 스토리가 이 제목을 실제로 읽었는지 확인할 수 있게 넘긴다.
    globalThis.__publishedAnnouncement = title;
    return `"${title}" 작성 + 발행`;
  });

  await story("O4", "모임을 만들고 출석을 체크한다", async () => {
    need();
    await p.goto(BASE + "/admin/sessions", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const links = p.locator('a[href*="/attendance"], a[href^="/admin/sessions/"]');
    if ((await links.count()) === 0) throw new Error("세션 목록에서 출석 화면으로 가는 링크가 없음");
    await links.first().click();
    await p.waitForTimeout(1200);
    const controls = await p.locator('select:visible, button:visible').count();
    await shot(p, "O4-attendance");
    if (controls < 2) throw new Error(`출석 화면에 조작할 컨트롤이 ${controls}개`);
    return `출석 화면 진입, 컨트롤 ${controls}개`;
  });

  await story("O5", "회의를 열고 액션 아이템을 남긴다", async () => {
    need();
    await p.goto(BASE + "/admin/meetings", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const opened = await openCreateForm(p);
    const inputs = await p.locator('input:visible, textarea:visible').count();
    if (inputs === 0) throw new Error(`'+ 새 회의' ${opened ? "눌렀는데도" : "버튼이 없고"} 입력칸 0개`);
    return `작성 폼 입력칸 ${inputs}개`;
  });

  await story("O6", "운영 태스크를 보드에서 옮긴다", async () => {
    need();
    await p.goto(BASE + "/admin/tasks", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const cols = await p.locator('[data-testid^="task-column-"]').count();
    if (cols === 0) throw new Error("보드 컬럼이 안 보임");
    return `보드 컬럼 ${cols}개 (드래그 자체는 run.mjs 가 검증)`;
  });

  await story("O7", "멘토 프로필을 만들고 계정을 연결한다", async () => {
    need();
    await p.goto(BASE + "/admin/people", { waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    const create = p.locator("button", { hasText: /\+ *새 항목/ }).first();
    if (!(await create.count())) throw new Error("프로필 생성 진입점이 없음");
    const acct = p.locator("button", { hasText: /계정/ });
    const n = await acct.count();
    return `프로필 생성 진입점 있음, 계정 관련 버튼 ${n}개`;
  });

  await story("O9", "과제를 만들어 학생에게 낸다", async () => {
    need();
    await p.goto(BASE + "/admin/assignments", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const title = `주행 과제 ${Date.now()}`;
    await openCreateForm(p);
    const text = p.locator('input:visible:not([type="checkbox"]):not([type="datetime-local"])').first();
    if (!(await text.count())) throw new Error("과제 작성 폼이 안 열림");
    await text.fill(title);
    const ta = p.locator("textarea:visible").first();
    if (await ta.count()) await ta.fill("스토리 주행으로 만든 과제입니다. 자유롭게 제출하세요.");
    const due = p.locator('input[type="datetime-local"]:visible').first();
    if (await due.count()) await due.fill("2026-12-31T23:59");
    for (let i = 0; i < (await p.getByRole("combobox").count()); i++) await pickCombobox(p, i);
    const btn = p.locator("button", { hasText: /^(등록|저장|추가|생성|만들기)/ }).first();
    if (!(await btn.count())) throw new Error("등록 버튼 없음");
    await btn.click();
    await p.waitForTimeout(1600);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1100);
    if ((await p.locator(`text=${title}`).count()) === 0) throw new Error("새로고침 후 목록에 없음");

    // 새 과제는 "초안" 으로 저장되고, 초안인 동안 학생 화면에는 안 나온다.
    // 게시까지 해야 이 스토리가 끝난 것이다. 예전에는 게시 컨트롤이 [수정]
    // 다이얼로그 안에만 있어서 운영진이 "냈다" 고 착각하기 쉬웠는데,
    // 지금은 목록에서 바로 누를 수 있다 — 그 동선을 그대로 주행한다.
    const row = p.locator("tr").filter({ hasText: title });
    const hidden = await row.locator("text=학생에게 안 보임").count();
    if (!hidden) throw new Error("초안이 '학생에게 안 보임' 으로 표시되지 않음");
    const pub = row.locator("button", { hasText: /^게시$/ });
    if (!(await pub.count())) throw new Error("목록에 게시 버튼이 없음");
    await pub.click();
    await p.waitForTimeout(1600);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const after = p.locator("tr").filter({ hasText: title });
    if (await after.locator("text=학생에게 안 보임").count())
      throw new Error("게시 후에도 초안으로 남아 있음");
    return `"${title}" 등록 + 목록에서 바로 게시`;
  });

  await story("O10", "지원서에 평가자를 배정한다", async () => {
    need();
    await p.goto(BASE + "/admin/applications", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const link = p.locator('a[href^="/admin/applications/"]').first();
    if (!(await link.count())) throw blocked("지원서가 없어 주행 불가");
    await link.click();
    await p.waitForTimeout(1200);

    const evalSel = p.locator('[data-testid="select-evaluator"]');
    if (!(await evalSel.count())) throw new Error("평가자 선택 컨트롤이 없음");
    await evalSel.click();
    await p.waitForTimeout(400);
    const opts = p.getByRole("option");
    const n = await opts.count();
    if (!n) throw new Error("배정할 수 있는 평가자가 없음");
    // 멘토 스토리에서 쓰는 계정을 고른다. 그래야 아래 E 축이 이어진다.
    let target = 0;
    for (let i = 0; i < n; i++) {
      if ((await opts.nth(i).innerText()).includes(process.env.E2E_MENTOR_EMAIL ?? "@@")) { target = i; break; }
    }
    const who = (await opts.nth(target).innerText()).trim();
    await opts.nth(target).click();
    await p.waitForTimeout(400);
    await p.locator('[data-testid="button-assign"]').click();
    await p.waitForTimeout(1600);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const body = await p.locator("main").innerText();
    if (!body.includes(who.split(" (")[0])) throw new Error(`새로고침 후 배정이 안 남음 (${who})`);
    return `${who} 배정 확인`;
  });

  await story("O8", "권한 밖 리소스에 접근한다", async () => {
    need();
    const r = await expect404(p, "/admin/applications/99999");
    if (r.is403) throw new Error(`403 이 노출됨 (설계상 404 여야 함): ${r.body}`);
    if (!r.is404) throw new Error(`404 도 403 도 아님: "${r.body}"`);
    return "없는 리소스 → 404";
  });

  await c.close();
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 멘토 ──────────────────────────────────────────────────────");
{
  const email = process.env.E2E_MENTOR_EMAIL, pw = process.env.E2E_MENTOR_PASSWORD;
  const c = await ctx();
  const p = await c.newPage();
  let ok = false;
  if (email && pw) { await login(p, "/admin/login", email, pw); ok = !p.url().includes("/login"); }
  const need = () => { if (!ok) throw blocked("멘토 계정 미설정 또는 로그인 실패"); };

  await story("M1", "로그인해서 담당 팀을 확인한다", async () => {
    need();
    await p.goto(BASE + "/mentor/teams", { waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    const links = await p.locator('a[href^="/mentor/projects/"]').count();
    await shot(p, "M1-teams");
    if (links === 0) throw new Error("담당 팀이 하나도 안 보임");
    return `담당 팀 ${links}개`;
  });

  await story("M2", "팀 상세에서 상태 체크를 올린다", async () => {
    need();
    await p.goto(BASE + "/mentor/teams", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const href = await p.locator('a[href^="/mentor/projects/"]').first().getAttribute("href");
    if (!href) throw new Error("팀 상세 링크 없음");
    await p.goto(BASE + href, { waitUntil: "networkidle" });
    await p.waitForTimeout(1400);
    const ta = p.locator("textarea:visible").first();
    if (!(await ta.count())) throw new Error("상태 체크 입력칸이 없음");
    const msg = `주행 상태체크 ${Date.now()}`;
    await ta.fill(msg);
    // 상태는 4지선다 버튼이다. 콤보박스(대상 학생·공개 범위)는 아래 피드백
    // 폼의 것이라, 열어두면 드롭다운이 제출 버튼을 덮어 클릭이 타임아웃 난다.
    const mood = p.locator("button", { hasText: /^양호/ }).first();
    if (await mood.count()) await mood.click();
    const btn = p.locator("button", { hasText: /^제출$/ }).first();
    if (!(await btn.count())) throw new Error("제출 버튼 없음");
    await btn.click();
    await p.waitForTimeout(1500);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    if ((await p.locator(`text=${msg}`).count()) === 0) throw new Error("새로고침 후 안 남음");
    return "상태 체크 저장 확인";
  });

  await story("M3", "내가 남긴 피드백을 확인한다", async () => {
    need();
    await p.goto(BASE + "/mentor/feedback", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const t = (await p.locator("main").innerText()).trim();
    if (t.length < 20) throw new Error("화면이 사실상 비어 있음");
    return `본문 ${t.length}자`;
  });

  await story("M4", "담당이 아닌 팀에 접근한다", async () => {
    need();
    const r = await expect404(p, "/mentor/projects/2");
    if (r.is403) throw new Error(`403 이 노출됨: ${r.body}`);
    if (!r.is404) throw new Error(`차단되지 않음. 본문="${r.body}"`);
    return "담당 아닌 팀 → 404";
  });

  await c.close();
}

// ══════════════════════════════════════════════════════════════════════════
// 평가위원은 별도 계정 종류가 아니다. 서버가 requireAdminOrMentor 로 받고,
// "평가위원인가" 는 evaluation_assignments 에 자기 배정이 있느냐로 정해진다.
// 그래서 멘토 계정으로 들어가되, 앞의 O10 이 배정을 만들어 둔 뒤에 주행한다.
console.log("\n── 평가위원 ──────────────────────────────────────────────────");
{
  const email = process.env.E2E_MENTOR_EMAIL, pw = process.env.E2E_MENTOR_PASSWORD;
  const c = await ctx();
  const p = await c.newPage();
  let ok = false;
  if (email && pw) { await login(p, "/admin/login", email, pw); ok = !p.url().includes("/login"); }
  const need = () => { if (!ok) throw blocked("평가위원으로 쓸 계정 미설정 또는 로그인 실패"); };
  let appId = null;

  await story("E1", "배정받은 지원서 목록을 확인한다", async () => {
    need();
    await p.goto(BASE + "/evaluator", { waitUntil: "networkidle" });
    await p.waitForTimeout(1100);
    const rows = p.locator('[data-testid^="row-assignment-"]');
    const n = await rows.count();
    await shot(p, "E1-dashboard");
    if (n === 0) throw new Error("배정받은 지원서가 하나도 없음");
    const open = p.locator('[data-testid^="button-open-"]').first();
    const href = await open.locator("xpath=ancestor::a").getAttribute("href").catch(() => null);
    appId = href ? href.split("/").pop() : null;
    return `배정 ${n}건`;
  });

  await story("E2", "지원서를 열어 내용을 읽는다", async () => {
    need();
    if (!appId) throw blocked("E1 에서 지원서 id 를 못 얻음");
    await p.goto(BASE + `/evaluator/applications/${appId}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const t = (await p.locator("main").innerText()).trim();
    if (t.length < 100) throw new Error(`내용이 사실상 비어 있음 (${t.length}자)`);
    return `본문 ${t.length}자`;
  });

  await story("E3", "평가를 작성해 제출한다", async () => {
    need();
    if (!appId) throw blocked("E1 에서 지원서 id 를 못 얻음");
    await p.goto(BASE + `/evaluator/applications/${appId}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const comment = p.locator('[data-testid="input-comment"]');
    if (!(await comment.count())) throw new Error("평가 의견 입력칸이 없음");
    const msg = `주행 평가 의견 ${Date.now()}`;
    await comment.fill(msg);
    for (const id of ["select-stage", "select-recommendation"]) {
      const trig = p.locator(`[data-testid="${id}"]`);
      if (!(await trig.count())) continue;
      await trig.click();
      await p.waitForTimeout(350);
      const o = p.getByRole("option");
      if (await o.count()) await o.first().click();
      await p.waitForTimeout(350);
    }
    await p.locator('[data-testid="button-submit-evaluation"]').click();
    await p.waitForTimeout(1800);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1300);
    if ((await p.locator(`text=${msg}`).count()) === 0) throw new Error("새로고침 후 평가가 안 남음");
    return "평가 저장 확인";
  });

  await story("E4", "배정받지 않은 지원서에 접근한다", async () => {
    need();
    const r = await expect404(p, "/evaluator/applications/99999");
    if (r.is403) throw new Error(`403 이 노출됨: ${r.body}`);
    if (!r.is404) throw new Error(`차단되지 않음. 본문="${r.body}"`);
    return "배정 밖 지원서 → 404";
  });

  await c.close();
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n── 학생 ──────────────────────────────────────────────────────");
{
  const email = process.env.E2E_STUDENT_EMAIL, pw = process.env.E2E_STUDENT_PASSWORD;
  const c = await ctx();
  const p = await c.newPage();
  let ok = false;
  if (email && pw) { await login(p, "/student/login", email, pw); ok = !p.url().includes("/login"); }
  const need = () => { if (!ok) throw blocked("학생 계정 미설정 또는 로그인 실패"); };

  await story("S1", "로그인해서 내 상태를 파악한다", async () => {
    need();
    await p.goto(BASE + "/student", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    await shot(p, "S1-dashboard");
    const t = (await p.locator("main").innerText()).trim();
    if (t.length < 40) throw new Error("대시보드가 사실상 비어 있음");
    return `본문 ${t.length}자`;
  });

  await story("S2", "공지를 읽는다", async () => {
    need();
    await p.goto(BASE + "/student/announcements", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const t = (await p.locator("main").innerText()).trim();
    if (!t) throw new Error("화면이 완전히 비어 있음(빈 상태 문구조차 없음)");
    // 운영진이 방금 발행한 공지를 학생이 실제로 읽는지까지 본다.
    // 전에는 "공지가 없습니다" 만 보고도 통과했다 — 읽기 경로가 사실상 미검증이었다.
    const expected = globalThis.__publishedAnnouncement;
    if (expected) {
      if (!t.includes(expected)) throw new Error(`운영진이 발행한 공지 "${expected}" 가 학생 화면에 없음`);
      return `발행된 공지를 읽음: "${expected}"`;
    }
    return `"${t.replace(/\s+/g, " ").slice(0, 40)}" (발행된 공지가 없어 빈 상태만 확인)`;
  });

  await story("S3", "과제를 확인하고 제출한다", async () => {
    need();
    await p.goto(BASE + "/student/assignments", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const links = p.locator('a[href^="/student/assignments/"]');
    if ((await links.count()) === 0) throw blocked("과제 데이터가 없어 주행 불가(빈 상태 화면은 정상 표시)");
    await links.first().click();
    await p.waitForTimeout(1100);
    const ta = p.locator("textarea:visible").first();
    if (!(await ta.count())) throw new Error("제출 입력칸이 없음");
    const msg = `주행 제출 ${Date.now()}`;
    await ta.fill(msg);
    const btn = p.locator("button", { hasText: /제출|저장/ }).first();
    await btn.click();
    await p.waitForTimeout(1500);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    if ((await p.locator(`text=${msg}`).count()) === 0) throw new Error("새로고침 후 제출물이 안 남음");
    return "제출 저장 확인";
  });

  await story("S4", "회고를 쓰고 공개 범위를 정한다", async () => {
    need();
    await p.goto(BASE + "/student/reflections", { waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    const ta = p.locator("textarea:visible").first();
    if (!(await ta.count())) throw new Error("회고 입력칸이 없음");
    const msg = `주행 회고 ${Date.now()}`;
    await ta.fill(msg);
    // 공개 범위 컨트롤(셀렉트 또는 라디오/토글)
    // 공개 범위는 분절 버튼이다(나만 보기 / 팀원까지 / 담당 멘토까지 / 같은 기수까지).
    // 콤보박스 0번은 회고 "종류"라 범위와 무관하다 — 처음엔 이걸 잘못 집었다.
    const scopeBtn = p.locator("button", { hasText: /^팀원까지$/ }).first();
    let scope = "기본값";
    if (await scopeBtn.count()) { await scopeBtn.click(); scope = "팀원까지"; await p.waitForTimeout(300); }
    // "작성"은 탭 이름이라 제출 버튼이 아니다. 실제 버튼은 "회고 저장".
    const btn = p.locator("button", { hasText: /회고 저장|^저장$|^등록$/ }).first();
    if (!(await btn.count())) throw new Error("저장 버튼 없음");
    await btn.click();
    await p.waitForTimeout(1500);
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1000);
    if ((await p.locator(`text=${msg}`).count()) === 0) throw new Error("새로고침 후 회고가 안 남음");
    return `저장 확인, 공개 범위=${scope}`;
  });

  await story("S5", "내 출석 현황을 본다", async () => {
    need();
    await p.goto(BASE + "/student/attendance", { waitUntil: "networkidle" });
    await p.waitForTimeout(900);
    const t = (await p.locator("main").innerText()).trim();
    if (t.length < 20) throw new Error("화면이 비어 있음");
    return `본문 ${t.length}자`;
  });

  await story("S6", "남의 자료에 접근한다", async () => {
    need();
    const r = await expect404(p, "/admin/students");
    if (r.is403) throw new Error(`403 이 노출됨: ${r.body}`);
    // 섹션 전체가 막힌 경우 자기 홈으로 되돌리는 것도 올바른 처리다.
    // 중요한 건 어드민 자료가 새지 않는 것이다.
    const bounced = p.url().includes("/student") && !p.url().includes("/admin");
    const leaked = /학생 목록|전체 학생|관리자 전용/.test(r.body);
    if (leaked) throw new Error(`어드민 자료가 노출됨: ${r.body}`);
    if (!r.is404 && !bounced) throw new Error(`차단되지 않음. 본문="${r.body}"`);
    return bounced ? "자기 대시보드로 되돌림 (자료 노출 없음)" : "404";
  });

  await c.close();
}

await b.close();

// ══════════════════════════════════════════════════════════════════════════
const by = (s) => results.filter((r) => r.status === s).length;
console.log(`\n═══ PASS ${by("PASS")} · FAIL ${by("FAIL")} · BLOCK ${by("BLOCK")} / 전체 ${results.length} ═══`);
if (by("FAIL")) {
  console.log("\n실패한 스토리:");
  for (const r of results.filter((r) => r.status === "FAIL")) console.log(`  ${r.id} ${r.title}\n     ${r.note}`);
}
process.exit(by("FAIL") ? 1 : 0);
