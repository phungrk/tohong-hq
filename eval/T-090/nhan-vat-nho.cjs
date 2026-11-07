#!/usr/bin/env node
// Eval tầng 1 của T-090. Spec: products/T-090-nhan-vat-nho-mot-nua.md.
//   cd /home/user/tohong-hq && bash eval/T-090/run.sh <repo-dashboard> [--criterion N] [--no-inv]   (N = 1..5)
//   cd /home/user/tohong-hq && bash eval/T-090/run.sh <repo> --shots <thư-mục> --label truoc|sau
// Tiêu chí: 1 cỡ nhân vật = 1/2; 2 khối thu nhỏ tương ứng; 3 mọi bất biến model xanh (trừ inv-019 có chủ ý); 4 ảnh trước/sau 1280 và 390 đã commit; 5 .page max-width 1400px (v2, Capu 2026-11-07).
// In từng dòng `PASS Cn ...` / `FAIL Cn.<mã> <lý do>`, rồi một dòng cuối PASS/FAIL; mã thoát 0/1. Dữ liệu dashboard.json và kênh live là giả, cục bộ.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const PW = require('playwright');
const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--label']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots'), LABEL = flag('--label'), NO_INV = !!flag('--no-inv');
const INDEX = path.join(REPO, 'index.html'), HQ = path.resolve(__dirname, '..', '..');
const SP = '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad';
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js', SP + '/d3pkg/package/dist/d3.min.js', SP + '/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (SHOTS && !['truoc', 'sau'].includes(LABEL)) { console.log('FAIL --shots cần --label truoc|sau'); process.exit(1); }

// ---------- MỐC "TRƯỚC" đóng cứng: đo bằng Playwright trên dashboard origin/main (index.html 1350 dòng, CH_S=2.2, viewBox 0 0 1000 1100), 2026-11-07 ----------
// Thân = g.mch [data-part=body] (hộp bao), lúc nghỉ: 48,4u × 66u ở mọi khối (đơn vị u = px chia (svg.width / viewBox.width)).
// Nhân vật (đầy đủ) = hộp bao các path hiển thị (opacity tích lũy > 0,05, không display:none) của g.mch lúc nghỉ: [rộng, cao] u. Phần ẩn lúc nghỉ (mồ hôi, giấy, vệt lao, dấu hỏi) không tính.
const BODY0 = [48.4, 66];
const FULL0 = { nd_intents: [77, 85.8], nd_spec: [61.6, 79.2], nd_respec: [72.6, 79.2], gt_spec: [81.4, 79.2], nd_exec: [57.2, 85.8], nd_rework: [63.8, 79.2],
  gt_code: [72.6, 79.2], nd_capu: [74.8, 85.8], nd_insight: [79.2, 79.2], nd_kr: [72.6, 79.2], nd_prod: [57.2, 79.2] };
// Hình chính của khối "trước": rect [rộng, cao]; cổng: đường kính. Khối không có nhân vật (nd_rel, src_*) giữ nguyên.
const SHAPE0 = { nd_intents: [150, 176], nd_spec: [165, 176], nd_respec: [160, 176], nd_exec: [180, 176], nd_rework: [155, 176], nd_capu: [190, 176],
  nd_kr: [340, 176], nd_prod: [240, 176], nd_insight: [160, 160], gt_spec: [124, 124], gt_code: [124, 124] };
