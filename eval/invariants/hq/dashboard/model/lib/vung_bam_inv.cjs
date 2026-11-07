#!/usr/bin/env node
// Thư viện bất biến vùng bấm nhân vật (rút từ eval đối kháng T-095 adv-01/05/06, adversary 2026-11-07; ADR-034). Bản gốc: eval/T-095/lib/adv_bam_so.cjs.
//   node adv_bam_so.cjs --repo <repo-dashboard> --check <tap-count|capu-caption|labels|routes>
// tap-count (adv-01): ở 360, 375, 390 (thường), 390 phóng to, 844, 1280: vùng bấm nhân vật (g.mch, tối thiểu 44px, T-037) không phủ TÂM số đếm của khối
//   (tâm hộp chữ .n và tâm phần mực của chữ số); bấm tâm số khối Capu mở #capu-modal với số dòng [data-capu-row] = số trên khối (INV-006 mở rộng
//   xuống 360/375, cỡ iPhone SE/mini). Font thật Be Vietnam Pro. Dữ liệu 0/0/0 và 12/34/56 (leo thang / chờ quyết-chặn / diff).
// capu-caption (adv-02): chú thích nd_capu với số hai chữ số (12/34/56, 99/99/99) và font thật: đủ ba nhóm số + nhãn, cỡ .cap ≥ 10,5, mọi chữ khối
//   Capu trọn trong rect (0,5u), thân nhân vật không đè chữ quá 2u; 1280/1440/1920/844/390 và phóng to 390/1280/1440.
// labels (adv-03): mọi nhãn .lbl ngoài khối (gồm "eval tầng 3") không đè chữ khác, hình khối, thân nhân vật (>0,5u), trừ hai dòng của cùng một nhãn;
//   ở 8 viewport T-090 với font thật.
// routes (adv-04): mỗi đường p_* bắt đầu ở khối nguồn và kết thúc ở khối đích theo tên tuyến (|khoảng cách tới hình| ≤ 8u, hình học viewBox).
// hit-other-block (adv-05): ở 320, 360, 375, 390 (thường) và 360, 390 (phóng to): vùng bấm của nhân vật (g.mch, T-037) không nằm trên hình chính hay chữ
//   của KHỐI KHÁC (g.node, g.gate, g.res có id): bấm vào khối phía trên/dưới không được mở tóm tắt của nhân vật khối khác. Đo bằng elementFromPoint ở
//   tâm và hai đầu mỗi chữ khối, và ở mép trên/dưới (3%, 97%) của hình chính mỗi khối. Bấm tâm thân mỗi nhân vật vẫn mở tóm tắt của chính nó.
// first-load (adv-06, ADR-034): tải trang một lần ở khung hẹp, KHÔNG phát sự kiện resize nhân tạo (điện thoại thật không đổi cỡ sau khi tải):
//   320, 340, 355 (< 360) và 360, 375: tâm số đếm khối không nằm dưới vùng bấm nhân vật của khối mình, vùng bấm không lấn khối khác, bấm tâm số
//   Capu mở #capu-modal; vùng bấm rộng ≥ 44px, cao ≥ 44px (≥ 360) hoặc ≥ 36px (< 360). Chạy cả font nạp ngay và font nạp muộn 2,5s.
// Dữ liệu dashboard.json, kênh live, d3, font đều cục bộ. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
const REPO = path.resolve(arg('--repo') || '.'), INDEX = path.join(REPO, 'index.html'), CHECK = arg('--check');
const FONT = path.join(__dirname, 'BeVietnamPro-Regular.ttf');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js',
  '/tmp/claude-0/-home-user/86243faa-8dbf-5631-b32b-051ad4d92b1e/scratchpad/d3.min.js'].find(p => p && fs.existsSync(p));
