#!/usr/bin/env node
// Eval tầng 1 của T-047: đầu mũi tên ở mọi đường nối p_* của bảng Mô hình to 1,5 lần so với dfe8a20 (dài 5,10px -> 7,65px; rộng 4,15px -> 6,23px).
// Spec: products/T-047-mui-ten-to-1-5-lan.md. Bản dẫn xuất của eval/T-039/mui-ten-huong.cjs (KHÔNG sửa bản gốc; ADR đề xuất trong spec thay ngưỡng), khác bản gốc ở đúng các điểm sau:
//   1. cỡ mũi (LEN/WID) đổi từ 5-7 x 4-7px sang 1,5 x mốc dfe8a20 +-10%; thêm viewport 844;
//   2. nét còn thấy (1.9): hệ số hiển thị < 0,5 (390 không phóng to) chỉ cần >= 25% và >= 3px; các viewport khác giữ >= 50% và >= 7px;
//   3. tiêu chí 4 chạy bất biến từ eval/invariants/hq/dashboard/model/ (cây mới theo ADR-011), bỏ inv-029/030 (đang cứng 5-7px; thay bằng tiêu chí 1-2);
//   3b. thêm B5c (và trong M3 của tiêu chí 2): tỉ lệ dài/rộng 1,106-1,352 (giữ hình cũ, phóng đều);
//   4. tiêu chí 5: sáu ảnh docs/screenshots/T-047/{truoc,sau}-{1280,844,390}.png.
//
//   cd /home/user/tohong-hq && bash eval/T-047/run.sh <thư-mục-repo-dashboard> --task T-047 [--criterion N] [--engines chromium,webkit,firefox] [--require-engines] [--no-inv]
//   cd /home/user/tohong-hq && bash eval/T-047/run.sh <repo> --task T-047 --shots <thư-mục-ảnh> --label truoc|sau     (chụp ảnh trước/sau)
//
// In từng dòng `PASS Cn ...` / `FAIL Cn.<mã> <lý do>` / `SKIP <engine> <lý do>`, rồi một dòng cuối `PASS` hoặc `FAIL`; mã thoát 0/1.
//   --criterion N      : chỉ tiêu chí N (1..5). Không có thì chạy cả năm.
//   --engines a,b      : engine thử (mặc định chromium,webkit,firefox). Engine không khởi động được thì in SKIP, không bao giờ tính PASS.
//   --require-engines  : SKIP thành FAIL.
//   --no-inv           : tiêu chí 4 không chạy bất biến hq/dashboard/model (chạy lâu).
//   --task <T-xxx>     : bắt buộc cho tiêu chí 5 và --shots.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const PW = require('playwright');

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--criterion', '--shots', '--task', '--engines', '--label']);
const flag = n => { const i = args.indexOf(n); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const REPO = path.resolve(args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1])) || '.');
const ONLY = flag('--criterion') ? Number(String(flag('--criterion')).replace(/^C/i, '')) : null;
const SHOTS = flag('--shots'), LABEL = flag('--label');
const TASK = flag('--task') === true ? null : flag('--task');
const NO_INV = !!flag('--no-inv'), REQUIRE = !!flag('--require-engines');
const ENGINES = (typeof flag('--engines') === 'string' ? flag('--engines') : 'chromium,webkit,firefox').split(',').map(s => s.trim()).filter(Boolean);
const INDEX = path.join(REPO, 'index.html');
const HQ = path.resolve(__dirname, '..', '..');
const SP = '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad';
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js', SP + '/d3pkg/package/dist/d3.min.js', SP + '/d3.min.js'].find(p => p && fs.existsSync(p));
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt biến môi trường D3=/đường/dẫn/d3.min.js'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if ((ONLY === 5 || SHOTS) && !TASK) { console.log('FAIL cần tham số --task <T-xxx> (thư mục ảnh docs/screenshots/<task>/ không có mặc định)'); process.exit(1); }
if (SHOTS && !['truoc', 'sau'].includes(LABEL)) { console.log('FAIL --shots cần --label truoc|sau'); process.exit(1); }

// ---------- hằng số theo spec (mục 0 và 1) ----------
// MỐC HIỆN TẠI đóng cứng, đo bằng Playwright trên dashboard dfe8a20, mọi mũi (24 cuối + 6 giữa) ở 1280, 844, 390: dài 5,10px (5,10-5,11), rộng 4,15px (4,14-4,17); không phụ thuộc viewport.
const BASE_LEN = 5.10, BASE_WID = 4.15, SCALE = 1.5, TOL = 0.10;
const LEN_MIN = +(BASE_LEN * SCALE * (1 - TOL)).toFixed(3), LEN_MAX = +(BASE_LEN * SCALE * (1 + TOL)).toFixed(3);   // 6,885 .. 8,415px
const WID_MIN = +(BASE_WID * SCALE * (1 - TOL)).toFixed(3), WID_MAX = +(BASE_WID * SCALE * (1 + TOL)).toFixed(3);   // 5,603 .. 6,848px
const RATIO_BASE = BASE_LEN / BASE_WID, RATIO_MIN = +(RATIO_BASE * (1 - TOL)).toFixed(3), RATIO_MAX = +(RATIO_BASE * (1 + TOL)).toFixed(3);   // dài/rộng giữ hình cũ: 1,106 .. 1,352 (phóng đều)
const GAP_MIN = 0.8, GAP_MAX = 3.5;                            // u: khoảng từ đầu mũi tới đường viền hình học của khối đích
const LONG = 220;                                              // u: đường dài từ ngưỡng này có đúng một mũi giữa (đường ngắn nhất ≥ 220 là 268u, dài nhất < 220 là 176u)
const ANG = 20;                                                // độ: lệch cho phép giữa trục mũi tên và tiếp tuyến của đường
const MID_T = [0.25, 0.75], MID_END_MIN = 50, MID_START_MIN = 30;
const OVER = 0.5;                                              // u: dung sai chồng lấn
const VIS_FRAC = 0.5, VIS_PX = 7, VIS_FRAC_LOW = 0.25, VIS_PX_LOW = 3, LOW_SC = 0.5;   // sc < LOW_SC (390 không phóng to): >= 25% và >= 3px; còn lại >= 50% và >= 7px
//                                // nét còn thấy (nguồn -> gốc mũi cuối) ≥ 50% chiều dài đường trên main và ≥ 7px
const TRIM_MAX = 16, EXT_MAX = 8, LABEL_MOVE = 8;                                           // u: được rút ngắn cuối đường tối đa bao nhiêu để mũi không chui vào khối
const SHOT_NAMES = ['truoc-1280', 'sau-1280', 'truoc-844', 'sau-844', 'truoc-390', 'sau-390'];
const TARGET = { p_intent_spec: 'nd_spec', p_spec_gate: 'gt_spec', p_gate_exec: 'nd_exec', p_gate_respec: 'nd_respec', p_respec_spec: 'nd_spec', p_exec_gate: 'gt_code',
  p_gate_rework: 'nd_rework', p_rework_exec: 'nd_exec', p_gate_respec2: 'nd_respec', p_gate_capu: 'nd_capu', p_capu_exec: 'nd_exec', p_gate_kr: 'nd_kr', p_gate_kr2: 'nd_kr',
  p_kr_gate: 'gt_code', p_kr_spec: 'nd_spec', p_gate_rel: 'nd_rel', p_capu_res: 'nd_prod', p_rel_res: 'nd_prod', p_src1: 'nd_insight', p_src2: 'nd_insight', p_src3: 'nd_insight',
  p_res_insight: 'nd_insight', p_insight_intent: 'nd_intents', p_insight_kr: 'nd_kr' };
