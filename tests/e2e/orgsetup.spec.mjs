/* 관리자 > 조직 설정의 "추가" 버튼 동작 검증.
   부서 추가 · 직급 추가/삭제/저장 · 휴가 종류 추가/삭제/저장.

   서버 상태를 바꾸는 시나리오이므로, 직급과 휴가 종류는 검증 후 원래대로 되돌린다.
   부서는 삭제 UI 가 없으므로 실행마다 다른 이름을 써서 재실행이 가능하게 한다. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'erp_session', value: '1', url: BASE }]);

const errs = [];
const ok = (m) => console.log('  ✓', m);
const bad = (m) => { console.log('  ✗', m); errs.push(m); };

const p = await ctx.newPage();
p.on('pageerror', (e) => bad('pageerror: ' + e.message));

const toastText = () => p.$eval('.toast', (e) => e.textContent.trim()).catch(() => '');

/* ---- 1. 부서 추가 ------------------------------------------------------- */

const NEW_DEPT = `개발${String(Date.now()).slice(-4)}팀`;

await p.goto(BASE + '/admin?tab=org');
const tree0 = await p.$$eval('.orgtree__branch > div', (e) => e.length);

await p.click('[data-dept-new]');
await p.waitForSelector('[data-dept-modal]:not([hidden])');
ok('부서 추가 모달 열림');

// 이름 없이 저장하면 거부돼야 한다.
await p.click('[data-dept-save]');
await p.waitForTimeout(300);
(await toastText()).includes('부서명') ? ok('빈 부서명 거부') : bad('빈 부서명이 통과됨');
(await p.$eval('[data-dept-modal]', (e) => e.hidden)) === false
  ? ok('거부 시 모달 유지')
  : bad('거부됐는데 모달이 닫힘');

await p.fill('[data-dept-name]', NEW_DEPT);
await p.selectOption('[data-dept-kind]', 'team');
await p.screenshot({ path: `${OUT}/o-deptmodal.png` });
await p.click('[data-dept-save]');
await p.waitForTimeout(1200);

const tree1 = await p.$$eval('.orgtree__branch > div', (e) => e.textContent);
const treeNodes = await p.$$eval('.orgtree__branch > div', (e) => e.map((x) => x.textContent.trim()));
treeNodes.length === tree0 + 1 && treeNodes.some((t) => t.startsWith(NEW_DEPT))
  ? ok(`조직도에 반영 (${tree0}→${treeNodes.length}): ${treeNodes.find((t) => t.startsWith(NEW_DEPT))}`)
  : bad(`조직도 미반영: ${treeNodes.join(' | ')}`);

// 팀은 본부 하위 묶음 안쪽, 독립 부서보다 앞에 와야 한다.
const idxNew = treeNodes.findIndex((t) => t.startsWith(NEW_DEPT));
const idxDept = treeNodes.findIndex((t) => t.startsWith('경영지원팀'));
idxNew < idxDept ? ok('팀이 독립 부서 위에 삽입됨') : bad(`삽입 위치 이상: ${idxNew} / ${idxDept}`);

// 사원 등록 모달의 부서 선택지에도 나와야 한다.
const deptOpts = await p.$$eval('#emp-dept option', (e) => e.map((x) => x.textContent.trim()));
deptOpts.includes(NEW_DEPT)
  ? ok('사원 모달 부서 목록에 반영')
  : bad(`사원 모달에 미반영: ${deptOpts.join(', ')}`);

// 같은 이름은 거부돼야 한다.
await p.click('[data-dept-new]');
await p.fill('[data-dept-name]', NEW_DEPT);
await p.click('[data-dept-save]');
await p.waitForTimeout(500);
(await toastText()).includes('이미 있는') ? ok('중복 부서명 거부') : bad('중복 부서명이 통과됨');
await p.click('.picker__x[data-action="close-dept"]');

/* ---- 2. 직급 추가 · 삭제 · 저장 -------------------------------------------- */