if (!['tap-count', 'capu-caption', 'labels', 'routes', 'hit-other-block', 'first-load'].includes(CHECK)) { console.log('FAIL --check sai'); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.log('FAIL không thấy index.html trong ' + REPO); process.exit(1); }
if (!D3) { console.log('FAIL thiếu d3.min.js cục bộ: đặt D3'); process.exit(1); }
if (!fs.existsSync(FONT)) { console.log('FAIL thiếu font ' + FONT); process.exit(1); }

const T = (id, state, owner, extra) => ({ id, title: 'Việc ' + id, state, holder: owner, owner, reviewer: 'adversary', rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-11-07T09:00', updated: '2026-11-07T09:00', hours_since_update: 2, tier: 'B', area: 'hq/dashboard/model', evals: 1, spec_returns: 0, evals_added: 0, ...(extra || {}) });
const roster = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary'].map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
function data(a, d, b) {
  const tasks = []; let k = 100; const add = (n, st, own, ex) => { for (let i = 0; i < n; i++) tasks.push(T('T-' + (k++), st, own, ex)); };
  add(a, 'escalated', 'engineering'); add(d, 'blocked', 'engineering'); add(b, 'done', 'engineering', { tier: 'B' });
  add(3, 'doing', 'product'); add(4, 'doing', 'engineering'); add(2, 'rework', 'engineering', { evals_added: 5 }); add(3, 'review', 'engineering');
  const queue = tasks.filter(t => t.state === 'blocked').map(t => ({ task: t.id, kind: 'blocked', decide_by: '', links: [] }))
    .concat(tasks.filter(t => t.state === 'done' && t.owner === 'engineering').map(t => ({ task: t.id, kind: 'diff-b', decide_by: '', links: [] })));
  return { generated_at: '2026-11-07T11:00', timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events: [], roster, capu_queue: queue,
    model: { invariants: { _shared: 2, 'hq/dashboard/model': 33, 'hq/dashboard': 14 }, invariants_total: 49, adversarial_evals: 48, regression_evals: 12, insight_reports: 9, last_insight: '', specs: 90 } };
}
const CSS = ['400', '500', '600'].map(w => `@font-face{font-family:'Be Vietnam Pro';font-weight:${w};src:url(https://fonts.gstatic.com/bvp.ttf) format('truetype')}`).join('');
const UFN = () => { window.__U = e => { const svg = document.querySelector('#model svg'), sr = svg.getBoundingClientRect(), k = sr.width / 1000, r = e.getBoundingClientRect();
  return { l: (r.left - sr.left) / k, t: (r.top - sr.top) / k, r: (r.right - sr.left) / k, b: (r.bottom - sr.top) / k }; }; };
async function open(browser, vp, zoom, d, opt = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('lỗi JS ' + String(e).slice(0, 80))); await page.addInitScript(UFN);
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: CSS }));
  await page.route('**/fonts.gstatic.com/**', async r => { if (opt.late) await new Promise(z => setTimeout(z, 2500)); r.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(FONT) }); });
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) }));
  await page.routeWebSocket(/\/ws$/, ws => { ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: [] })); });
  await page.goto('file://' + INDEX); await page.waitForSelector('#model svg');
  if (opt.late) await page.waitForTimeout(1500); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200);
  if (zoom) { await page.click('button#model-zoom'); await page.waitForTimeout(600); }
  if (!opt.noResize) await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const V = { '360': [{ width: 360, height: 800 }, 0], '375': [{ width: 375, height: 667 }, 0], '390': [{ width: 390, height: 844 }, 0], '844': [{ width: 844, height: 900 }, 0],
  '1280': [{ width: 1280, height: 900 }, 0], '1440': [{ width: 1440, height: 900 }, 0], '1920': [{ width: 1920, height: 1000 }, 0],
  '390-phong-to': [{ width: 390, height: 844 }, 1], '1280-phong-to': [{ width: 1280, height: 900 }, 1], '1440-phong-to': [{ width: 1440, height: 900 }, 1] };

