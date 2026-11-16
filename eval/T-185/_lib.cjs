/* T-185 khung dùng chung: App THẬT qua Root (khung của eval/T-179/_lib.cjs: vite dev + Playwright + API giả có trạng thái).
 * Thêm: (1) detailRoute: ghi đè GET /api/vendors/:id?coupleId=… với độ trễ / câu AI / lỗi / không điểm tuỳ ý; (2) watch: ghi lại, theo thời gian, ẢNH CHỤP khối "Phân tích AI" của thẻ chi tiết (chữ nhìn thấy, vùng chờ,
 * các khối skeleton và vị trí nhãn) để đo "không nháy" và "không số tạm" ở MỌI thời điểm, không chỉ lúc dừng. Eval chỉ đo chữ/hình người dùng thấy, không đọc tên hàm/state/class của front.
 * "Khối Phân tích AI" = phần tử bao dòng tiêu đề có chữ "Phân tích AI" (hiển thị hoa/thường tuỳ CSS) và các thanh/câu của nó; nếu tiêu đề nằm trong vùng aria-busy thì khối là vùng đó. "Skeleton nhìn thấy" = trong khối có vùng aria-busy="true" nhìn thấy (quy ước T-061).
 * Biến: TOHONG_FRONT_REPO, PLAYWRIGHT_PATH (xem eval/T-171/_lib.cjs). */
const path = require('path');
const base = require(path.join(__dirname, '..', 'T-179', '_lib.cjs'));
const { sleep } = base;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const AI = 'Hợp ngân sách và phong cách hiện đại của anh chị, lịch còn trống đúng ngày cưới.';
const LABELS = ['Ngân sách', 'Phong cách', 'Lịch trống'];

/* opts: { delay (ms), why (chuỗi | null), fail (true => 500), none (true => 200 match null) }; trả về bộ đếm { n }. Chỉ bắt chi tiết có coupleId (đúng lời gọi của thẻ chi tiết). */
async function detailRoute(pg, S, opts = {}) {
  const c = { n: 0, attempts: 0, times: [] }; // dev có StrictMode: một lần mở có thể gọi 2 lần liền nhau (lần đầu bị bỏ); "lần thử" = cụm yêu cầu cách nhau < 300ms
  await pg.route(/localhost:8787\/api\/vendors\/t171_[ab]\?/, async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    const u = new URL(r.request().url()); if (!u.searchParams.get('coupleId')) return r.fallback();
    const now = Date.now(); if (!c.times.length || now - c.times[c.times.length - 1] > 300) c.attempts++; const o = typeof opts === 'function' ? opts(c.attempts - 1) : opts; c.n++; c.times.push(now);
    if (o.delay) await sleep(o.delay);
    const j = (b, status = 200) => r.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(b) });
    if (o.fail) return j({ error: 'boom' }, 500);
    const id = u.pathname.split('/').pop(); const v = S.vendors().find((x) => x.id === id);
    if (o.none) return j({ vendor: v, match: null });
    const m = { ...v.match }; if (o.why !== null) m.whyThisVendor = o.why === undefined ? AI : o.why;
    return j({ vendor: v, match: m });
  });
  return c;
}

