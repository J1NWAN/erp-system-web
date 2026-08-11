/* 기간 이동 검증 — 주간업무보고의 주 이동과 팀 휴가 캘린더의 달 이동·부서 필터.

   시안이 "오늘"로 삼는 날짜는 2026-08-05 이고, 시드 주간보고는 32주차(8/3–8/7)다.
   그 주와 그 달의 화면은 원본과 값이 같아야 하므로 함께 검증한다. */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.addCookies([{ name: 'erp_session', value: '1', url: BASE }]);

const errs = [];
const ok = (m) => console.log('  ✓', m);
const bad = (m) => { console.log('  ✗', m); errs.push(m); };
const eq = (got, want, what) =>
  got === want ? ok(`${what}: ${got}`) : bad(`${what}: "${got}" (기대 "${want}")`);

const p = await ctx.newPage();
p.on('pageerror', (e) => bad('pageerror: ' + e.message));

/* ---- 주간업무보고 주 이동 ------------------------------------------------- */

console.log('\n[주간업무보고]');

await p.goto(BASE + '/weekly');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 32주차 · 8/3 – 8/7', '기본 주차는 오늘이 속한 주');

// 시드 주차의 값은 원본과 같아야 한다.
const seed = await p.evaluate(() => ({
  note: document.querySelector('.card__note').textContent.trim(),
  nums: [...document.querySelectorAll('.summary__row strong')].map((e) => e.textContent.trim()),
  rate: document.querySelector('.summary__rate').textContent.trim(),
  doneW: document.querySelector('.summary__done').style.width,
  doingW: document.querySelector('.summary__doing').style.width,
}));
(seed.note === '6명 중 4명 제출'
  && seed.nums.join(',') === '34건,27건,5건,2건'
  && seed.rate === '완료율 79%'
  && seed.doneW === '79%' && seed.doingW === '15%')
  ? ok(`32주차 요약이 시안과 동일 (${seed.nums.join(' / ')}, ${seed.rate})`)
  : bad(`32주차 요약 불일치: ${JSON.stringify(seed)}`);

await p.screenshot({ path: `${OUT}/cal-week32.png` });

// 이전 주 — 지난 주차는 전원 제출·승인
await p.click('[aria-label="이전 주"]');
await p.waitForLoadState('load');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 31주차 · 7/27 – 7/31', '이전 주 이동');
const past = await p.$$eval('.weekly-grid .pill', (e) => e.map((x) => x.textContent.trim()));
past.length && past.every((s) => s === '승인')
  ? ok(`지난 주차는 전원 승인 (${past.length}명)`)
  : bad(`지난 주차 상태 이상: ${past.join(', ')}`);
const pastTitles = await p.$$eval('.weekly-grid .tcell--ellipsis', (e) => e.map((x) => x.textContent.trim()));
pastTitles.every((t) => t.includes('31주차'))
  ? ok('제목의 주차 번호도 함께 바뀜')
  : bad(`제목 미갱신: ${pastTitles[0]}`);

// 다음 주 두 번 — 아직 오지 않은 주는 전원 미제출
await p.click('[aria-label="다음 주"]');
await p.waitForLoadState('load');
await p.click('[aria-label="다음 주"]');
await p.waitForLoadState('load');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 33주차 · 8/10 – 8/14', '다음 주 이동');
const future = await p.$$eval('.weekly-grid .pill', (e) => e.map((x) => x.textContent.trim()));
future.every((s) => s === '미제출')
  ? ok(`앞으로 올 주차는 전원 미제출 (${future.length}명)`)
  : bad(`미래 주차 상태 이상: ${future.join(', ')}`);
eq(await p.$eval('.card__note', (e) => e.textContent.trim()), '6명 중 0명 제출', '제출 인원 표시');

// 탭을 바꿔도 보고 있던 주가 유지돼야 한다.
await p.click('.tabs__btn:not(.is-active)');
await p.waitForLoadState('load');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 33주차 · 8/10 – 8/14', '탭 전환 후에도 주차 유지');
eq(await p.$eval('#w-title', (e) => e.value), '[개발1팀] 33주차 주간업무보고 — 김지현', '작성 폼 제목');

// 연도를 넘어가도 주차가 이어져야 한다.
await p.goto(BASE + '/weekly?week=2025-12-29');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 1주차 · 12/29 – 1/2', '연말 주차 (ISO 기준)');

// 잘못된 값은 오늘이 속한 주로 되돌아간다.
await p.goto(BASE + '/weekly?week=nope');
eq(await p.$eval('.weeknav__label', (e) => e.textContent.trim()),
   '2026년 32주차 · 8/3 – 8/7', '잘못된 week 값은 이번 주로 폴백');

/* ---- 팀 휴가 캘린더 ------------------------------------------------------- */

console.log('\n[팀 휴가 캘린더]');

const readCal = () => p.evaluate(() => {
  const cells = [...document.querySelectorAll('.calgrid:not(.calgrid--dow) .calcell')];
  const nums = cells.map((c) => c.querySelector('.calcell__num').textContent.trim());
  return {
    label: document.querySelector('.calhead__nav .doc__title').textContent.trim(),
    cells: cells.length,
    days: nums.filter(Boolean),
    firstDayIndex: nums.indexOf('1'),
    today: cells.findIndex((c) => c.classList.contains('calcell--today')),
    events: [...document.querySelectorAll('.calevent')].map((e) => e.textContent.trim()),
  };
});

