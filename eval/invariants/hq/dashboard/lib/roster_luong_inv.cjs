#!/usr/bin/env node
// Thư viện đo INV-020 và INV-021 hq/dashboard (nguồn: T-162, spec products/T-162-so-do-luong-theo-roster.md v2, Hành vi 1 và 3;
// spec-critic rút ở Spec Gate 2026-11-14). Bản cố định, không phụ thuộc eval/T-162/*.cjs.
//   node roster_luong_inv.cjs --repo <repo-dashboard> --check nodes|label
// Hợp đồng quan sát: #flow svg; mỗi node là nhóm chứa .chr[data-agent][data-state] và một vòng tròn; select#product-filter; WebSocket /ws gửi snapshot.
// Đo bằng toạ độ màn hình (getBoundingClientRect), không đọc transform hay vị trí viết cứng. Mã thoát 0 = đạt.
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), flag = n => { const i = args.indexOf(n); return i < 0 ? null : args[i + 1]; };
const REPO = path.resolve(flag('--repo') || '.'), CHECK = flag('--check'), INDEX = path.join(REPO, 'index.html');
const D3 = [process.env.D3, '/opt/npm-tools/node_modules/d3/dist/d3.min.js'].find(p => p && fs.existsSync(p));
const out = (s, c) => { console.log(s); process.exit(c); };
if (!D3) out('FAIL thiếu d3.min.js cục bộ: đặt D3=/đường/dẫn/d3.min.js', 1);
if (!fs.existsSync(INDEX)) out('FAIL không thấy index.html trong ' + REPO + ' (đặt TOHONG_DASHBOARD_REPO)', 1);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { out('FAIL thiếu playwright (NODE_PATH=$(npm root -g))', 1); }

// Roster 7 bộ phận hiện tại + một id mới (node sinh theo roster, không viết cứng)
const NEW = 'bo-phan-moi';
const ids = ['capu', 'chief-of-staff', 'insight', 'product', 'spec-critic', 'engineering', 'adversary', NEW];
const roster = ids.map(id => ({ id, name: id, role: '', kind: id === 'capu' ? 'human' : 'agent', reports_to: '', mission: '', agent_file: '', status: 'Hired' }));
const stamp = new Date(Date.now() + 7 * 3600e3 - 2 * 3600e3).toISOString().slice(0, 16);
const T = (id, state, holder, owner, reviewer, product = 'hq') => ({ id, title: 'Việc ' + id, state, holder, owner, reviewer, rounds: 0, version: 1, deadline: '', budget: '', cost: 0,
  created: '2026-10-30T09:00', updated: stamp, hours_since_update: 2, tier: 'A', area: product === 'hq' ? 'hq/dashboard' : 'planner/front', product, evals: 1, spec_returns: 0, evals_added: 0 });
const tasks = [
  T('T-901', 'review', 'insight', 'insight', 'spec-critic'), T('T-902', 'spec', 'spec-critic', 'product', 'spec-critic'),
  T('T-903', 'doing', 'engineering', 'engineering', 'adversary', 'planner'), T('T-904', 'rework', 'adversary', 'engineering', 'adversary'),
  T('T-905', 'new', 'product', 'product', 'spec-critic'), T('T-906', 'blocked', 'chief-of-staff', 'engineering', 'adversary'),
  T('T-907', 'escalated', 'capu', 'product', 'spec-critic'), T('T-908', 'done', 'chief-of-staff', 'insight', 'spec-critic'),
  T('T-909', 'done', 'vendor-ops', 'vendor-ops', 'reviewer'),
];
let k = 0; const E = (task, event, from, to) => ({ seq: 'S-' + String(++k).padStart(5, '0'), ledger_id: 'e' + k, t: stamp, task, title: '', event, from, to, round: 0, severity: '', cost: 0, state: '', holder: '' });
const events = [E('T-901', 'assigned', 'chief-of-staff', 'insight'), E('T-902', 'handoff', 'product', 'spec-critic'), E('T-903', 'assigned', 'chief-of-staff', 'engineering'),
  E('T-904', 'handoff', 'engineering', 'adversary'), E('T-908', 'accepted', 'chief-of-staff', 'done'), E('T-909', 'assigned', 'chief-of-staff', 'vendor-ops')];
const data = { generated_at: stamp, timezone: 'Asia/Ho_Chi_Minh', public: true, tasks, events, roster, capu_queue: [],
  model: { invariants: { 'hq/dashboard': 1 }, invariants_total: 1, adversarial_evals: 0, regression_evals: 0, insight_reports: 0, last_insight: '', specs: 1 } };

