#!/usr/bin/env node
// T-151 adv-03 (adversary, tầng 3): drawer thật (EnrichDrawer.jsx của repo front, dựng bằng vite + react plugin của repo, chạy trong Chromium) với phản hồi API ở các biên
// mà eval T-147 #6 không chạm. Spec products/T-150-drawer-moi-admin-nhan-reviews.md Hành vi 2 ("dòng trường vắng" xét theo KHOÁ) và Hành vi 1 (câu 403):
//   - pool.vendor có rating=0, reviewCount=0, priceMin=0, isVerified=false, kèm ghi chú cho cả bốn: hiện "rating 0" ... rồi ghi chú NGAY SAU; không có dòng "<trường> —" nào cho các khoá có mặt;
//   - ghi chú cho khoá vắng (reviews, và một khoá vắng thứ hai `zz_vang` có hai ghi chú): mỗi khoá vắng đúng MỘT dòng "<khoá> —", ở cuối danh sách trường pool (sau mọi trường có mặt,
//     trước "Lớp admin (R2)"), ghi chú ngay sau dòng đó; tổng số dòng "—" trong mục pool = số khoá vắng (không có "—" thừa);
//   - field_notes rỗng: không có dòng "—" nào trong mục pool;
//   - 403: "Chỉ admin xem được chi tiết này", không còn chữ "Chỉ Capu".
// Chạy: cd <tohong-front> && node <hq>/eval/T-151/adv-03-drawer-gia-tri-khong-va-truong-vang.mjs   (TOHONG_FRONT_REPO đặt thì dùng nó)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = [process.env.TOHONG_FRONT_REPO, process.cwd(), path.join(HQ, '..', 'tohong-front')].filter(Boolean).map((p) => path.resolve(p))
  .find((p) => fs.existsSync(path.join(p, 'src', 'admin', 'EnrichDrawer.jsx')));
if (!REPO) { console.log('FAIL không thấy repo tohong-front (đặt TOHONG_FRONT_REPO)'); process.exit(2); }
const req = createRequire(path.join(REPO, 'x.js'));
let chromium;
for (const t of [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = req(t)); break; } catch { /* thử tiếp */ }
}
if (!chromium) { console.log('FAIL không tìm thấy playwright'); process.exit(2); }
const fails = [];
const check = (n, ok, x) => { if (!ok) fails.push(n + (x !== undefined ? ' [' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220) + ']' : '')); };

/* ---------- dựng trang thử: chỉ EnrichDrawer ---------- */
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 't151-adv03-'));
const DIST = path.join(ROOT, 'dist');
fs.writeFileSync(path.join(ROOT, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="./main.jsx"></script></body></html>');
fs.writeFileSync(path.join(ROOT, 'main.jsx'), `import { createRoot } from 'react-dom/client';
import { EnrichDrawer } from ${JSON.stringify(path.join(REPO, 'src/admin/EnrichDrawer.jsx'))};
const id = new URLSearchParams(location.search).get('id') || 'vd1';
createRoot(document.getElementById('root')).render(<EnrichDrawer id={id} name="Vendor thử" onClose={() => {}} onPad={() => {}} />);
`);
try {
  const { build } = await import(pathToFileURL(req.resolve('vite')).href);
  const react = (await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href)).default;
  await build({ root: ROOT, configFile: false, logLevel: 'silent', plugins: [react()], resolve: { alias: [{ find: /^react-dom(\/.*)?$/, replacement: path.dirname(req.resolve('react-dom/package.json')) + '$1' }, { find: /^react(\/.*)?$/, replacement: path.dirname(req.resolve('react/package.json')) + '$1' }] },
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify('http://api.test') }, server: { fs: { strict: false } },
    build: { outDir: DIST, emptyOutDir: true, rollupOptions: { input: path.join(ROOT, 'index.html') } }, cacheDir: path.join(ROOT, '.vite') });
} catch (e) { console.log('FAIL dựng trang thử lỗi: ' + String(e && e.message).replace(/\s+/g, ' ').slice(0, 400)); fs.rmSync(ROOT, { recursive: true, force: true }); process.exit(2); }

