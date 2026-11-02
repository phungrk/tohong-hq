#!/usr/bin/env node
// Thư viện đo bất biến rút từ T-039 (spec products/T-039-mui-ten-huong.md v2, qua Spec Gate 2026-11-02, spec-critic), vùng dashboard/model.
// Bản cố định, không phụ thuộc eval việc: KHÔNG dùng bảng khối đích hay tuyến đường của main; khối đích suy bằng hình học
// (khối có khoảng cách có dấu nhỏ nhất tới đầu mũi cuối), để đường p_* thêm sau này không cần sửa bất biến.
//   node t039_inv.cjs --repo <repo-dashboard> --check <end-arrow|mid-arrow|no-fragile>
// Hợp đồng quan sát: #model svg, path[id^=p_], phần tử mũi tên [data-part=ah][data-for=<id p_*>][data-at=end|mid] (path/polygon, không trong defs/marker),
// hình chính khối (g.node|g.gate|g.res > rect|circle), text, g.mch [data-part=body], #fx_f, button#model-zoom.
// Áp dụng khi index.html có dấu hiệu [data-part=ah] hoặc repo có docs/screenshots/T-039/; trước đó PASS "chưa áp dụng". Dữ liệu, WebSocket, d3 đều giả/cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), CHECK = arg('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3pkg/package/dist/d3.min.js'].find(p => p && fs.existsSync(p));
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)'); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js'); process.exit(1); }
const CHECKS = ['end-arrow', 'mid-arrow', 'no-fragile'];
if (!CHECKS.includes(CHECK)) { console.log('FAIL --check phải là một trong ' + CHECKS.join(', ')); process.exit(1); }