// tuyến đường trên main ab08fd4 (spec: không đổi tuyến; chỉ được rút cuối đường ≤ 16u, kéo dài ≤ 8u)
const ORACLE = {
  p_intent_spec: "M 165 172 L 208 172",
  p_spec_gate: "M 375 212 C 420 217 462 247 472 306",
  p_gate_exec: "M 538 303 C 556 242 570 202 608 192",
  p_gate_respec: "M 446 346 C 430 357 410 362 372 372",
  p_respec_spec: "M 290 328 L 290 274",
  p_exec_gate: "M 690 272 L 676 358",
  p_gate_rework: "M 720 375 C 740 342 790 312 850 274",
  p_rework_exec: "M 830 172 L 792 172",
  p_gate_respec2: "M 622 443 C 600 492 440 532 372 504",
  p_gate_capu: "M 741 409 L 793 410",
  p_capu_exec: "M 820 328 C 810 302 800 252 792 227",
  p_gate_kr: "M 453 388 C 430 432 425 492 420 560",
  p_gate_kr2: "M 636 466 C 620 532 590 552 547 587",
  p_kr_gate: "M 547 662 C 610 652 625 532 618 422",
  p_kr_spec: "M 205 652 C 170 632 175 412 212 264",
  p_gate_rel: "M 734 453 C 760 452 800 512 790 585",
  p_capu_res: "M 940 504 C 1000 572 990 692 884 722",
  p_rel_res: "M 770 627 L 770 670",
  p_src1: "M 55 992 L 55 944",
  p_src2: "M 95 1026 L 95 944",
  p_src3: "M 135 1060 L 135 944",
  p_res_insight: "M 650 802 C 500 832 330 862 177 862",
  p_insight_intent: "M 95 782 L 95 274",
  p_insight_kr: "M 175 802 C 215 792 240 777 252 740"
};
// nhãn đường `.lbl` trên main: chữ -> [x, y]; spec cho nhích tối đa 8u, không đổi chữ
const LABELS = {"DISCOVER & SPECIFY (+ EVAL)": [300.0, 24.0], "EXECUTE (AGENT)": [700.0, 24.0], "Spec Gate: agent critic · Code Gate: máy": [507.0, 44.0], "spec + eval → việc": [507.0, 162.0], "critic chặn": [408.0, 348.0], "spec đã sửa → viết lại": [298.0, 298.0], "code + eval": [670.0, 317.0], "code sai / thêm eval": [985.0, 306.0], "spec mâu thuẫn → spec rework": [432.0, 552.0], "bậc B, C": [768.0, 396.0], "spec đã duyệt": [414.0, 540.0], "→ lưu bất biến": [414.0, 553.0], "eval tầng 3": [598.0, 580.0], "eval hồi quy": [556.0, 677.0], "đọc bể": [168.0, 442.0], "bậc A, B: merge": [812.0, 532.0], "bậc C": [960.0, 622.0], "input": [187.0, 1044.0], "ống hồi: dữ liệu vận hành, sự cố": [410.0, 890.0], "báo cáo": [103.0, 512.0], "insight tuần": [103.0, 525.0], "eval hồi quy,": [186.0, 822.0], "insight → bể": [186.0, 835.0]};
const BACK = new Set(['p_gate_respec', 'p_respec_spec', 'p_gate_rework', 'p_rework_exec', 'p_gate_respec2', 'p_capu_exec', 'p_kr_spec']);

