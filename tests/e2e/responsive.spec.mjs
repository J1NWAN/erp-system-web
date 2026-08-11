import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errs=[]; const ok=m=>console.log('  ✓',m); const bad=m=>{console.log('  ✗',m);errs.push(m);}

const sizes = [[1440,900,'desktop'],[1100,900,'tablet'],[820,900,'tablet-sm'],[390,844,'mobile']];

for (const [w,h,label] of sizes) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  await ctx.addCookies([{name:'erp_session',value:'1',url:BASE}]);
  const p = await ctx.newPage();
  p.on('pageerror', e=>bad(`${label} pageerror: ${e.message}`));

  // 로그인 화면
  const anon = await b.newContext({ viewport:{width:w,height:h} });
  const lp = await anon.newPage();
  await lp.goto(BASE+'/'); await lp.waitForTimeout(300);
  await lp.screenshot({path: `${OUT}/r-${label}-login.png`, fullPage:true});
  const cols = await lp.$eval('.login', e=>getComputedStyle(e).gridTemplateColumns);
  const oneCol = cols.split(' ').length===1;
  if (w<=1024) { oneCol?ok(`${label} 로그인 1단 전환`):bad(`${label} 로그인 컬럼 ${cols}`); }
  else { !oneCol?ok(`${label} 로그인 2단 유지`):bad(`${label} 로그인이 1단`); }
  await anon.close();

  // 대시보드
  await p.goto(BASE+'/dashboard'); await p.waitForTimeout(400);
  await p.screenshot({path: `${OUT}/r-${label}-dash.png`, fullPage:true});
  // 가로 스크롤 없어야 함
  const overflow = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow<=1 ? ok(`${label} 대시보드 가로 오버플로 없음`) : bad(`${label} 가로 오버플로 ${overflow}px`);

  // 모바일: 사이드바가 하단 탭바인지
  if (w<=700) {
    const s = await p.$eval('.side', e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
      return {pos:cs.position, bottom:cs.bottom, w:r.width, h:r.height, dir:cs.flexDirection};});
    (s.pos==='fixed' && s.bottom==='0px' && s.dir==='row' && s.h<=74)
      ? ok(`${label} 사이드바 → 하단 탭바 (h=${Math.round(s.h)})`)
      : bad(`${label} 탭바 전환 실패: ${JSON.stringify(s)}`);
    const lbl = await p.$eval('.side__label', e=>getComputedStyle(e).display);
    lbl==='block' ? ok(`${label} 탭 라벨 표시`) : bad(`${label} 탭 라벨 display=${lbl}`);
    const dateHidden = await p.$eval('.head__date', e=>getComputedStyle(e).display);
    dateHidden==='none' ? ok(`${label} 헤더 날짜칩 숨김`) : bad(`${label} 날짜칩 ${dateHidden}`);
  }

  // 테이블 가로 스크롤 처리 (일일업무일지)
  await p.goto(BASE+'/daily'); await p.waitForTimeout(300);
  await p.screenshot({path: `${OUT}/r-${label}-daily.png`, fullPage:true});
  const ov2 = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ov2<=1 ? ok(`${label} 일지목록 가로 오버플로 없음`) : bad(`${label} 일지목록 오버플로 ${ov2}px`);

  // 휴가 캘린더
  await p.goto(BASE+'/leave?tab=cal'); await p.waitForTimeout(300);
  await p.screenshot({path: `${OUT}/r-${label}-cal.png`, fullPage:true});
  const ov3 = await p.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ov3<=1 ? ok(`${label} 캘린더 가로 오버플로 없음`) : bad(`${label} 캘린더 오버플로 ${ov3}px`);

  await ctx.close();
}
console.log('\n=== 결과: ' + (errs.length? errs.length+'건 실패':'전부 통과') + ' ===');
await b.close();
process.exit(errs.length?1:0);
