import { chromium } from "playwright";
const B="https://seeds.harvester.kr"; const OUT="/tmp/claude-1000/-home-harvester/1e97ac80-7549-41a7-9bcd-96a3e6df83f5/scratchpad/cards";
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2})).newPage();
// 공개 표면 카드가 한 벌인지 실제 렌더 값으로 확인한다
const probe=(sel)=>p.evaluate((s)=>[...document.querySelectorAll(s)].slice(0,6).map(e=>{
  const c=getComputedStyle(e);
  return `r=${c.borderRadius} p=${c.paddingTop}/${c.paddingLeft} bd=${c.borderColor}`;
}),sel);
await p.goto(B+"/",{waitUntil:"networkidle"}); await p.waitForTimeout(1200);
console.log("홈 활동카드:", [...new Set(await probe(".spotlight-card"))]);
await p.goto(B+"/people",{waitUntil:"networkidle"}); await p.waitForTimeout(1200);
console.log("인물카드   :", [...new Set(await probe(".spotlight-card"))]);
// 호버 반응
const card=p.locator(".spotlight-card").first();
const before=await card.evaluate(e=>getComputedStyle(e).borderColor+" | "+getComputedStyle(e).boxShadow.slice(0,20));
await card.hover(); await p.waitForTimeout(400);
const after=await card.evaluate(e=>getComputedStyle(e).borderColor+" | "+getComputedStyle(e).boxShadow.slice(0,20));
console.log("호버 전:", before); console.log("호버 후:", after);
console.log("태그:", await card.evaluate(e=>e.tagName+" href="+(e.getAttribute("href")??"-")));
await p.screenshot({path:`${OUT}/people.png`,fullPage:false});
await p.goto(B+"/",{waitUntil:"networkidle"}); await p.waitForTimeout(1000);
await p.evaluate(()=>window.scrollTo(0,1900)); await p.waitForTimeout(900);
await p.screenshot({path:`${OUT}/home-cards.png`});
await b.close();
