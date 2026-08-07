import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
const errs=[]; const ok=(m)=>console.log('  ✓',m); const bad=(m)=>{console.log('  ✗',m); errs.push(m);}

// ---- 1. 로그인 플로우 (실제 폼 제출)
let p = await ctx.newPage();
p.on('pageerror', e=>bad('pageerror: '+e.message));
await p.goto(BASE+'/');
await p.click('button[type=submit]');
await p.waitForURL('**/dashboard');
ok('로그인 → /dashboard 리다이렉트');

// ---- 2. 사이드바 접기 (쿠키 저장 + 재방문 유지)
await p.click('[data-action="toggle-sidebar"]');
await p.waitForTimeout(350);
let w = await p.$eval('.side', el=>el.getBoundingClientRect().width);
w===72 ? ok(`사이드바 접힘 (${w}px)`) : bad(`사이드바 폭 ${w} (72 기대)`);
await p.goto(BASE+'/daily');
w = await p.$eval('.side', el=>el.getBoundingClientRect().width);
w===72 ? ok('접힘 상태가 쿠키로 유지됨') : bad(`재방문 후 폭 ${w}`);
await p.click('[data-action="toggle-sidebar"]'); await p.waitForTimeout(350);

// ---- 3. 사용자 메뉴 열고 로그아웃
await p.click('[data-action="toggle-user-menu"]');
await p.waitForTimeout(200);
(await p.isVisible('.user__menu')) ? ok('사용자 메뉴 열림') : bad('사용자 메뉴 안 열림');
await p.screenshot({path: `${OUT}/i-usermenu.png`});
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
(await p.isVisible('.user__menu')) ? bad('Esc로 안 닫힘') : ok('Esc로 사용자 메뉴 닫힘');

// ---- 4. 인원 선택 모달 (일일업무일지 작성)
await p.goto(BASE+'/daily/new');
const before = await p.$$eval('#box-to .tagchip', e=>e.length);
await p.click('[data-picker-open="#box-to"]');
await p.waitForSelector('[data-picker]:not([hidden])');
await p.waitForTimeout(500);
const groups = await p.$$eval('.picker__group', e=>e.length);
groups>0 ? ok(`선택 모달 열림 · 부서 ${groups}개 로드`) : bad('조직도 로드 실패');
await p.screenshot({path: `${OUT}/i-picker.png`});
// 검색
await p.fill('[data-picker-search]','경영');
await p.waitForTimeout(500);
const g2 = await p.$$eval('.picker__group', e=>e.length);
const dept = await p.$eval('.picker__dept', e=>e.textContent);
(g2===1 && dept.includes('경영지원팀')) ? ok(`검색 필터 동작 (${dept})`) : bad(`검색 결과 이상: ${g2}개 / ${dept}`);
// 선택 후 추가
await p.click('.picker__row');
const cnt = await p.$eval('[data-picker-count]', e=>e.textContent);
await p.click('[data-action="confirm-picker"]');
await p.waitForTimeout(300);
const after = await p.$$eval('#box-to .tagchip', e=>e.length);
after>before ? ok(`인원 추가 반영 (${before}→${after}, 선택 ${cnt}명)`) : bad(`칩 추가 안 됨 ${before}→${after}`);
const hidden = await p.$eval('#box-to input[type=hidden]', e=>e.value);
hidden.includes('윤채원')||hidden.includes('강태오') ? ok(`hidden input 동기화: ${hidden}`) : bad(`hidden 미동기화: ${hidden}`);
// 칩 삭제
await p.click('#box-to .tagchip .tagchip__x');
await p.waitForTimeout(200);
const after2 = await p.$$eval('#box-to .tagchip', e=>e.length);
after2===after-1 ? ok('칩 삭제 동작') : bad(`칩 삭제 실패 ${after}→${after2}`);

// ---- 5. 행 추가 / 삭제
const rows0 = await p.$$eval('[data-rows="task"] [data-row]', e=>e.length);
await p.click('[data-add-row="task"]');
await p.waitForTimeout(150);
const rows1 = await p.$$eval('[data-rows="task"] [data-row]', e=>e.length);
const nos = await p.$$eval('[data-rows="task"] .gridtable__no', e=>e.map(x=>x.textContent.trim()));
(rows1===rows0+1 && nos[rows1-1]===String(rows1)) ? ok(`행 추가 + 번호 재계산 (${nos.join(',')})`) : bad(`행추가 실패 ${rows0}→${rows1} nos=${nos}`);
await p.click('[data-rows="task"] [data-row]:last-child [data-del-row]');
await p.waitForTimeout(150);
const rows2 = await p.$$eval('[data-rows="task"] [data-row]', e=>e.length);
rows2===rows0 ? ok('행 삭제 동작') : bad(`행삭제 실패 →${rows2}`);

// ---- 6. 휴가 일수 계산 (서버 API 연동)
await p.goto(BASE+'/leave?tab=new');
let days = await p.$eval('[data-days]', e=>e.textContent.trim());
days==='2.0일' ? ok(`초기 사용일수 ${days}`) : bad(`초기 일수 ${days}`);
await p.click('[data-duration="오전반차"]');
await p.waitForTimeout(600);
days = await p.$eval('[data-days]', e=>e.textContent.trim());
const endDis = await p.$eval('[data-end]', e=>e.disabled);
(days==='0.5일' && endDis) ? ok(`반차 선택 → ${days}, 종료일 잠금`) : bad(`반차 처리 이상: ${days}, disabled=${endDis}`);
await p.click('[data-duration="전일"]'); await p.waitForTimeout(600);
await p.fill('[data-start]','2026-08-03'); await p.fill('[data-end]','2026-08-14');
await p.dispatchEvent('[data-end]','change'); await p.waitForTimeout(600);
days = await p.$eval('[data-days]', e=>e.textContent.trim());
days==='10.0일' ? ok(`영업일 계산 (8/3~8/14 주말제외) = ${days}`) : bad(`영업일 계산 오류: ${days}`);
await p.click('[data-leave-type="기타(연차미반영)"]'); await p.waitForTimeout(600);
const hint = await p.$eval('[data-type-hint]', e=>e.textContent.trim());
hint.includes('차감되지 않습니다') ? ok(`휴가종류 안내문 갱신: ${hint}`) : bad(`안내문 미갱신: ${hint}`);

console.log('\n=== 결과: ' + (errs.length? errs.length+'건 실패':'전부 통과') + ' ===');
await b.close();
process.exit(errs.length?1:0);