const CFG = { LEN: [5, 7], WID: [4, 7], GAP: [0.8, 3.5], ANG: 20, EXT: 8, LONG: 220, OVER: 0.5, ONPATH: 1.5 };
const DATA = { generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [], events: [], roster: [],
  model: { invariants: { 'dashboard/model': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } };

const MEASURE = cfg => {
  const svg = document.querySelector('#model svg'); if (!svg) return { none: true, probs: [['svg', 'không có #model svg']] };
  const sr = svg.getBoundingClientRect(), sc = sr.width / svg.viewBox.baseVal.width, inv = svg.getScreenCTM().inverse(), probs = [], P = m => probs.push(m);
  const toU = (x, y, ctm) => { const q = new DOMPoint(x, y).matrixTransform(ctm).matrixTransform(inv); return [q.x, q.y]; };
  const rectU = e => { const r = e.getBoundingClientRect(); return { l: (r.left - sr.left) / sc, t: (r.top - sr.top) / sc, r: (r.right - sr.left) / sc, b: (r.bottom - sr.top) / sc }; };
  const vis = e => { let o = 1, n = e; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (n === svg) break; n = n.parentNode; } return o; };
  const rgb = c => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.%]+))?/.exec(c || ''); if (!m) return null; const a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; };
  const blocks = [...svg.querySelectorAll('g.node, g.gate, g.res')].map(g => { const sh = g.querySelector(':scope > rect, :scope > circle'); if (!sh) return null;
    const ctm = sh.getScreenCTM(), a = n => parseFloat(sh.getAttribute(n)) || 0;
    if (sh.tagName === 'circle') { const c = toU(a('cx'), a('cy'), ctm); return { el: g, id: g.id || g.getAttribute('data-block') || '?', circle: true, cx: c[0], cy: c[1], r: a('r') }; }
    const p = toU(a('x'), a('y'), ctm); return { el: g, id: g.id || g.getAttribute('data-block') || '?', x: p[0], y: p[1], w: a('width'), h: a('height'), rx: Math.min(a('rx'), a('width') / 2, a('height') / 2) }; }).filter(Boolean);
  const sd = (b, x, y) => { if (b.circle) return Math.hypot(x - b.cx, y - b.cy) - b.r; const cx = b.x + b.w / 2, cy = b.y + b.h / 2, hx = b.w / 2 - b.rx, hy = b.h / 2 - b.rx;
    const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.rx; };
  const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.mch, #fx_b, #fx_s, #fx_f') && t.textContent.trim() && vis(t) > 0).map(t => ({ ...rectU(t), s: t.textContent.trim().slice(0, 24) })).filter(r => r.r > r.l);
  const bots = [...svg.querySelectorAll('g.mch [data-part=body]')].map(b => ({ ...rectU(b), s: 'bot ' + (b.closest('g.mch').getAttribute('data-block') || '') })).filter(r => r.r > r.l);
  const hull = pts => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const shapePts = el => { if (el.getTotalLength) { const L = el.getTotalLength(), ctm = el.getScreenCTM(), o = []; for (let i = 0; i < 120; i++) { const p = el.getPointAtLength(L * i / 120); o.push(toU(p.x, p.y, ctm)); } return o; }
    const ctm = el.getScreenCTM(); return [...el.points].map(p => toU(p.x, p.y, ctm)); };
  const geom = el => { const h = hull(shapePts(el)); if (h.length < 3) return null; let best = null;
    h.forEach((v, i) => { const a = h[(i + h.length - 1) % h.length], b = h[(i + 1) % h.length], u1 = [a[0] - v[0], a[1] - v[1]], u2 = [b[0] - v[0], b[1] - v[1]];
      const ang = Math.acos((u1[0] * u2[0] + u1[1] * u2[1]) / (Math.hypot(...u1) * Math.hypot(...u2) || 1)); if (!best || ang < best.ang) best = { ang, v }; });
    let A = 0, cx = 0, cy = 0; h.forEach((v, i) => { const w = h[(i + 1) % h.length], k = v[0] * w[1] - w[0] * v[1]; A += k; cx += (v[0] + w[0]) * k; cy += (v[1] + w[1]) * k; }); cx /= 3 * A; cy /= 3 * A;
    let ax = best.v[0] - cx, ay = best.v[1] - cy; const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
    const pr = h.map(q => (q[0] - cx) * ax + (q[1] - cy) * ay), pp = h.map(q => -(q[0] - cx) * ay + (q[1] - cy) * ax);
    return { hull: h, tip: best.v, c: [cx, cy], ax, ay, len: Math.max(...pr) - Math.min(...pr), wid: Math.max(...pp) - Math.min(...pp) }; };
  const overlapRect = (h, r) => { const R = [[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]], axes = [[1, 0], [0, 1]]; h.forEach((v, i) => { const w = h[(i + 1) % h.length], n = Math.hypot(w[0] - v[0], w[1] - v[1]) || 1; axes.push([-(w[1] - v[1]) / n, (w[0] - v[0]) / n]); });
    let m = Infinity; for (const [x, y] of axes) { const a = h.map(q => q[0] * x + q[1] * y), b = R.map(q => q[0] * x + q[1] * y); const ov = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)); if (ov < m) m = ov; } return m; };
  const dense = el => { const L = el.getTotalLength(), n = Math.max(2, Math.ceil(L)), ctm = el.getScreenCTM(), o = []; for (let i = 0; i <= n; i++) { const p = el.getPointAtLength(L * i / n); o.push(toU(p.x, p.y, ctm)); } return o; };
  const nearest = (pts, q) => { let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const tangent = (pts, i) => { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)], n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / n, (b[1] - a[1]) / n]; };
  const later = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const heads = [...svg.querySelectorAll('[data-part=ah]')], paths = [...svg.querySelectorAll('path[id^=p_]')], fxf = svg.querySelector('#fx_f');
  const out = { applies: heads.length > 0, sc, nPaths: paths.length, nEnd: 0, nMid: 0, nLong: 0, probs };
  // không phụ thuộc kỹ thuật dễ vỡ (INV-C)
  const ids = {}; document.querySelectorAll('[id]').forEach(e => { ids[e.id] = (ids[e.id] || 0) + 1; });
  out.dupIds = Object.keys(ids).filter(k => ids[k] > 1);
  out.ctx = []; document.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); if (/context-/.test(cs.fill + ' ' + cs.stroke)) out.ctx.push(e.tagName + (e.id ? '#' + e.id : '')); });
  out.markers = paths.filter(p => { const cs = getComputedStyle(p); return cs.markerStart !== 'none' || cs.markerMid !== 'none' || cs.markerEnd !== 'none'; }).map(p => p.id);
  out.inDefs = heads.filter(h => h.closest('defs, marker, symbol')).length;
  out.orphans = heads.filter(h => !paths.some(p => p.id === h.getAttribute('data-for'))).map(h => h.getAttribute('data-for'));
  for (const p of paths) {
    const id = p.id, L = p.getTotalLength(), pts = dense(p), mine = heads.filter(h => h.getAttribute('data-for') === id), stroke = rgb(getComputedStyle(p).stroke);
    const ext = pts.slice(); { const a = pts[Math.max(0, pts.length - 3)], b = pts[pts.length - 1], n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; for (let k = 1; k <= cfg.EXT; k++) ext.push([b[0] + (b[0] - a[0]) / n * k, b[1] + (b[1] - a[1]) / n * k]); }
    const ends = mine.filter(h => h.getAttribute('data-at') === 'end'), mids = mine.filter(h => h.getAttribute('data-at') === 'mid'), long = L >= cfg.LONG;
    out.nEnd += ends.length; out.nMid += mids.length; if (long) out.nLong++;
    if (ends.length !== 1) P(`END ${id}: có ${ends.length} mũi cuối (cần đúng 1)`);
    if (mids.length !== (long ? 1 : 0)) P(`MID ${id}: dài ${L.toFixed(0)}u, có ${mids.length} mũi giữa (cần ${long ? 1 : 0}; ngưỡng ${cfg.LONG}u)`);
    for (const h of mine) {
      const at = h.getAttribute('data-at'), tag = `${at === 'mid' ? 'MID' : 'END'} ${id}/${at}`, g = geom(h); if (!g) { P(`${tag}: không có hình`); continue; }
      const hs = getComputedStyle(h), fill = rgb(hs.fill), r = h.getBoundingClientRect();
      if (!(vis(h) >= 0.99) || r.width <= 0 || r.height <= 0) P(`${tag}: không nhìn thấy`);
      if (!fill || fill[3] < 0.99 || parseFloat(hs.fillOpacity) < 0.99) P(`${tag}: fill "${hs.fill}" không đặc`);
      if (fill && stroke && Math.abs(fill[0] - stroke[0]) + Math.abs(fill[1] - stroke[1]) + Math.abs(fill[2] - stroke[2]) > 12) P(`${tag}: màu mũi ${hs.fill} khác màu đường`);
      const lp = g.len * sc, wp = g.wid * sc;
      if (lp < cfg.LEN[0] - 0.01 || lp > cfg.LEN[1] + 0.01) P(`${tag}: dài ${lp.toFixed(1)}px (cần ${cfg.LEN[0]}-${cfg.LEN[1]}px)`);
      if (wp < cfg.WID[0] - 0.01 || wp > cfg.WID[1] + 0.01) P(`${tag}: rộng ${wp.toFixed(1)}px (cần ${cfg.WID[0]}-${cfg.WID[1]}px)`);
      const ref = at === 'end' ? g.tip : g.c, nn = nearest(at === 'end' ? ext : pts, ref);
      if (nn.d > cfg.ONPATH) P(`${tag}: cách đường ${nn.d.toFixed(1)}u`);
      const tg = tangent(ext, nn.i), cos = g.ax * tg[0] + g.ay * tg[1];
      if (cos < Math.cos(cfg.ANG * Math.PI / 180)) P(`${tag}: lệch ${(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(0)}° so với hướng đi (≤ ${cfg.ANG}°)`);
      if (fxf && !later(h, fxf)) P(`${tag}: nằm sau #fx_f trong DOM (dot phải chạy trên mũi)`);
      for (const t of texts) { const ov = overlapRect(g.hull, t); if (ov > cfg.OVER) { P(`${tag}: che chữ "${t.s}" (${ov.toFixed(1)}u)`); break; } }
      for (const t of bots) { const ov = overlapRect(g.hull, t); if (ov > cfg.OVER) { P(`${tag}: đè ${t.s} (${ov.toFixed(1)}u)`); break; } }
      if (at === 'end') {
        const ranked = blocks.map(b => [b, sd(b, g.tip[0], g.tip[1])]).sort((a, b) => a[1] - b[1]); if (!ranked.length) { P(`${tag}: không có khối nào`); continue; }
        const [tb, gap] = ranked[0];
        if (gap < cfg.GAP[0] || gap > cfg.GAP[1]) P(`${tag}: đầu mũi cách mép khối gần nhất ${tb.id} ${gap.toFixed(1)}u (cần ${cfg.GAP[0]}-${cfg.GAP[1]}u)`);
        if (!later(tb.el, h)) P(`${tag}: nằm trước khối đích ${tb.id} trong DOM (khối đè lên mũi)`);
        for (const b of blocks) { if (b === tb) continue; let m = Infinity; for (const q of g.hull) m = Math.min(m, sd(b, q[0], q[1])); if (m < -cfg.OVER) P(`${tag}: chồng vào khối ${b.id} ${(-m).toFixed(1)}u`); }
      } else {
        for (const b of blocks) if (sd(b, g.c[0], g.c[1]) < 0) { P(`${tag}: tâm nằm trong khối ${b.id}`); break; }
      }
    }
  }
  return out;
};

