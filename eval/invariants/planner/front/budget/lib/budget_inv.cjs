#!/usr/bin/env node
// Bản chụp cố định cho bất biến planner/front/budget, nguồn T-045 (harness eval/T-045/check_ui.cjs v3, qua Spec Gate 2026-11-03).
// Sửa file này = sửa bất biến: qua Chief of Staff, ghi decisions/.
/*
 * Bất biến vùng Ngân sách (front). --only 1 = INV-001 một con số, 2 = INV-002 không đoán số, 3 = INV-003 mở màn không đụng dữ liệu dùng chung.
 * Chạy: node lib/budget_inv.cjs --repo <tohong-front> --only N   (tự vite build ra thư mục tạm, dữ liệu giả, mạng ngoài bị chặn)
 * Chỉ đo hành vi nhìn thấy: chữ trên tab Ngân sách (tìm theo chữ và vai trò, không theo style) và thân PUT ngân sách gửi ra mạng.
 * Không phụ thuộc công thức tính tiền của từng hạng mục: chỉ so các số với nhau và với số lưu.
 * Dòng cuối PASS / FAIL <lý do>; mã thoát 0/1 (2 = không chạy được).
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
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-inv-dist-'));
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
const mkBudget = (guests, extraCats = [], venueItems) => ({
  total_tr: 500, guests, mung_tr: 0,
  categories: [
    { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, items: venueItems || [{ id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 }] },
    { id: 'photography', name: 'Chụp ảnh + quay phim', pct: 8, priority: 'high', allocated_tr: 40, items: [{ id: 'i-album', name: 'Album', amt: 5 }] },
    { id: 'decor', name: 'Trang trí tiệc + hoa', pct: 6, priority: 'mid', allocated_tr: 30, items: [] },
    { id: 'reserve', name: 'Dự phòng phát sinh', pct: 10, priority: null, allocated_tr: 50, items: [] },
    ...extraCats,
  ],
});
const withStats = (b) => { const cats = b.categories.map((c) => { const est = (c.items || []).filter((i) => !i.status || i.status === 'confirmed').reduce((s, i) => s + (Number(i.amt) || 0), 0);
  return { ...c, estimated_tr: est, variance_tr: (c.allocated_tr || 0) - est, state: est === 0 ? 'chua_phan_bo' : 'dang_theo_doi' }; });
  const te = cats.reduce((s, c) => s + c.estimated_tr, 0); return { ...b, categories: cats, total_estimated_tr: te, total_variance_tr: b.total_tr - te, budget_used_pct: b.total_tr ? Math.round(te / b.total_tr * 100) : 0 }; };


let browser, BASE;
// opts: guests, saved ({catId: {shortlisted, confirmed}}), extraCats, viewport, hash
async function scenario(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const S = { base: BASE, page, ctx, puts: [], external: [], errors: [], store: mkBudget(opts.guests === undefined ? 205 : opts.guests, opts.extraCats, opts.venueItems) };
  page.on('pageerror', (e) => S.errors.push(String(e)));
  await page.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(S.base) || u.startsWith('http://api.test')) return route.continue(); S.external.push(u); return route.abort(); });
  await page.route('http://api.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (p === '/api/me') return json({ couples: [{ couple_id: CID, role: 'owner' }] });
    if (p === `/api/couples/${CID}/budget` && m === 'GET') return json(withStats(S.store));
    if (p === `/api/couples/${CID}/budget` && m === 'PUT') { const b = JSON.parse(req.postData() || '{}'); S.puts.push(b); S.store = { ...S.store, ...b }; return json(withStats(S.store)); }
    if (p === `/api/couples/${CID}/summary`) return json({ profile: {}, budget: { total_tr: S.store.total_tr }, guests: { capacity: S.store.guests, total: 0, yes: 0, pending: 0, no: 0 } });
    if (p === `/api/couples/${CID}/conversations`) return json({ conversations: [] });
    if (p === '/api/vendors/status') return json({ vendors: {} });
    return json({});
  });
  await page.addInitScript(([cid, saved]) => { try { if (!sessionStorage.getItem('budget-inv-seeded')) { localStorage.setItem('th_vendors_' + cid, JSON.stringify(saved)); sessionStorage.setItem('budget-inv-seeded', '1'); } } catch { /* bỏ qua */ } },
    [CID, opts.saved || { venue: { shortlisted: [venueV()], confirmed: null } }]);
  await page.goto(S.base + '/#/ngan-sach'); await page.waitForTimeout(600);
  return S;
}
// Bộ chọn theo CHỮ và VAI TRÒ, không theo style hay cấu trúc component:
//  - tab Ngân sách = tổ tiên lớn nhất của nhãn "Mục con"/"Hạng mục" mà chưa chứa chữ của tab Trang chủ ("TỔNG QUAN");
//  - dòng khoản = phần tử nhỏ nhất trong tab đó chứa cả tên khoản (chữ) lẫn nút bỏ khoản (button có tên "Bỏ").
const HELPERS = `(() => {
  const leaf = (re) => [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && re.test(e.textContent.trim()));
  const root = () => { const lab = leaf(/^(Mục con|Hạng mục)$/); if (!lab) return document.body; let el = lab;
    while (el.parentElement && el.parentElement !== document.body && !/TỔNG QUAN/.test(el.parentElement.innerText || '')) el = el.parentElement; return el; };
  const isBo = (b) => /^Bỏ$/.test((b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim());
  const row = (name) => { const r = root(); const ok = (e) => (e.innerText || '').includes(name) && [...e.querySelectorAll('button')].some(isBo);
    const c = [...r.querySelectorAll('*')].filter(ok); return c.find((e) => ![...e.children].some(ok)) || null; };
  return { root, row, isBo };
})()`;
const text = (page) => page.evaluate((h) => { const H = eval(h); const root = H.root();
  return root.innerText + '\n' + [...root.querySelectorAll('input')].map((i) => i.value).join(' '); }, HELPERS);