// ---------- trong trang: đo mọi thứ một lần, trả về danh sách lỗi + số đo ----------
// cfg = { LEN_MIN, ..., TARGET, ORACLE, BACK }. Mọi toạ độ trả về là đơn vị SVG (u) trừ khi ghi px.
const MEASURE = cfg => {
  const svg = document.querySelector('#model svg'); const sr = svg.getBoundingClientRect(); const sc = sr.width / svg.viewBox.baseVal.width;
  const inv = svg.getScreenCTM().inverse(); const probs = []; const P = (c, m) => probs.push([c, m]);
  const toU = (x, y, ctm) => { const q = new DOMPoint(x, y).matrixTransform(ctm).matrixTransform(inv); return [q.x, q.y]; };
  const rectU = e => { const r = e.getBoundingClientRect(); return { l: (r.left - sr.left) / sc, t: (r.top - sr.top) / sc, r: (r.right - sr.left) / sc, b: (r.bottom - sr.top) / sc }; };
  const vis = e => { let o = 1, n = e; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= parseFloat(s.opacity); if (n === svg) break; n = n.parentNode; } return o; };
  const rgb = c => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.%]+))?/.exec(c || ''); if (!m) return null; let a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return [+m[1], +m[2], +m[3], a]; };
  // hình chính của khối
  const blocks = [...svg.querySelectorAll('g.node, g.gate, g.res')].filter(g => g.id).map(g => { const sh = g.querySelector(':scope > rect, :scope > circle'); if (!sh) return null;
    const a = n => parseFloat(sh.getAttribute(n)) || 0; return sh.tagName === 'circle' ? { id: g.id, circle: true, cx: a('cx'), cy: a('cy'), r: a('r') } : { id: g.id, x: a('x'), y: a('y'), w: a('width'), h: a('height'), rx: a('rx') }; }).filter(Boolean);
  const sd = (b, x, y) => { if (b.circle) return Math.hypot(x - b.cx, y - b.cy) - b.r; const cx = b.x + b.w / 2, cy = b.y + b.h / 2, hx = b.w / 2 - b.rx, hy = b.h / 2 - b.rx;
    const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.rx; };
  const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.mch, #fx_b, #fx_s, #fx_f') && t.textContent.trim() && vis(t) > 0).map(t => ({ ...rectU(t), s: t.textContent.trim().slice(0, 24) })).filter(r => r.r > r.l);
  const bots = [...svg.querySelectorAll('g.mch [data-part=body]')].map(b => ({ ...rectU(b), s: 'bot ' + (b.closest('g.mch').getAttribute('data-block') || '') })).filter(r => r.r > r.l);
  // hình lồi của một phần tử (lấy mẫu đường viền) + trục
  const shapePts = (el, n = 120) => { const L = el.getTotalLength(), ctm = el.getScreenCTM(), o = []; for (let i = 0; i < n; i++) { const p = el.getPointAtLength(L * i / n); o.push(toU(p.x, p.y, ctm)); } return o; };
  const hull = pts => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const geom = el => { const h = hull(shapePts(el)); if (h.length < 3) return null; let best = null;
    h.forEach((v, i) => { const a = h[(i + h.length - 1) % h.length], b = h[(i + 1) % h.length], u1 = [a[0] - v[0], a[1] - v[1]], u2 = [b[0] - v[0], b[1] - v[1]];
      const ang = Math.acos((u1[0] * u2[0] + u1[1] * u2[1]) / (Math.hypot(...u1) * Math.hypot(...u2) || 1)); if (!best || ang < best.ang) best = { ang, v }; });
    let A = 0, cx = 0, cy = 0; h.forEach((v, i) => { const w = h[(i + 1) % h.length], k = v[0] * w[1] - w[0] * v[1]; A += k; cx += (v[0] + w[0]) * k; cy += (v[1] + w[1]) * k; }); cx /= 3 * A; cy /= 3 * A; let ax = best.v[0] - cx, ay = best.v[1] - cy; const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
    const pr = h.map(q => (q[0] - cx) * ax + (q[1] - cy) * ay), pp = h.map(q => -(q[0] - cx) * ay + (q[1] - cy) * ax);
    return { hull: h, tip: best.v, c: [cx, cy], ax, ay, len: Math.max(...pr) - Math.min(...pr), wid: Math.max(...pp) - Math.min(...pp) }; };
  // SAT: độ chồng lấn nhỏ nhất giữa hình lồi và hình chữ nhật (≤ 0 là không giao)
  const overlapRect = (h, r) => { const R = [[r.l, r.t], [r.r, r.t], [r.r, r.b], [r.l, r.b]]; const axes = [[1, 0], [0, 1]]; h.forEach((v, i) => { const w = h[(i + 1) % h.length]; const n = Math.hypot(w[0] - v[0], w[1] - v[1]) || 1; axes.push([-(w[1] - v[1]) / n, (w[0] - v[0]) / n]); });
    let m = Infinity; for (const [x, y] of axes) { const a = h.map(q => q[0] * x + q[1] * y), b = R.map(q => q[0] * x + q[1] * y); const ov = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)); if (ov < m) m = ov; } return m; };
  const dense = el => { const L = el.getTotalLength(), n = Math.max(2, Math.ceil(L)), ctm = el.getScreenCTM(), o = []; for (let i = 0; i <= n; i++) { const p = el.getPointAtLength(L * i / n); o.push(toU(p.x, p.y, ctm)); } return o; };
  const nearest = (pts, q) => { let bi = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const tangent = (pts, i) => { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)]; const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / n, (b[1] - a[1]) / n]; };
  const dMap = {}; document.querySelectorAll('[id]').forEach(e => { dMap[e.id] = (dMap[e.id] || 0) + 1; });
  const dups = Object.keys(dMap).filter(k => dMap[k] > 1); if (dups.length) P('C3.id', 'id trùng trong tài liệu: ' + dups.join(', '));
  const heads = [...svg.querySelectorAll('[data-part=ah]')], paths = [...svg.querySelectorAll('path[id^=p_]')];
  const fxf = svg.querySelector('#fx_f'), later = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const out = { sc, heads: [], nPaths: paths.length, nHeads: heads.length, longPaths: 0 };
  // oracle tuyến đường
  const tsvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); tsvg.setAttribute('style', 'position:absolute;left:0;top:0;width:10px;height:10px;visibility:hidden;pointer-events:none'); const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); tsvg.appendChild(tmp); document.body.appendChild(tsvg); const tmpLen = d => { tmp.setAttribute('d', d); return tmp.getTotalLength(); };
  for (const p of paths) {
    const id = p.id, L = p.getTotalLength(), pts = dense(p), mine = heads.filter(h => h.getAttribute('data-for') === id);
    const cs = getComputedStyle(p), strokeC = rgb(cs.stroke);
    if (cfg.ORACLE[id]) { tmp.setAttribute('d', cfg.ORACLE[id]); const oL = tmp.getTotalLength(); let worst = 0; const t0 = tmp.getScreenCTM(), p0 = p.getScreenCTM();
      for (let k = 0; k <= 20; k++) { const q = tmp.getPointAtLength(oL * 0.8 * k / 20); const qu = [q.x, q.y]; // oracle ở hệ toạ độ của chính svg (p_* không có transform trên main)
        const pu = pts; const d = nearest(pu, qu).d; if (d > worst) worst = d; }
      if (worst > 1) P('C4.route', `${id}: tuyến đường lệch ${worst.toFixed(1)}u so với main (không được đổi tuyến, chỉ được rút cuối đường ≤ ${cfg.TRIM_MAX}u)`);
      if (L < oL - cfg.TRIM_MAX - 1) P('C4.route', `${id}: đường ngắn đi ${(oL - L).toFixed(1)}u so với main (tối đa ${cfg.TRIM_MAX}u)`); }
    // marker không còn trên p_*
    if (cs.markerEnd !== 'none' || cs.markerMid !== 'none' || cs.markerStart !== 'none') P('C3.marker', `${id}: còn dùng marker (${cs.markerEnd}); mũi tên phải là phần tử vẽ thật data-part="ah"`);
    const ends = mine.filter(h => h.getAttribute('data-at') === 'end'), mids = mine.filter(h => h.getAttribute('data-at') === 'mid');
    const tb = blocks.find(b => b.id === (cfg.TARGET[id] || '')); const ext = pts.slice(); { const a = pts[pts.length - 3], b = pts[pts.length - 1], n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; for (let k = 1; k <= cfg.EXT_MAX; k++) ext.push([b[0] + (b[0] - a[0]) / n * k, b[1] + (b[1] - a[1]) / n * k]); } if (!tb) { P('C1.target', `${id}: không có khối đích ${cfg.TARGET[id]} trong trang`); continue; }
    if (ends.length !== 1) P('C1.count', `${id}: có ${ends.length} mũi cuối (cần đúng 1, data-for="${id}" data-at="end")`);
    const wantMid = L >= cfg.LONG ? 1 : 0; if (wantMid) out.longPaths++;
    if (mids.length !== wantMid) P('C2.count', `${id}: dài ${L.toFixed(0)}u, có ${mids.length} mũi giữa (cần ${wantMid}; ngưỡng ${cfg.LONG}u)`);
    // đường không được chui sâu vào khối đích
    let deep = 0; for (const q of pts) deep = Math.max(deep, -sd(tb, q[0], q[1])); if (deep > 0.5) P('C1.stub', `${id}: nét đường chui vào khối đích ${tb.id} sâu ${deep.toFixed(1)}u (đoạn thò vào khối phải rút bỏ)`);
    for (const h of mine) {
      const at = h.getAttribute('data-at'), tag = `${id}/${at}`; if (at !== 'end' && at !== 'mid') { P('C1.attr', `${tag}: data-at phải là end hoặc mid`); continue; }
      const o = vis(h), hs = getComputedStyle(h), r = h.getBoundingClientRect();
      const g = geom(h); if (!g) { P('C1.visible', `${tag}: không có hình (hull < 3 điểm)`); continue; }
      const fill = rgb(hs.fill), strk = rgb(hs.stroke);
      const rec = { id, at, cx: g.c[0], cy: g.c[1], tip: g.tip, lenPx: g.len * sc, widPx: g.wid * sc, fill: hs.fill, ax: g.ax, ay: g.ay, client: [r.left + r.width / 2, r.top + r.height / 2], gc: g.c, hull: g.hull };
      // nhìn thấy
      if (!(o >= 0.99) || r.width <= 0 || r.height <= 0) P('C1.visible', `${tag}: không nhìn thấy (độ đục ${o}, bbox ${r.width.toFixed(1)}x${r.height.toFixed(1)})`);
      if (!fill || fill[3] < 0.99 || parseFloat(hs.fillOpacity) < 0.99) P('C1.fill', `${tag}: fill = "${hs.fill}" (cần màu đặc, không trong suốt, không "none"/"context-*")`);
      if (/context/.test(hs.fill + hs.stroke + hs.markerEnd)) P('C3.context', `${tag}: dùng context-stroke/context-fill (Safari/iOS cũ không vẽ)`);
      if (hs.strokeDasharray !== 'none' && hs.strokeDasharray !== '' && parseFloat(hs.strokeWidth) > 0 && strk && strk[3] > 0) P('C1.solid', `${tag}: viền mũi tên có nét đứt (${hs.strokeDasharray}); mũi phải đặc`);
      if (strk && strk[3] > 0.05 && parseFloat(hs.strokeWidth) > 0 && fill && (Math.abs(strk[0] - fill[0]) + Math.abs(strk[1] - fill[1]) + Math.abs(strk[2] - fill[2])) > 12) P('C1.color', `${tag}: viền mũi tên khác màu fill`);
      if (fill && strokeC && (Math.abs(fill[0] - strokeC[0]) + Math.abs(fill[1] - strokeC[1]) + Math.abs(fill[2] - strokeC[2])) > 12) P('C1.color', `${tag}: màu mũi ${hs.fill} khác màu đường ${cs.stroke}`);
      if (h.closest('defs, marker, symbol')) P('C3.defs', `${tag}: mũi tên nằm trong defs/marker`);
      if (hs.pointerEvents !== 'none') P('C1.pe', `${tag}: pointer-events phải là none (không chặn bấm nhân vật), đang ${hs.pointerEvents}`);
      if (h.getAttribute('aria-hidden') !== 'true' && !h.closest('[aria-hidden=true]')) P('C1.aria', `${tag}: thiếu aria-hidden="true"`);
      if (document.getAnimations().some(a => a.effect && a.effect.target && (a.effect.target === h || h.contains(a.effect.target)))) P('C1.static', `${tag}: mũi tên có animation (phải đứng yên)`);
      // kích thước
      if (g.len * sc < cfg.LEN_MIN - 0.01 || g.len * sc > cfg.LEN_MAX + 0.01) P('C1.size', `${tag}: dài ${(g.len * sc).toFixed(1)}px (cần ${cfg.LEN_MIN}-${cfg.LEN_MAX}px)`);
      { const rt = g.len / g.wid; if (rt < cfg.RATIO_MIN - 0.005 || rt > cfg.RATIO_MAX + 0.005) P('C1.ratio', `${tag}: tỉ lệ dài/rộng ${rt.toFixed(2)} (${(g.len * sc).toFixed(1)}x${(g.wid * sc).toFixed(1)}px), cần ${cfg.RATIO_MIN}-${cfg.RATIO_MAX} (giữ hình cũ 1,23 +-10%)`); }
      if (g.wid * sc < cfg.WID_MIN - 0.01 || g.wid * sc > cfg.WID_MAX + 0.01) P('C1.size', `${tag}: rộng ${(g.wid * sc).toFixed(1)}px (cần ${cfg.WID_MIN}-${cfg.WID_MAX}px)`);
      // hướng và vị trí trên đường
      const ref = at === 'end' ? g.tip : g.c, nn = nearest(at === 'end' ? ext : pts, ref);
      if (nn.d > 1.5) P('C1.onpath', `${tag}: ${at === 'end' ? 'đầu mũi' : 'tâm mũi'} cách đường ${nn.d.toFixed(1)}u (≤ 1,5u)`);
      const tg = tangent(ext, nn.i), cos = g.ax * tg[0] + g.ay * tg[1];
      if (cos < Math.cos(cfg.ANG * Math.PI / 180)) P('C1.dir', `${tag}: mũi chỉ lệch ${(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(0)}° so với hướng đi của đường (≤ ${cfg.ANG}°; >90° là ngược chiều)`);
      rec.arc = Math.min(nn.i, pts.length - 1) / (pts.length - 1); rec.arcU = nn.i; rec.L = pts.length - 1;
      // paint order
      if (fxf && !later(h, fxf)) P('C4.order', `${tag}: mũi tên nằm SAU #fx_f trong DOM (dot phải chạy trên mũi tên)`);
      const tgtEl = document.getElementById(tb.id); if (!later(tgtEl, h)) P('C1.covered', `${tag}: mũi tên nằm TRƯỚC khối đích ${tb.id} trong DOM (khối đè lên mũi tên)`);
      const okAfter = e => e === h || e.closest('#fx_f, #fx_b, #fx_s') || e.getAttribute('data-part') === 'ah' || /^p_/.test(e.id) || e.closest('g.mch') || e.tagName === 'g' || e.tagName === 'defs';
      const hb = { l: Math.min(...g.hull.map(q => q[0])), r: Math.max(...g.hull.map(q => q[0])), t: Math.min(...g.hull.map(q => q[1])), b: Math.max(...g.hull.map(q => q[1])) };
      for (const e of svg.querySelectorAll('rect, circle, ellipse, text, image, use, polygon, path')) { if (okAfter(e) || !later(h, e) || vis(e) < 0.05) continue; const cs2 = getComputedStyle(e); if (cs2.fill === 'none' && (cs2.stroke === 'none' || !parseFloat(cs2.strokeWidth))) continue;
        const q = rectU(e); if (q.r > q.l && overlapRect(g.hull, q) > cfg.OVER) { P('C1.covered', `${tag}: bị <${e.tagName}${e.id ? ' #' + e.id : ''} class=${e.getAttribute('class')} ${(e.getAttribute('d') || '').slice(0, 30)}> vẽ sau và chồng lên (${(e.textContent || '').trim().slice(0, 20)})`); break; } }
      // chồng khối khác, chữ, bot
      for (const b of blocks) { const lim = (b.id === tb.id && at === 'end') ? cfg.GAP_MIN - 0.01 : 0; let minsd = Infinity; for (const q of g.hull) minsd = Math.min(minsd, sd(b, q[0], q[1])); if (minsd < -cfg.OVER) { P('C1.inblock', `${tag}: mũi tên chồng vào khối ${b.id} sâu ${(-minsd).toFixed(1)}u`); } }
      for (const t of texts) { const ov = overlapRect(g.hull, { l: t.l + 0, t: t.t + 0, r: t.r, b: t.b }); if (ov > cfg.OVER) { P('C4.text', `${tag}: che chữ "${t.s}" (chồng ${ov.toFixed(1)}u)`); break; } }
      for (const t of bots) { const ov = overlapRect(g.hull, t); if (ov > cfg.OVER) { P('C4.bot', `${tag}: đè ${t.s} (chồng ${ov.toFixed(1)}u)`); break; } }
      if (at === 'end') {
        const bx = g.tip[0] - g.ax * g.len, by = g.tip[1] - g.ay * g.len, bi = Math.min(nearest(ext, [bx, by]).i, pts.length - 1), oL = cfg.ORACLE[id] ? (tmpLen(cfg.ORACLE[id])) : L;
        rec.visU = bi; rec.visPx = bi * sc;
        const vf = sc < cfg.LOW_SC ? cfg.VIS_FRAC_LOW : cfg.VIS_FRAC, vpx = sc < cfg.LOW_SC ? cfg.VIS_PX_LOW : cfg.VIS_PX;
        if (bi < vf * oL - 0.01 || bi * sc < vpx - 0.01) P('C1.vstroke', `${tag}: nét còn thấy từ khối nguồn tới gốc mũi ${bi.toFixed(0)}u = ${(bi * sc).toFixed(1)}px = ${(100 * bi / oL).toFixed(0)}% chiều dài đường ${oL.toFixed(0)}u (cần ≥ ${vf * 100}% và ≥ ${vpx}px)`);
        const gap = sd(tb, g.tip[0], g.tip[1]); rec.gap = gap;
        if (gap < cfg.GAP_MIN || gap > cfg.GAP_MAX) P('C1.edge', `${tag}: đầu mũi cách mép khối đích ${tb.id} ${gap.toFixed(1)}u (cần ${cfg.GAP_MIN}-${cfg.GAP_MAX}u, dương = ở ngoài khối)`);
        // mũi không được chỉ vào khối khác: tia từ đầu mũi theo trục đi 6u phải còn gần khối đích hơn mọi khối khác
        const fx = g.tip[0] + g.ax * 6, fy = g.tip[1] + g.ay * 6; const other = blocks.filter(b => b.id !== tb.id).find(b => sd(b, fx, fy) < 0); if (other) P('C1.dir', `${tag}: mũi chỉ vào khối ${other.id}, không phải khối đích ${tb.id}`);
      } else {
        const fromEnd = (pts.length - 1) - nn.i, fromStart = nn.i;
        if (rec.arc < cfg.MID_T[0] - 0.01 || rec.arc > cfg.MID_T[1] + 0.01) P('C2.place', `${tag}: mũi giữa nằm ở ${(rec.arc * 100).toFixed(0)}% chiều dài (cần ${cfg.MID_T[0] * 100}-${cfg.MID_T[1] * 100}%)`);
        if (fromEnd < cfg.MID_END_MIN || fromStart < cfg.MID_START_MIN) P('C2.place', `${tag}: mũi giữa cách đầu mút ${fromStart.toFixed(0)}u / ${fromEnd.toFixed(0)}u (tối thiểu ${cfg.MID_START_MIN}u từ đầu, ${cfg.MID_END_MIN}u từ cuối)`);
        for (const b of blocks) if (sd(b, g.c[0], g.c[1]) < 0) { P('C2.place', `${tag}: tâm mũi giữa nằm trong khối ${b.id}`); break; }
      }
      out.heads.push(rec);
    }
    // hai mũi giữa/cuối không chồng nhau
  }
  tsvg.remove();
  const lbls = [...svg.querySelectorAll(':scope > text.lbl')]; const seen = new Set();
  for (const t of lbls) { const k = t.textContent.trim(), o0 = cfg.LABELS[k]; if (!o0) continue; seen.add(k); const m0 = t.getCTM(), x = (parseFloat(t.getAttribute('x')) || 0) + (m0 ? m0.e : 0), y = (parseFloat(t.getAttribute('y')) || 0) + (m0 ? m0.f : 0);
    const dx = Math.abs(x - o0[0]), dy = Math.abs(y - o0[1]); if (dx > cfg.LABEL_MOVE + 0.01 || dy > cfg.LABEL_MOVE + 0.01) P('C4.label', `nhãn "${k}" bị dời (${dx.toFixed(1)}u, ${dy.toFixed(1)}u) quá ${cfg.LABEL_MOVE}u`);
    if (dx > 0.5 || dy > 0.5) { const q = rectU(t), r0 = { l: q.l - (x - o0[0]), r: q.r - (x - o0[0]), t: q.t - (y - o0[1]), b: q.b - (y - o0[1]) };   // hộp bao ở vị trí main
      const hit = out.heads.find(h => overlapRect(h.hull, r0) > cfg.OVER); if (!hit) P('C4.label', `nhãn "${k}" bị dời (${dx.toFixed(1)}u, ${dy.toFixed(1)}u) nhưng ở vị trí cũ không mũi tên nào chạm nó (chỉ được nhích khi có va chạm)`); } }
  for (const k of Object.keys(cfg.LABELS)) if (!seen.has(k) && !/Spec Gate: agent critic/.test(k)) P('C4.label', `mất nhãn "${k}"`);
  for (const h of heads) if (!TARGET_OK(cfg.TARGET, h)) P('C1.count', `mũi tên mồ côi: data-for="${h.getAttribute('data-for')}" không phải đường p_* nào`);
  function TARGET_OK(T, h) { return !!T[h.getAttribute('data-for')] || !!svg.querySelector('path#' + CSS.escape(h.getAttribute('data-for') || '_')); }
  // hai mũi không chồng nhau
  for (let i = 0; i < out.heads.length; i++) for (let j = i + 1; j < out.heads.length; j++) { const a = out.heads[i], b = out.heads[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < 3 && a.id !== b.id) P('C1.dup', `mũi ${a.id}/${a.at} và ${b.id}/${b.at} chồng nhau`); }
  out.probs = probs; return out;
};