await p.goto(BASE + '/leave?tab=cal');
let c = await readCal();
eq(c.label, '2026년 8월', '기본 달은 오늘이 속한 달');

// 2026-08-01 은 토요일 → 일요일 시작 달력의 7번째 칸.
c.firstDayIndex === 6 ? ok('1일이 토요일 칸에 놓임') : bad(`1일 위치 이상: ${c.firstDayIndex}`);
c.days.length === 31 && c.days[30] === '31'
  ? ok(`31일까지 모두 표시 (${c.cells}칸 / ${c.cells / 7}주)`)
  : bad(`날짜 누락: ${c.days.length}일까지만 표시`);
c.today === 10 ? ok('오늘(8/5) 강조 표시') : bad(`오늘 표시 위치 이상: ${c.today}`);

// 기본(개발1팀) 일정은 시안과 같아야 한다.
eq(c.events.join(' | '),
   '박서준 연차 | 박서준 연차 | 이도윤 반차 | 정하윤 병가 | 김지현 연차 | 김지현 연차 | 한도현 반차 | 최민서 경조 | 이도윤 연차',
   '8월 개발1팀 일정');
await p.screenshot({ path: `${OUT}/cal-month8.png` });

// 이전 달 — 김지현의 7/31 반차가 있어야 한다.
await p.click('[aria-label="이전 달"]');
await p.waitForLoadState('load');
c = await readCal();
eq(c.label, '2026년 7월', '이전 달 이동');
c.events.join('') === '김지현 반차' ? ok('7월 일정 표시') : bad(`7월 일정: ${c.events.join(', ')}`);
c.today === -1 ? ok('다른 달에는 오늘 강조 없음') : bad('다른 달인데 오늘이 강조됨');

// 다음 달 두 번 — 9월은 일정이 없다.
await p.click('[aria-label="다음 달"]');
await p.waitForLoadState('load');
await p.click('[aria-label="다음 달"]');
await p.waitForLoadState('load');
c = await readCal();
eq(c.label, '2026년 9월', '다음 달 이동');
c.events.length === 0 ? ok('일정 없는 달은 빈 캘린더') : bad(`9월에 일정: ${c.events.join(', ')}`);

// 달 경계 — 2026년 2월은 1일이 일요일이라 정확히 4주다.
await p.goto(BASE + '/leave?tab=cal&month=2026-02');
c = await readCal();
(c.cells === 28 && c.firstDayIndex === 0 && c.days.length === 28)
  ? ok('2026년 2월은 4주 그리드 (1일=일요일, 28일)')
  : bad(`2월 그리드 이상: ${c.cells}칸, 1일 위치 ${c.firstDayIndex}`);

// 연도 경계
await p.goto(BASE + '/leave?tab=cal&month=2026-12');
await p.click('[aria-label="다음 달"]');
await p.waitForLoadState('load');
eq(await p.$eval('.calhead__nav .doc__title', (e) => e.textContent.trim()), '2027년 1월', '연도 넘김');

// 잘못된 값은 이번 달로
await p.goto(BASE + '/leave?tab=cal&month=2026-13');
eq(await p.$eval('.calhead__nav .doc__title', (e) => e.textContent.trim()), '2026년 8월', '잘못된 month 값은 이번 달로 폴백');

/* ---- 부서 필터 ------------------------------------------------------------ */

console.log('\n[부서 필터]');

await p.goto(BASE + '/leave?tab=cal');
const before = (await readCal()).events.length;
// select 변경은 JS 로 주소를 다시 여는 방식이라 이동이 끝날 때까지 기다린다.
await Promise.all([
  p.waitForURL(/dept=/),
  p.selectOption('[data-cal-dept]', '전체 부서'),
]);
await p.waitForLoadState('load');
c = await readCal();
c.events.length > before
  ? ok(`전체 부서로 바꾸면 일정이 늘어남 (${before}→${c.events.length})`)
  : bad(`부서 필터 무동작 (${before}→${c.events.length})`);
c.events.some((e) => e.startsWith('서지우')) && c.events.some((e) => e.startsWith('윤채원'))
  ? ok('다른 부서(개발2팀 · 경영지원팀) 일정 노출')
  : bad(`다른 부서 일정 없음: ${c.events.join(', ')}`);
eq(await p.$eval('[data-cal-dept]', (e) => e.value), '전체 부서', '선택한 부서 유지');
eq(c.label, '2026년 8월', '부서를 바꿔도 보던 달 유지');

// 부서를 유지한 채 달을 넘길 수 있어야 한다.
await p.click('[aria-label="다음 달"]');
await p.waitForLoadState('load');
eq(await p.$eval('[data-cal-dept]', (e) => e.value), '전체 부서', '달을 넘겨도 부서 유지');

console.log('\n=== 결과: ' + (errs.length ? errs.length + '건 실패' : '전부 통과') + ' ===');
await b.close();
process.exit(errs.length ? 1 : 0);