// Dòng khoản trong "Mục con" của màn chi tiết (chữ + giá trị ô nhập), tìm theo tên. null nếu không có dòng.
const vendorRow = (page, name = 'Nhà hàng Hoa Sen') => page.evaluate(([h, nm]) => { const H = eval(h); const row = H.row(nm); if (!row) return null;
  const amtInputs = [...row.querySelectorAll('input')].map((i) => ({ v: i.value, editable: !i.readOnly && !i.disabled }));
  return { text: row.innerText + ' ' + amtInputs.map((i) => i.v).join(' '), amtInputs, hasRemove: [...row.querySelectorAll('button')].some(H.isBo) };
}, [HELPERS, name]);
const rowHas = (r, n) => !!r && new RegExp(`(^|[^\\d.,])${String(n).replace('.', '\\.')}(\\s*tr)?([^\\d.,]|$)`).test(r.text);
const hasTr = (t, n) => new RegExp(`(^|[^\\d.,])${String(n).replace('.', '\\.')}\\s*tr`).test(t);
const venueItemAmt = (S) => { const c = ((S.puts.at(-1) || S.store).categories || []).find((x) => x.id === 'venue'); const it = (c?.items || []).find((i) => i.vendor); return it ? it.amt : undefined; };
async function rowText(page, name) { const rows = page.locator('button', { hasText: name }); const n = await rows.count(); const out = []; for (let i = 0; i < n; i++) out.push(await rows.nth(i).innerText()); return out.join('\n---\n'); }
async function openCat(S, id = 'venue') { await S.page.goto(S.base + '/#/ngan-sach/' + id); await S.page.waitForTimeout(500); }
// bấm nút "Chốt" (đúng chữ) của vendor đầu tiên đang thấy trên màn hạng mục
async function chot(S) { await S.page.locator('button:visible', { hasText: /^\s*Chốt\s*$/ }).first().evaluate((b) => b.click()); }
async function confirmFirst(S) { await openCat(S); await chot(S); await S.page.waitForTimeout(1500); }
async function backToList(S) { await S.page.goto(S.base + '/#/ngan-sach'); await S.page.waitForTimeout(600); }