/* Ảnh chụp khối Phân tích AI trong trình duyệt (hàm chạy trong trang; trả null nếu chưa có khối). */
const SNAP_SRC = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const cands = [...document.querySelectorAll('div,span,p,h3,h4')].filter((e) => e.firstChild && e.firstChild.nodeType === 3 && /^\\s*phân tích ai/i.test(e.firstChild.nodeValue || ''));
  const title = cands[cands.length - 1]; if (!title) return null;
  const own = title.closest('[aria-busy="true"]'); const block = own || title.parentElement; const br = block.getBoundingClientRect();
  const busy = own && vis(own) ? own : [...block.querySelectorAll('[aria-busy="true"]')].filter(vis)[0] || null;
  const leaves = busy ? [...busy.querySelectorAll('*')].filter((e) => e.children.length === 0 && !norm(e.textContent) && e.getAttribute('role') !== 'status' && vis(e)
    && (() => { const c = getComputedStyle(e).backgroundColor; const m = /rgba?\\(([^)]+)\\)/.exec(c); if (!m) return false; const p = m[1].split(',').map(Number); return p.length < 4 || p[3] > 0; })())
    .map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height, bg: getComputedStyle(e).backgroundColor }; }) : [];
  const lab = {}; for (const n of ${JSON.stringify(LABELS)}) { const e = [...block.querySelectorAll('span,div')].find((x) => x.children.length === 0 && norm(x.textContent) === n); if (e) { const r = e.getBoundingClientRect(); lab[n] = { top: r.top, bottom: r.bottom }; } }
  const status = !!block.querySelector('[role="status"][aria-label^="Đang tải"]');
  return { text: norm(block.innerText), busy: !!busy, status, leaves, lab, h: br.height, left: br.left, right: br.right, scrollW: block.scrollWidth, clientW: block.clientWidth, blockBg: getComputedStyle(block).backgroundColor };
})()`;
const snap = (pg) => pg.evaluate(SNAP_SRC);
/* ghi lại ảnh chụp mỗi ~16ms vào window.__s (kèm mốc thời gian performance.now); dừng bằng stopWatch. */
const watch = (pg) => pg.evaluate(`(() => { window.__s = []; const f = new Function('return ' + ${JSON.stringify(SNAP_SRC)}); window.__w = setInterval(() => { try { const s = f(); window.__s.push({ t: performance.now(), s }); } catch (e) { /* */ } }, 16); })()`);
const stopWatch = (pg) => pg.evaluate(() => { clearInterval(window.__w); return window.__s; });

/* chữ còn lại sau khi bỏ chữ tĩnh (tiêu đề, ba nhãn): rỗng = không số, không chữ chờ, không câu, không caret */
const dynText = (t) => { let s = t.replace(/phân tích ai/i, ''); for (const n of LABELS) s = s.replace(n, ''); return s.replace(/\s+/g, ' ').trim(); };

/* Bốn vùng của skeleton theo vị trí nhãn: tiêu đề (trên nhãn Ngân sách), dưới Ngân sách (thanh + dòng phép so), dưới Phong cách (thanh), dưới Lịch trống (thanh + câu AI). */
function zones(s) {
  const { lab, leaves } = s; if (!lab['Ngân sách'] || !lab['Phong cách'] || !lab['Lịch trống']) return null;
  const ns = lab['Ngân sách'], pc = lab['Phong cách'], lt = lab['Lịch trống'];
  const tops = (a) => new Set(a.map((l) => Math.round(l.top / 3))).size;
  return {
    title: leaves.filter((l) => l.bottom <= ns.top + 1).length,
    ns: tops(leaves.filter((l) => l.top >= ns.bottom - 1 && l.top < pc.top)),
    pc: tops(leaves.filter((l) => l.top >= pc.bottom - 1 && l.top < lt.top)),
    lt: tops(leaves.filter((l) => l.top >= lt.bottom - 1)),
  };
}
const zonesOk = (z) => !!z && z.title >= 1 && z.ns >= 2 && z.pc >= 1 && z.lt >= 2;
const zonesMsg = (z) => (z ? `tiêu đề ${z.title} (cần >=1), dưới Ngân sách ${z.ns} hàng (cần >=2: thanh + dòng phép so), dưới Phong cách ${z.pc} (>=1), dưới Lịch trống ${z.lt} (>=2: thanh + câu AI)` : 'thiếu nhãn Ngân sách/Phong cách/Lịch trống trong khối');

/* mở chi tiết Beta từ danh sách (Alpha ở hàng đầu khi dự toán 90; dùng Beta cho ổn định), trả mốc thời điểm bấm theo performance.now của trang. */
async function openBeta(pg) { await pg.evaluate(() => { window.__click = null; document.addEventListener('click', () => { window.__click = performance.now(); }, true); }); await pg.getByText('Beta Hall', { exact: false }).first().click(); }

/* mở App thật, đăng ký chi tiết giả, bấm Tìm vendor (danh sách 2 hàng Alpha/Beta); width mặc định 390 của khung. */
async function setup(h, opts, width) {
  const S = h.newServer(); const { ctx, pg } = await h.openApp(h.dev, h.br, S); if (width) await pg.setViewportSize({ width, height: 800 });
  const route = await detailRoute(pg, S, opts); await h.pressFind(pg, 1); return { S, ctx, pg, route };
}
const run = (scenario) => base.run(async (h) => scenario({ ...h, setup: (o, w) => setup(h, o, w), detailRoute, snap, watch, stopWatch, dynText, zones, zonesOk, zonesMsg, openBeta, AI, LABELS }));
module.exports = { run, sleep, detailRoute, snap, watch, stopWatch, dynText, zones, zonesOk, zonesMsg, openBeta, AI, LABELS, CORS };