const server = http.createServer((q, s) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const note = (field, code, text) => ({ field, code, text });
const detail = (vendor, field_notes) => ({
  data_as_of: '2026-11-11T13:08:22', id: 'vd1', name: 'Vendor thử',
  catalog: [{ file: 'vendors.json', key: 'name', label: 'Tên vendor', stages: ['gen'], pool: ['name'] }], extra_inputs: [],
  source: { available: true, record: { name: 'Vendor thử' }, audit: null, truncated: {} },
  pool: { in_pool: true, visible: true, vendor, reasons: [], field_notes }, overlay: null,
});
const V0 = { id: 'vd1', name: 'Vendor thử', category: 'venue', rating: 0, reviewCount: 0, priceMin: 0, priceMax: 4.7, isVerified: false, styles: ['modern'] };
const N0 = [
  note('rating', 'kept_from_base', 'GHI-rating nguồn hiện cho 4.5'),
  note('reviewCount', 'kept_from_base', 'GHI-reviewCount nguồn hiện cho 12'),
  note('priceMin', 'price_default', 'GHI-priceMin nguồn không có giá'),
  note('isVerified', 'kept_from_base', 'GHI-isVerified'),
  note('zz_vang', 'kept_from_base', 'GHI-zz1'),
  note('zz_vang', 'admin_override', 'GHI-zz2'),
  note('reviews', 'kept_from_base', 'GHI-reviews nguồn hiện có 3 bài đánh giá có chữ, pool có 0'),
];
const RESP = { vd1: [200, detail(V0, N0)], vd2: [200, detail(V0, [])], vd3: [403, { error: 'forbidden' }] };

const browser = await chromium.launch();
try {
  for (const [id, [st, body]] of Object.entries(RESP)) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await page.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
    await page.route('http://api.test/**', (r) => r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      : r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }));
    await page.goto(`${base}/?id=${id}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Đang tải…') && document.body.innerText.length > 20, null, { timeout: 8000 }).catch(() => {});
    const t = await page.evaluate(() => document.body.innerText);
    if (id === 'vd3') {
      check('403: "Chỉ admin xem được chi tiết này"', t.includes('Chỉ admin xem được chi tiết này'), t.slice(0, 200));
      check('403: không còn chữ "Chỉ Capu"', !t.includes('Chỉ Capu'), t.slice(0, 200));
      check('403: không hiện mục pool', !t.includes('Kết quả trong pool'), t.slice(0, 200));
      continue;
    }
    const sec = t.slice(t.indexOf('Kết quả trong pool'), t.indexOf('Lớp admin (R2)'));
    const lines = sec.split('\n').map((s) => s.trim()).filter(Boolean);
    check(`${id}: thấy mục pool`, t.includes('Kết quả trong pool') && t.includes('Lớp admin (R2)'), t.slice(0, 200));
    const dash = lines.filter((l) => /^\S+:?\s*—$/.test(l));
    if (id === 'vd2') { check('field_notes rỗng: không có dòng "—" nào trong mục pool', dash.length === 0, dash); continue; }
    const at = (re) => lines.findIndex((l) => re.test(l));
    for (const [k, v, g] of [['rating', '0', 'GHI-rating'], ['reviewCount', '0', 'GHI-reviewCount'], ['priceMin', '0', 'GHI-priceMin'], ['isVerified', 'false', 'GHI-isVerified']]) {
      const i = at(new RegExp(`^${k}:?\\s+${v}$`));
      check(`${k}=${v}: dòng "${k} ${v}" có mặt, ghi chú ngay sau`, i >= 0 && lines[i + 1] && lines[i + 1].startsWith(g), lines.slice(Math.max(0, i), i + 2));
      check(`${k}=${v}: không có dòng "${k} —"`, at(new RegExp(`^${k}:?\\s*—$`)) < 0, dash);
    }
    check('đúng hai dòng "—" (hai khoá vắng: zz_vang, reviews), không thừa', dash.length === 2, dash);
    const iz = at(/^zz_vang:?\s*—$/), ir = at(/^reviews:?\s*—$/);
    const lastField = Math.max(...Object.keys(V0).map((k) => at(new RegExp(`^${k}:?(\\s|$)`))));
    check('dòng trường vắng ở CUỐI danh sách trường pool (sau mọi trường có mặt)', iz > lastField && ir > lastField, { iz, ir, lastField, lines });
    check('zz_vang: một dòng, rồi đủ hai ghi chú ngay sau', iz >= 0 && lines[iz + 1] === 'GHI-zz1' && lines[iz + 2] === 'GHI-zz2', lines.slice(iz, iz + 3));
    check('reviews: dòng "reviews —" rồi ghi chú ngay sau', ir >= 0 && (lines[ir + 1] || '').startsWith('GHI-reviews'), lines.slice(ir, ir + 2));
    check('mỗi ghi chú hiện đúng một lần', N0.every((n) => lines.filter((l) => l === n.text).length === 1), lines);
  }
} finally {
  await browser.close(); server.close(); fs.rmSync(ROOT, { recursive: true, force: true });
}
if (fails.length) { console.log(`FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}`); process.exit(1); }
console.log('PASS');