// --- tap-count: điểm tâm của số đếm có bị vùng bấm nhân vật chiếm không
const COUNT_PTS = id => { const out = []; const sel = id ? `#${id} .n` : '#model g.node .n';
  document.querySelectorAll(sel).forEach(n => { n.scrollIntoView({ block: 'center' }); const r = n.getBoundingClientRect(), g = n.closest('g[id]');
    const cv = document.createElement('canvas').getContext('2d'), cs = getComputedStyle(n); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = cv.measureText(n.textContent), M = n.getScreenCTM(), y0 = +n.getAttribute('y'), asc = m.actualBoundingBoxAscent;
    const P = (x, y) => { const p = n.ownerSVGElement.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(M); };
    const ink = P(+n.getAttribute('x'), y0 - asc / 2);
    const pts = [['tâm hộp', r.left + r.width / 2, r.top + r.height / 2], ['tâm mực', r.left + r.width / 2, ink.y]];
    out.push({ id: g.id, pts: pts.map(([nm, x, y]) => { const e = document.elementFromPoint(x, y), mc = e && e.closest && e.closest('g.mch'); return { nm, x, y, by: mc ? mc.getAttribute('data-block') : null }; }) }); });
  return out; };

const CAPU = () => { const g = document.getElementById('nd_capu'), R = __U(g.querySelector(':scope>rect')), bad = [];
  const cap = g.querySelector('.cap'), n = g.querySelector('.n'), t = g.querySelector('.t'), f = x => x.toFixed(1);
  const fsz = parseFloat(getComputedStyle(cap).fontSize); if (fsz < 10.5 - 0.01) bad.push('cỡ .cap ' + fsz + ' < 10,5');
  for (const e of [t, n, cap, ...cap.querySelectorAll('tspan')]) { const q = __U(e);
    if (q.l < R.l - .5 || q.r > R.r + .5 || q.t < R.t - .5 || q.b > R.b + .5) bad.push(`"${e.textContent.trim()}" [${f(q.l)},${f(q.t)},${f(q.r)},${f(q.b)}] ra ngoài khối [${f(R.l)},${f(R.t)},${f(R.r)},${f(R.b)}]`); }
  const body = document.querySelector('g.mch[data-block=nd_capu] [data-part=body]');
  if (body) { const b = __U(body); for (const e of [t, n, cap]) { const q = __U(e);
    if (Math.min(q.r, b.r) - Math.max(q.l, b.l) > 2 && Math.min(q.b, b.b) - Math.max(q.t, b.t) > 2) bad.push('thân nhân vật đè "' + e.textContent.trim() + '"'); } }
  return { bad, txt: cap.textContent.replace(/\s+/g, ' ').trim() }; };

const OTHER = () => { const svg = document.querySelector('#model svg'), bad = [];
  const who = (x, y) => { const e = document.elementFromPoint(x, y), m = e && e.closest && e.closest('g.mch'); return m ? m.getAttribute('data-block') : null; };
  for (const t of svg.querySelectorAll('g.node[id] text, g.gate[id] text, g.res[id] text')) { if (!t.textContent.trim() || t.closest('.mch')) continue;
    const own = t.closest('g.node[id], g.gate[id], g.res[id]').id; t.scrollIntoView({ block: 'center' }); const q = t.getBoundingClientRect(); if (!q.width) continue;
    for (const fx of [.15, .5, .85]) { const b = who(q.left + q.width * fx, q.top + q.height / 2); if (b && b !== own) { bad.push(`chữ "${t.textContent.trim().slice(0, 24)}" của ${own} nằm dưới vùng bấm nhân vật ${b}`); break; } } }
  for (const s of svg.querySelectorAll('g.node[id]>rect, g.gate[id]>circle, g.res[id]>rect')) { const own = s.parentNode.id; s.scrollIntoView({ block: 'center' }); const q = s.getBoundingClientRect();
    for (const [fx, fy] of [[.3, .03], [.5, .03], [.7, .03], [.3, .97], [.5, .97], [.7, .97]]) { const b = who(q.left + q.width * fx, q.top + q.height * fy);
      if (b && b !== own) { bad.push(`khối ${own} (điểm ${fx},${fy}) nằm dưới vùng bấm nhân vật ${b}`); break; } } }
  return bad; };

