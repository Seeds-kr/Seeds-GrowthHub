import { chromium } from "playwright";
const B="https://seeds.harvester.kr"; const OUT="/tmp/claude-1000/-home-harvester/1e97ac80-7549-41a7-9bcd-96a3e6df83f5/scratchpad/admin";
const MEASURE=`(() => {
  const lum=(c)=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
  const parse=(s)=>(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
  const ratio=(f,b)=>{const a=lum(parse(f)),c=lum(parse(b));const [hi,lo]=a>c?[a,c]:[c,a];return (hi+0.05)/(lo+0.05)};
  const bgOf=(el)=>{let n=el;while(n){const b=getComputedStyle(n).backgroundColor;
    if(b.startsWith("rgb(")) return b;
    if(b.startsWith("rgba(")){const a=parseFloat(b.slice(5,-1).split(",")[3]); if(a>=0.95) return b;} n=n.parentElement} return "rgb(255,255,255)"};
  const seen=new Set(), fails=[];
  let total=0;
  for (const el of document.querySelectorAll("h1,h2,h3,p,td,th,span,button,a,label,div")) {
    const t=(el.innerText||"").trim(); if(!t||t.length>70) continue;
    if(el.querySelector("h1,h2,h3,p,td,th,span,button,a,label")) continue;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    const cs=getComputedStyle(el); if(cs.visibility==="hidden"||cs.opacity==="0") continue;
    const px=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight,10)>=700;
    const need=(px>=24||(px>=18.66&&bold))?3:4.5;
    const cr=ratio(cs.color,bgOf(el));
    const k=t.slice(0,24)+"|"+Math.round(px); if(seen.has(k)) continue; seen.add(k); total++;
    if(cr<need) fails.push(cr.toFixed(2)+" (필요 "+need+") "+px+"px : "+t.slice(0,34));
  }
  // 모양 일관성
  const radii={}, pads={};
  for (const el of document.querySelectorAll("div,section,article")) {
    const cs=getComputedStyle(el);
    if (cs.borderTopWidth==="0px" || cs.borderTopStyle==="none") continue;
    const r=el.getBoundingClientRect(); if(r.width<120||r.height<40) continue;
    radii[cs.borderRadius]=(radii[cs.borderRadius]||0)+1;
  }
  const btns={};
  for (const el of document.querySelectorAll("button")) {
    const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
    if(r.width<20) continue;
    btns[cs.borderRadius]=(btns[cs.borderRadius]||0)+1;
  }
  return { total, fails, radii, btns,
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
})()`;
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2})).newPage();
await p.goto(B+"/admin/login",{waitUntil:"networkidle"});
await p.locator('input[type="email"]').fill(process.env.AE);
await p.locator('input[type="password"]').fill(process.env.AP);
await p.locator('button[type="submit"]').click(); await p.waitForTimeout(1800);
for (const [name,path] of [["dashboard","/admin"],["applications","/admin/applications"],["students","/admin/students"],
                           ["sessions","/admin/sessions"],["tasks","/admin/tasks"],["ops","/admin/ops-dashboard"],["people","/admin/people"]]) {
  await p.goto(B+path,{waitUntil:"networkidle"}); await p.waitForTimeout(1300);
  await p.screenshot({path:`${OUT}/${name}.png`, fullPage:true});
  const m=await p.evaluate(MEASURE);
  console.log(`━━ ${name.padEnd(12)} 검사 ${String(m.total).padStart(3)} · 미달 ${m.fails.length} · 가로 ${m.hScroll?"있음✗":"없음"}`);
  console.log(`   컨테이너 반경 ${JSON.stringify(m.radii)} · 버튼 반경 ${JSON.stringify(m.btns)}`);
  m.fails.slice(0,4).forEach(f=>console.log("   ✗",f));
}
await b.close();
