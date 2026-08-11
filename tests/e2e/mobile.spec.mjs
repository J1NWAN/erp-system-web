import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const errs=[]; const ok=m=>console.log('  ✓',m); const bad=m=>{console.log('  ✗',m);errs.push(m);}

// iPhone 13 Pro. 실제 Safari 는 주소창 때문에 표시영역이 더 작으므로
// visible viewport 를 줄여 최악의 경우를 재현한다.
const cases = [
  ['iPhone13Pro (전체높이 844)', 390, 844],
  ['iPhone13Pro (주소창 표시 750)', 390, 750],
  ['소형 (360x640)', 360, 640],
];

for (const [label, w, h] of cases) {
  console.log(`\n[${label}]`);
  const ctx = await b.newContext({viewport:{width:w,height:h}, isMobile:true, hasTouch:true, deviceScaleFactor:3});
  const p = await ctx.newPage();
  p.on('pageerror', e=>bad(`${label} pageerror: ${e.message}`));

  // --- 로그인 스크롤
  await p.goto(BASE+'/'); await p.waitForTimeout(400);
  const sc = await p.evaluate(()=>document.documentElement.scrollHeight - window.innerHeight);
  sc<=1 ? ok(`로그인 스크롤 없음 (${sc}px)`) : bad(`로그인 스크롤 ${sc}px`);
  const help = await p.$('.login__help');
  !help ? ok('문의 문구 제거됨') : bad('문의 문구 남아있음');

  // --- 브랜드명
  const brand = await p.$eval('.login__brand-name', e=>e.textContent.trim());
  brand==='ERP' ? ok(`브랜드 "${brand}"`) : bad(`브랜드 "${brand}"`);
  const title = await p.title();
  !/nexo/i.test(title) ? ok(`타이틀 "${title}"`) : bad(`타이틀에 Nexo: ${title}`);

  await ctx.addCookies([{name:'erp_session',value:'1',url:BASE}]);

  // --- 모달이 탭바를 넘지 않는지
  for (const [name, url, opener] of [
    ['부서 추가', '/admin?tab=org', '[data-dept-new]'],
    ['사원 등록', '/admin?tab=org', '[data-emp-new]'],
    ['사원 수정', '/admin?tab=org', '[data-emp-edit]'],
    ['권한 추가', '/admin?tab=perm', '[data-role-new]'],
    ['인원 선택', '/daily/new', '[data-picker-open="#box-to"]'],
  ]) {
    await p.goto(BASE+url); await p.waitForTimeout(350);
    await p.click(opener); await p.waitForTimeout(500);
    const r = await p.evaluate(()=>{
      const panel=[...document.querySelectorAll('.modal:not([hidden]) .modal__panel')].pop().getBoundingClientRect();
      const nav=document.querySelector('.side').getBoundingClientRect();
      return {bottom:panel.bottom, h:panel.height, navTop:nav.top, vp:window.innerHeight};
    });
    const over = Math.round(r.bottom - r.navTop);
    over<=0 ? ok(`${name} 모달: 탭바 침범 없음 (여유 ${-over}px, 높이 ${Math.round(r.h)})`)
            : bad(`${name} 모달이 탭바를 ${over}px 침범`);
    if (name==='사원 등록' && w===390 && h===844) await p.screenshot({path: `${OUT}/mobile-empmodal.png`});
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  }

  // --- 자동 포커스 없어야 함
  await p.goto(BASE+'/daily/new'); await p.waitForTimeout(350);
  await p.click('[data-picker-open="#box-to"]'); await p.waitForTimeout(500);
  let af = await p.evaluate(()=>document.activeElement?.getAttribute('data-picker-search')!==null
      && document.activeElement?.hasAttribute('data-picker-search'));
  !af ? ok('인원 선택: 검색창 자동 포커스 안 함') : bad('인원 선택: 자동 포커스 발생');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  const before = await p.$$eval('[data-rows="task"] [data-row]', e=>e.length);
  await p.click('[data-add-row="task"]'); await p.waitForTimeout(300);
  const after = await p.$$eval('[data-rows="task"] [data-row]', e=>e.length);
  const focusedInput = await p.evaluate(()=>document.activeElement?.tagName==='INPUT');
  (after===before+1) ? ok(`행 추가 동작 (${before}→${after})`) : bad(`행 추가 실패`);
  !focusedInput ? ok('행 추가: 입력칸 자동 포커스 안 함') : bad('행 추가: 자동 포커스 발생');

  await p.goto(BASE+'/admin?tab=org'); await p.waitForTimeout(350);
  await p.click('[data-emp-new]'); await p.waitForTimeout(400);
  const empFocused = await p.evaluate(()=>document.activeElement?.id==='emp-id');
  !empFocused ? ok('사원 등록: 첫 필드 자동 포커스 안 함') : bad('사원 등록: 자동 포커스 발생');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  await p.click('[data-dept-new]'); await p.waitForTimeout(400);
  const deptFocused = await p.evaluate(()=>document.activeElement?.id==='dept-name');
  !deptFocused ? ok('부서 추가: 부서명 자동 포커스 안 함') : bad('부서 추가: 자동 포커스 발생');

  await ctx.close();
}

// --- 데스크톱에서는 포커스가 유지되어야 함 (회귀 방지)
console.log('\n[데스크톱 1440 — 포커스 유지 확인]');
const dctx = await b.newContext({viewport:{width:1440,height:900}});
await dctx.addCookies([{name:'erp_session',value:'1',url:BASE}]);
const dp = await dctx.newPage();
await dp.goto(BASE+'/daily/new'); await dp.waitForTimeout(350);
await dp.click('[data-picker-open="#box-to"]'); await dp.waitForTimeout(500);
const dfocus = await dp.evaluate(()=>document.activeElement?.hasAttribute('data-picker-search'));
dfocus ? ok('데스크톱: 검색창 자동 포커스 유지') : bad('데스크톱: 포커스가 사라짐');
await dp.keyboard.press('Escape');
await dp.goto(BASE+'/admin?tab=org'); await dp.waitForTimeout(350);
await dp.click('[data-emp-new]'); await dp.waitForTimeout(400);
const dEmp = await dp.evaluate(()=>document.activeElement?.id==='emp-id');
dEmp ? ok('데스크톱: 사원 등록 첫 필드 포커스 유지') : bad('데스크톱: 사원 모달 포커스 사라짐');

console.log('\n=== ' + (errs.length? errs.length+'건 실패':'전부 통과') + ' ===');
await b.close();
process.exit(errs.length?1:0);