// ---------- trình duyệt ----------
const DATA = () => ({ generated_at: '2026-11-01T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks: [], events: [], roster: [], model: { invariants: { 'dashboard/model': 1 }, invariants_total: 48, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 0 } });
let browser, ENG; const results = []; const ALLERR = [];
const rec = (c, name, problem) => { results.push([problem ? 'FAIL' : 'PASS', c, name, problem || '', ENG]); console.log(problem ? `FAIL C${c}.${name} [${ENG}] ${problem}` : `PASS C${c} ${name} [${ENG}]`); };
async function open(opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: opt.reduce ? 'reduce' : 'no-preference', colorScheme: opt.dark ? 'dark' : 'light' });
  const page = await ctx.newPage(); const o = { ctx, page, errors: [] };
  page.on('pageerror', e => o.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') o.errors.push(m.text()); });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.g*apis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DATA()) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg'); await page.waitForTimeout(opt.settle || 1500);
  return o;
}
const close = async o => { ALLERR.push(...o.errors); await o.ctx.close(); };
const CFG = { RATIO_MIN, RATIO_MAX, VIS_FRAC_LOW, VIS_PX_LOW, LOW_SC, LEN_MIN, LEN_MAX, WID_MIN, WID_MAX, GAP_MIN, GAP_MAX, LONG, ANG, MID_T, MID_END_MIN, MID_START_MIN, OVER, VIS_FRAC, VIS_PX, TRIM_MAX, EXT_MAX, LABEL_MOVE, LABELS, TARGET, ORACLE };
const measure = o => o.page.evaluate(MEASURE, CFG);
// viewport cao bằng cả trang (không cuộn, không đổi bề rộng) rồi đo lại: toạ độ trang = toạ độ viewport
async function tall(o) { const vp = o.page.viewportSize(); const h = await o.page.evaluate(() => Math.ceil(document.documentElement.scrollHeight)); await o.page.setViewportSize({ width: vp.width, height: Math.min(h + 20, 12000) }); await o.page.waitForTimeout(700); await o.page.evaluate(() => window.scrollTo(0, 0)); return measure(o); }
const zoomOn = o => o.page.evaluate(() => document.querySelector('#model') && document.querySelector('#model').getAttribute('data-zoom') === 'on');
async function enterZoom(o) { await o.page.click('#model-zoom'); await o.page.waitForTimeout(600); return zoomOn(o); }
// giải mã ảnh bằng canvas ở một trang trắng, lấy màu tại các điểm
async function pixels(o, buf, pts) {
  const pg = await o.ctx.newPage(); try { await pg.goto('about:blank');
    return await pg.evaluate(async ([b64, pts]) => { const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = 'data:image/png;base64,' + b64; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      return pts.map(([px, py, wr, wg, wb]) => { const D = x.getImageData(Math.round(px) - 1, Math.round(py) - 1, 3, 3).data; let best = null, bd = 1e9; for (let i = 0; i < 9; i++) { const d = Math.abs(D[i * 4] - wr) + Math.abs(D[i * 4 + 1] - wg) + Math.abs(D[i * 4 + 2] - wb); if (d < bd) { bd = d; best = [D[i * 4], D[i * 4 + 1], D[i * 4 + 2], D[i * 4 + 3]]; } } return best; }); }, [buf.toString('base64'), pts]); } finally { await pg.close(); }
}
const rgbOf = s => { const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
const sumProbs = (probs, codes) => probs.filter(p => codes.some(c => p[0].startsWith(c)));
function reportProbs(c, label, m, groups) {   // groups: [[mã-tiền-tố, tên kiểm tra]]; mỗi nhóm một dòng PASS/FAIL. Không có mũi tên nào thì mọi nhóm đỏ (không PASS rỗng).
  const probs = m.probs;
  for (const [pre, name] of groups) { const ps = probs.filter(p => p[0].startsWith(pre)); if (!m.heads.length && !ps.length) { rec(c, `${name} (${label})`, 'không có mũi tên nào (data-part="ah") trong trang để kiểm'); continue; } rec(c, `${name} (${label})`, ps.length ? `${ps.length} lỗi: ` + ps.slice(0, 4).map(p => p[1]).join(' | ') + (ps.length > 4 ? ' | …' : '') : null); }
}

// ---------- tiêu chí 1: mũi cuối ----------
const VIEWS = [{ k: '1280', vp: { width: 1280, height: 900 } }, { k: '844', vp: { width: 844, height: 900 } }, { k: '390', vp: { width: 390, height: 844 } }, { k: '390-phong-to', vp: { width: 390, height: 844 }, zoom: true }];
async function viewData(v, dark) { const o = await open({ vp: v.vp, dark }); if (v.zoom && !(await enterZoom(o))) { await close(o); return { o: null, err: 'không vào được phóng to' }; } const m = await measure(o); return { o, m }; }
async function crit1() {
  for (const v of VIEWS) {
    const { o, m, err } = await viewData(v, false); if (err) { rec(1, 'V0 vào chế độ phóng to', err); continue; }
    try {
      rec(1, `A1 có đủ 24 đường p_* và mỗi đường có đúng một mũi cuối (${v.k})`, m.nPaths === 24 ? (sumProbs(m.probs, ['C1.count']).length ? sumProbs(m.probs, ['C1.count']).slice(0, 4).map(p => p[1]).join(' | ') : null) : `chỉ thấy ${m.nPaths} đường p_*`);
      reportProbs(1, v.k, m, [['C1.visible', 'B1 mũi nhìn thấy (bbox > 0, không ẩn)'], ['C1.fill', 'B2 fill đặc, không trong suốt, không none'], ['C1.solid', 'B3 đặc (không nét đứt)'], ['C1.color', 'B4 cùng màu đường'],
        ['C1.size', 'B5 kích thước 1,5 x mốc dfe8a20: dài 6,89-8,41px, rộng 5,60-6,85px'], ['C1.ratio', 'B5c tỉ lệ dài/rộng 1,106-1,352 (phóng đều, không đổi hình mũi)'], ['C1.vstroke', 'B5b nét còn thấy ≥ 50% đường và ≥ 7px (390 không phóng to: ≥ 25% và ≥ 3px)'], ['C1.dir', 'B6 đúng hướng, chỉ về khối đích'], ['C1.onpath', 'B7 đầu mũi nằm trên đường'], ['C1.edge', 'B8 đầu mũi sát mép khối đích (0,8-3,5u)'], ['C1.stub', 'B9 nét đường không chui vào khối đích'],
        ['C1.covered', 'B10 không bị phần tử nào vẽ đè'], ['C1.inblock', 'B11 mũi không chồng vào khối'], ['C1.pe', 'B12 pointer-events none'], ['C1.aria', 'B13 aria-hidden'], ['C1.static', 'B14 đứng yên'], ['C1.attr', 'B15 thuộc tính'], ['C1.dup', 'B16 không chồng nhau'], ['C1.target', 'B17 khối đích có trong trang']]);
      if (!v.zoom) { // pixel: tâm mũi đúng màu fill (chứng minh thật sự được vẽ, không bị khối/đường khác đè)
        const m2 = await tall(o);
        const ptsAll = await o.page.evaluate(() => [...document.querySelectorAll('#model svg [data-part=ah]')].map(h => { const r = h.getBoundingClientRect(); return { id: h.getAttribute('data-for') + '/' + h.getAttribute('data-at'), x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, fill: getComputedStyle(h).fill, gc: null }; }));
        // dùng tâm hình lồi thay vì tâm bbox (mũi nghiêng): đổi toạ độ u -> trang
        const cp = await o.page.evaluate(arr => { const svg = document.querySelector('#model svg'), m = svg.getScreenCTM(); return arr.map(([x, y]) => [m.a * x + m.e + scrollX, m.d * y + m.f + scrollY]); }, m2.heads.map(h => h.gc)).then(c => c.map((q, i) => [q[0], q[1], ...(rgbOf(m2.heads[i].fill) || [0, 0, 0])]));
        const buf = await o.page.screenshot(); const px = await pixels(o, buf, cp);
        const bad = []; m2.heads.forEach((h, i) => { const want = rgbOf(h.fill), got = px[i]; if (!want || !got || Math.abs(got[0] - want[0]) + Math.abs(got[1] - want[1]) + Math.abs(got[2] - want[2]) > 45) bad.push(`${h.id}/${h.at} thấy [${got && got.slice(0, 3)}] cần ${h.fill}`); });
        rec(1, `B18 điểm ảnh ở tâm mỗi mũi đúng màu mũi (thật sự được vẽ, không bị đè) (${v.k})`, bad.length ? `${bad.length}/${m2.heads.length}: ` + bad.slice(0, 3).join(' | ') : (m2.heads.length ? null : 'không có mũi nào để đo')); }
      rec(1, `Z console không lỗi (${v.k})`, o.errors.length ? o.errors.slice(0, 2).join(' | ') : null);
    } finally { await close(o).catch(() => { }); }
  }
  { // đổi cỡ cửa sổ và bật/tắt phóng to ngay trên một trang: kích thước tính lại, không tải lại
    const o = await open({ vp: { width: 1280, height: 900 } });
    try { const seq = [[{ width: 1280, height: 900 }, 0], [{ width: 390, height: 844 }, 0], [{ width: 390, height: 844 }, 1], [{ width: 1280, height: 900 }, 0]]; const bad = []; let z = false;
      for (const [vp, zoom] of seq) { if (zoom && !z) { if (!(await enterZoom(o))) { bad.push('không vào được phóng to'); continue; } z = true; } if (!zoom && z) { await o.page.keyboard.press('Escape'); await o.page.waitForTimeout(300); if (await zoomOn(o)) await o.page.click('#model-zoom'); await o.page.waitForTimeout(400); z = false; }
        await o.page.setViewportSize(vp); await o.page.waitForTimeout(700); const m = await measure(o); const sz = m.probs.filter(p => /^C1\.(size|ratio)$/.test(p[0])); if (sz.length || !m.heads.length) bad.push(`${vp.width}${zoom ? ' phóng to' : ''}: ${sz.length ? sz[0][1] : 'không có mũi nào'}`); }
      rec(1, 'D1 đổi cỡ cửa sổ 1280 -> 390 -> phóng to -> 1280 không tải lại: cỡ mũi tên luôn 1,5 x mốc (dài 6,89-8,41px, rộng 5,60-6,85px)', bad.length ? bad.slice(0, 3).join(' | ') : null); } finally { await close(o).catch(() => { }); }
  }
  { // chế độ tối: màu mũi theo token tối và khác màu sáng
    const L = await viewData(VIEWS[0], false), Dk = await viewData(VIEWS[0], true);
    try { const colL = {}, colD = {}; L.m.heads.forEach(h => colL[h.id + '/' + h.at] = h.fill); Dk.m.heads.forEach(h => colD[h.id + '/' + h.at] = h.fill);
      const bad = []; for (const k of Object.keys(colL)) { const id = k.split('/')[0]; if (colD[k] === undefined) bad.push(k + ' mất ở chế độ tối'); else if (colD[k] === colL[k]) bad.push(`${k} cùng màu ${colL[k]} ở sáng và tối (màu mũi phải theo token --axis/--warn)`); }
      const dk = Dk.m.probs.filter(p => p[0].startsWith('C1.') && !['C1.count'].includes(p[0])); if (dk.length) bad.push('chế độ tối: ' + dk[0][1]);
      rec(1, 'D2 chế độ tối: mọi mũi đổi màu theo token tối, vẫn đạt B1-B17', !Object.keys(colL).length ? 'không có mũi nào' : (bad.length ? `${bad.length}: ` + bad.slice(0, 3).join(' | ') : null));
      const m2 = await tall(Dk.o); const cp = await Dk.o.page.evaluate(arr => { const svg = document.querySelector('#model svg'), m = svg.getScreenCTM(); return arr.map(([x, y]) => [m.a * x + m.e + scrollX, m.d * y + m.f + scrollY]); }, m2.heads.map(h => h.gc)).then(c => c.map((q, i) => [q[0], q[1], ...(rgbOf(m2.heads[i].fill) || [0, 0, 0])]));
      const buf = await Dk.o.page.screenshot(); const px = await pixels(Dk.o, buf, cp); const bd = []; m2.heads.forEach((h, i) => { const want = rgbOf(h.fill), got = px[i]; if (!want || !got || Math.abs(got[0] - want[0]) + Math.abs(got[1] - want[1]) + Math.abs(got[2] - want[2]) > 45) bd.push(`${h.id}/${h.at} thấy [${got && got.slice(0, 3)}] cần ${h.fill}`); });
      rec(1, 'D3 chế độ tối: điểm ảnh ở tâm mỗi mũi đúng màu mũi', bd.length ? `${bd.length}: ` + bd.slice(0, 3).join(' | ') : (m2.heads.length ? null : 'không có mũi nào')); } finally { if (L.o) await close(L.o).catch(() => { }); if (Dk.o) await close(Dk.o).catch(() => { }); }
  }
}

// ---------- tiêu chí 2: mũi giữa đường dài ----------
async function crit2() {
  for (const v of VIEWS) {
    const { o, m, err } = await viewData(v, false); if (err) { rec(2, 'V0 vào chế độ phóng to', err); continue; }
    try { rec(2, `M0 có ${m.longPaths} đường dài ≥ ${LONG}u (cần đúng 6: p_gate_respec2, p_kr_gate, p_kr_spec, p_capu_res, p_res_insight, p_insight_intent) (${v.k})`, m.longPaths === 6 ? null : `đo được ${m.longPaths}`);
      reportProbs(2, v.k, m, [['C2.count', 'M1 đường ≥ 220u có đúng một mũi giữa, đường ngắn hơn không có'], ['C2.place', 'M2 mũi giữa nằm 25-75% chiều dài, cách đầu ≥ 30u, cách cuối ≥ 50u, ngoài khối']]);
      const mids = m.heads.filter(h => h.at === 'mid'), probs = m.probs.filter(p => /^C(1|4)\.(size|ratio|dir|onpath|fill|covered|text|bot|visible)/.test(p[0]) && /\/mid/.test(p[1]));
      rec(2, `M3 mũi giữa cùng chuẩn với mũi cuối: nhìn thấy, đúng hướng, 1,5 x mốc kể cả tỉ lệ dài/rộng, không đè, không che chữ/bot (${v.k})`, probs.length ? probs.slice(0, 3).map(p => p[1]).join(' | ') : (mids.length ? null : 'không có mũi giữa nào')); } finally { await close(o).catch(() => { }); }
  }
}

// ---------- tiêu chí 3: không phụ thuộc context-stroke / marker; tài liệu sạch ----------
async function crit3() {
  const o = await open({}); try { const m = await measure(o);
    reportProbs(3, '1280', m, [['C3.context', 'X1 không dùng context-stroke/context-fill'], ['C3.marker', 'X2 p_* không dùng marker (mũi tên là phần tử vẽ thật)'], ['C3.defs', 'X3 mũi tên không nằm trong defs/marker'], ['C3.id', 'X4 không có id trùng trong tài liệu']]);
    const bad = await o.page.evaluate(() => { const r = []; document.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); for (const k of ['fill', 'stroke']) if (/context-/.test(cs[k])) r.push(e.tagName + (e.id ? '#' + e.id : '')); }); return r.slice(0, 5); });
    rec(3, 'X5 không phần tử nào trong trang có fill/stroke tính ra "context-*"', bad.length ? bad.join(', ') : null);
    const srcBad = (fs.readFileSync(INDEX, 'utf8').match(/context-(stroke|fill)/g) || []).length; rec(3, 'X6 index.html không còn chuỗi context-stroke / context-fill', srcBad ? `còn ${srcBad} chỗ` : null);
    rec(3, 'X7 các engine đã chạy: ' + RAN.join(', '), RAN.length ? null : 'không engine nào chạy được');
  } finally { await close(o).catch(() => { }); }
}