const NOCHAR0 = { nd_rel: [260, 40], src_data: [160, 26], src_inc: [160, 26], src_fb: [160, 26] };
const RATIO = [0.45, 0.55];                 // 1/2 ±10% của 1/2 (tiêu chí 1: "±10%")
const SHRINK = [30, 46];                    // khối cao (và cổng đường kính) giảm trong khoảng này, u: 33u (phần thân bớt) đến 43u (phần nhân vật đầy đủ bớt) ±~3u
const WIDTH_TOL = 0.10;                     // bề ngang khối giữ trong ±10% (chữ quyết định bề ngang, không thu chữ)
const GAP = [2, 24];                        // u: từ đáy thân tới chữ ngay dưới nó trong khối (mốc trước 21,5u): không dính chữ, không để trống thừa
const TOP = [0, 24];                        // u: từ mép trên khối tới đỉnh thân (mốc trước 19u)
const VB_H_MAX = 1040;                      // viewBox cao giảm ≥ 60u so với 1100 (3 hàng khối cùng co), viewBox rộng giữ 1000
const BODY_MIN = { u: 29.7, px1280: 33, px390: 9 };   // sàn tuyệt đối đề xuất cho inv-019 mới (xem spec mục "Bất biến đề xuất")
const PAGE_MAX = 1400;                      // px: .page max-width mới (cũ 1200)
const SHOT_NAMES = ['truoc-1280', 'sau-1280', 'truoc-390', 'sau-390'];

const T = (id, state, owner) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-11-07T09:00', updated: '2026-11-07T09:00', hours_since_update: 2, tier: 'A', area: 'hq/dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const DASH = { generated_at: '2026-11-07T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [T('T-1', 'done', 'engineering'), T('T-2', 'done', 'product')], events: [], roster,
  model: { invariants: { 'hq/dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } };

let browser;
async function open(vp, zoom) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DASH) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  if (zoom) { await page.click('button#model-zoom'); await page.waitForTimeout(500); }
  return o;
}
const VIEWS = [['1280', { width: 1280, height: 900 }, 0], ['1440', { width: 1440, height: 900 }, 0], ['1920', { width: 1920, height: 1000 }, 0], ['844', { width: 844, height: 900 }, 0], ['390', { width: 390, height: 844 }, 0], ['1280-phong-to', { width: 1280, height: 900 }, 1], ['1440-phong-to', { width: 1440, height: 900 }, 1], ['390-phong-to', { width: 390, height: 844 }, 1]];

// ---------- đo trong trang (lúc nghỉ) ----------
const MEASURE = () => {
  const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), k = sr.width / svg.viewBox.baseVal.width, R = e => e.getBoundingClientRect();
  const vis = e => { let o = 1, x = e; while (x && x.nodeType === 1) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (x === svg) break; x = x.parentNode; } return o; };
  const U = r => ({ l: (r.left - sr.left) / k, t: (r.top - sr.top) / k, r: (r.right - sr.left) / k, b: (r.bottom - sr.top) / k });
  const out = { k, vbW: svg.viewBox.baseVal.width, vbH: svg.viewBox.baseVal.height, svgW: sr.width, svgN: document.querySelectorAll('#model svg').length, chars: {}, blocks: {}, texts: [],
    over: document.documentElement.scrollWidth - innerWidth, errs: [] };
  svg.querySelectorAll('g.mch').forEach(g => { const id = g.getAttribute('data-block'), body = g.querySelector('[data-part="body"]'); if (!body) return; const b = R(body);
    let L = 1e9, T = 1e9, Rr = -1e9, B = -1e9; g.querySelectorAll('path').forEach(e => { if (vis(e) <= 0.05) return; const q = R(e); if (q.width + q.height <= 0) return; L = Math.min(L, q.left); T = Math.min(T, q.top); Rr = Math.max(Rr, q.right); B = Math.max(B, q.bottom); });
    out.chars[id] = { body: U(b), bodyPx: [b.width, b.height], full: { l: (L - sr.left) / k, t: (T - sr.top) / k, r: (Rr - sr.left) / k, b: (B - sr.top) / k }, state: g.getAttribute('data-state') }; });
  svg.querySelectorAll('g.node, g.gate, g.res').forEach(g => { if (!g.id) return; const sh = g.querySelector(':scope > rect, :scope > circle'); if (!sh) return; const a = n => parseFloat(sh.getAttribute(n)) || 0;
    out.blocks[g.id] = sh.tagName === 'circle' ? { circle: true, cx: a('cx'), cy: a('cy'), r: a('r'), l: a('cx') - a('r'), t: a('cy') - a('r'), r2: a('cx') + a('r'), b: a('cy') + a('r') }
      : { l: a('x'), t: a('y'), r2: a('x') + a('width'), b: a('y') + a('height'), w: a('width'), h: a('height') };
    g.querySelectorAll('text').forEach(t => { const s = t.textContent.trim(); if (!s || vis(t) <= 0.05) return; const q = R(t); if (!q.width) return; out.texts.push({ blk: g.id, s: s.slice(0, 26), ...U(q) }); }); });
  return out;
};

