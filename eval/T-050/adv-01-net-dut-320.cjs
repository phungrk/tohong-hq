#!/usr/bin/env node
/*
 * T-050 adv-01 (adversary, tầng 3). Spec T-048 hành vi 5: "Ba nét đứt nối bốn vòng tròn, mỗi nét nằm giữa hai vòng tròn liền kề";
 * hành vi 7: khối phải đúng "Ở mọi chiều rộng từ 320px". Eval tầng 1 (TC2) chỉ đo nét đứt ở 390px.
 * Input phá: chiều rộng 320px (và 360px). Mong đợi: giữa mỗi cặp vòng tròn liền kề, phần được vẽ là một NÉT ĐỨT thật,
 * tức thấy được ít nhất 2 đoạn vẽ tách nhau bởi khoảng trống (đọc từ pixel ảnh chụp), không chỉ một chấm.
 * Chạy: cd /home/user/tohong-hq && node eval/T-050/adv-01-net-dut-320.cjs /home/user/tohong-front
 * Dùng chung build + API giả với eval/T-048/check_ui.cjs (không sửa file đó). Tìm phần tử theo chữ/vai trò; đọc pixel để đếm đoạn nét.
 * Dòng cuối PASS / FAIL; mã thoát 0/1 (2 = không chạy được).
 */
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), zlib = require('zlib');
const { execSync } = require('child_process');
const { createRequire } = require('module');
const REPO = path.resolve(process.argv[2] || '');
if (!fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL cần đường dẫn tohong-front'); process.exit(2); }
const tries = [process.env.PLAYWRIGHT_PATH, path.join(REPO, 'node_modules/playwright'), '/opt/node-tools/node_modules/playwright'].filter(Boolean);
let chromium; for (const t of tries) { try { chromium = createRequire(path.join(REPO, 'x.js'))(t).chromium; break; } catch { /* tiếp */ } }
if (!chromium) { console.log('FAIL không tìm thấy playwright'); process.exit(2); }

function decodePng(buf) {
  let p = 8, w, h, ct, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = src[x]; if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255; } }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}

const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 't050-adv01-'));
try { execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_CLERK_PUBLISHABLE_KEY: '', VITE_API_BASE: 'http://api.test' } }); }
catch (e) { console.log('FAIL build lỗi'); process.exit(1); }
const server = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  const M = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  res.writeHead(200, { 'content-type': M[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const CID = 'c-test', CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const BUDGET = { total_tr: 500, guests: 205, mung_tr: 0, total_estimated_tr: 3, total_variance_tr: 497, budget_used_pct: 1, categories: [
  { id: 'venue', name: 'Nhà hàng tiệc cưới', pct: 40, priority: 'high', allocated_tr: 200, estimated_tr: 3, variance_tr: 197, state: 'dang_theo_doi', items: [{ id: 'i1', name: 'Bánh cưới', amt: 3 }] }] };

const fails = []; const check = (n, ok, x) => { console.log(`${ok ? '  ok ' : '  XX '} [ADV1] ${n}${!ok && x ? '  :: ' + x : ''}`); if (!ok) fails.push(n); };
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  for (const W of [320, 360, 390]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 800 }, deviceScaleFactor: 2 }); const page = await ctx.newPage(); page.setDefaultTimeout(5000);
    await page.route('**/*', (r) => { const u = r.request().url(); return u.startsWith(BASE) || u.startsWith('http://api.test') ? r.continue() : r.abort(); });
    await page.route('http://api.test/**', (r) => { const q = r.request(), p = new URL(q.url()).pathname, j = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(o) });
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      if (p === '/api/me') return j({ couples: [{ couple_id: CID, role: 'owner' }] }); if (p === `/api/couples/${CID}/budget`) return j(BUDGET);
      if (p === `/api/couples/${CID}/summary`) return j({ profile: {}, budget: { total_tr: 500 }, guests: { capacity: 205, total: 0, yes: 0, pending: 0, no: 0 } });
      if (p === `/api/couples/${CID}/conversations`) return j({ conversations: [] }); return j({}); });
    await page.addInitScript((cid) => { localStorage.setItem('th_vendors_' + cid, JSON.stringify({ venue: { shortlisted: [], confirmed: null } })); localStorage.setItem('th_user', JSON.stringify({ bride: 'An', groom: 'Bình' })); }, CID);
    await page.goto(BASE + '/#/ngan-sach'); await page.waitForTimeout(500); await page.goto(BASE + '/#/ngan-sach/venue'); await page.waitForTimeout(800);
    // 4 bước = 4 listitem của list chứa nhãn "Vào ngân sách"; vòng tròn = phần tử bọc icon (svg) trong mỗi listitem.
    const geo = await page.evaluate(() => {
      const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
      const lists = [...document.querySelectorAll('ul,ol,[role="list"]')].filter((l) => norm(l.innerText).includes('Vào ngân sách') && !l.closest('[role="dialog"]'));
      if (!lists.length) return null;
      const lis = [...lists[0].querySelectorAll('li,[role="listitem"]')];
      const circles = lis.map((li) => { const s = li.querySelector('svg'); const r = s.parentElement.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
      const card = lists[0].getBoundingClientRect(); return { circles, card: { t: card.top, b: card.bottom }, bg: getComputedStyle(lists[0]).backgroundColor };
    });
    if (!geo || geo.circles.length !== 4) { check(`${W}px: tìm được list 4 bước`, false, JSON.stringify(geo)); await ctx.close(); continue; }
    const shot = decodePng(await page.screenshot()); const S = 2;
    for (let i = 0; i < 3; i++) {
      const a = geo.circles[i], b = geo.circles[i + 1];
      const x0 = Math.ceil(a.r * S) + 1, x1 = Math.floor(b.l * S) - 1, y0 = Math.floor(a.t * S), y1 = Math.ceil(a.b * S);
      // nền tham chiếu = pixel ở góc trên của dải (trong thẻ, không có nét)
      const bg = shot.px(x0, y0); const painted = [];
      for (let x = x0; x <= x1; x++) { let on = false; for (let y = y0; y < y1; y++) { const c = shot.px(x, y); if (Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) > 30) { on = true; break; } } painted.push(on); }
      let runs = 0; for (let k = 0; k < painted.length; k++) if (painted[k] && !painted[k - 1]) runs++;
      const gapCss = Math.round((b.l - a.r) * 10) / 10;
      check(`${W}px: nét nối ${['Tìm-Lưu', 'Lưu-Chốt', 'Chốt-Vào ngân sách'][i]} là nét đứt thấy được (>= 2 đoạn vẽ)`, runs >= 2, `số đoạn vẽ = ${runs}, khoảng giữa hai vòng tròn = ${gapCss}px`);
    }
    await ctx.close();
  }
  await browser.close(); server.close(); fs.rmSync(DIST, { recursive: true, force: true });
  console.log(fails.length ? `FAIL ${fails[0]}${fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : ''}` : 'PASS'); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log('FAIL không chạy được: ' + e.message.split('\n')[0]); process.exit(2); });