await p.goto(BASE + '/admin?tab=role');
const r0 = await p.$$eval('[data-rank-row]', (e) => e.length);

await p.click('[data-rank-add]');
const r1 = await p.$$eval('[data-rank-row]', (e) => e.length);
r1 === r0 + 1 ? ok(`직급 행 추가 (${r0}→${r1})`) : bad(`행 추가 실패 ${r0}→${r1}`);

// 복제된 행은 값이 비어 있어야 한다.
const blank = await p.$eval('[data-rank-row]:last-child [data-rank-field="name"]', (e) => e.value);
blank === '' ? ok('추가된 행이 비어 있음') : bad(`추가된 행에 값이 남음: ${blank}`);

// 순서 열이 다시 매겨져야 한다.
const nos = await p.$$eval('[data-rank-row] .gridtable__no', (e) => e.map((x) => x.textContent.trim()));
nos.join(',') === nos.map((_, i) => i + 1).join(',')
  ? ok(`순서 재계산 (1..${nos.length})`)
  : bad(`순서 이상: ${nos.join(',')}`);

// 이름이 비어 있으면 저장이 거부돼야 한다.
await p.click('[data-rank-save]');
await p.waitForTimeout(400);
(await toastText()).includes('직급명') ? ok('빈 직급명 저장 거부') : bad('빈 직급명이 저장됨');

await p.fill('[data-rank-row]:last-child [data-rank-field="name"]', '팀장');
await p.fill('[data-rank-row]:last-child [data-rank-field="days"]', '17');
await p.selectOption('[data-rank-row]:last-child [data-rank-field="perm"]', '팀 승인');
await p.screenshot({ path: `${OUT}/o-rankadd.png` });
await p.click('[data-rank-save]');
await p.waitForTimeout(600);
(await toastText()).includes('저장') ? ok('직급 저장 토스트') : bad('저장 토스트 없음');

await p.reload();
const saved = await p.$$eval('[data-rank-row] [data-rank-field="name"]', (e) => e.map((x) => x.value));
saved.includes('팀장') ? ok(`새로고침 후에도 유지: ${saved.join(', ')}`) : bad(`저장 안 됨: ${saved.join(', ')}`);

// 새 직급이 사원 모달 · 기본 연차 API 에도 반영돼야 한다.
await p.goto(BASE + '/admin?tab=org');
const rankOpts = await p.$$eval('#emp-rank option', (e) => e.map((x) => x.textContent.trim()));
rankOpts.includes('팀장') ? ok('사원 모달 직급 목록에 반영') : bad(`사원 모달 미반영: ${rankOpts.join(', ')}`);

await p.click('[data-emp-new]');
await p.waitForSelector('[data-emp-modal]:not([hidden])');
await p.selectOption('[data-emp-field="rank"]', '팀장');
await p.waitForTimeout(600);
const autoDays = await p.$eval('[data-emp-field="leave"]', (e) => e.value);
autoDays === '17.0' ? ok(`새 직급 기본 연차 자동 반영 (${autoDays})`) : bad(`연차 미반영: ${autoDays}`);
await p.click('.picker__x[data-action="close-emp"]');

// 되돌리기 — 추가한 직급 행을 지우고 저장한다.
await p.goto(BASE + '/admin?tab=role');
await p.click('[data-rank-row]:last-child [data-rank-del]');
const r2 = await p.$$eval('[data-rank-row]', (e) => e.length);
r2 === r0 ? ok(`직급 행 삭제 (${r1}→${r2})`) : bad(`행 삭제 실패 →${r2}`);
await p.click('[data-rank-save]');
await p.waitForTimeout(600);
await p.reload();
const back = await p.$$eval('[data-rank-row] [data-rank-field="name"]', (e) => e.map((x) => x.value));
!back.includes('팀장') && back.length === r0
  ? ok('직급 삭제가 서버에 반영됨')
  : bad(`삭제 미반영: ${back.join(', ')}`);

/* ---- 3. 휴가 종류 추가 · 삭제 · 저장 ---------------------------------------- */

