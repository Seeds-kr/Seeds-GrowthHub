import { chromium } from "playwright";
const BASE="https://seeds.harvester.kr";
const OUT="/tmp/claude-1000/-home-harvester/1e97ac80-7549-41a7-9bcd-96a3e6df83f5/scratchpad/final";
const MEASURE = `(() => {
  const lum=(c)=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
  const parse=(s)=>(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
  const ratio=(f,b)=>{const a=lum(parse(f)),c=lum(parse(b));const [hi,lo]=a>c?[a,c]:[c,a];return (hi+0.05)/(lo+0.05)};
  const bgOf=(el)=>{let n=el;while(n){const b=getComputedStyle(n).backgroundColor;
    if(b.startsWith("rgb(")) return b;
    if(b.startsWith("rgba(")){const a=parseFloat(b.slice(5,-1).split(",")[3]); if(a>=0.95) return b;}
    n=n.parentElement} return "rgb(255,255,255)"};
  const seen=new Set(); const rows=[];
  for (const el of document.querySelectorAll("h1,h2,h3,p,li,dt,dd,a,span,button,label,td,th")) {
    const t=(el.innerText||"").trim(); if(!t||t.length>90) continue;
    if(el.querySelector("h1,h2,h3,p,li,dt,dd,a,span,button")) continue;
    const r=el.getBoundingClientRect(); if(r.width<2||r.height<2) continue;
    const cs=getComputedStyle(el); if(cs.visibility==="hidden"||cs.opacity==="0") continue;
    const px=parseFloat(cs.fontSize), bold=parseInt(cs.fontWeight,10)>=700;
    const cr=ratio(cs.color,bgOf(el));
    const need=(px>=24||(px>=18.66&&bold))?3:4.5;
    const key=t.slice(0,28)+"|"+Math.round(px); if(seen.has(key)) continue; seen.add(key);
    rows.push({t:t.slice(0,42).replace(/\\n/g," "),px:+px.toFixed(1),cr:+cr.toFixed(2),need,pass:cr>=need});
  }
  return { fails: rows.filter(r=>!r.pass), total: rows.length,
           hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
           radii: [...new Set([...document.querySelectorAll(".spotlight-card")].map(e=>getComputedStyle(e).borderRadius))] };
})()`;
const PAGES=[["home","/"],["people","/people"],["recruit","/recruit"],["program","/program"],["about","/about"],["faq","/faq"]];
const b=await chromium.launch();
let totalFail=0, totalChecked=0;
for (const [w,h,tag] of [[1440,900,"desktop"],[390,844,"mobile"]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2});
  const pg=await ctx.newPage();
  for (const [name,path] of PAGES) {
    await pg.goto(BASE+path,{waitUntil:"networkidle"}); await pg.waitForTimeout(800);
    await pg.screenshot({path:`${OUT}/${name}-${tag}.png`,fullPage:true});
    const m=await pg.evaluate(MEASURE);
    totalFail+=m.fails.length; totalChecked+=m.total;
    const flag = m.fails.length||m.hScroll ? "✗" : "✓";
    console.log(`${flag} ${tag.padEnd(7)} ${name.padEnd(8)} 검사 ${String(m.total).padStart(3)} · 미달 ${m.fails.length} · 가로스크롤 ${m.hScroll?"있음":"없음"}${m.radii.length?` · 카드 반경 ${m.radii.join("/")}`:""}`);
    for (const f of m.fails) console.log(`     ✗ ${f.cr} (필요 ${f.need}) ${f.px}px "${f.t}"`);
  }
  await ctx.close();
}
await b.close();
console.log(`\n합계: 검사 ${totalChecked}개 · 명암비 미달 ${totalFail}개`);
