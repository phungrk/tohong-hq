#!/usr/bin/env node
// Thư viện bất biến INV-032 (rút từ T-049 adv-03/adv-05, adversary, 2026-11-03; Chief of Staff đồng ý): font thật nạp muộn thì mũi tên vẫn không che chữ.
// Đo bằng MEASURE và CFG của t039_inv.cjs (cùng thư mục; không chép logic). Font: lib/BeVietnamPro-Regular.ttf (SIL OFL 1.1, xem OFL-BeVietnamPro.txt).
//   node font_inv.cjs --repo <repo-dashboard>
// Kịch bản: trang dựng mũi/nhãn bằng font dự phòng; "Be Vietnam Pro" (font thật của trang) nạp sau 2,5s. Sau khi font nạp xong: mọi mũi [data-part=ah]
// (cuối và giữa) không che chữ (text hiển thị trong #model svg, trừ g.mch/#fx_*) và không đè thân bot quá 0,5u; không lỗi JS.
// Viewport: 360x800, 375x667, 390x844, 390x844 phóng to, 844x900, 1280x900. Áp dụng như t039_inv (có [data-part=ah] hoặc docs/screenshots/T-039/).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html');
const FONT = path.join(__dirname, 'BeVietnamPro-Regular.ttf');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(FONT)) { console.log('FAIL thiếu font ' + FONT); process.exit(1); }
const SRC = fs.readFileSync(path.join(__dirname, 't039_inv.cjs'), 'utf8');
const { MEASURE, CFG } = new Function(SRC.slice(SRC.indexOf('const CFG = '), SRC.indexOf('\n\n(async')) + ';return {MEASURE, CFG};')();
const DATA = { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [], events: [], roster: [],
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } };
const CSS = ['400', '500'].map(w => `@font-face{font-family:'Be Vietnam Pro';font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/bvp.ttf) format('truetype')}`).join('');

(async () => {
  const src = fs.readFileSync(INDEX, 'utf8');
  const SHOT = fs.existsSync(path.join(REPO, 'docs', 'screenshots', 'T-039'));
  if (!SHOT && !/data-part=["']?ah\b|['"]data-part['"]\s*,\s*['"]ah['"]|dataset\.part\s*=\s*['"]ah['"]/.test(src)) { console.log('PASS chưa áp dụng (trang chưa có mũi tên [data-part=ah])'); process.exit(0); }
  const browser = await chromium.launch(); const fails = [];
  const views = [['360', { width: 360, height: 800 }, 0], ['375', { width: 375, height: 667 }, 0], ['390', { width: 390, height: 844 }, 0], ['390-phong-to', { width: 390, height: 844 }, 1], ['844', { width: 844, height: 900 }, 0], ['1280', { width: 1280, height: 900 }, 0]];
  try {
    for (const [name, vp, zoom] of views) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 }); const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(String(e)));
      await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
      await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: CSS }));
      await page.route('**/fonts.gstatic.com/**', async r => { await new Promise(s => setTimeout(s, 2500)); r.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(FONT) }); });
      await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DATA) }));
      await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
      await page.goto('file://' + INDEX, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#model svg');
      if (zoom) { await page.waitForTimeout(300); const b = await page.$('#model-zoom'); if (!b) { fails.push(`${name}: không có nút #model-zoom`); await ctx.close(); continue; } await b.click(); }
      await page.waitForFunction(() => [...document.fonts].some(f => f.family.includes('Be Vietnam') && f.status === 'loaded'), null, { timeout: 10000 }).catch(() => fails.push(`${name}: font Be Vietnam Pro không nạp được trong 10s (kịch bản không chạy)`));
      await page.waitForTimeout(1000);
      const m = await page.evaluate(MEASURE, CFG); await ctx.close();
      if (!m.applies) { fails.push(`${name}: index.html có mũi tên nhưng trang không vẽ [data-part=ah] nào`); continue; }
      fails.push(...m.probs.filter(p => / che chữ | đè /.test(p)).map(p => `${name}: ${p}`));
      if (errs.length) fails.push(`${name}: lỗi JS ${errs[0]}`);
      console.log(`  ${name}: ${m.nEnd} mũi cuối, ${m.nMid} mũi giữa (sau khi font nạp)`);
    }
  } finally { await browser.close(); }
  if (fails.length) { console.log(`FAIL font-muon: ${fails.length} lỗi`); fails.slice(0, 25).forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log('PASS font-muon: font thật nạp muộn, mũi tên không che chữ, không đè bot'); process.exit(0);
})().catch(e => { console.log('FAIL lỗi chạy: ' + (e && e.stack || e)); process.exit(1); });
