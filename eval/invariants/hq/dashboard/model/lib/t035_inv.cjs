#!/usr/bin/env node
// Thư viện đo bất biến rút từ T-035 (spec products/T-035-bo-cuc-phong-to.md v2, qua Spec Gate 2026-11-01, spec-critic), vùng dashboard/model.
// Viết lại gọn từ gateViol / ovlText / pathHit / zoomState của eval/T-035/bo-cuc-phong-to.cjs; bản cố định, không phụ thuộc eval việc.
//   node t035_inv.cjs --repo <repo-dashboard> --check <dot-visible|no-text-cover|char-size|gate-on-top|zoom-safe>
// Chỉ đọc hợp đồng quan sát của spec: #model svg (viewBox rộng 1000), g.mch[data-block|data-state], [data-part=body], #fx_f circle, #fx_b .bub,
// path#p_*, hình chính khối (:scope > rect|circle), button#model-zoom, #model[data-zoom=on].
// Áp dụng: T-035 coi là đã vào khi trang có button#model-zoom HOẶC repo có docs/screenshots/T-035/ (hoặc T-036/, việc code của T-035).
// Chưa vào thì in PASS "chưa áp dụng" (main 55e8e57 còn dot ẩn, nhân vật 30u: không bắt việc khác chịu lỗi cũ). Đã có thư mục ảnh mà mất nút thì FAIL.
// Dữ liệu dashboard.json, kênh live (WebSocket) và d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const CHECKS = ['dot-visible', 'no-text-cover', 'char-size', 'gate-on-top', 'zoom-safe'];
if (!CHECKS.includes(CHECK)) { console.log('FAIL --check phải là một trong ' + CHECKS.join(', ')); process.exit(1); }
const SHOT_DIR = ['T-035', 'T-036'].some(t => fs.existsSync(path.join(REPO, 'docs', 'screenshots', t)));

const GATES = ['gt_spec', 'gt_code'];
const BODY_MIN_U = 29.7, BODY_MIN_PX = { 1280: 33, 390: 9 };  // ADR-033 (2026-11-07): hạ ngưỡng cho nhân vật 1/2 (T-090); trước: 62u, 68px/19px
const T = (id, state, owner) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: '2026-11-01T09:00', hours_since_update: 2, tier: 'A', area: 'dashboard/model', evals: 1, spec_returns: 0, evals_added: 0 });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const dash = tasks => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster,
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 1, last_insight: '', specs: 1 } });
const IDLE = () => dash([T('T-1', 'done', 'engineering'), T('T-2', 'done', 'product'), T('T-3', 'done', 'insight')]);
let n = 0;
const live = o => ({ type: 'event', id: 'E-' + (9800 + (++n)), t: '2026-11-01T12:00', round: 0, severity: '', cost: 0, title: '', ...o });
const EV = [
  { task: 'T-1', event: 'handoff', from: 'engineering', to: 'adversary', state: 'review', holder: 'adversary', owner: 'engineering' },
  { task: 'T-2', event: 'handoff', from: 'product', to: 'spec-critic', state: 'review', holder: 'spec-critic', owner: 'product' },
  { task: 'T-2', event: 'rejected', from: 'spec-critic', to: 'product', state: 'spec', holder: 'product', owner: 'product' },
  { task: 'T-1', event: 'rejected', from: 'adversary', to: 'engineering', state: 'rework', holder: 'engineering', owner: 'engineering', round: 1 },
  { task: 'T-1', event: 'escalated', from: 'adversary', to: 'capu', state: 'escalated', holder: 'capu', owner: 'engineering' },
  { task: 'T-2', event: 'accepted', from: 'spec-critic', to: 'engineering', state: 'done', holder: '-', owner: 'product' },
];