const results = []; const rec = (c, name, bad) => { results.push([bad ? 'FAIL' : 'PASS', c]); console.log(bad ? `FAIL C${c}.${name} ${bad}` : `PASS C${c} ${name}`); };
const f1 = x => Number(x).toFixed(1);

async function crit1and2() {
  for (const [tag, vp, zoom] of VIEWS) {
    const o = await open(vp, zoom);
    try {
      const m = await o.page.evaluate(MEASURE); const need = (ONLY ? [ONLY] : [1, 2]);
      // ---- tiêu chí 1: cỡ nhân vật ----
      if (need.includes(1)) {
        const ids = Object.keys(FULL0), miss = ids.filter(id => !m.chars[id]);
        rec(1, `${tag} A đủ 11 nhân vật, một svg, viewBox rộng 1000`, miss.length ? 'thiếu ' + miss.join(', ') : (m.svgN !== 1 ? `có ${m.svgN} svg` : (m.vbW !== 1000 ? `viewBox rộng ${m.vbW}` : null)));
        const badB = [], badF = [], badMin = [];
        for (const id of ids) { const c = m.chars[id]; if (!c) continue; const w = c.body.r - c.body.l, h = c.body.b - c.body.t, fw = c.full.r - c.full.l, fh = c.full.b - c.full.t;
          const rb = [w / BODY0[0], h / BODY0[1]], rf = [fw / FULL0[id][0], fh / FULL0[id][1]];
          if (rb.some(r => r < RATIO[0] || r > RATIO[1])) badB.push(`${id} thân ${f1(w)}×${f1(h)}u (tỉ lệ ${rb.map(x => x.toFixed(2)).join('/')})`);
          if (rf.some(r => r < RATIO[0] || r > RATIO[1])) badF.push(`${id} đầy đủ ${f1(fw)}×${f1(fh)}u (tỉ lệ ${rf.map(x => x.toFixed(2)).join('/')})`);
          if (h < BODY_MIN.u || (/^1280/.test(tag) && c.bodyPx[1] < BODY_MIN.px1280) || (/^390/.test(tag) && c.bodyPx[1] < BODY_MIN.px390)) badMin.push(`${id} thân cao ${f1(h)}u/${f1(c.bodyPx[1])}px`); }
        rec(1, `${tag} B thân nhân vật = 1/2 mốc trước (0,45–0,55 cả rộng lẫn cao; mốc 48,4×66u)`, badB.length ? badB.slice(0, 3).join(' | ') : null);
        rec(1, `${tag} C nhân vật đầy đủ (hộp bao phần hiển thị) = 1/2 mốc trước của chính nó (0,45–0,55)`, badF.length ? badF.slice(0, 3).join(' | ') : null);
        rec(1, `${tag} D không nhỏ hơn sàn tuyệt đối (thân ≥ ${BODY_MIN.u}u; ≥ ${BODY_MIN.px1280}px ở 1280; ≥ ${BODY_MIN.px390}px ở 390)`, badMin.length ? badMin.slice(0, 3).join(' | ') : null);
      }
      // ---- tiêu chí 2: khối thu nhỏ tương ứng ----
      if (need.includes(2)) {
        const bad = { H: [], W: [], keep: [], fit: [], text: [], cover: [], gate: [], ov: [] };
        for (const [id, [w0, h0]] of Object.entries(SHAPE0)) { const b = m.blocks[id]; if (!b) { bad.H.push(id + ' mất khối'); continue; }
          if (b.circle) { const d = 2 * b.r, dd = 124 - d; if (dd < SHRINK[0] || dd > SHRINK[1]) bad.H.push(`${id} đường kính ${f1(d)}u (giảm ${f1(dd)}u, cần ${SHRINK.join('–')}u)`); }
          else { const dh = h0 - b.h; if (dh < SHRINK[0] || dh > SHRINK[1]) bad.H.push(`${id} cao ${f1(b.h)}u (giảm ${f1(dh)}u từ ${h0}, cần ${SHRINK.join('–')}u)`);
            if (Math.abs(b.w - w0) > WIDTH_TOL * w0) bad.W.push(`${id} rộng ${f1(b.w)}u (mốc ${w0} ±10%)`); } }
        for (const [id, [w0, h0]] of Object.entries(NOCHAR0)) { const b = m.blocks[id]; if (!b || Math.abs(b.w - w0) > 1 || Math.abs(b.h - h0) > 1) bad.keep.push(`${id} ${b ? f1(b.w) + '×' + f1(b.h) : 'mất'} (mốc ${w0}×${h0}, khối không có nhân vật không đổi cỡ)`); }
        // nhân vật nằm trong khối, cách chữ vừa phải
        for (const id of Object.keys(FULL0)) { const b = m.blocks[id], c = m.chars[id]; if (!b || !c) continue;
          const cx = (c.body.l + c.body.r) / 2, cy = (c.body.t + c.body.b) / 2;
          if (b.circle) { if (Math.hypot(cx - b.cx, cy - b.cy) > b.r * 0.5) bad.fit.push(`${id} tâm thân lệch tâm cổng ${f1(Math.hypot(cx - b.cx, cy - b.cy))}u`); }
          else { const sx = (b.l + b.r2) / 2; if (Math.abs(cx - sx) > 3) bad.fit.push(`${id} thân lệch giữa khối ${f1(cx - sx)}u`);
            if (c.full.t < b.t - 3 || c.body.b > b.b || c.body.l < b.l || c.body.r > b.r2) bad.fit.push(`${id} nhân vật chui ra ngoài khối`);
            const topGap = c.body.t - b.t; if (topGap < TOP[0] || topGap > TOP[1]) bad.fit.push(`${id} thân cách mép trên khối ${f1(topGap)}u (cần ${TOP.join('–')}u)`);
            const under = m.texts.filter(t => t.blk === id && t.t >= c.body.b - 2 && t.l < c.body.r && t.r > c.body.l).map(t => t.t - c.body.b);
            if (!under.length) bad.fit.push(`${id} không có chữ nào ngay dưới thân`); else { const g = Math.min(...under); if (g < GAP[0] || g > GAP[1]) bad.fit.push(`${id} đáy thân cách chữ dưới ${f1(g)}u (cần ${GAP.join('–')}u)`); } } }
        // chữ trong khối không bị cắt (nằm trong hình chính), không bị thân đè
        for (const t of m.texts) { const b = m.blocks[t.blk]; if (!b) continue;
          if (b.circle) { if (t.l < b.l + 0 && false) continue; const hit = Math.min(t.r, b.r2) - Math.max(t.l, b.l) > 0.5 && Math.min(t.b, b.b) - Math.max(t.t, b.t) > 0.5; if (hit) bad.gate.push(`${t.blk} chữ "${t.s}" đè vòng cổng`); }
          else if (t.l < b.l - 0.5 || t.r > b.r2 + 0.5 || t.t < b.t - 0.5 || t.b > b.b + 0.5) bad.text.push(`${t.blk} chữ "${t.s}" ra ngoài khối [${f1(t.l)},${f1(t.t)},${f1(t.r)},${f1(t.b)}] ngoài [${f1(b.l)},${f1(b.t)},${f1(b.r2)},${f1(b.b)}]`);
          if (t.l < -0.5 || t.r > m.vbW + 0.5 || t.b > m.vbH + 0.5 || t.t < -0.5) bad.text.push(`"${t.s}" ra ngoài viewBox`);
          for (const [id, c] of Object.entries(m.chars)) { const x = Math.min(t.r, c.body.r) - Math.max(t.l, c.body.l), y = Math.min(t.b, c.body.b) - Math.max(t.t, c.body.t); if (x > 2 && y > 2) bad.cover.push(`thân ${id} đè chữ "${t.s}" ${f1(x)}×${f1(y)}u`); } }
        // khối không chồng nhau, nằm trong viewBox, viewBox thấp hơn
        const ids = Object.keys(m.blocks);
        for (let i = 0; i < ids.length; i++) { const a = m.blocks[ids[i]]; if (a.l < -0.5 || a.t < -0.5 || a.r2 > m.vbW + 0.5 || a.b > m.vbH + 0.5) bad.ov.push(`${ids[i]} ra ngoài viewBox`);
          for (let j = i + 1; j < ids.length; j++) { const b = m.blocks[ids[j]], x = Math.min(a.r2, b.r2) - Math.max(a.l, b.l), y = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (x > 0.5 && y > 0.5) bad.ov.push(`${ids[i]} chồng ${ids[j]}`); } }
        if (m.vbH > VB_H_MAX) bad.ov.push(`viewBox cao ${m.vbH}u (cần ≤ ${VB_H_MAX}u: các hàng khối co theo, không để khoảng trống)`);
        rec(2, `${tag} A khối có nhân vật thấp đi ${SHRINK.join('–')}u (cổng: đường kính), khối không nhân vật giữ cỡ`, bad.H.concat(bad.keep).slice(0, 3).join(' | ') || null);
        rec(2, `${tag} B bề ngang khối giữ trong ±10% (chữ quyết định bề ngang)`, bad.W.slice(0, 3).join(' | ') || null);
        rec(2, `${tag} C nhân vật nằm giữa khối, cách mép trên ${TOP.join('–')}u và cách chữ dưới ${GAP.join('–')}u`, bad.fit.slice(0, 3).join(' | ') || null);
        rec(2, `${tag} D chữ trong khối không bị cắt, chữ cổng không đè vòng, thân không đè chữ lúc nghỉ`, bad.text.concat(bad.gate, bad.cover).slice(0, 3).join(' | ') || null);
        rec(2, `${tag} E khối không chồng nhau, nằm trong viewBox, viewBox cao ≤ ${VB_H_MAX}u`, bad.ov.slice(0, 3).join(' | ') || null);
        if (/^390/.test(tag)) rec(2, `${tag} F trang không cuộn ngang`, m.over > 0 ? `tràn ${m.over}px` : null);
      }
      if (o.errors.length) rec(need[0], `${tag} 0 lỗi trang`, o.errors[0]);
    } finally { await o.ctx.close(); }
  }
}

