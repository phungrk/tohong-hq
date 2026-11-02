#!/usr/bin/env node
/*
 * Eval tầng 1 của T-045 (front): chi phí "Nhà hàng tiệc cưới" = số bàn x giá vendor, kèm dòng "Số bàn: N".
 * Spec: products/T-045-nha-hang-tinh-theo-ban.md. Mỗi tiêu chí 1..7 của spec là một `--only N` (1 chi, 2 dòng Số bàn + 390px,
 * 3 hạng mục khác, 4 thiếu dữ liệu, 5 đổi số khách, 6 đổi tên). Tiêu chí 7 (cổng) ở check_7_gates.py, tiêu chí 8 ở checklist.md.
 *
 * Chạy: cd /home/user/tohong-front && node /home/user/tohong-hq/eval/T-045/check_ui.cjs --repo . [--only 1] [--shots DIR] [--dist DIR]
 * Tự `vite build` ra thư mục tạm (không ghi vào repo, không Clerk, VITE_API_BASE=http://api.test), tự phục vụ bản build.
 * Mọi request tới http://api.test là giả (sổ ngân sách giả trong bộ nhớ; GET trả lại đúng cái PUT đã ghi); request ra ngoài bị chặn.
 * Dữ liệu là bịa. Chỉ đo hành vi nhìn thấy (chữ trên màn hình, thân PUT ngân sách gửi ra mạng); không đọc mã nguồn.
 * In `  ok ` / `  XX ` từng ý, dòng cuối `PASS` hoặc `FAIL <lý do đầu> (+n lỗi nữa)`; mã thoát 0/1 (2 = eval không chạy được).
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execSync } = require('child_process');
const { createRequire } = require('module');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const SHOTS = arg('--shots'); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const wants = (c) => !ONLY || ONLY.includes(c);

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')].filter(Boolean);
  for (const t of tries) { try { return createRequire(path.join(REPO, 'x.js'))(t); } catch { /* thử tiếp */ } }
  console.log('FAIL không tìm thấy playwright (đặt PLAYWRIGHT_PATH)'); process.exit(2);
}
const { chromium } = loadPlaywright();

const fails = []; let crit = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 240) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};

/* ---------- build + server ---------- */
let DIST = arg('--dist');
if (!DIST) {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't045-dist-'));
  try {
    execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } });
  } catch (e) { console.log('FAIL build lỗi: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')); process.exit(1); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

/* ---------- dữ liệu giả ---------- */
const CID = 'c-test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const venueV = (o = {}) => ({ id: 'v-venue', name: 'Nhà hàng Hoa Sen', priceTotal: 6, spec: '10 người/bàn', ...o });   // priceTotal = giá TRIỆU MỖI BÀN; priceMax có thì là khoảng giá
const photoV = (o = {}) => ({ id: 'v-photo', name: 'Studio Ánh Dương', priceTotal: 12, ...o });
const mkBudget = (guests, extraCats = []) => ({
  total_tr: 500, guests, mung_tr: 0,
  categories: [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: [{ id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 }] },
    { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [{ id: 'i-album', name: 'Album', amt: 5 }] },
    { id: 'decor', name: 'Trang trí tiệc + hoa', pct: 6, priority: 'mid', allocated_tr: 30, items: [] },
    { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
    ...extraCats,
  ],
});
const withStats = (b) => { const cats = b.categories.map((c) => { const est = (c.items || []).filter((i) => !i.status || i.status === 'confirmed').reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: est === 0 ? 'chua_phan_bo' : 'dang_theo_doi' }; });
  const te = cats.reduce((s, c) => s + c.estimated_tr, 0); return { ...b, categories: cats, total_estimated_tr: te, total_variance_tr: b.total_tr - te, budget_used_pct: b.total_tr ? Math.round(te / b.total_tr * 100) : 0 }; };

const expectTr = (guests, lo, hi) => Math.round((hi == null ? lo : (lo + hi) / 2) * Math.ceil(guests / 10));   // công thức của spec, độc lập với mã nguồn

