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

  // --- 휴가신청: 날짜 입력이 다른 입력칸과 같은 자리만 쓰는지
  await p.goto(BASE+'/leave?tab=new'); await p.waitForTimeout(350);
  const box = await p.evaluate(()=>{
    const R = s => { const r = document.querySelector(s).getBoundingClientRect();
                     return [Math.round(r.left), Math.round(r.right)]; };
    return {card:R('[data-leave-form]'), start:R('#l-start'), end:R('#l-end'),
            reason:R('#l-reason'), tel:R('#l-tel')};
  });
  const same = JSON.stringify(box.start)===JSON.stringify(box.reason)
            && JSON.stringify(box.end)===JSON.stringify(box.reason)
            && JSON.stringify(box.tel)===JSON.stringify(box.reason);
  same ? ok(`시작일·종료일이 사유·연락처와 같은 폭 (${box.reason[0]}–${box.reason[1]})`)
       : bad(`날짜 입력 폭이 다름: ${JSON.stringify(box)}`);

  /* iOS Safari 의 날짜 입력은 고유 폭이 커서 그리드 칸을 밀어내고 카드를 넘친다.
     Chromium 에는 그 동작이 없으므로 글자 크기를 키워 같은 상황을 만든다.
     min-width:0 / max-width:100% 가 빠지면 카드가 화면 밖으로 늘어난다. */
  await p.addStyleTag({content:'#l-start,#l-end{font-size:40px!important}'});
  await p.waitForTimeout(200);
  const grown = await p.evaluate(()=>{
    const c = document.querySelector('[data-leave-form]').getBoundingClientRect();
    const s = document.querySelector('#l-start').getBoundingClientRect();
    return {cardR:Math.round(c.right), startR:Math.round(s.right), vw:window.innerWidth};
  });
  (grown.cardR <= grown.vw && grown.startR <= grown.cardR)
    ? ok(`날짜 입력이 커져도 카드 밖으로 나가지 않음 (카드 ${grown.cardR} ≤ 화면 ${grown.vw})`)
    : bad(`카드가 화면 밖으로 밀림: 카드 ${grown.cardR} / 화면 ${grown.vw}`);
  if (w===390 && h===844) await p.screenshot({path: `${OUT}/mobile-leaveform.png`});

  /* 날짜 글자가 세로 가운데에 오는지. 입력칸을 잘라 찍고 캔버스로 픽셀을 읽어
     글자(어두운 픽셀)의 세로 중심을 잰 뒤, 같은 높이의 일반 입력칸과 비교한다. */
  await p.goto(BASE+'/leave?tab=new'); await p.waitForTimeout(350);
  const inkCenter = async (sel) => {
    const b64 = (await p.locator(sel).screenshot()).toString('base64');
    return p.evaluate(async (b64)=>{
      const img = new Image();
      await new Promise(r=>{ img.onload=r; img.src='data:image/png;base64,'+b64; });
      const c = document.createElement('canvas');
      c.width=img.width; c.height=img.height;
      const g = c.getContext('2d'); g.drawImage(img,0,0);
      const d = g.getImageData(0,0,c.width,c.height).data;
      const xMax = Math.floor(c.width*0.6);   // 오른쪽 달력 아이콘은 제외
      let top=-1, bot=-1;
      for(let y=0;y<c.height;y++){
        for(let x=0;x<xMax;x++){
          const i=(y*c.width+x)*4;
          if(d[i]<140 && d[i+1]<140 && d[i+2]<140){ if(top<0) top=y; bot=y; break; }
        }
      }
      return top<0 ? null : {center:(top+bot)/2, box:c.height/2};
    }, b64);
  };
  const dateInk = await inkCenter('#l-start');
  const textInk = await inkCenter('#l-tel');
  const drift = dateInk && textInk ? Math.abs(dateInk.center - textInk.center) : 999;
  drift <= 3
    ? ok(`날짜 글자 세로 위치가 일반 입력칸과 같음 (차이 ${drift.toFixed(1)}px)`)
    : bad(`날짜 글자가 세로로 치우침: 차이 ${drift}px`);


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

/* --- 날짜 입력의 세로 정렬 기준값 -----------------------------------------
   iOS 는 기본 스타일을 끄면 값 텍스트를 입력칸 위쪽에 붙여 그린다. --date-line 을
   줄 높이로 써서 가운데로 내리는데, Chromium 에는 그 동작이 없어 화면으로는 확인할
   수 없다. 대신 이 값이 입력칸 안쪽 높이와 맞는지 검사한다. 입력칸 높이만 바꾸고
   변수를 안 고치면 여기서 걸린다. */
console.log('\n[날짜 입력 --date-line 기준값]');
{
  const ctx = await b.newContext({viewport:{width:1440,height:1000}});
  await ctx.addCookies([{name:'erp_session',value:'1',url:BASE}]);
  const p = await ctx.newPage();
  for (const [url, sel, opener] of [
    ['/leave?tab=new', '#l-start', null],
    ['/daily/new', '.gridtable input[type="date"]', null],
    ['/admin?tab=org', '#emp-joined', '[data-emp-new]'],
  ]) {
    await p.goto(BASE+url); await p.waitForTimeout(300);
    if (opener) { await p.click(opener); await p.waitForTimeout(300); }
    const r = await p.evaluate((s)=>{
      const e=document.querySelector(s); const cs=getComputedStyle(e);
      return {inner: e.offsetHeight - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth),
              v: cs.getPropertyValue('--date-line').trim()};
    }, sel);
    r.v === `${r.inner}px`
      ? ok(`${sel}: --date-line ${r.v} = 안쪽 높이 ${r.inner}px`)
      : bad(`${sel}: --date-line ${r.v} ≠ 안쪽 높이 ${r.inner}px`);
  }
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