// ---------- tiêu chí 4: không phá bất biến, không che chữ, tuyến không đổi, dot trên mũi ----------
function runShell(cmd, argv, env, timeout) { return new Promise(res => { const p = cp.spawn(cmd, argv, { env: { ...process.env, ...env } }); let out = ''; const t = setTimeout(() => p.kill('SIGKILL'), timeout);
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('close', code => { clearTimeout(t); res({ code, out }); }); }); }
async function pool(jobs, n) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; res[j] = await jobs[j](); } })); return res; }
async function crit4() {
  for (const v of VIEWS) {
    const { o, m, err } = await viewData(v, false); if (err) { rec(4, 'V0 vào chế độ phóng to', err); continue; }
    try { reportProbs(4, v.k, m, [['C4.text', 'K1 mũi tên không che chữ nào'], ['C4.bot', 'K2 mũi tên không đè thân bot (inv-020)'], ['C4.order', 'K3 mũi tên nằm dưới dot (#fx_f)'], ['C4.route', 'K4 không đổi tuyến đường (chỉ rút cuối ≤ 16u)'], ['C4.label', 'K8 nhãn đường còn đủ, chỉ nhích ≤ 8u và chỉ khi mũi tên chạm ở vị trí cũ']]);
      rec(4, `K5 không cuộn ngang ở ${v.vp.width}px`, await o.page.evaluate(() => (document.documentElement.scrollWidth <= innerWidth + 1) ? null : `scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`));
      rec(4, `K6 console không lỗi (${v.k})`, o.errors.length ? o.errors.slice(0, 2).join(' | ') : null); } finally { await close(o).catch(() => { }); }
  }
  { // reduced-motion: mũi tên vẫn có, đứng yên
    const o = await open({ reduce: true }); try { const m = await measure(o); rec(4, 'K7 reduced-motion: mũi tên vẫn hiện đủ (24 mũi cuối + 6 mũi giữa)', m.heads.length === 30 ? null : `thấy ${m.heads.length} mũi`); } finally { await close(o).catch(() => { }); }
  }
  if (ENG === 'chromium' && !NO_INV) {
    const invDir = path.join(HQ, 'eval', 'invariants', 'hq', 'dashboard', 'model'); const invs = fs.readdirSync(invDir).filter(f => /^inv-\d+.*\.sh$/.test(f) && !/^inv-0(29|30)-/.test(f)).sort();   // inv-029/030 cứng 5-7px: thay bằng tiêu chí 1-2 cho tới khi ADR thay ngưỡng được áp vào bất biến
    rec(4, `V0 bất biến vùng hq/dashboard/model có đủ (trừ inv-029/030) (${invs.length} file, cần >= 29)`, invs.length >= 29 ? null : `chỉ ${invs.length} file`);
    const rs = await pool(invs.map(f => () => runShell('bash', [path.join(invDir, f)], { TOHONG_DASHBOARD_REPO: REPO }, 400000).then(r => ({ f, ...r }))), 2);
    for (const r of rs) { const last = r.out.trim().split('\n').filter(l => /^(PASS|FAIL)/.test(l)).slice(-3).join(' / ') || r.out.trim().split('\n').slice(-2).join(' / '); rec(4, `V ${r.f}`, r.code === 0 ? null : `thoát ${r.code}: ${last.slice(0, 300)}`); }
  } else if (ENG !== 'chromium') console.log(`ghi chú: bất biến inv-001..028 chỉ chạy trên chromium (chúng tự khởi động chromium)`);
}

