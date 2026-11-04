/*
 * Trợ giúp chung cho eval đối kháng T-055 (adversary). Harness build/serve/kill nhóm tiến trình dùng lại eval/T-054/lib.cjs
 * (vite build ra thư mục tạm, máy chủ tĩnh trong tiến trình, listen(0), nonce, chặn mạng ngoài, API giả, dữ liệu bịa).
 * Tìm phần tử theo chữ và vai trò; riêng `.app-frame` là tên spec T-054 giữ cố định (mục "Định nghĩa dùng chung").
 */
const path = require('path');
const L = require('../../T-054/lib.cjs');

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const HINT = 'Thêm Tơ Hồng vào màn hình chính';

function repoArg() {
  const a = process.argv[2] || process.env.TOHONG_FRONT_REPO || process.cwd();
  const r = path.resolve(a);
  if (!require('fs').existsSync(path.join(r, 'package.json'))) { console.log('FAIL cần đường dẫn tohong-front (tham số, TOHONG_FRONT_REPO hoặc cwd)'); process.exit(2); }
  return r;
}

const fails = [];
const check = (name, ok, extra) => { console.log(`${ok ? '  ok ' : '  XX '} ${name}${!ok && extra ? '  :: ' + extra : ''}`); if (!ok) fails.push(name); };
const frames = (p, n = 3) => p.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const settle = (p, fr = 20) => p.evaluate((fr) => new Promise((res) => { let last = -1, n = 0; const t0 = performance.now();
  const f = () => { if (scrollY === last) { if (++n >= fr) return res(Math.round(scrollY)); } else { n = 0; last = scrollY; } if (performance.now() - t0 > 4000) return res(Math.round(scrollY)); requestAnimationFrame(f); }; f(); }), fr);
const sy = (p) => p.evaluate(() => Math.round(scrollY));
const idle = async (p) => { await p.waitForFunction(() => document.getAnimations().filter((a) => a.playState === 'running').length === 0, null, { timeout: 4000 }).catch(() => {}); await frames(p, 2); };
// Lá văn bản đúng chữ t, điểm giữa chạm đúng nó và thấy được (độ mờ tích luỹ > 0.5).
const leafPoint = (p, t) => p.evaluate((t) => { for (const e of document.querySelectorAll('body *')) { if (e.children.length || (e.textContent || '').trim() !== t) continue;
  const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (y < 0 || y > innerHeight) continue;
  const h = document.elementFromPoint(x, y); if (h && (e === h || e.contains(h))) { let o = 1; for (let a = e; a; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); if (o > 0.5) return { x, y, top: r.top, left: r.left }; } } return null; }, t);
const hintVisible = async (p) => { await idle(p); return !!(await leafPoint(p, HINT)); };
async function btn(p, name) { const loc = p.getByRole('button', { name, exact: true }); const n = await loc.count();
  for (let i = 0; i < n; i++) { const ok = await loc.nth(i).evaluate((el) => { const r = el.getBoundingClientRect(); if (r.width < 2) return false; const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const t = document.elementFromPoint(cx, cy); return !!t && el.contains(t); }).catch(() => false); if (ok) return loc.nth(i); } return null; }
async function tap(p, name) { const b = await btn(p, name); if (!b) throw new Error('không thấy nút chạm được: ' + name); await b.click(); }
async function waitBtn(p, name, present = true) { for (let i = 0; i < 60; i++) { if (!!(await btn(p, name)) === present) return true; await p.waitForTimeout(50); } return false; }
async function goTab(p, name) { await tap(p, name); await p.waitForFunction((n) => [...document.querySelectorAll('button[aria-current="page"]')].some((b) => b.textContent.trim() === n), name); return settle(p); }
// Đặt vị trí cuộn tức thì rồi chờ vài khung hình để sự kiện scroll được phát.
const jump = async (p, y) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await frames(p, 3); return sy(p); };

async function run(body, launchOpts) {
  const REPO = repoArg();
  const { chromium } = L.loadPlaywright(REPO);
  const dist = await L.buildDist(REPO); const srv = await L.serve(dist);
  const browser = await chromium.launch(launchOpts);
  try { await body({ browser, base: srv.base, mk: (o) => L.scenario(browser, srv.base, o) }); }
  catch (e) { check('lỗi chạy: ' + String(e.message || e).split('\n')[0].slice(0, 200), false); }
  finally { await browser.close().catch(() => {}); await srv.close().catch(() => {}); require('fs').rmSync(dist, { recursive: true, force: true }); }
  if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
  console.log('PASS'); process.exit(0);
}

module.exports = { IOS_UA, HINT, check, frames, settle, sy, idle, leafPoint, hintVisible, btn, tap, waitBtn, goTab, jump, run };