// Bộ đo trong trang (đơn vị SVG u = px / (svg.width / viewBox.width)).
const SAMPLER = `(() => { const W = window.__t5 = { rec: false, dots: 0, maxDot: 0, cv: {}, viol: {} };
  const GATES = ${JSON.stringify(GATES)};
  const R = e => e.getBoundingClientRect();
  const inter = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
  const svgEl = () => document.querySelector('#model svg');
  const sc = svg => R(svg).width / (svg.viewBox.baseVal.width || 1000);
  const shown = e => { let o = 1, x = e; while (x && x.nodeType === 1 && x.tagName.toLowerCase() !== 'svg') { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; o *= parseFloat(s.opacity); x = x.parentNode; }
    if (o <= 0.05) return false; const r = R(e); return r.width + r.height > 0; };
  const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.parentNode && e.parentNode.id ? '(trong #' + e.parentNode.id + ')' : '');
  W.gateViol = id => { const svg = svgEl(), g = svg && svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!body) return ['thiếu nhân vật ' + id];
    const b = R(body), out = [];
    for (const e of svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse,text,use,image')) {
      if (g.contains(e) || e.contains(g) || e.closest('defs,symbol,marker,clipPath,mask,.bub')) continue;
      if (!(g.compareDocumentPosition(e) & 4) || !shown(e)) continue; const x = inter(R(e), b); if (x.w > 0.5 && x.h > 0.5) out.push(desc(e)); }
    return out; };
  W.cover = () => { const svg = svgEl(); if (!svg) return []; const k = sc(svg), hits = [];
    const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.mch,.bub,defs')).map(t => [t, R(t)]).filter(([, r]) => r.width > 0);
    svg.querySelectorAll('g.mch').forEach(g => { const body = g.querySelector('[data-part="body"]'); if (!body) return; const b = R(body); if (!b.width) return;
      for (const [t, r] of texts) { const x = inter(r, b); if (x.w > 2 * k && x.h > 2 * k) hits.push(g.getAttribute('data-block') + '[' + g.getAttribute('data-state') + '] ↔ "' + t.textContent.trim().slice(0, 22) + '" ' + (x.w / k).toFixed(1) + '×' + (x.h / k).toFixed(1) + 'u'); } });
    return hits; };
  W.pathHit = id => { const svg = svgEl(), g = svg && svg.querySelector('g.mch[data-block="' + id + '"]'), body = g && g.querySelector('[data-part="body"]'); if (!body) return ['thiếu nhân vật ' + id];
    const k = sc(svg), b = R(body), pad = 2 * k, out = [];
    for (const p of svg.querySelectorAll('path')) { if (p.closest('.mch,.bub,defs,marker,symbol') || !(p.id || '').startsWith('p_')) continue; const m = p.getScreenCTM(); if (!m) continue; const L = p.getTotalLength();
      for (let t = 0; t <= L; t += 2) { const q = p.getPointAtLength(t), x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f; if (x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad) { out.push(p.id); break; } } }
    return out; };
  W.inRing = id => { const svg = svgEl(), blk = document.getElementById(id), s = blk && blk.querySelector(':scope > circle'), body = svg && svg.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]'); if (!s || !body) return 'thiếu cổng hoặc nhân vật ' + id;
    const k = sc(svg), c = R(s), b = R(body), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    return [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].some(([x, y]) => Math.hypot(x - cx, y - cy) > c.width / 2 - 2 * k) ? id + ': thân bot chạm/vượt viền cổng (cần cách ≥ 2u)' : null; };
  W.sizes = () => { const svg = svgEl(); if (!svg) return []; const k = sc(svg); return [...svg.querySelectorAll('g.mch')].map(g => { const b = g.querySelector('[data-part="body"]'); const r = b ? R(b) : { height: 0 }; return [g.getAttribute('data-block'), r.height / k, r.height]; }); };
  const tick = () => { if (W.rec && svgEl()) {
      const L = document.getElementById('fx_f'); let any = false; if (L) for (const c of L.querySelectorAll('circle')) if (shown(c)) { const w = R(c).width; if (w > 0) { any = true; W.maxDot = Math.max(W.maxDot, w); } }
      if (any) W.dots++;
      W.cover().forEach(x => { W.cv[x] = 1; });
      if (W.wantGate) for (const id of GATES) W.gateViol(id).forEach(x => { W.viol[id + ' ← ' + x] = 1; }); }
    requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

let browser;
async function open(vp, reduce) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: reduce ? 'reduce' : 'no-preference', colorScheme: 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, sock: null, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e)));
  await page.addInitScript(SAMPLER);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(IDLE()) }));
  await page.routeWebSocket(/\/ws$/, ws => { o.sock = ws; ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__mark = 1; });
  return o;
}
const VP = { 1280: { width: 1280, height: 900 }, 390: { width: 390, height: 844 } };
const send = (o, e) => o.sock.send(JSON.stringify(live(e)));
async function play(o, gap = 2300) { await o.page.evaluate(() => { window.__t5.rec = true; }); for (const e of EV) { send(o, e); await o.page.waitForTimeout(gap); } await o.page.waitForTimeout(1200);
  return o.page.evaluate(() => { const W = window.__t5; W.rec = false; return { dots: W.dots, maxDot: W.maxDot, cover: Object.keys(W.cv), viol: Object.keys(W.viol) }; }); }

async function main() {
  const errs = [];
  const probe = await open(VP[1280]); const hasBtn = await probe.page.evaluate(() => !!document.querySelector('button#model-zoom')); await probe.ctx.close();
  if (!hasBtn && !SHOT_DIR) return { na: true };
  if (!hasBtn && CHECK === 'zoom-safe') return { err: 'có docs/screenshots/T-035/ (T-035 đã vào) mà không còn button#model-zoom' };

  if (CHECK === 'dot-visible') {
    for (const w of [1280, 390]) { const o = await open(VP[w]);
      try { const disp = await o.page.evaluate(() => { const L = document.getElementById('fx_f'); return L ? getComputedStyle(L).display : 'thiếu #fx_f'; });
        const r = await play(o, 1600);
        if (disp === 'none' || disp === 'thiếu #fx_f') errs.push(`${w}px #fx_f display=${disp}`);
        else if (r.dots < 5 || r.maxDot < 7) errs.push(`${w}px dot hiện ở ${r.dots} khung, đường kính lớn nhất ${r.maxDot.toFixed(1)}px (cần ≥ 5 khung, ≥ 7px)`);
        if (o.errors.length) errs.push('lỗi trang: ' + o.errors[0]); } finally { await o.ctx.close(); } }
  }
  if (CHECK === 'no-text-cover') {
    for (const w of [1280, 390]) { const o = await open(VP[w]);
      try { const rest = await o.page.evaluate(() => window.__t5.cover()); const r = await play(o);
        const all = [...new Set(rest.concat(r.cover))]; if (all.length) errs.push(`${w}px thân bot che chữ: ${all.slice(0, 3).join(' | ')}`); } finally { await o.ctx.close(); } }
  }
  if (CHECK === 'char-size') {
    for (const w of [1280, 390]) { const o = await open(VP[w]);
      try { const s = await o.page.evaluate(() => window.__t5.sizes()); if (s.length < 11) errs.push(`${w}px chỉ có ${s.length}/11 nhân vật`);
        const bad = s.filter(([, u, px]) => u + 0.1 < BODY_MIN_U || px + 0.1 < BODY_MIN_PX[w]);
        if (bad.length) errs.push(`${w}px thân nhỏ: ${bad.slice(0, 4).map(([id, u, px]) => `${id} ${u.toFixed(1)}u/${px.toFixed(1)}px`).join(', ')}`); } finally { await o.ctx.close(); } }
  }
  if (CHECK === 'gate-on-top') {
    for (const w of [1280, 390]) { const o = await open(VP[w]);
      try {
        const st = await o.page.evaluate(G => { const W = window.__t5, out = [];
          for (const id of G) { W.gateViol(id).forEach(x => out.push(`${id} ← ${x} (lúc nghỉ)`)); W.pathHit(id).forEach(x => out.push(`${id}: đường ${x} đi qua thân bot`)); const ring = W.inRing(id); if (ring) out.push(ring);
            const svg = document.querySelector('#model svg'), body = svg.querySelector('g.mch[data-block="' + id + '"] [data-part="body"]'), L = document.getElementById('fx_f'); if (!body || !L) { out.push(id + ': thiếu thân bot hoặc #fx_f'); continue; }
            const b = body.getBoundingClientRect(), p = new DOMPoint(b.left + b.width / 2, b.top + b.height / 2).matrixTransform(svg.getScreenCTM().inverse());
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 4); L.appendChild(c);
            const prev = L.style.display; L.style.display = 'inline'; const v = W.gateViol(id); c.remove(); L.style.display = prev; if (v.length) out.push(`${id}: dot thử trong #fx_f vẽ đè thân bot`); }
          return out; }, GATES);
        await o.page.evaluate(() => { window.__t5.wantGate = true; }); const r = await play(o);
        const all = st.concat(r.viol.map(x => x + ' (khi chạy sự kiện)')); if (all.length) errs.push(`${w}px ${all.slice(0, 4).join(' | ')}`); } finally { await o.ctx.close(); } }
  }
  if (CHECK === 'zoom-safe') {
    for (const w of [1280, 390]) { const o = await open(VP[w]);
      try { const st = () => o.page.evaluate(() => { const m = document.querySelector('#model'), ids = [...document.querySelectorAll('#model [id]')].map(e => e.id);
          return { on: m.getAttribute('data-zoom') === 'on', over: document.documentElement.scrollWidth - innerWidth, sx: window.scrollX, svgN: document.querySelectorAll('#model svg').length, dup: ids.filter((x, i) => ids.indexOf(x) !== i).length, mark: window.__mark || 0, url: location.href }; });
        const s0 = await st();
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); let s = await st();
        if (!s.on) { errs.push(`${w}px bấm nút không vào phóng to`); continue; }
        if (s.over > 0 || s.sx !== 0) errs.push(`${w}px khi phóng to trang cuộn ngang (tràn ${s.over}px, scrollX ${s.sx})`);
        if (s.svgN !== 1 || s.dup) errs.push(`${w}px khi phóng to có ${s.svgN} svg, ${s.dup} id trùng`);
        await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(400); s = await st(); if (s.on) errs.push(`${w}px Esc không đóng phóng to`);
        await o.page.click('button#model-zoom'); await o.page.waitForTimeout(400); await o.page.goBack(); await o.page.waitForTimeout(600); s = await st().catch(() => null);
        if (!s) errs.push(`${w}px Back khi phóng to làm rời trang`); else if (s.on || s.mark !== 1 || s.url !== s0.url) errs.push(`${w}px Back khi phóng to: còn bật=${s.on}, tải lại=${s.mark !== 1}, đổi địa chỉ=${s.url !== s0.url}`);
        else if (s.svgN !== 1 || s.dup || s.over > 0) errs.push(`${w}px sau khi thoát còn ${s.svgN} svg, ${s.dup} id trùng, tràn ${s.over}px`);
        if (o.errors.length) errs.push('lỗi trang: ' + o.errors[0]); } finally { await o.ctx.close(); } }
  }
  return { err: errs.length ? errs.join(' || ') : null };
}

(async () => {
  browser = await chromium.launch(); let r;
  try { r = await main(); } catch (e) { r = { err: 'lỗi chạy: ' + (e && e.stack || e) }; }
  await browser.close();
  console.log(r.err ? `FAIL ${CHECK}: ${r.err}` : r.na ? `PASS ${CHECK} (chưa áp dụng: T-035 chưa vào, trang chưa có button#model-zoom)` : `PASS ${CHECK}`);
  process.exit(r.err ? 1 : 0);
})();