(async () => {
  const src = fs.readFileSync(INDEX, 'utf8');
  // Áp dụng khi mã có dấu hiệu mũi tên [data-part=ah] HOẶC repo có docs/screenshots/T-039/ (ảnh của việc T-039 đã vào). Đã áp dụng mà trang không vẽ mũi nào thì FAIL.
  const SHOT = fs.existsSync(path.join(REPO, 'docs', 'screenshots', 'T-039'));
  if (!SHOT && !/data-part=["']?ah\b|['"]data-part['"]\s*,\s*['"]ah['"]|dataset\.part\s*=\s*['"]ah['"]/.test(src)) { console.log('PASS chưa áp dụng (trang chưa có mũi tên [data-part=ah] của T-039)'); process.exit(0); }
  const browser = await chromium.launch(); const fails = []; let applied = false;
  const views = CHECK === 'no-fragile' ? [['1280', { width: 1280, height: 900 }, 0, 0]]
    : [['1280', { width: 1280, height: 900 }, 0, 0], ['390', { width: 390, height: 844 }, 0, 0], ['390-phong-to', { width: 390, height: 844 }, 1, 0], ['1280-toi', { width: 1280, height: 900 }, 0, 1], ['390-toi', { width: 390, height: 844 }, 0, 1]];
  try {
    for (const [name, vp, zoom, dark] of views) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' }); const page = await ctx.newPage();
      await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
      await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
      await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DATA) }));
      await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
      await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(1500);
      if (zoom) { const b = await page.$('#model-zoom'); if (!b) { fails.push(`${name}: không có nút #model-zoom`); await ctx.close(); continue; } await b.click(); await page.waitForTimeout(800); }
      const m = await page.evaluate(MEASURE, CFG); await ctx.close();
      if (!m.applies) { fails.push(`${name}: index.html có mũi tên nhưng trang không vẽ [data-part=ah] nào`); continue; }
      applied = true;
      if (CHECK === 'end-arrow') { fails.push(...m.probs.filter(p => p.startsWith('END')).map(p => `${name}: ${p}`)); if (!m.nPaths) fails.push(`${name}: không có đường p_*`); }
      if (CHECK === 'mid-arrow') { fails.push(...m.probs.filter(p => p.startsWith('MID')).map(p => `${name}: ${p}`)); }
      if (CHECK === 'no-fragile') {
        if (m.dupIds.length) fails.push(`id trùng: ${m.dupIds.join(', ')}`);
        if (m.ctx.length) fails.push(`fill/stroke tính ra context-*: ${m.ctx.slice(0, 5).join(', ')}`);
        if (m.markers.length) fails.push(`p_* còn dùng marker: ${m.markers.join(', ')}`);
        if (m.inDefs) fails.push(`${m.inDefs} mũi tên nằm trong defs/marker/symbol`);
        if (m.orphans.length) fails.push(`mũi tên mồ côi data-for: ${m.orphans.join(', ')}`);
        const n = (src.match(/context-(stroke|fill)/g) || []).length; if (n) fails.push(`index.html còn ${n} chỗ context-stroke/context-fill`);
      }
      console.log(`  ${name}: ${m.nPaths} đường, ${m.nEnd} mũi cuối, ${m.nMid} mũi giữa, ${m.nLong} đường dài`);
    }
  } finally { await browser.close(); }
  if (fails.length) { console.log(`FAIL ${CHECK}: ${fails.length} lỗi`); fails.slice(0, 25).forEach(f => console.log('  - ' + f)); process.exit(1); }
  console.log(`PASS ${CHECK}${applied ? '' : ' (chưa áp dụng)'}`); process.exit(0);
})().catch(e => { console.log('FAIL lỗi chạy: ' + (e && e.stack || e)); process.exit(1); });
