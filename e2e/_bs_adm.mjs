import { chromium } from 'playwright';
const b = await chromium.launch(); const pg = await b.newPage({viewport:{width:1280,height:1000}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:3122/ko/admin',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1200);
console.log('  로그인 폼:', await pg.locator('.lgn').count());
await pg.locator('#u').fill('admin'); await pg.locator('#p').fill('wrongpw');
await pg.locator('.lgn .btn').click(); await pg.waitForTimeout(1000);
console.log('  틀린 비번:', await pg.locator('.err2').innerText().catch(()=>'(없음)'));
await pg.locator('#p').fill('booksoom153@');
await pg.locator('.lgn .btn').click(); await pg.waitForTimeout(1600);
const rows = await pg.locator('.row').count();
console.log('  로그인 성공, 대기 건수:', rows);
if (rows > 0) {
  await pg.locator('.row .sm').first().click(); await pg.waitForTimeout(500);
  console.log('  펼침 — 열람 경고:', await pg.locator('.warn2').first().innerText().catch(()=>'(없음)'));
  await pg.getByRole('button',{name:'답변 열람'}).click(); await pg.waitForTimeout(1500);
  console.log('  답변:', (await pg.locator('.panel dl').first().innerText().catch(()=>'?')).replace(/\n/g,' | ').slice(0,140));
  await pg.locator('.panel input[type=text]').fill('아무튼 계속');
  await pg.waitForTimeout(1800);
  const h = await pg.locator('.hits .sm').count();
  console.log('  책 검색 결과:', h, '건');
  if (h) { await pg.locator('.hits .sm').first().click(); await pg.waitForTimeout(300);
    await pg.locator('.panel textarea').fill('지금 필요한 건 속도가 아니라 여백일 것 같아서요.');
    await pg.getByRole('button',{name:'준비 완료로'}).click(); await pg.waitForTimeout(1800);
    console.log('  저장 후 상태:', await pg.locator('.row .tag').first().innerText().catch(()=>'?'));
  }
}
await pg.screenshot({path:'/tmp/admin.png'});
if(errs.length) console.log('  ⚠', errs.slice(0,3).join(' | '));
await b.close();