const LBL = () => { const svg = document.querySelector('#model svg'), bad = [];
  const ov = (a, b) => Math.min(Math.min(a.r, b.r) - Math.max(a.l, b.l), Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('.mch,#fx_b,#fx_s,#fx_f') && t.textContent.trim() && getComputedStyle(t).display !== 'none');
  const lbls = texts.filter(t => t.classList.contains('lbl') && !t.closest('g.node,g.res,g.gate'));
  const pair = (a, b) => a.classList.contains('lbl') && b.classList.contains('lbl') && a.getAttribute('data-x0') === b.getAttribute('data-x0') &&
    Math.abs(+(a.getAttribute('data-y0') || a.getAttribute('y')) - +(b.getAttribute('data-y0') || b.getAttribute('y'))) <= 14 && a.parentNode === b.parentNode;
  const shapes = [...svg.querySelectorAll('g.node>rect, g.res>rect, g.gate>circle')], bodies = [...svg.querySelectorAll('g.mch [data-part=body]')];
  for (const l of lbls) { const a = __U(l), nm = l.textContent.trim();
    if (a.l < -0.5 || a.r > 1000.5 || a.t < -0.5 || a.b > svg.viewBox.baseVal.height + 0.5) bad.push(`nhãn "${nm}" ra ngoài viewBox`);
    for (const o of texts) if (o !== l && !pair(l, o)) { const v = ov(a, __U(o)); if (v > 0.5) bad.push(`nhãn "${nm}" đè chữ "${o.textContent.trim().slice(0, 25)}" ${v.toFixed(1)}u`); }
    for (const s of shapes) { const S = __U(s); let v;
      if (s.tagName === 'circle') { const cx = (S.l + S.r) / 2, cy = (S.t + S.b) / 2, r = (S.r - S.l) / 2, dx = Math.max(a.l - cx, 0, cx - a.r), dy = Math.max(a.t - cy, 0, cy - a.b); v = r - Math.hypot(dx, dy); }
      else v = ov(a, S);
      if (v > 0.5) bad.push(`nhãn "${nm}" đè khối ${s.parentNode.id} ${v.toFixed(1)}u`); }
    for (const b of bodies) if (ov(a, __U(b)) > 0.5) bad.push(`nhãn "${nm}" đè thân ${b.closest('g.mch').getAttribute('data-block')}`); }
  return bad; };