async function open(browser, width, activity) {
  const page = await browser.newPage({ viewport: { width, height: 1400 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(D3) }));
  await page.route('**/raw.githubusercontent.com/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
  await page.routeWebSocket(/\/ws$/, ws => ws.send(JSON.stringify({ type: 'snapshot', server_time: Date.now(), events: [], activity: activity.map(a => ({ ...a, at: Date.now() - a.ago })) })));
  await page.goto('file://' + INDEX); await page.waitForTimeout(1500); return { page, errors };
}
const read = page => page.evaluate(() => {
  const svg = document.querySelector('#flow svg'); if (!svg) return null; const sr = svg.getBoundingClientRect();
  return { hscroll: document.documentElement.scrollWidth > innerWidth, nodes: [...svg.querySelectorAll('.chr[data-agent]')].map(c => { const g = c.parentNode, r = g.getBoundingClientRect();
    const ring = g.querySelector(':scope > circle:not([class])') || g.querySelector('circle'), b = ring.getBoundingClientRect();
    return { id: c.getAttribute('data-agent'), sprite: c.getAttribute('data-state'), text: g.textContent, box: [b.left, b.top, b.right, b.bottom],
      inside: r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1 }; }) };
});

(async () => {
  const browser = await chromium.launch(); const why = [];
  for (const [nm, w] of [['1200px', 1200], ['390px', 390]]) {
    if (CHECK === 'nodes') {
      const o = await open(browser, w, []); const f = await read(o.page); await o.page.close();
      if (o.errors.length) why.push(nm + ': lỗi trang ' + o.errors[0]);
      if (!f) { why.push(nm + ': không có sơ đồ luồng'); continue; }
      const have = f.nodes.map(n => n.id);
      for (const id of [...ids, 'done']) if (have.filter(x => x === id).length !== 1) why.push(nm + ': ' + id + ' có ' + have.filter(x => x === id).length + ' node (phải đúng 1)');
      for (const id of have) if (!ids.includes(id) && id !== 'done') why.push(nm + ': node ' + id + ' ngoài roster');
      for (let i = 0; i < f.nodes.length; i++) for (let j = i + 1; j < f.nodes.length; j++) { const a = f.nodes[i].box, b = f.nodes[j].box, G = 4;
        if (a[0] - G < b[2] + G && b[0] - G < a[2] + G && a[1] - G < b[3] + G && b[1] - G < a[3] + G) why.push(nm + ': node ' + f.nodes[i].id + ' và ' + f.nodes[j].id + ' chồng hoặc sát hơn 8px'); }
      for (const n of f.nodes) if (!n.inside) why.push(nm + ': node ' + n.id + ' vượt khung sơ đồ');
      if (f.hscroll) why.push(nm + ': trang cuộn ngang');
    } else if (CHECK === 'label') {
      // Bảng Hành vi 3: nhịp còn hạn -> hành động mới nhất, không "Đang làm"; không nhịp + giữ doing/review/spec/rework -> "Đang làm"; còn lại không chữ. Sprite working đúng khi có chữ. Theo bộ lọc.
      const L = /đang làm/i;
      const judge = (tag, f, exp) => { for (const [id, want] of Object.entries(exp)) { const n = f.nodes.find(x => x.id === id); if (!n) { why.push(tag + ': không có node ' + id); continue; }
        const act = want && want !== 'DL' ? want : null, on = !!want;
        if (want === 'DL' && !L.test(n.text)) why.push(tag + ': ' + id + ' phải hiện "Đang làm" (thấy "' + n.text + '")');
        if (act && (!n.text.includes(act) || L.test(n.text))) why.push(tag + ': ' + id + ' phải hiện "' + act + '" và không có "Đang làm" (thấy "' + n.text + '")');
        if (!want && L.test(n.text)) why.push(tag + ': ' + id + ' không được hiện "Đang làm"');
        if (on !== (n.sprite === 'working')) why.push(tag + ': ' + id + ' sprite ' + n.sprite + ' không khớp chữ'); } };
      let o = await open(browser, w, []); let f = await read(o.page);
      judge(nm + ' không nhịp', f, { insight: 'DL', 'spec-critic': 'DL', engineering: 'DL', adversary: 'DL', product: null, 'chief-of-staff': null, capu: null, [NEW]: null });
      await o.page.selectOption('#product-filter', 'hq'); await o.page.waitForTimeout(400); f = await read(o.page);
      judge(nm + ' không nhịp, lọc hq', f, { insight: 'DL', engineering: null, adversary: 'DL' });
      await o.page.close();
      o = await open(browser, w, [{ agent: 'adversary', action: 'Soi input', task: 'T-904', ago: 60000 }, { agent: 'adversary', action: 'Chạy gate', task: 'T-904', ago: 2000 },
        { agent: NEW, action: 'Dọn dữ liệu', task: 'T-901', ago: 4000 }, { agent: 'insight', action: 'Nhịp cũ', task: 'T-901', ago: 900000 }]);
      f = await read(o.page); await o.page.close();
      judge(nm + ' có nhịp', f, { adversary: 'Chạy gate', [NEW]: 'Dọn dữ liệu', insight: 'DL', product: null });
      for (const [id, s] of [['adversary', 'Soi input'], ['insight', 'Nhịp cũ']]) if ((f.nodes.find(x => x.id === id) || { text: '' }).text.includes(s)) why.push(nm + ': ' + id + ' hiện nhịp cũ/quá hạn "' + s + '"');
    } else out('FAIL --check phải là nodes hoặc label', 1);
  }
  await browser.close();
  out(why.length ? 'FAIL ' + why.join(' | ') : 'PASS ' + (CHECK === 'nodes' ? 'mỗi phần tử roster và done có đúng một node, không chồng, trong khung, ở 1200px và 390px' : 'chữ và sprite node theo bảng T-162 Hành vi 3, kể cả khi lọc sản phẩm'), why.length ? 1 : 0);
})();
