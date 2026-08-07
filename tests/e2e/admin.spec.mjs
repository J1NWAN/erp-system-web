import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport:{width:1440,height:900} });
await ctx.addCookies([{name:'nexo_session',value:'1',url:BASE}]);
const errs=[]; const ok=m=>console.log('  ✓',m); const bad=m=>{console.log('  ✗',m);errs.push(m);}
const p = await ctx.newPage();
p.on('pageerror', e=>bad('pageerror: '+e.message));

// ---- 1. 권한 추가
await p.goto(BASE+'/admin?tab=perm');
const n0 = await p.$$eval('[data-role-row]', e=>e.length);
await p.click('[data-role-new]');
await p.waitForSelector('[data-role-modal]:not([hidden])');
ok('권한 추가 모달 열림');
await p.fill('[data-role-name]','팀장');
await p.click('[data-role-menu="dash"]');
await p.click('[data-role-menu="approve"]');
await p.screenshot({path: `${OUT}/i-rolemodal.png`});
await p.click('[data-role-save]');
await p.waitForTimeout(900);
const n1 = await p.$$eval('[data-role-row]', e=>e.length);
n1===n0+1 ? ok(`권한 생성 반영 (${n0}→${n1})`) : bad(`권한 생성 실패 ${n0}→${n1}`);
const row = await p.$$eval('[data-role-row]', e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
row.some(r=>r.includes('팀장')&&r.includes('대시보드')&&r.includes('결재함')) ? ok('생성된 권한의 메뉴 저장 확인: '+row.find(r=>r.includes('팀장'))) : bad('메뉴 저장 안 됨: '+row.join(' | '));

// ---- 2. 권한 수정 (행 클릭 → 기존 값 로드)
await p.click('[data-role-row]:last-child');
await p.waitForSelector('[data-role-modal]:not([hidden])');
const nm = await p.$eval('[data-role-name]', e=>e.value);
const onCount = await p.$$eval('[data-role-menu].is-on', e=>e.length);
(nm==='팀장' && onCount===2) ? ok(`수정 모달에 기존값 로드 (${nm}, 메뉴 ${onCount}개)`) : bad(`기존값 로드 실패: ${nm} / ${onCount}`);
await p.click(".picker__x[data-action=\"close-role\"]"); await p.waitForTimeout(200);

// ---- 3. 기본 권한은 삭제 버튼이 없어야 함
const delBtns = await p.$$eval('[data-role-delete]', e=>e.map(x=>x.dataset.roleDelete));
(!delBtns.includes('admin') && !delBtns.includes('user')) ? ok('기본 권한(admin/user) 삭제 불가 처리') : bad('기본 권한에 삭제 버튼 노출: '+delBtns);

// ---- 4. 권한 삭제
await p.click('[data-role-delete]');
await p.waitForTimeout(900);
const n2 = await p.$$eval('[data-role-row]', e=>e.length);
n2===n0 ? ok(`권한 삭제 반영 (${n1}→${n2})`) : bad(`삭제 실패 →${n2}`);

// ---- 5. 사원 권한 변경
await p.goto(BASE+'/admin?tab=org');
const target = '[data-emp-edit][data-id="N-2022-007"]';
const roleBefore = await p.$eval(target+' .pill', e=>e.textContent.trim());
await p.click(target);
await p.waitForSelector('[data-emp-modal]:not([hidden])');
const loaded = await p.$eval('[data-emp-field="name"]', e=>e.value);
const lockRO = await p.$eval('[data-emp-field="login"]', e=>e.readOnly);
(loaded==='김지현' && lockRO) ? ok(`사원 수정 모달 로드 (${loaded}, 아이디 읽기전용)`) : bad(`모달 로드 이상: ${loaded}, RO=${lockRO}`);
await p.screenshot({path: `${OUT}/i-empmodal.png`});
await p.click('[data-emp-role="admin"]');
await p.click('[data-emp-save]');
await p.waitForTimeout(900);
const roleAfter = await p.$eval(target+' .pill', e=>e.textContent.trim());
(roleBefore==='사용자' && roleAfter==='관리자') ? ok(`사원 권한 변경 반영 (${roleBefore}→${roleAfter})`) : bad(`권한 변경 실패 ${roleBefore}→${roleAfter}`);

// ---- 6. 사원 등록 모달에서 직급 변경 시 기본 연차 자동 반영
await p.click('[data-emp-new]');
await p.waitForSelector('[data-emp-modal]:not([hidden])');
await p.waitForTimeout(400);
await p.selectOption('[data-emp-field="rank"]','부장');
await p.waitForTimeout(600);
const lv = await p.$eval('[data-emp-field="leave"]', e=>e.value);
lv==='18.0' ? ok(`직급(부장) → 기본연차 자동 ${lv}일`) : bad(`연차 자동반영 실패: ${lv}`);
await p.click(".picker__x[data-action=\"close-emp\"]");

// ---- 7. 결재선 단계 전환
await p.goto(BASE+'/admin?tab=approval');
let steps = await p.$$eval('[data-line="0"] .step', e=>e.length);
steps===2 ? ok(`휴가신청 결재선 2단계 (${steps})`) : bad(`초기 단계수 ${steps}`);
await p.click('[data-line="0"] [data-line-mode="one"]');
await p.waitForTimeout(900);
steps = await p.$$eval('[data-line="0"] .step', e=>e.length);
steps===1 ? ok('1단계로 전환 반영') : bad(`전환 실패 단계수=${steps}`);
await p.click('[data-line="0"] [data-line-mode="none"]');
await p.waitForTimeout(900);
const empty = await p.isVisible('[data-line="0"] .line__empty');
empty ? ok('결재선 미사용 안내 표시') : bad('미사용 상태 미표시');
await p.click('[data-line="0"] [data-line-mode="two"]');
await p.waitForTimeout(900);

// ---- 8. 결재선 단계에 결재자 추가 (서버 반영)
const box = '#line0-1-ap';
const c0 = await p.$$eval(box+' .tagchip', e=>e.length);
await p.click(`[data-picker-open="${box}"]`);
await p.waitForSelector('[data-picker]:not([hidden])');
await p.waitForTimeout(500);
const title = await p.$eval('[data-picker-title]', e=>e.textContent);
title==='결재자 선택' ? ok('결재자 모드 제목 표시') : bad('제목: '+title);
await p.fill('[data-picker-search]','서지우'); await p.waitForTimeout(500);
await p.click('.picker__row');
await p.click('[data-action="confirm-picker"]');
await p.waitForTimeout(1000);
const c1 = await p.$$eval(box+' .tagchip', e=>e.length);
const names = await p.$$eval(box+' .tagchip', e=>e.map(x=>x.dataset.name));
(c1>c0 && names.includes('서지우')) ? ok(`결재자 서버 저장 확인 (${c0}→${c1}: ${names})`) : bad(`결재자 저장 실패 ${c0}→${c1} ${names}`);
const rule = await p.$eval('[data-line="0"] .step__rule', e=>e.textContent.trim());
rule.includes('2명 중 1명') ? ok(`규칙 문구 갱신: ${rule}`) : bad(`규칙 미갱신: ${rule}`);

console.log('\n=== 결과: ' + (errs.length? errs.length+'건 실패':'전부 통과') + ' ===');
await b.close();
process.exit(errs.length?1:0);