// ---------- tiêu chí 5: ảnh trước/sau đã commit ----------
function crit5() {
  const dir = `docs/screenshots/${TASK}/`; let ls;
  try { ls = cp.execFileSync('git', ['-C', REPO, 'ls-tree', '-r', 'HEAD', '--', dir], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch (e) { rec(5, 'S0 đọc được git HEAD của repo', 'không đọc được git ls-tree'); return; }
  const files = Object.fromEntries(ls.map(l => { const [meta, f] = l.split('\t'); return [path.basename(f), meta.split(' ')[2]]; }));
  const miss = SHOT_NAMES.filter(n => !files[n + '.png']); rec(5, `S1 ${dir} đã commit ở HEAD đủ ${SHOT_NAMES.length} ảnh (${SHOT_NAMES.join(', ')})`, miss.length ? 'thiếu ' + miss.join(', ') : null);
  const have = SHOT_NAMES.filter(n => files[n + '.png']); const shas = have.map(n => files[n + '.png']);
  rec(5, 'S2 mỗi ảnh khác nhau (ảnh trước khác ảnh sau, không chụp trùng)', shas.length && new Set(shas).size === shas.length ? null : (shas.length ? 'có ảnh trùng nội dung' : 'không có ảnh nào'));
  const small = have.filter(n => Number(cp.execFileSync('git', ['-C', REPO, 'cat-file', '-s', files[n + '.png']], { encoding: 'utf8' })) < 5000); rec(5, 'S3 ảnh không rỗng (≥ 5 KB mỗi ảnh)', small.length || !have.length ? (have.length ? 'ảnh quá nhỏ: ' + small.join(', ') : 'không có ảnh nào') : null);
  for (const n of have) { const buf = cp.execFileSync('git', ['-C', REPO, 'cat-file', 'blob', files[n + '.png']]); const w = buf.readUInt32BE(16); const want = /1280/.test(n) ? 1280 : /844/.test(n) ? 844 : 390; rec(5, `S4 ${n}.png rộng đúng ${want}px`, w === want ? null : `rộng ${w}px`); }
}

// ---------- chụp ảnh trước/sau ----------
async function shots() {
  const dir = path.resolve(typeof SHOTS === 'string' ? SHOTS : path.join(REPO, 'docs', 'screenshots', TASK)); fs.mkdirSync(dir, { recursive: true });
  for (const [k, vp] of [['1280', { width: 1280, height: 900 }], ['844', { width: 844, height: 900 }], ['390', { width: 390, height: 844 }]]) {
    const o = await open({ vp }); try { const r = await o.page.evaluate(() => { const e = document.querySelector('#model'); const b = e.getBoundingClientRect(); return { y: b.top + scrollY, h: b.height }; });
      const buf = await o.page.screenshot({ fullPage: true, clip: { x: 0, y: Math.max(0, r.y), width: vp.width, height: r.h } }); fs.writeFileSync(path.join(dir, `${LABEL}-${k}.png`), buf); console.log(`ảnh ${LABEL}-${k}.png`); } finally { await close(o).catch(() => { }); }
  }
  console.log('PASS đã chụp ảnh vào ' + dir);
}

let RAN = [];
(async () => {
  const want = n => !ONLY || ONLY === n; const skipped = [];
  if (SHOTS) { try { browser = await PW.chromium.launch(); ENG = 'chromium'; await shots(); await browser.close(); process.exit(0); } catch (e) { console.log('FAIL không chụp được ảnh: ' + (e && e.message || e)); process.exit(1); } }
  for (const eng of ENGINES) {
    if (!PW[eng]) { console.log(`SKIP ${eng} không phải engine của Playwright`); skipped.push(eng); continue; }
    try { browser = await PW[eng].launch(); } catch (e) { console.log(`SKIP ${eng} không khởi động được: ${String(e.message).split('\n')[0].slice(0, 160)}`); skipped.push(eng); continue; }
    ENG = eng; RAN.push(eng); console.log(`== engine ${eng} ${browser.version()}`);
    try { if (want(1)) await crit1(); if (want(2)) await crit2(); if (want(3)) await crit3(); if (want(4)) await crit4(); }
    catch (e) { console.log('FAIL lỗi chạy eval: ' + (e && e.stack || e)); await browser.close(); process.exit(1); }
    await browser.close();
  }
  if (want(5)) { ENG = '-'; crit5(); }
  const bad = results.filter(r => r[0] === 'FAIL'); const sk = skipped.length ? `; CHƯA KIỂM trên ${skipped.join(', ')} (SKIP, không phải PASS)` : '';
  if (!RAN.length && !(ONLY === 5)) { console.log('FAIL không engine nào chạy được' + sk); process.exit(1); }
  if (REQUIRE && skipped.length) { console.log(`FAIL --require-engines: ${skipped.join(', ')} không chạy được`); process.exit(1); }
  console.log(bad.length ? `FAIL ${bad.length}/${results.length} kiểm tra đỏ (tiêu chí ${[...new Set(bad.map(r => r[1]))].join(', ')})${sk}` : `PASS ${results.length}/${results.length} (đã chạy: ${RAN.join(', ') || '-'})${sk}`);
  process.exit(bad.length ? 1 : 0);
})();