let browser, BASE;
// opts: guests, saved ({catId: {shortlisted, confirmed}}), extraCats, viewport, hash
async function scenario(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const S = { base: BASE, page, ctx, puts: [], external: [], errors: [], store: mkBudget(opts.guests === undefined ? 205 : opts.guests, opts.extraCats) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(S.base) || u.startsWith('http://api.test')) return route.continue(); S.external.push(u); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget` && m === 'GET') return json(withStats(S.store));
    if (p === `/api/couples/${CID}/budget` && m === 'PUT') { const b = JSON.parse(req.postData() || '{}'); S.puts.push(b); S.store = { ...S.store, ...b }; return json(withStats(S.store)); }
    if (p === `/api/couples/${CID}/summary`) return json({ profile: {}, budget: { total_tr: S.store.total_tr }, guests: { capacity: S.store.guests } });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  await page.addInitScript(([cid, saved]) => { try { if (!sessionStorage.getItem('t045-seeded')) { localStorage.setItem('th_vendors_' + cid, JSON.stringify(saved)); sessionStorage.setItem('t045-seeded', '1'); } } catch { /* bỏ qua */ } },
    [CID, opts.saved || { venue: { shortlisted: [venueV()], confirmed: null } }]);
  await page.goto(S.base + '/#/ngan-sach'); await page.waitForTimeout(600);
  return S;
}
const text = (page) => page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('input')].map((i) => i.value).join(' '));
const hasTr = (t, n) => new RegExp(`(^|[^\\d.,])${String(n).replace('.', '\\.')}\\s*tr`).test(t);
const venueItemAmt = (S) => { const c = ((S.puts.at(-1) || S.store).categories || []).find((x) => x.id === 'venue'); const it = (c?.items || []).find((i) => i.vendor); return it ? it.amt : undefined; };
async function rowText(page, name) { const rows = page.locator('button', { hasText: name }); const n = await rows.count(); const out = []; for (let i = 0; i < n; i++) out.push(await rows.nth(i).innerText()); return out.join('\n---\n'); }
async function openCat(S, id = 'venue') { await S.page.goto(S.base + '/#/ngan-sach/' + id); await S.page.waitForTimeout(500); }
// bấm nút "Chốt" (đúng chữ) của vendor đầu tiên đang thấy trên màn hạng mục
async function chot(S) { await S.page.locator('button:visible', { hasText: /^\s*Chốt\s*$/ }).first().evaluate((b) => b.click()); }
async function confirmFirst(S) { await openCat(S); await chot(S); await S.page.waitForTimeout(1500); }
async function backToList(S) { await S.page.goto(S.base + '/#/ngan-sach'); await S.page.waitForTimeout(600); }

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();

  const run = async (n, fn) => { if (!wants(n)) return; crit = n; try { await fn(); } catch (e) { check('bước thao tác không thực hiện được (thiếu phần tử mà spec yêu cầu?)', false, String(e.message).split('\n')[0]); } };

  await run(1, async () => {
    const cases = [
      { n: 'a 205 khách, giá 6tr/bàn -> 21 bàn -> 126tr', g: 205, lo: 6 },
      { n: 'b 201 khách, giá 6tr/bàn -> làm tròn LÊN thành 21 bàn -> 126tr (không phải 120.6 hay 121)', g: 201, lo: 6 },
      { n: 'c 200 khách, giá 3.9tr/bàn -> 20 bàn -> 78tr (không dư bàn)', g: 200, lo: 3.9 },
      { n: 'd 205 khách, giá 3.9tr/bàn -> 81.9 -> làm tròn 82tr', g: 205, lo: 3.9 },
      { n: 'e 100 khách, khoảng giá 5-15tr/bàn -> lấy giữa khoảng 10tr -> 100tr', g: 100, lo: 5, hi: 15 },
      { n: 'f 7 khách, giá 6tr/bàn -> 1 bàn -> 6tr', g: 7, lo: 6 },
    ];
    for (const c of cases) {
      const S = await scenario({ guests: c.g, saved: { venue: { shortlisted: [venueV({ priceTotal: c.lo, ...(c.hi ? { priceMax: c.hi } : {}) })], confirmed: null } } });
      const exp = expectTr(c.g, c.lo, c.hi);
      await confirmFirst(S);
      check(`${c.n}: thân PUT ngân sách ghi khoản vendor = ${exp}`, venueItemAmt(S) === exp, 'amt=' + venueItemAmt(S));
      const d = await text(S.page); check(`${c.n}: màn chi tiết hạng mục hiện ${exp}tr`, hasTr(d, exp), d.slice(0, 160));
      const dif = 200 - exp; check(`${c.n}: chênh lệch với dự toán 200tr tính trên tiền chi: "${dif > 0 ? 'Còn dư ' + dif + 'tr' : 'Khớp dự toán'}"`, d.includes(dif > 0 ? `Còn dư ${dif}tr` : 'Khớp dự toán'), d.split('\n').filter((l) => /dư|Vượt|Khớp/.test(l)).join(' / '));
      await backToList(S); const row = await rowText(S.page, 'Nhà hàng tiệc cưới');
      const tot = await text(S.page); check(`${c.n}: tổng "Đã chốt" = ${exp}tr (vendor duy nhất đã chốt)`, new RegExp(`Đã chốt\\s*${String(exp).replace('.', '\\.')}\\s*tr`).test(tot), tot.split('\n').filter((l) => /Đã chốt/.test(l)).join(' / '));
      check(`${c.n}: dòng hạng mục ở danh sách hiện ${exp}tr`, hasTr(row, exp), row);
      if (exp !== c.lo) check(`${c.n}: dòng hạng mục không hiện giá/bàn ${c.lo}tr như tiền chi`, !hasTr(row, c.lo), row);
      await S.ctx.close();
    }
    // Hủy chốt: khoản vendor biến mất, các khoản khác giữ nguyên.
    const S = await scenario({ guests: 205 }); await confirmFirst(S);
    await chot(S); await S.page.waitForTimeout(1500);
    const c = (S.puts.at(-1) || S.store).categories.find((x) => x.id === 'venue');
    check('hủy chốt: không còn khoản vendor, khoản "Bánh cưới" 3tr còn nguyên', !(c.items || []).some((i) => i.vendor) && (c.items || []).some((i) => i.id === 'i-keep-venue' && i.amt === 3), JSON.stringify(c.items));
    await S.ctx.close();
  });

  await run(2, async () => {
    const S = await scenario({ guests: 205 }); await confirmFirst(S);
    let d = await text(S.page); check('màn chi tiết hạng mục có dòng "Số bàn: 21"', /Số bàn:\s*21(?!\d)/.test(d), d.slice(0, 200));
    await backToList(S); let row = await rowText(S.page, 'Nhà hàng tiệc cưới'); check('dòng hạng mục ở danh sách có "Số bàn: 21"', /Số bàn:\s*21(?!\d)/.test(row), row);
    const lines = row.split('\n').filter((l) => /Số bàn/.test(l)); check('đúng một dòng "Số bàn" trong dòng hạng mục, nằm riêng một dòng', lines.length === 1 && /^\s*Số bàn:\s*21\s*$/.test(lines[0]), JSON.stringify(lines));
    const all = await text(S.page); check('trên cả màn Ngân sách chỉ có đúng một "Số bàn" (không lặp ở hạng mục khác)', (all.match(/Số bàn/g) || []).length === 1, String((all.match(/Số bàn/g) || []).length));
    const geo = await S.page.evaluate(() => { const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /^\s*Số bàn:/.test(e.textContent)); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { l: r.left, r2: r.right, w: innerWidth, fs: parseFloat(cs.fontSize), vis: cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, line: el.scrollWidth <= el.clientWidth + 1 }; });
    check('390px: dòng Số bàn thấy được, nằm trong khung, không cuộn ngang, chữ nhỏ hơn 16px', !!geo && geo.vis && geo.l >= 0 && geo.r2 <= geo.w && geo.sw <= geo.cw + 1 && geo.fs < 16, JSON.stringify(geo));
    if (SHOTS) await S.page.screenshot({ path: path.join(SHOTS, 'ngan-sach-390-so-ban.png') });
    // Chưa chốt: không có dòng Số bàn. Hủy chốt: dòng biến mất.
    await openCat(S); await chot(S); await S.page.waitForTimeout(1200);
    await backToList(S); row = await rowText(S.page, 'Nhà hàng tiệc cưới'); check('sau khi hủy chốt, không còn dòng "Số bàn"', !/Số bàn/.test(row), row);
    await S.ctx.close();
    const S2 = await scenario({ guests: 205 }); const t0 = await text(S2.page); check('chưa chốt vendor nào: không có "Số bàn" trên màn Ngân sách', !/Số bàn/.test(t0), t0.slice(0, 120)); await S2.ctx.close();
    const S3 = await scenario({ guests: 205, viewport: { width: 1024, height: 900 } }); await confirmFirst(S3); await backToList(S3); const t3 = await text(S3.page);
    check('1024px: vẫn có "Số bàn: 21"', /Số bàn:\s*21(?!\d)/.test(t3), t3.slice(0, 120)); if (SHOTS) await S3.page.screenshot({ path: path.join(SHOTS, 'ngan-sach-1024-so-ban.png') }); await S3.ctx.close();
  });

  await run(3, async () => {
    const saved = { venue: { shortlisted: [venueV()], confirmed: null }, photography: { shortlisted: [photoV()], confirmed: null } };
    const S = await scenario({ guests: 205, saved });
    await openCat(S, 'photography'); await chot(S); await S.page.waitForTimeout(1500);
    const ph = (S.puts.at(-1) || S.store).categories.find((c) => c.id === 'photography'); const it = (ph.items || []).find((i) => i.vendor);
    check('chốt vendor chụp ảnh giá 12tr: khoản vendor = 12 (không nhân số bàn)', it && it.amt === 12, JSON.stringify(ph.items));
    check('chốt vendor chụp ảnh: khoản "Album" 5tr còn nguyên', (ph.items || []).some((i) => i.id === 'i-album' && i.amt === 5 && i.name === 'Album'));
    const dp = await text(S.page); check('chi tiết chụp ảnh không có "Số bàn"', !/Số bàn/.test(dp), dp.slice(0, 100));
    await confirmFirst(S);   // venue
    const last = (S.puts.at(-1) || S.store).categories; const g = (id) => last.find((c) => c.id === id);
    check('sau khi chốt cả nhà hàng: chụp ảnh vẫn 12 + Album 5', (g('photography').items || []).some((i) => i.vendor && i.amt === 12) && (g('photography').items || []).some((i) => i.id === 'i-album' && i.amt === 5), JSON.stringify(g('photography').items));
    check('dự toán (allocated_tr) các hạng mục không đổi: nhà hàng 200, chụp ảnh 40, trang trí 30, dự phòng 50', g('venue').allocated_tr === 200 && g('photography').allocated_tr === 40 && g('decor').allocated_tr === 30 && g('reserve').allocated_tr === 50, JSON.stringify(last.map((c) => [c.id, c.allocated_tr])));
    check('khoản thủ công "Bánh cưới" 3tr của hạng mục nhà hàng còn nguyên và vẫn là khoản riêng', (g('venue').items || []).some((i) => i.id === 'i-keep-venue' && i.amt === 3 && !i.vendor), JSON.stringify(g('venue').items));
    check('tổng ngân sách và số khách trong PUT không đổi (500tr, 205 khách)', (S.puts.at(-1).total_tr === 500) && (S.puts.at(-1).guests === 205), JSON.stringify([S.puts.at(-1).total_tr, S.puts.at(-1).guests]));
    await backToList(S); const t = await text(S.page); check('danh sách Ngân sách: "Số bàn" chỉ có ở nhà hàng (đúng 1 lần)', (t.match(/Số bàn/g) || []).length === 1);
    await S.ctx.close();
  });

  await run(4, async () => {
    const cases = [
      { n: 'a số khách = 0', o: { guests: 0 }, why: /thiếu số khách|chưa có số khách/i, ban: /Số bàn:\s*chưa có số khách/i },
      { n: 'b giá vendor = 0 (chưa có giá)', o: { guests: 205, saved: { venue: { shortlisted: [venueV({ priceTotal: 0 })], confirmed: null } } }, why: /chưa có giá/i, ban: /Số bàn:\s*21(?!\d)/ },
      { n: 'c cả hai thiếu', o: { guests: 0, saved: { venue: { shortlisted: [venueV({ priceTotal: 0 })], confirmed: null } } }, why: /thiếu số khách|chưa có số khách/i, ban: /Số bàn:\s*chưa có số khách/i },
    ];
    for (const c of cases) {
      const S = await scenario(c.o); await confirmFirst(S);
      const amt = venueItemAmt(S);
      check(`${c.n}: không đoán số, khoản vendor trong PUT là 0 hoặc không có`, amt === undefined || amt === 0, 'amt=' + amt);
      const d = await text(S.page); check(`${c.n}: màn chi tiết nói rõ lý do chưa tính được`, c.why.test(d), d.slice(0, 200));
      await backToList(S); const row = await rowText(S.page, 'Nhà hàng tiệc cưới');
      check(`${c.n}: dòng hạng mục hiện lý do chưa tính được`, c.why.test(row), row);
      check(`${c.n}: dòng "Số bàn" đúng chữ`, c.ban.test(row), row);
      check(`${c.n}: dòng hạng mục không lấy giá/bàn 6tr làm tiền chi`, !hasTr(row, 6), row);
      const top = await text(S.page); check(`${c.n}: không có NaN, undefined, Infinity trên màn Ngân sách`, !/NaN|undefined|Infinity/.test(top), top.slice(0, 120));
      await S.ctx.close();
    }
  });

  await run(5, async () => {
    const S = await scenario({ guests: 205 }); await confirmFirst(S);
    check('trước khi đổi: 21 bàn, 126tr', venueItemAmt(S) === 126);
    // Đổi số khách ở máy chủ (như hồ sơ/onboarding đổi), rồi mở lại app. KHÔNG bấm Chốt lại.
    S.store = { ...S.store, guests: 230 }; S.puts.length = 0;
    await S.page.reload(); await S.page.waitForTimeout(2500); await backToList(S);
    const row = await rowText(S.page, 'Nhà hàng tiệc cưới');
    check('sau khi đổi 205 -> 230 khách, không chốt lại: dòng hạng mục hiện "Số bàn: 23" và 138tr', /Số bàn:\s*23(?!\d)/.test(row) && hasTr(row, 138), row);
    const amt = ((S.puts.at(-1) || S.store).categories.find((c) => c.id === 'venue').items || []).find((i) => i.vendor)?.amt;
    check('khoản vendor được lưu lại = 138 (số lưu khớp số hiển thị, trong 2,5 giây sau khi mở)', amt === 138, 'amt=' + amt);
    check('khoản "Bánh cưới" 3tr không bị đụng', ((S.puts.at(-1) || S.store).categories.find((c) => c.id === 'venue').items || []).some((i) => i.id === 'i-keep-venue' && i.amt === 3));
    // Giảm số khách xuống 0 -> chuyển sang trạng thái thiếu số khách, không giữ số cũ.
    S.store = { ...S.store, guests: 0 }; S.puts.length = 0; await S.page.reload(); await S.page.waitForTimeout(2500); await backToList(S);
    const r0 = await rowText(S.page, 'Nhà hàng tiệc cưới'); check('đổi về 0 khách: không còn hiện 138tr, hiện lý do thiếu số khách', !hasTr(r0, 138) && /thiếu số khách|chưa có số khách/i.test(r0), r0);
    await S.ctx.close();
  });

  await run(6, async () => {
    const S = await scenario({ guests: 205, extraCats: [{ id: 'c-moi', name: 'Nhà hàng tiệc cưới', pct: 0, allocated_tr: 10, items: [{ id: 'i-x', name: 'Khoản tự thêm', amt: 4 }] }] });
    S.store.categories[0].name = 'Tiệc nhà gái';   // người dùng đã đổi tên hạng mục nhà hàng
    await S.page.reload(); await S.page.waitForTimeout(800);
    await S.page.goto(S.base + '/#/ngan-sach/venue'); await S.page.waitForTimeout(500);
    await chot(S); await S.page.waitForTimeout(1500);
    check('hạng mục nhà hàng đã đổi tên "Tiệc nhà gái": vẫn tính 126tr', venueItemAmt(S) === 126, 'amt=' + venueItemAmt(S));
    await backToList(S); const row = await rowText(S.page, 'Tiệc nhà gái');
    check('hạng mục đã đổi tên: vẫn có "Số bàn: 21" và 126tr', /Số bàn:\s*21(?!\d)/.test(row) && hasTr(row, 126), row);
    const all = await text(S.page); check('hạng mục khác tên "Nhà hàng tiệc cưới" (người dùng tự thêm) KHÔNG có "Số bàn" (đúng 1 dòng Số bàn trên cả màn)', (all.match(/Số bàn/g) || []).length === 1, String((all.match(/Số bàn/g) || []).length));
    const mine = (S.puts.at(-1) || S.store).categories.find((c) => c.id === 'c-moi');
    check('hạng mục tự thêm tên "Nhà hàng tiệc cưới" giữ nguyên khoản 4tr', mine && (mine.items || []).length === 1 && mine.items[0].amt === 4, JSON.stringify(mine));
    await S.ctx.close();
  });

  await browser.close(); server.close();
  if (!fails.length) { console.log('PASS'); process.exit(0); }
  console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1);
}
main().catch((e) => { console.log('FAIL eval lỗi: ' + (e && e.message)); process.exit(2); });