/* ---------- bất biến ---------- */
// Các số "Ntr" trong một đoạn chữ (số thập phân dấu chấm hoặc phẩy).
const trNums = (t) => [...String(t).matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*tr/g)].map((m) => Number(m[1].replace(',', '.')));
// Số "Ntr" trên dòng hạng mục ở danh sách, bỏ đúng một lần số dự toán của hạng mục.
const rowSpend = (row, allocated) => { const ns = trNums(row); const i = ns.indexOf(allocated); if (i >= 0) ns.splice(i, 1); return ns; };
const store = (S) => S.store.categories;
const itemOf = (S, catId, pred) => ((store(S).find((c) => c.id === catId) || {}).items || []).find(pred);
const NAMES = { venue: ['Nhà hàng tiệc cưới', 'Nhà hàng Hoa Sen', 200], photography: ['Chụp ảnh + quay phim', 'Studio Ánh Dương', 40] };

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
  const run = async (n, fn) => { if (!wants(n)) return; crit = n; try { await fn(); } catch (e) { check('bước thao tác không thực hiện được', false, String(e.message).split('\n')[0]); } };

  // INV-001: khoản vendor đã chốt có MỘT con số: số lưu = số ở Mục con = số ở dòng hạng mục; tổng "Đã chốt" = tổng các số lưu.
  await run(1, async () => {
    const saved = { venue: { shortlisted: [venueV()], confirmed: null }, photography: { shortlisted: [photoV()], confirmed: null } };
    const S = await scenario({ guests: 205, saved });
    await openCat(S, 'photography'); await chot(S); await S.page.waitForTimeout(1500);
    await confirmFirst(S);
    let sum = 0;
    for (const id of ['photography', 'venue']) {
      const [cat, vname, alloc] = NAMES[id];
      const A = itemOf(S, id, (i) => i.vendor)?.amt;
      check(`${id}: có khoản vendor lưu ở máy chủ với số hữu hạn`, Number.isFinite(A), 'amt=' + A);
      if (!Number.isFinite(A)) continue; sum += A;
      await openCat(S, id); const vr = await vendorRow(S.page, vname);
      check(`${id}: số ở dòng khoản vendor trong Mục con = số lưu ${A}`, rowHas(vr, A), vr && vr.text);
      await backToList(S); const row = await rowText(S.page, cat); const sp = rowSpend(row, alloc);
      check(`${id}: dòng hạng mục ở danh sách chỉ hiện đúng số lưu ${A} làm tiền chi`, sp.length === 1 && sp[0] === A, row.replace(/\s+/g, ' ') + ' :: ' + JSON.stringify(sp));
    }
    await backToList(S); const t = await text(S.page); const m = t.match(/Đã chốt\s*(\d+(?:[.,]\d+)?)\s*tr/);
    check(`tổng "Đã chốt" = tổng số lưu của các khoản vendor (${sum})`, !!m && Number(m[1].replace(',', '.')) === sum, m && m[0]);
    await S.ctx.close();
  });

  // INV-002: vendor đã chốt nhưng thiếu đầu vào (số khách 0, hoặc giá 0) thì không có số suy diễn: số lưu 0/không có, dòng hạng mục không hiện tiền chi, không NaN/undefined/Infinity.
  await run(2, async () => {
    const cases = [
      { n: 'thiếu số khách', o: { guests: 0 } },
      { n: 'vendor chưa có giá', o: { guests: 205, saved: { venue: { shortlisted: [venueV({ priceTotal: 0 })], confirmed: null } } } },
    ];
    for (const c of cases) {
      const S = await scenario(c.o); await confirmFirst(S);
      const A = itemOf(S, 'venue', (i) => i.vendor)?.amt;
      check(`${c.n}: số lưu của khoản vendor là 0 hoặc không có`, A === undefined || A === 0, 'amt=' + A);
      const d = await text(S.page); check(`${c.n}: màn chi tiết không có NaN/undefined/Infinity`, !/NaN|undefined|Infinity/.test(d), d.slice(0, 120));
      await backToList(S); const row = await rowText(S.page, 'Nhà hàng tiệc cưới'); const sp = rowSpend(row, 200).filter((x) => x !== 0);
      check(`${c.n}: dòng hạng mục không hiện số tiền chi nào`, sp.length === 0, row.replace(/\s+/g, ' '));
      const t = await text(S.page); check(`${c.n}: danh sách Ngân sách không có NaN/undefined/Infinity`, !/NaN|undefined|Infinity/.test(t), t.slice(0, 120));
      await S.ctx.close();
    }
  });

  // INV-003: mở màn Ngân sách mà không bấm gì thì không thêm, không xoá khoản, không đổi trường nào ngoài `amt` của khoản vendor có id trùng vendor đang chốt trên máy này;
  // máy không có trạng thái chốt thì không PUT.
  await run(3, async () => {
    const X = { id: 'vendor_v-X', name: 'Nhà hàng X của máy kia', amt: 99, status: 'confirmed', vendor: true };
    const keep = { id: 'i-keep-venue', name: 'Bánh cưới', amt: 3 };
    const Y = { id: 'vendor_v-venue', name: 'Nhà hàng Hoa Sen', amt: 100, status: 'confirmed', vendor: true };
    const P = { id: 'vendor_v-photo', name: 'Studio Ánh Dương', amt: 50, status: 'confirmed', vendor: true };
    const strip = (cats, allowId) => JSON.stringify(cats.map((c) => ({ ...c, items: (c.items || []).map((i) => (i.id === allowId ? { ...i, amt: '*' } : i)) })));
    const cases = [
      { n: 'máy không có trạng thái chốt, máy chủ có khoản X', items: [keep, X], conf: null, live: X.name, noPut: true },
      { n: 'máy chốt Y, máy chủ chỉ có khoản X của vendor khác', items: [keep, X], conf: venueV(), live: X.name, allow: null },
      { n: 'máy chốt Y, máy chủ có khoản Y cũ', items: [keep, Y], conf: venueV(), live: Y.name, allow: Y.id },
    ];
    for (const c of cases) {
      const S = await scenario({ guests: 230, venueItems: c.items, saved: { venue: { shortlisted: [venueV()], confirmed: c.conf } } });
      const before = JSON.parse(JSON.stringify(store(S)));
      await openCat(S); await S.page.waitForTimeout(3500);
      const vr = await vendorRow(S.page, c.live); check(`${c.n}: app đã tải xong (dòng "${c.live}" hiện trong Mục con)`, !!vr, 'null');
      if (c.noPut) check(`${c.n}: không có PUT nào`, S.puts.length === 0, 'puts=' + S.puts.length);
      check(`${c.n}: không thêm/xoá khoản, không đổi gì ngoài amt của khoản trùng vendor đang chốt`, strip(store(S), c.allow) === strip(before, c.allow), JSON.stringify(store(S)[0].items));
      await backToList(S); await S.page.waitForTimeout(1500);
      check(`${c.n}: sau khi về danh sách vẫn không thêm/xoá/đổi khoản`, strip(store(S), c.allow) === strip(before, c.allow), JSON.stringify(store(S)[0].items));
      await S.ctx.close();
    }
    // Hạng mục khác: máy chốt vendor chụp ảnh, máy chủ có khoản đó; mở màn cũng không được thêm/xoá khoản nào.
    const S = await scenario({ guests: 205, saved: { photography: { shortlisted: [photoV()], confirmed: photoV() } } });
    S.store.categories[1].items = [{ id: 'i-album', name: 'Album', amt: 5 }, P]; const before = JSON.parse(JSON.stringify(store(S)));
    await S.page.reload(); await S.page.waitForTimeout(800); await openCat(S, 'photography'); await S.page.waitForTimeout(3500);
    check('chụp ảnh: mở màn không thêm/xoá khoản, chỉ có thể đổi amt khoản vendor trùng', strip(store(S), P.id) === strip(before, P.id), JSON.stringify(store(S)[1].items));
    await S.ctx.close();
  });

  await browser.close(); server.close();
  if (!fails.length) { console.log('PASS'); process.exit(0); }
  console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1);
}
main().catch((e) => { console.log('FAIL eval lỗi: ' + (e && e.message)); process.exit(2); });
