#!/usr/bin/env bash
# Adversary T-146 adv-03: trang khi nhánh dashboard-data của tohong-hq-dashboard chưa có dữ liệu đúng (lần đầu, trước khi workflow chạy).
# Ca: 404, 200 thân rỗng, 200 JSON hỏng, lỗi mạng (abort). Mong đợi: banner hiện, nhắc tohong-hq-dashboard, không lỗi JS chưa bắt,
# trang không treo (#live vẫn nối WebSocket). Thêm: ?data=<url lạ> không làm trang gọi URL khác.
# Cần NODE_PATH=$(npm root -g) (Playwright) và D3=/đường/dẫn/d3.min.js. Repo trang: ${TOHONG_DASHBOARD_REPO:-/home/user/tohong-hq-dashboard}
set -euo pipefail
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
exec node - <<'JS'
const fs = require('fs'), path = require('path');
const INDEX = path.join(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard', 'index.html');
const EXPECT = 'https://raw.githubusercontent.com/phungrk/tohong-hq-dashboard/dashboard-data/dashboard.json';
const D3 = process.env.D3; if (!D3 || !fs.existsSync(D3)) { console.log('FAIL thiếu D3'); process.exit(1); }
const { chromium } = require('playwright');
const cases = [
  ['404', r => r.fulfill({ status: 404, body: '404: Not Found' })],
  ['200 rỗng', r => r.fulfill({ status: 200, contentType: 'application/json', body: '' })],
  ['200 JSON hỏng', r => r.fulfill({ status: 200, contentType: 'text/plain', body: '{"tasks": [' })],
  ['lỗi mạng', r => r.abort('failed')],
];
(async () => {
  const browser = await chromium.launch(); const why = [];
  for (const [label, handler] of cases.concat([['?data=', null]])) {
    const page = await browser.newPage(); const errors = [], hits = [], ws = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
    await page.route(u => !u.protocol.startsWith('file') && !/cdnjs/.test(u.host), r => { hits.push(r.request().url()); (handler || (x => x.fulfill({ status: 404, body: 'x' })))(r); });
    await page.routeWebSocket(/\/ws$/, s => { ws.push(s.url()); s.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
    const q = handler ? '' : '?data=https://evil.example/d.json';
    await page.goto('file://' + INDEX + q); await page.waitForTimeout(2000);
    if (handler) {
      const msg = await page.$eval('#banner', e => getComputedStyle(e).display !== 'none' ? e.textContent : '').catch(() => '');
      if (!/tohong-hq-dashboard/.test(msg)) why.push(label + ': banner không hiện hoặc không nhắc tohong-hq-dashboard ("' + msg + '")');
      if (errors.length) why.push(label + ': lỗi JS chưa bắt: ' + errors[0]);
      if (!ws.length) why.push(label + ': trang không nối WebSocket (treo?)');
      const alive = await Promise.race([page.evaluate(() => 1), new Promise(r => setTimeout(() => r(0), 3000))]);
      if (alive !== 1) why.push(label + ': trang treo');
    } else {
      const other = hits.filter(u => /evil\.example|raw\.githubusercontent/.test(u) && u.split('?')[0] !== EXPECT);
      if (other.length) why.push('?data=: trang gọi URL khác ' + other[0]);
    }
    await page.close();
  }
  await browser.close();
  console.log(why.length ? 'FAIL ' + why.join(' | ') : 'PASS'); process.exit(why.length ? 1 : 0);
})();
JS