// ---------- tiêu chí 3: bất biến model chạy nguyên; inv-019 (cỡ nhân vật tối thiểu) được miễn vì bị thay có chủ ý ----------
async function crit3() {
  const dir = path.join(HQ, 'eval', 'invariants', 'hq', 'dashboard', 'model'); const exempt = (process.env.T090_EXEMPT || 'inv-019').split(',');
  const files = fs.readdirSync(dir).filter(f => /^inv-\d+.*\.sh$/.test(f) && !exempt.some(e => f.startsWith(e + '-'))).sort();
  const run = f => new Promise(res => { const p = cp.spawn('bash', [path.join(dir, f)], { env: { ...process.env, TOHONG_DASHBOARD_REPO: REPO, D3 }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; const to = setTimeout(() => { try { p.kill(); } catch (e) { } }, 280000); p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => { clearTimeout(to); res([f, code, out.trim().split('\n').slice(-1)[0] || '']); }); });
  const q = files.slice(), done = []; const work = async () => { while (q.length) { const f = q.shift(); done.push(await run(f)); } };
  await Promise.all([work(), work(), work(), work()]);
  done.sort((a, b) => a[0] < b[0] ? -1 : 1);
  for (const [f, code, last] of done) rec(3, f.replace(/\.sh$/, ''), code === 0 ? null : last.slice(0, 220));
  console.log(`ghi chú: miễn ${exempt.join(', ')} (cỡ tối thiểu cũ 62u mâu thuẫn trực tiếp với ý định; lời mới do Chief of Staff phân xử qua decisions/, xem spec mục "Bất biến đề xuất")`);
}


// ---------- tiêu chí 5 (v2): .page max-width 1400px; bố cục trang vẫn lành ở mọi cỡ ----------
async function crit5() {
  for (const w of [390, 844, 1280, 1440, 1920]) {
    const o = await open({ width: w, height: w >= 1440 ? 1000 : 900 }, 0);
    try {
      const m = await o.page.evaluate(() => { const pg = document.querySelector('.page'), pr = pg.getBoundingClientRect(), svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), bf = document.querySelector('#ban-do-luong svg');
        const outside = [...pg.children].filter(c => { const r = c.getBoundingClientRect(); return r.width && (r.left < pr.left - 1 || r.right > pr.right + 1); }).map(c => c.id || c.tagName.toLowerCase() + '.' + c.className);
        return { maxW: getComputedStyle(pg).maxWidth, pageW: pr.width, svgW: sr.width, over: document.documentElement.scrollWidth - innerWidth, outside, flow: bf ? bf.getBoundingClientRect().width : -1, flowBox: bf ? bf.parentNode.getBoundingClientRect().width : -1, mdlRight: sr.right - pr.right }; });
      const want = Math.min(w, PAGE_MAX);
      rec(5, `${w} A .page rộng ${want}px (max-width ${PAGE_MAX}px: ≥ 1440 dừng ở 1400, nhỏ hơn thì kín khung nhìn, không còn chặn 1200)`, m.maxW !== PAGE_MAX + 'px' ? `max-width tính ra ${m.maxW}` : (Math.abs(m.pageW - want) > 1 ? `.page rộng ${m.pageW.toFixed(0)}px, cần ${want}` : null));
      rec(5, `${w} B trang không cuộn ngang; mọi khối con của .page nằm trong .page`, m.over > 0 ? `tràn ${m.over}px` : (m.outside.length ? 'ra ngoài .page: ' + m.outside.join(', ') : null));
      rec(5, `${w} C #model svg rộng ≥ 90% .page ở > 480px (≥ 300px ở 390, T-028) và không tràn .page`, (w > 480 && m.svgW < 0.9 * m.pageW) || (w <= 480 && m.svgW < 300) || m.mdlRight > 1 ? `svg ${m.svgW.toFixed(0)}px trong .page ${m.pageW.toFixed(0)}px (lệch phải ${m.mdlRight.toFixed(0)}px)` : null);
      rec(5, `${w} D Bản đồ luồng vẫn vừa khung chứa`, m.flow < 0 ? 'mất Bản đồ luồng' : (m.flow > m.flowBox + 1 ? `svg ${m.flow.toFixed(0)}px > khung ${m.flowBox.toFixed(0)}px` : null));
      if (w >= 1280) { // phóng to: T-035 "svg ≥ 94% khung nhìn" giữ nguyên ở cỡ rộng
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(500);
        const z = await o.page.evaluate(() => ({ svgW: document.querySelector('#model svg').getBoundingClientRect().width, vw: innerWidth, mw: document.querySelector('#model').scrollWidth - document.querySelector('#model').clientWidth, over: document.documentElement.scrollWidth - innerWidth }));
        rec(5, `${w} E phóng to: svg ≥ 94% khung nhìn, không cuộn ngang trong #model và trang`, z.svgW < 0.94 * z.vw - 1 || z.mw > 1 || z.over > 0 ? `svg ${z.svgW.toFixed(0)}/${z.vw}px, cuộn ngang #model ${z.mw}px, trang ${z.over}px` : null); }
      if (o.errors.length) rec(5, `${w} 0 lỗi trang`, o.errors[0]);
    } finally { await o.ctx.close(); }
  }
}

