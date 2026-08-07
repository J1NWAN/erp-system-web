import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || './tests/e2e/__shots__';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

const pages = [
  ['login',      '/',                  false],
  ['dash-a',     '/dashboard?tab=a',   true],
  ['dash-b',     '/dashboard?tab=b',   true],
  ['daily',      '/daily',             true],
  ['daily-new',  '/daily/new',         true],
  ['weekly',     '/weekly?tab=view',   true],
  ['weekly-w',   '/weekly?tab=write',  true],
  ['leave-new',  '/leave?tab=new',     true],
  ['leave-my',   '/leave?tab=my',      true],
  ['leave-cal',  '/leave?tab=cal',     true],
  ['approve',    '/approve',           true],
  ['admin-org',  '/admin?tab=org',     true],
  ['admin-role', '/admin?tab=role',    true],
  ['admin-lv',   '/admin?tab=leave',   true],
  ['admin-appr', '/admin?tab=approval',true],
  ['admin-perm', '/admin?tab=perm',    true],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

// 로그인 화면은 쿠키 없는 컨텍스트에서 찍는다
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'nexo_session', value: '1', url: BASE }]);

const errors = [];
for (const [name, path, needAuth] of pages) {
  const page = await (needAuth ? ctx : anon).newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${name}: PAGEERROR ${e.message}`));
  const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`${name.padEnd(11)} ${resp.status()}`);
  await page.close();
}

await browser.close();
console.log('\n--- console errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
