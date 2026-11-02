#!/usr/bin/env node
// Bất biến inv-022 (dashboard/model). Nguồn: eval đối kháng T-036 adv-01 (adversary, 2026-11-02), Chief of Staff đồng ý đưa vào bể.
// trên màn hình, trọn trong svg) và mục 2 "Dot, khối sáng, nhân vật khi phóng to (chạy y như bản thường)".
// Áp dụng cho mọi việc chạm vùng: bong bóng đang hiện phải bố trí lại theo bề rộng svg mới mỗi khi đổi chế độ phóng to.
// Kiểm: ở 390 và 1280, bắn một sự kiện, chờ bong bóng hiện, bấm Phóng to; 150ms sau mọi bong bóng còn hiện có chữ cao 9–16px
// (cỡ chữ SVG × hệ số svg) và hộp bao trọn trong svg (±0,5px); rồi bấm Thu nhỏ khi có bong bóng mới, kiểm lại y như vậy.
//   node adv_zoom_bub.cjs --repo <repo-dashboard>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const T = (id, state, owner) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [T('T-1', 'done', 'engineering'), T('T-2', 'done', 'product')], events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } };
let n = 0;
const ev = o => JSON.stringify({ type: 'event', id: 'E-' + (9950 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const EVS = [{ task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' },
  { task: 'T-2', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' }];
const fails = [];
const measure = p => p.evaluate(() => { const sv = document.querySelector('#model svg'), r = sv.getBoundingClientRect(), sc = r.width / 1000;
  return [...document.querySelectorAll('#fx_b .bub')].map(b => { const t = b.querySelector('text'), br = b.getBoundingClientRect();
    return { id: b.getAttribute('data-block'), px: +(parseFloat(t.getAttribute('font-size')) * sc).toFixed(1),
      inside: br.left >= r.left - 0.5 && br.right <= r.right + 0.5 && br.top >= r.top - 0.5 && br.bottom <= r.bottom + 0.5 }; }); });
async function waitBub(p) { for (let i = 0; i < 40; i++) { const m = await measure(p); if (m.length) return m; await p.waitForTimeout(100); } return []; }
function check(tag, list) {
  if (!list.length) { fails.push(tag + ': không có bong bóng để đo (eval không chạy được)'); return; }
  const bad = list.filter(x => x.px < 9 || x.px > 16 || !x.inside);
  if (bad.length) fails.push(tag + ': ' + bad.map(x => `${x.id} chữ ${x.px}px${x.inside ? '' : ', ra ngoài svg'}`).join('; ') + ' (cần 9–16px, trọn trong svg)');
  else console.log('PASS ' + tag + ' ' + list.map(x => x.id + ' ' + x.px + 'px').join(', '));
}
(async () => {
  const browser = await chromium.launch();
  try {
    if (!(fs.readFileSync(INDEX, 'utf8').includes('model-zoom'))) { console.log('PASS chưa có chế độ phóng to (chưa áp dụng)'); process.exit(0); }
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: 'light' }); const page = await ctx.newPage(); let sock = null;
      await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
      await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(dash) }));
      await page.routeWebSocket(/\/ws$/, ws => { sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
      await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
      if (!sock) { fails.push(vp.width + 'px: không mở được kênh live giả'); await ctx.close(); continue; }
      sock.send(ev(EVS[0])); check(vp.width + 'px bản thường, trước khi bấm', await waitBub(page));
      await page.click('#model-zoom'); await page.waitForTimeout(150);
      check(vp.width + 'px vừa bấm Phóng to, bong bóng đang hiện', await measure(page));
      await page.waitForTimeout(2500); sock.send(ev(EVS[1])); await waitBub(page);
      await page.click('#model-zoom'); await page.waitForTimeout(150);
      check(vp.width + 'px vừa bấm Thu nhỏ, bong bóng đang hiện', await measure(page));
      await ctx.close();
    }
  } catch (e) { fails.push('lỗi chạy: ' + e.message); }
  await browser.close();
  if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); process.exit(1); }
  console.log('PASS'); process.exit(0);
})();