const ROUTES = () => { const svg = document.querySelector('#model svg'), bad = [];
  const R = { p_intent_spec: ['nd_intents', 'nd_spec'], p_spec_gate: ['nd_spec', 'gt_spec'], p_gate_exec: ['gt_spec', 'nd_exec'], p_gate_respec: ['gt_spec', 'nd_respec'],
    p_respec_spec: ['nd_respec', 'nd_spec'], p_exec_gate: ['nd_exec', 'gt_code'], p_gate_rework: ['gt_code', 'nd_rework'], p_rework_exec: ['nd_rework', 'nd_exec'],
    p_gate_respec2: ['gt_code', 'nd_respec'], p_gate_capu: ['gt_code', 'nd_capu'], p_capu_exec: ['nd_capu', 'nd_exec'], p_gate_kr: ['gt_spec', 'nd_kr'], p_gate_kr2: ['gt_code', 'nd_kr'],
    p_kr_gate: ['nd_kr', 'gt_code'], p_kr_spec: ['nd_kr', 'nd_spec'], p_gate_rel: ['gt_code', 'nd_rel'], p_capu_res: ['nd_capu', 'nd_prod'], p_rel_res: ['nd_rel', 'nd_prod'],
    p_src1: ['src_data', 'nd_insight'], p_src2: ['src_inc', 'nd_insight'], p_src3: ['src_fb', 'nd_insight'], p_res_insight: ['nd_prod', 'nd_insight'],
    p_insight_intent: ['nd_insight', 'nd_intents'], p_insight_kr: ['nd_insight', 'nd_kr'] };
  const dist = id => { const s = document.querySelector('#' + id + '>rect, #' + id + '>circle'); if (!s) return null;
    if (s.tagName === 'circle') { const cx = +s.getAttribute('cx'), cy = +s.getAttribute('cy'), r = +s.getAttribute('r'); return (x, y) => Math.hypot(x - cx, y - cy) - r; }
    const x = +s.getAttribute('x'), y = +s.getAttribute('y'), w = +s.getAttribute('width'), h = +s.getAttribute('height');
    return (px, py) => { const inside = px > x && px < x + w && py > y && py < y + h; if (inside) return -Math.min(px - x, x + w - px, py - y, y + h - py);
      return Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h)); }; };
  for (const [id, [a, b]] of Object.entries(R)) { const p = document.getElementById(id); if (!p) { bad.push('thiếu đường ' + id); continue; }
    const q = document.createElementNS('http://www.w3.org/2000/svg', 'path'); q.setAttribute('d', p.getAttribute('data-d0') || p.getAttribute('d')); svg.appendChild(q);
    const L = q.getTotalLength(), s = q.getPointAtLength(0), e = q.getPointAtLength(L); q.remove();
    const da = dist(a), db = dist(b); if (!da || !db) { bad.push(`${id}: thiếu khối ${a}/${b}`); continue; }
    if (Math.abs(da(s.x, s.y)) > 8) bad.push(`${id} đầu (${s.x.toFixed(0)},${s.y.toFixed(0)}) cách ${a} ${da(s.x, s.y).toFixed(1)}u`);
    if (Math.abs(db(e.x, e.y)) > 8) bad.push(`${id} cuối (${e.x.toFixed(0)},${e.y.toFixed(0)}) cách ${b} ${db(e.x, e.y).toFixed(1)}u`); }
  return bad; };