await p.goto(BASE + '/admin?tab=leave');
const l0 = await p.$$eval('[data-leave-row]', (e) => e.length);

await p.click('[data-leave-add]');
const l1 = await p.$$eval('[data-leave-row]', (e) => e.length);
l1 === l0 + 1 ? ok(`휴가 종류 행 추가 (${l0}→${l1})`) : bad(`행 추가 실패 ${l0}→${l1}`);

const cleared = await p.$eval('[data-leave-row]:last-child', (row) => ({
  name: row.querySelector('[data-leave-field="name"]').value,
  half: row.querySelector('[data-leave-field="half"]').checked,
  proof: row.querySelector('[data-leave-field="proof"]').checked,
}));
cleared.name === '' && !cleared.half && !cleared.proof
  ? ok('추가된 행의 입력·체크박스가 초기화됨')
  : bad(`초기화 안 됨: ${JSON.stringify(cleared)}`);

await p.fill('[data-leave-row]:last-child [data-leave-field="name"]', '리프레시휴가');
await p.selectOption('[data-leave-row]:last-child [data-leave-field="deduct"]', '미차감');
await p.check('[data-leave-row]:last-child [data-leave-field="half"]');
await p.screenshot({ path: `${OUT}/o-leaveadd.png` });
await p.click('[data-leave-save]');
await p.waitForTimeout(600);
(await toastText()).includes('저장') ? ok('휴가 종류 저장 토스트') : bad('저장 토스트 없음');

await p.reload();
const lsaved = await p.$$eval('[data-leave-row]', (rows) =>
  rows.map((r) => ({
    name: r.querySelector('[data-leave-field="name"]').value,
    deduct: r.querySelector('[data-leave-field="deduct"]').value,
    half: r.querySelector('[data-leave-field="half"]').checked,
  }))
);
const fresh = lsaved.find((x) => x.name === '리프레시휴가');
fresh && fresh.deduct === '미차감' && fresh.half === true
  ? ok(`새로고침 후에도 유지: ${JSON.stringify(fresh)}`)
  : bad(`저장 안 됨: ${JSON.stringify(lsaved)}`);

// 휴가 신청 화면의 종류 목록에 나와야 한다.
await p.goto(BASE + '/leave?tab=new');
const typeOpts = await p.$$eval('[data-leave-type]', (e) => e.map((x) => x.textContent.trim()));
typeOpts.includes('리프레시휴가')
  ? ok('휴가 신청 화면 종류 목록에 반영')
  : bad(`휴가 신청 화면 미반영: ${typeOpts.join(', ')}`);

// 되돌리기
await p.goto(BASE + '/admin?tab=leave');
await p.click('[data-leave-row]:last-child [data-leave-del]');
await p.click('[data-leave-save]');
await p.waitForTimeout(600);
await p.reload();
const lback = await p.$$eval('[data-leave-row] [data-leave-field="name"]', (e) => e.map((x) => x.value));
!lback.includes('리프레시휴가') && lback.length === l0
  ? ok('휴가 종류 삭제가 서버에 반영됨')
  : bad(`삭제 미반영: ${lback.join(', ')}`);

// 마지막 한 줄은 지워지지 않고 값만 비워져야 한다.
const before = await p.$$eval('[data-leave-row]', (e) => e.length);
for (let i = 0; i < before; i += 1) {
  await p.click('[data-leave-row]:last-child [data-leave-del]');
}
const left = await p.$$eval('[data-leave-row]', (e) => e.length);
const leftName = await p.$eval('[data-leave-row] [data-leave-field="name"]', (e) => e.value);
left === 1 && leftName === ''
  ? ok('마지막 행은 삭제 대신 초기화')
  : bad(`마지막 행 처리 이상: ${left}행, "${leftName}"`);

console.log('\n=== 결과: ' + (errs.length ? errs.length + '건 실패' : '전부 통과') + ' ===');
await b.close();
process.exit(errs.length ? 1 : 0);