// ---------- tiêu chí 4: ảnh trước/sau đã commit ở HEAD của repo dashboard ----------
function crit4() {
  const dir = 'docs/screenshots/T-090/'; let ls;
  try { ls = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '-r', 'HEAD', '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch (e) { rec(4, 'S0 đọc được git HEAD của repo', 'không đọc được git ls-tree'); return; }
  const files = Object.fromEntries(ls.map(l => { const [meta, f] = l.split('\t'); return [path.basename(f), meta.split(' ')[2]]; }));
  const miss = SHOT_NAMES.filter(n => !files[n + '.png']); rec(4, `S1 ${dir} đã commit ở HEAD đủ ${SHOT_NAMES.length} ảnh (${SHOT_NAMES.join(', ')})`, miss.length ? 'thiếu ' + miss.join(', ') : null);
  const have = SHOT_NAMES.filter(n => files[n + '.png']), shas = have.map(n => files[n + '.png']);
  rec(4, 'S2 mỗi ảnh khác nhau', shas.length && new Set(shas).size === shas.length ? null : (shas.length ? 'có ảnh trùng nội dung' : 'không có ảnh nào'));
  const buf = n => cp.execFileSync('git', ['-C', REPO, 'cat-file', 'blob', files[n + '.png']]);
  const small = have.filter(n => buf(n).length < 5000); rec(4, 'S3 ảnh không rỗng (≥ 5 KB mỗi ảnh)', small.length || !have.length ? (have.length ? 'ảnh quá nhỏ: ' + small.join(', ') : 'không có ảnh nào') : null);
  const bw = []; const dim = n => { const b = buf(n); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const n of have) { const [w] = dim(n); const want = /1280/.test(n) ? 1280 : 390; if (w !== want) bw.push(`${n} rộng ${w}px`); } rec(4, 'S4 ảnh rộng đúng 1280 / 390px', bw.join(', ') || null);
  const sh = [];
  for (const w of ['1280', '390']) if (files[`truoc-${w}.png`] && files[`sau-${w}.png`]) { const a = dim(`truoc-${w}`)[1], b = dim(`sau-${w}`)[1]; if (!(b < a)) sh.push(`sau-${w} cao ${b}px không thấp hơn truoc-${w} ${a}px`); }
  rec(4, 'S5 ảnh sau thấp hơn ảnh trước ở cả hai cỡ (bảng gọn hơn)', sh.join(', ') || null);
}

async function shots() {
  const dir = path.resolve(typeof SHOTS === 'string' ? SHOTS : path.join(REPO, 'docs', 'screenshots', 'T-090')); fs.mkdirSync(dir, { recursive: true });
  for (const [k, vp] of [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    const o = await open(vp, 0); try { const r = await o.page.evaluate(() => { const b = document.querySelector('#model').getBoundingClientRect(); return { y: b.top + scrollY, h: b.height }; });
      fs.writeFileSync(path.join(dir, `${LABEL}-${k}.png`), await o.page.screenshot({ fullPage: true, clip: { x: 0, y: Math.max(0, r.y), width: vp.width, height: r.h } })); console.log(`ảnh ${LABEL}-${k}.png`); } finally { await o.ctx.close(); } }
  console.log('PASS đã chụp ảnh vào ' + dir);
}

(async () => {
  const want = n => !ONLY || ONLY === n;
  try {
    browser = await PW.chromium.launch();
    if (SHOTS) { await shots(); await browser.close(); process.exit(0); }
    if (want(1) || want(2)) await crit1and2();
    if (want(5)) await crit5();
    await browser.close();
    if (want(3) && !NO_INV) await crit3();
    if (want(4)) crit4();
  } catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); process.exit(1); }
  const bad = results.filter(r => r[0] === 'FAIL');
  console.log(bad.length ? `FAIL ${bad.length}/${results.length} kiểm tra đỏ (tiêu chí ${[...new Set(bad.map(r => r[1]))].join(', ')})` : `PASS ${results.length}/${results.length}`);
  process.exit(bad.length ? 1 : 0);
})();
