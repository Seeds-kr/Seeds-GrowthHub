import { chromium } from "playwright";

/**
 * 공개 페이지가 "밋밋한지" 를 재고 전체 화면을 찍는다.
 *
 * 스크롤을 끝까지 한 번 굴린 뒤에 찍는 게 핵심이다. 등장 모션이 IntersectionObserver
 * 기반(`whileInView`)이라, 그냥 fullPage 로 찍으면 화면 밖 내용이 opacity:0 인 채로
 * 박제된다 — 실제로는 멀쩡한 페이지가 텅 빈 것처럼 보인다.
 */
const OUT = "/tmp/claude-1000/-home-harvester/1e97ac80-7549-41a7-9bcd-96a3e6df83f5/scratchpad/flat";
const BASE = process.env.BASE ?? "https://seeds.harvester.kr";
const PAGES = process.argv[2]
  ? process.argv[2].split(",").map((p) => [p.replace(/\W+/g, "") || "home", p])
  : [["program", "/program"], ["recruit", "/recruit"], ["faq", "/faq"]];

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })).newPage();

for (const [name, path] of PAGES) {
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);

  // 한 화면씩 굴려 내려가며 등장 모션을 모두 깨운다.
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(160);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(700);

  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

  // 보이지 않는 채로 남은 게 있으면 잡는다. 등장 모션이 안 깨졌다는 뜻이거나,
  // 진짜로 화면에서 사라진 내용이거나 둘 중 하나다.
  const hidden = await p.evaluate(() =>
    [...document.querySelectorAll("main *")].filter((el) => {
      if (!el.textContent?.trim()) return false;
      const s = getComputedStyle(el);
      return s.opacity === "0" || s.visibility === "hidden";
    }).length
  );
  console.log(
    `${name.padEnd(9)} 높이 ${h}px  섹션 ${await p.locator("section").count()}개  ` +
      `안보임 ${hidden}개`
  );
}
await b.close();
