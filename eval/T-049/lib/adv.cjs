// Eval đối kháng T-049 (adversary): dùng lại MEASURE + ngưỡng của eval/T-047/mui-ten-to.cjs (không sửa file đó), chạy ở những kịch bản tiêu chí 1-4 không chạm.
// node adv.cjs <kịch-bản>   repo = $TOHONG_DASHBOARD_REPO hoặc /home/user/tohong-hq-dashboard
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'T-047', 'mui-ten-to.cjs'), 'utf8');
const body = SRC.slice(SRC.indexOf('// ---------- hằng số theo spec'), SRC.indexOf('// ---------- trình duyệt ----------'));
const { MEASURE, CFG } = new Function(body + ';return {MEASURE, CFG:{ RATIO_MIN, RATIO_MAX, VIS_FRAC_LOW, VIS_PX_LOW, LOW_SC, LEN_MIN, LEN_MAX, WID_MIN, WID_MAX, GAP_MIN, GAP_MAX, LONG, ANG, MID_T, MID_END_MIN, MID_START_MIN, OVER, VIS_FRAC, VIS_PX, TRIM_MAX, EXT_MAX, LABEL_MOVE, LABELS, TARGET, ORACLE }};')();
const SP = '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad';
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js', SP + '/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
const INDEX = path.join(process.env.TOHONG_DASHBOARD_REPO || '/home/user/tohong-hq-dashboard', 'index.html');
const DATA = { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [], events: [], roster: [], model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } };
async function open(b, vp, o = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: o.dpr || 1, colorScheme: o.dark ? 'dark' : 'light', reducedMotion: o.reduce ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => { if (!o.font) return r.fulfill({ contentType: 'text/css', body: '' });
    r.fulfill({ contentType: 'text/css', body: ["400", "500", "600", "700"].map(w => `@font-face{font-family:'Be Vietnam Pro';font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/x.ttf) format('truetype')}`).join('') }); });
  await page.route('**/fonts.gstatic.com/**', async r => { await new Promise(s => setTimeout(s, o.fontDelay || 2500)); if (o.fontFail) return r.fulfill({ status: 404, body: '' }); r.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(o.font) }); });
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(o.data || DATA) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(o.settle || 1500);
  return { ctx, page, errs };
}
const meas = page => page.evaluate(MEASURE, CFG);
let FAILS = 0;
function show(name, m, codes, extra = '') {   // codes: tiền tố mã lỗi cần soi (null = mọi lỗi)
  const ps = m.probs.filter(p => !codes || codes.some(c => p[0].startsWith(c)));
  const nEnd = m.heads.filter(h => h.at === 'end').length, nMid = m.heads.filter(h => h.at === 'mid').length;
  const bad = ps.length || nEnd !== 24 || nMid !== 6; if (bad) FAILS++;
  console.log(`${bad ? 'FAIL' : 'PASS'} ${name}: end=${nEnd} mid=${nMid} lỗi=${ps.length} ${extra}`); ps.slice(0, 8).forEach(p => console.log(`   ${p[0]} ${p[1]}`));
}
function done() { console.log(FAILS ? `FAIL ${FAILS} kịch bản đỏ` : 'PASS mọi kịch bản'); process.exit(FAILS ? 1 : 0); }
const zoom = async page => { await page.click('#model-zoom'); await page.waitForTimeout(800); };
module.exports = { open, meas, show, done, zoom, chromium, CFG, fail: () => FAILS++ };
