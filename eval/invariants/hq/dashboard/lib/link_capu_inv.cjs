#!/usr/bin/env node
// Thư viện đo INV-009 hq/dashboard (nguồn: T-076 INV-P3, rút bởi adversary ở Code Gate T-078 v2): mọi link trong modal Capu
// là https://github.com/phungrk/..., mở tab mới, rel có noopener; số dòng = số trên khối.
//   node link_capu_inv.cjs --repo <repo-dashboard> --data <dashboard.json>
// Áp dụng từ khi trang có modal #capu-modal; trước đó PASS "chưa áp dụng". d3, phông, kênh live đều giả/cục bộ.
const fs = require('fs'), path = require('path');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html'), DATA = arg('--data');
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!/capu-modal/.test(fs.readFileSync(INDEX, 'utf8'))) { console.log('PASS chưa áp dụng: trang chưa có modal #capu-modal (T-076)'); process.exit(0); }
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const { chromium } = require('playwright');
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const OK = /^https:\/\/github\.com\/phungrk\/[\w.-]+\/(pull\/\d+|blob\/main\/inbox\/capu\/[^/?#]+|tree\/main\/inbox\/capu)$/;
(async () => {
  const browser = await chromium.launch(); let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  for (const f of ['all', 'planner', 'hq']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })));
    try {
      await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
      if (await page.$('#product-filter')) { await page.selectOption('#product-filter', f); await page.waitForTimeout(400); }
      const n = await page.$eval('#nd_capu .n', e => e.textContent.trim());
      const loc = page.locator('#nd_capu .n'); await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
      const rows = await page.$$eval('#capu-modal [data-capu-row]', rs => rs.length);
      const links = await page.$$eval('#capu-modal a', as => as.map(a => ({ href: a.getAttribute('href') || '', target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '', capu: a.hasAttribute('data-capu-link') })));
      ok(String(rows) === n, `${f}: số trên khối ${n} = số dòng ${rows}`);
      const badL = links.filter(l => !(l.capu && OK.test(l.href) && l.target === '_blank' && /(^|\s)noopener(\s|$)/.test(l.rel)));
      ok(!badL.length, `${f}: ${links.length} link trong modal đều https github.com/phungrk, tab mới, noopener: lỗi ${JSON.stringify(badL)}`);
      ok(!errs.length, `${f}: không lỗi trang ${errs.join(' | ')}`);
    } finally { await ctx.close(); }
  }
  await browser.close(); console.log(fails ? 'FAIL ' + fails + ' ý' : 'PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ngoại lệ ' + e.message); process.exit(1); });