(async () => {
  const browser = await chromium.launch(); let fails = 0;
  const say = (bad, tag) => { if (bad.length) fails++; console.log(`${bad.length ? 'FAIL' : '  '} ${tag}: ${bad.slice(0, 4).join(' | ') || 'đạt'}${bad.length > 4 ? ` (+${bad.length - 4})` : ''}`); };
  try {
    if (CHECK === 'tap-count') {
      for (const tag of ['360', '375', '390', '390-phong-to', '844', '1280']) for (const D of [[0, 0, 0], [12, 34, 56]]) {
        const [vp, zoom] = V[tag]; const { ctx, page, errs } = await open(browser, vp, zoom, data(...D)); const bad = [];
        for (const c of await page.evaluate(COUNT_PTS, null)) for (const p of c.pts) if (p.by) bad.push(`${c.id}: ${p.nm} số đếm nằm dưới vùng bấm nhân vật ${p.by}`);
        const cp = (await page.evaluate(COUNT_PTS, 'nd_capu'))[0].pts[1];
        await page.mouse.click(cp.x, cp.y); await page.waitForTimeout(350);
        const st = await page.evaluate(() => { const m = document.getElementById('capu-modal'); return { open: !!m && !m.hidden && getComputedStyle(m).display !== 'none', rows: document.querySelectorAll('#capu-modal [data-capu-row]').length, n: document.querySelector('#nd_capu .n').textContent.trim() }; });
        if (!st.open) bad.push('bấm tâm số khối Capu không mở #capu-modal'); else if (String(st.rows) !== st.n) bad.push(`modal ${st.rows} dòng ≠ số khối ${st.n}`);
        await ctx.close(); say(bad.concat(errs), `${tag} ${D.join('/')}`);
      }
    } else if (CHECK === 'first-load') {
      const W = { '320': 320, '340': 340, '355': 355, '360': 360, '375': 375 };
      for (const late of [0, 1]) for (const tag of Object.keys(W)) { const vp = { width: W[tag], height: 760 };
        const { ctx, page, errs } = await open(browser, vp, 0, data(12, 34, 56), { noResize: 1, late }); const bad = [];
        for (const c of await page.evaluate(COUNT_PTS, null)) for (const p of c.pts) if (p.by) bad.push(`${c.id}: ${p.nm} số đếm nằm dưới vùng bấm nhân vật ${p.by}`);
        bad.push(...await page.evaluate(OTHER));
        for (const [id, w, h] of await page.evaluate(() => [...document.querySelectorAll('#chars g.mch .hit')].map(h => { const r = h.getBoundingClientRect(); return [h.parentNode.getAttribute('data-block'), r.width, r.height]; })))
          if (w < 44 - 0.01 || h < (W[tag] < 360 ? 36 : 44) - 0.01) bad.push(`vùng bấm ${id} ${w.toFixed(1)}x${h.toFixed(1)}px`);
        const cp = (await page.evaluate(COUNT_PTS, 'nd_capu'))[0].pts[1]; await page.mouse.click(cp.x, cp.y); await page.waitForTimeout(350);
        if (!await page.evaluate(() => { const m = document.getElementById('capu-modal'); return !!m && !m.hidden && getComputedStyle(m).display !== 'none'; })) bad.push('bấm tâm số khối Capu không mở #capu-modal');
        await ctx.close(); say(bad.concat(errs), `${tag}${late ? ' font-muộn' : ''}`); }
    } else if (CHECK === 'hit-other-block') {
      V['320'] = [{ width: 320, height: 700 }, 0]; V['360-phong-to'] = [{ width: 360, height: 800 }, 1];
      for (const tag of ['320', '360', '375', '390', '360-phong-to', '390-phong-to']) { const [vp, zoom] = V[tag]; const { ctx, page, errs } = await open(browser, vp, zoom, data(3, 2, 4));
        const bad = await page.evaluate(OTHER);
        for (const id of await page.evaluate(() => [...document.querySelectorAll('#chars g.mch')].map(g => g.getAttribute('data-block')))) {
          const pt = await page.evaluate(id => { const b = document.querySelector(`g.mch[data-block=${id}] [data-part=body]`); b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id);
          await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(250);
          if (!await page.evaluate(id => document.querySelector(`g.mch[data-block=${id}]`).getAttribute('aria-expanded') === 'true', id)) bad.push(`bấm thân ${id} không mở tóm tắt của nó`);
          await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
        await ctx.close(); say(bad.concat(errs), tag); }
    } else if (CHECK === 'capu-caption') {
      for (const D of [[0, 0, 0], [12, 34, 56], [99, 99, 99]]) for (const tag of ['390', '844', '1280', '1440', '1920', '390-phong-to', '1280-phong-to', '1440-phong-to']) {
        const [vp, zoom] = V[tag]; const { ctx, page, errs } = await open(browser, vp, zoom, data(...D)); const r = await page.evaluate(CAPU); await ctx.close();
        const re = new RegExp(`^${D[0]} leo thang · ${D[1]} chờ quyết/chặn\\s*·?\\s*${D[2]} diff hành vi chờ đọc$`);
        if (!re.test(r.txt)) r.bad.push(`chú thích "${r.txt}" thiếu nhóm số/nhãn`);
        say(r.bad.concat(errs), `${D.join('/')} ${tag}`);
      }
    } else {
      const tags = CHECK === 'labels' ? ['390', '844', '1280', '1440', '1920', '390-phong-to', '1280-phong-to', '1440-phong-to'] : ['1280', '390'];
      for (const tag of tags) { const [vp, zoom] = V[tag]; const { ctx, page, errs } = await open(browser, vp, zoom, data(3, 2, 4));
        const bad = await page.evaluate(CHECK === 'labels' ? LBL : ROUTES); await ctx.close(); say(bad.concat(errs), tag); }
    }
  } finally { await browser.close(); }
  console.log(fails ? `FAIL ${fails} tình huống` : 'PASS'); process.exit(fails ? 1 : 0);
})();
