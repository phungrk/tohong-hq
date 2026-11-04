#!/usr/bin/env node
/*
 * Eval tầng 1 của T-061 (front): trạng thái đang tải hiển thị skeleton. Spec: products/T-061-skeleton-dang-tai.md. --only N = tiêu chí N:
 *   1 bốn tab + trang con hạng mục: có skeleton, không chữ "Đang tải" trơn, không màn rỗng giả   2 chat: gợi ý vendor, lịch sử trò chuyện
 *   3 admin Thành viên   4 không nhảy bố cục (tiêu đề, thanh tab, khối đầu) 390 và 320   5 lỗi tải: thông báo + Thử lại; 404 ngân sách là "chưa có dữ liệu"
 *   6 thời điểm hiện (me trễ 1s: skeleton 100-300ms từ yêu cầu /api/me đầu và trước khi me về; tải nhanh không nháy; không rỗng giả suốt lúc chờ)   7 prefers-reduced-motion   8 truy cập (role=status "Đang tải", aria-busy, không focus được)
 *   9 màu chỉ dùng token   10 không cuộn ngang 320/390   11 không đổi API (chỉ yêu cầu đã có, không nhiều hơn main)
 *   (4 còn đo làm mới: dựng lại màn có key và tải lại màn còn dữ liệu)
 * Tiêu chí 12 (ảnh 390 trong PR): bash eval/T-061/check_pr.sh <số-PR>. Tiêu chí 13 (bất biến + T-054): bash eval/T-061/run.sh <front> --only 13.
 * Chạy: cd /home/user/tohong-hq && node eval/T-061/check_skel.cjs --repo /home/user/tohong-front [--only 1,4] [--shots <thư-mục>]
 * Tìm phần tử theo CHỮ và VAI TRÒ; chỉ đọc màu và hình học (vị trí, kích thước) khi tiêu chí nói về màu/hình học. Không bộ chọn theo class/style, không đọc mã nguồn.
 * Dòng cuối PASS hoặc FAIL <lý do đầu> (+n lỗi nữa); mã thoát 0/1 (2 = không chạy được).
 */
const path = require('path'), fs = require('fs');
const L = require('./lib.cjs');
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const REPO = arg('--repo') && path.resolve(arg('--repo'));
if (!REPO || !fs.existsSync(path.join(REPO, 'package.json'))) { console.log('FAIL thiếu --repo trỏ tới tohong-front'); process.exit(2); }
const ONLY = arg('--only') ? arg('--only').split(',').map(Number) : null;
const SHOTS = arg('--shots') && path.resolve(arg('--shots'));
const wants = (c) => !ONLY || ONLY.includes(c);
const { chromium } = L.loadPlaywright(REPO);

const fails = []; let crit = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? '  ok ' : '  XX '} [TC${crit}] ${name}${!ok && extra ? '  :: ' + String(extra).replace(/\s+/g, ' ').slice(0, 400) : ''}`);
  if (!ok) fails.push(`[TC${crit}] ${name}${extra ? ' [' + String(extra).replace(/\s+/g, ' ').slice(0, 140) + ']' : ''}`);
};
const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;

/* ---------- màn trong phạm vi ---------- */
// title: chữ tiêu đề trong header; at: mốc thật sau khi tải (chữ) và kiểu so khớp: card = so top + chiều cao của thẻ chứa chữ đó (tổ tiên đầu tiên rộng >= khung-40); text = so top của dòng chữ.
const TABS = [
  { id: 'trang-chu', tab: 'Trang chủ', title: 'Tơ Hồng', at: /ngày nữa/, kind: 'card', empty: [/Chọn ngày/] },
  { id: 'ke-hoach', tab: 'Kế hoạch', title: 'Kế hoạch', at: /việc trong giai đoạn/, kind: 'card', empty: [/^Thêm việc$/, /0\/0 việc/] },
  { id: 'ngan-sach', tab: 'Ngân sách', title: 'Ngân sách', at: /^Đã phân bổ$/i, kind: 'text', empty: [/Chưa có hạng mục/, /^Thêm hạng mục$/, /Chưa đặt mục tiêu/, /Chưa có số khách/] },
  { id: 'khach-moi', tab: 'Khách mời', title: 'Khách mời', at: /^Nhà trai$/, kind: 'text', empty: [/Chưa có khách mời/, /^Thêm khách mời$/, /^0 người$/, /Chưa đặt sức chứa/, /xác nhận ·\s+chờ/] },
];
const SUB = { id: 'ngan-sach/venue', title: null, empty: [/Chưa có hạng mục/, /^Thêm hạng mục$/], ready: (p) => p.getByRole('button', { name: 'Thêm mục con' }) };
const PLAIN = /Đang tải|Đang tìm vendor phù hợp/; // chữ chờ trơn: không còn nhìn thấy được
const DELAY = (p) => (p === '/api/me' ? 300 : 1500);

/* ---------- trợ giúp ---------- */
const statusOf = (page) => page.getByRole('status', { name: /Đang tải/ });
async function waitStatus(page, ms = 3500) { try { await statusOf(page).first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } }
// Mốc cố định (m5): đợi `ms` kể từ lúc bắt đầu chờ rồi hỏi thẳng status có đang hiện không, không đợi tới khi nó xuất hiện.
async function statusAt(page, ms) { await page.waitForTimeout(ms); return statusOf(page).first().isVisible().catch(() => false); }
async function waitGone(page, ms = 9000) { try { await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: ms }); return true; } catch { return false; } }
// Văn bản nhìn thấy thật (rộng và cao > 8px, không ẩn) có chữ riêng khớp: chống chữ chờ trơn / trạng thái rỗng giả / nút thêm.
const visibleHits = (page, regexes) => page.evaluate((src) => { const res = src.map((s) => new RegExp(s[0], s[1])); const out = [];
  for (const e of document.querySelectorAll('body *')) { const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!own) continue;
    if (!res.some((r) => r.test(own))) continue; const r = e.getBoundingClientRect(); if (r.width <= 8 || r.height <= 8) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue; out.push(own.slice(0, 40)); } return out; }, regexes.map((r) => [r.source, r.flags]));
// Khối skeleton = lá rỗng có nền tô, trong vùng aria-busy="true" nhìn thấy đầu tiên.
const REGION_JS = `(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const regs = [...document.querySelectorAll('[aria-busy="true"]')].filter(vis); const root = regs[0]; if (!root) return null;
  const leaves = [...root.querySelectorAll('*')].filter((e) => e.children.length === 0 && !(e.textContent || '').trim()).map((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const m = cs.backgroundColor.match(/rgba?\\(([^)]+)\\)/); const parts = m ? m[1].split(',').map((x) => parseFloat(x)) : null; const alpha = parts ? (parts.length > 3 ? parts[3] : 1) : 0;
    return { e, top: r.top + scrollY, left: r.left, width: r.width, height: r.height, bg: cs.backgroundColor, alpha }; }).filter((l) => l.alpha > 0 && l.width >= 8 && l.height >= 4);
  return { root, leaves, count: regs.length }; })()`;
const skelLeaves = (page) => page.evaluate(`(() => { const R = ${REGION_JS}; if (!R) return null; return { count: R.count, rootTop: R.root.getBoundingClientRect().top + scrollY, leaves: R.leaves.map(({ e, ...o }) => o) }; })()`);
const titleTop = (page, text) => page.evaluate((t) => { for (const e of document.querySelectorAll('body *')) { const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (own !== t) continue;
  const r = e.getBoundingClientRect(); if (r.width > 8 && r.top < 110 && r.bottom > 0) return r.top + scrollY; } return null; }, text);
const tabTop = (page, name) => page.evaluate((n) => { const b = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === n).map((x) => x.getBoundingClientRect()).filter((r) => r.width > 2 && r.top > 300).sort((a, b) => b.top - a.top)[0]; return b ? b.top : null; }, name);
// Mốc thật: phần tử có chữ riêng khớp `at`; kind=card thì leo lên tổ tiên đầu tiên rộng >= vw-40.
const realMark = (page, at, kind) => page.evaluate(([src, flags, kd]) => { const re = new RegExp(src, flags); // khớp theo textContent của phần tử nhỏ nhất chứa mốc (chữ có thể bị tách bởi <b>...</b>)
  const hit = [...document.querySelectorAll('body *')].filter((e) => re.test((e.textContent || '').trim()) && !e.closest('button') && ![...e.children].some((c) => re.test((c.textContent || '').trim()))
    && (() => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; })());
  if (!hit.length) return null; let r = hit[0].getBoundingClientRect();
  if (kd === 'card') { let a = hit[0]; while (a && a.getBoundingClientRect().width < innerWidth - 40 && a.parentElement) a = a.parentElement; r = a.getBoundingClientRect(); }
  return { top: r.top + scrollY, height: r.height, n: hit.length }; }, [at.source, at.flags, kind]);
const idleFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function load(browser, base, hash, opts = {}) { return L.scenario(browser, base, { hash, delay: DELAY, ...opts }); }
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

async function chip(page, name) { // nút cùng tên có thể nằm sau lớp phủ (thanh tab): chọn nút thật sự bấm được
  const b = page.getByRole('button', { name, exact: true }); await b.first().waitFor({ state: 'attached' });
  for (let k = 0; k < 20; k++) { const n = await b.count(); for (let i = 0; i < n; i++) { try { await b.nth(i).click({ trial: true, timeout: 400 }); await b.nth(i).click(); return; } catch { /* thử nút khác */ } } await page.waitForTimeout(200); }
  throw new Error('không có nút chạm được: ' + name); }

(async () => {
  const dist = await L.buildDist(REPO);
  const srv = await L.serve(dist);
  const browser = await chromium.launch();
  const allScenarios = [];
  const track = (S) => { allScenarios.push(S); return S; };
  try {
    /* ===== TC1: bốn tab + trang con ===== */
    if (wants(1)) { crit = 1; try {
      for (const sc of [...TABS, SUB]) {
        const S = track(await load(browser, srv.base, sc.id)); const { page } = S;
        const got = await waitStatus(page);
        check(`${sc.id}: lúc chờ có vùng role=status "Đang tải" nhìn thấy`, got, 'không thấy status nào có tên chứa "Đang tải"');
        if (got) {
          const busy = await page.evaluate(() => !![...document.querySelectorAll('[aria-busy="true"]')].find((e) => e.getBoundingClientRect().height > 0));
          check(`${sc.id}: vùng chờ đặt aria-busy="true"`, busy);
          const leaves = (await skelLeaves(page))?.leaves?.length || 0;
          check(`${sc.id}: có >= 3 khối skeleton (mô phỏng bố cục)`, leaves >= 3, 'chỉ có ' + leaves);
          const hits = await visibleHits(page, [PLAIN, ...sc.empty]);
          check(`${sc.id}: lúc chờ không có chữ chờ trơn, trạng thái rỗng giả hay nút thêm`, hits.length === 0, hits.join(' | '));
          await shot(page, `${sc.id.replace('/', '-')}-390-dang-tai`);
        } else {
          const hits = await visibleHits(page, [PLAIN, ...sc.empty]);
          check(`${sc.id}: lúc chờ không có chữ chờ trơn, trạng thái rỗng giả hay nút thêm`, hits.length === 0, hits.join(' | '));
        }
        const ready = sc.ready ? sc.ready(page) : page.getByText(sc.at).first();
        let okLoad = true; try { await ready.waitFor({ state: 'visible', timeout: 9000 }); } catch { okLoad = false; }
        check(`${sc.id}: dữ liệu về thì nội dung thật hiện`, okLoad);
        check(`${sc.id}: dữ liệu về thì skeleton biến mất (không còn aria-busy="true")`, await waitGone(page));
        await shot(page, `${sc.id.replace('/', '-')}-390-da-tai`);
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC2: chat ===== */
    if (wants(2)) { crit = 2; try {
      { // gợi ý vendor
        const S = track(await load(browser, srv.base, 'ngan-sach', { delay: (p) => (/vendors\/match/.test(p) ? 1500 : 0) })); const { page } = S;
        await page.getByRole('button', { name: /Nhà hàng tiệc cưới/ }).first().click();
        await page.getByRole('button', { name: 'Tìm nhà hàng tiệc cưới' }).click();
        const got = await statusAt(page, 700);
        check('gợi ý vendor: 700ms sau khi mở thẻ (API trễ 1,5s) có role=status "Đang tải"', got);
        let sk = null, t1 = null;
        { const hits = await visibleHits(page, [PLAIN]); check('gợi ý vendor: không còn chữ "Đang tìm vendor…"/"Đang tải…" trơn', hits.length === 0, hits.join(' | ')); }
        if (got) {
          check('gợi ý vendor: có >= 3 khối skeleton', ((await skelLeaves(page))?.leaves?.length || 0) >= 3);
          await shot(page, 'chat-vendor-390-dang-tai');
          sk = await skelLeaves(page); t1 = await titleTop(page, 'Tiệc & nhà hàng');
        }
        const row = page.getByRole('link', { name: /Nhà hàng Hoa Sen 1/ });
        let ok = true; try { await row.first().waitFor({ state: 'visible', timeout: 9000 }); } catch { ok = false; }
        check('gợi ý vendor: dữ liệu về thì danh sách thật hiện', ok);
        check('gợi ý vendor: skeleton biến mất', await waitGone(page));
        await shot(page, 'chat-vendor-390-da-tai');
        if (got && ok && sk?.leaves?.length) {
          const real = await row.first().evaluate((a) => { const d = [...a.querySelectorAll('*')].find((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - 100) <= 1 && r.height >= 100; }); const r = d && d.getBoundingClientRect(); return r ? { top: r.top + scrollY, width: r.width, height: r.height } : null; });
          const f = sk.leaves[0]; const t2 = await titleTop(page, 'Tiệc & nhà hàng');
          check('gợi ý vendor: tiêu đề thẻ không nhảy (±2px)', near(t1, t2, 2), `${t1} → ${t2}`);
          check('gợi ý vendor: khối đầu của skeleton khớp ảnh bìa vendor đầu (top ±4, rộng ±4, cao ±4)', !!real && near(f.top, real.top, 4) && near(f.width, real.width, 4) && near(f.height, real.height, 4), `skeleton ${Math.round(f.top)}/${Math.round(f.width)}x${Math.round(f.height)} thật ${real && Math.round(real.top)}/${real && Math.round(real.width)}x${real && Math.round(real.height)}`);
        }
        await S.ctx.close();
      }
      // Thẻ Khách mời/Timeline/Checklist trong chat (cards.jsx) hiện không có đường mở trong app (chip chủ đề không được vẽ): ngoài eval, xem spec mục Không làm.
      { // lịch sử trò chuyện mở từ ngăn kéo
        const S = track(await load(browser, srv.base, 'trang-chu', { delay: (p) => (/messages$/.test(p) ? 1500 : 0) })); const { page } = S;
        await page.getByText(/ngày nữa/).first().waitFor();
        await page.getByRole('button', { name: 'Mở menu' }).first().click();
        await page.getByRole('button', { name: /Chọn nhà hàng/ }).click();
        const got = await statusAt(page, 700);
        check('lịch sử trò chuyện: 700ms sau khi mở (API trễ 1,5s) có role=status "Đang tải"', got);
        { const hits = await visibleHits(page, [PLAIN]); check('lịch sử trò chuyện: không có chữ chờ trơn', hits.length === 0, hits.join(' | ')); }
        if (got) await shot(page, 'chat-lich-su-390-dang-tai');
        let ok = true; try { await page.getByText('Đây là gợi ý từ máy chủ giả').first().waitFor({ state: 'visible', timeout: 9000 }); } catch { ok = false; }
        check('lịch sử trò chuyện: dữ liệu về thì tin nhắn thật hiện', ok);
        check('lịch sử trò chuyện: skeleton biến mất', await waitGone(page));
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC3: admin Thành viên ===== */
    if (wants(3)) { crit = 3; try {
      const S = track(await L.scenario(browser, srv.base, { admin: true, delay: (p) => (/members-/.test(p) ? 1500 : 0) })); const { page } = S;
      const list = page.getByRole('region', { name: 'Danh sách thành viên' });
      await page.waitForTimeout(700);
      const got = await list.getByRole('status', { name: /Đang tải/ }).first().isVisible().catch(() => false);
      check('admin: 700ms sau khi mở (API trễ 1,5s) vùng danh sách thành viên có role=status "Đang tải"', got);
      const nStatus = await statusOf(page).count();
      check('admin: số liệu tổng hợp cũng có skeleton riêng (>= 2 vùng status)', nStatus >= 2, 'có ' + nStatus);
      const hits = await visibleHits(page, [PLAIN]); check('admin: lúc chờ không còn chữ "Đang tải…" trơn', hits.length === 0, hits.join(' | '));
      check('admin: có >= 3 khối skeleton', ((await skelLeaves(page))?.leaves?.length || 0) >= 3);
      const inp = page.getByRole('searchbox', { name: 'Tìm theo email hoặc tên' });
      const i1 = await inp.evaluate((e) => e.getBoundingClientRect().top + scrollY).catch(() => null);
      await shot(page, 'admin-thanh-vien-390-dang-tai');
      let ok = true; try { await page.getByText('an@example.test').first().waitFor({ state: 'visible', timeout: 9000 }); } catch { ok = false; }
      check('admin: dữ liệu về thì danh sách thật hiện', ok);
      check('admin: skeleton biến mất', await waitGone(page));
      const i2 = await inp.evaluate((e) => e.getBoundingClientRect().top + scrollY).catch(() => null);
      check('admin: ô tìm kiếm không nhảy khi số liệu về (±4px)', near(i1, i2, 4), `${i1} → ${i2}`);
      await S.ctx.close();
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC4: không nhảy bố cục (từ lúc /api/me đã về; header được phép đổi trước đó) ===== */
    if (wants(4)) { crit = 4; try {
      for (const w of [390, 320]) for (const sc of TABS) {
        const S = track(await load(browser, srv.base, sc.id, { viewport: { width: w, height: 844 }, delay: (p) => (p === '/api/me' ? 50 : 1500) })); const { page } = S; const tag = `${sc.id}@${w}`;
        const got = await waitStatus(page);
        if (!got) { check(`${tag}: có skeleton để đo`, false, 'không thấy role=status "Đang tải"'); await S.ctx.close(); continue; }
        for (let k = 0; k < 50 && !S.meDone; k++) await page.waitForTimeout(40); await idleFrames(page); // header được đổi khi /api/me về (vd. nút "Mời cùng xem" ở 320): đo từ lúc /api/me đã về
        const sk = await skelLeaves(page); const first = sk?.leaves?.[0];
        const m1 = { title: await titleTop(page, sc.title), tab: await tabTop(page, sc.tab) };
        await page.getByText(sc.at).first().waitFor({ state: 'visible', timeout: 9000 }); await waitGone(page); await idleFrames(page);
        const m2 = { title: await titleTop(page, sc.title), tab: await tabTop(page, sc.tab) }; const real = await realMark(page, sc.at, sc.kind);
        check(`${tag}: mốc thật tìm được đúng 1 phần tử (khớp theo textContent của phần tử nhỏ nhất)`, !!real && real.n === 1, real ? 'tìm được ' + real.n : 'không tìm thấy');
        check(`${tag}: tiêu đề không nhảy (±2px)`, near(m1.title, m2.title, 2), `${m1.title} → ${m2.title}`);
        check(`${tag}: thanh tab không nhảy (±2px)`, near(m1.tab, m2.tab, 2), `${m1.tab} → ${m2.tab}`);
        check(`${tag}: khối skeleton đầu cùng top với mốc thật (±3px)`, !!first && !!real && near(first.top, real.top, 3), `skeleton ${first && Math.round(first.top)} thật ${real && Math.round(real.top)}`);
        if (sc.kind === 'card') check(`${tag}: khối skeleton đầu cao bằng thẻ thật (±4px)`, !!first && !!real && near(first.height, real.height, 4), `skeleton ${first && Math.round(first.height)} thật ${real && Math.round(real.height)}`);
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    if (wants(4)) { crit = 4; try { // trang con hạng mục: chỉ đo thanh tab (tiêu đề hạng mục chưa biết lúc chờ); hình dạng xem ảnh trong PR (tiêu chí 12)
      const S = track(await load(browser, srv.base, SUB.id, { delay: (p) => (p === '/api/me' ? 50 : 1500) })); const { page } = S;
      if (!(await waitStatus(page))) check('ngan-sach/venue: có skeleton để đo', false, 'không thấy role=status "Đang tải"');
      else { for (let k = 0; k < 50 && !S.meDone; k++) await page.waitForTimeout(40); const t1 = await tabTop(page, 'Ngân sách'); await SUB.ready(page).waitFor({ state: 'visible', timeout: 9000 }); await waitGone(page); await idleFrames(page); const t2 = await tabTop(page, 'Ngân sách');
        check('ngan-sach/venue: thanh tab không nhảy (±2px)', near(t1, t2, 2), `${t1} → ${t2}`); }
      await S.ctx.close();
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC5: lỗi tải ===== */
    if (wants(5)) { crit = 5; try {
      const cases = [...TABS.map((t) => ({ ...t, match: { 'trang-chu': /\/summary$/, 'ke-hoach': /\/timeline$/, 'ngan-sach': /\/budget$/, 'khach-moi': /\/guests$/ }[t.id], ready: (p) => p.getByText(t.at).first() })),
        { id: 'khach-moi', label: 'khach-moi (lỗi /api/me)', empty: [], match: /\/api\/me$/, ready: (p) => p.getByText(/^Nhà trai$/).first() }];
      for (const c of cases) {
        const S = track(await load(browser, srv.base, c.id, { delay: () => 100, fail: { on: true, match: c.match } })); const { page } = S; const tag = c.label || c.id;
        const alert = page.getByRole('alert').filter({ hasText: /Không tải được/ });
        let shown = true; try { await alert.first().waitFor({ state: 'visible', timeout: 6000 }); } catch { shown = false; }
        check(`${tag}: lỗi tải hiện thông báo "Không tải được…" (role=alert)`, shown);
        check(`${tag}: có nút "Thử lại"`, await page.getByRole('button', { name: 'Thử lại', exact: true }).first().isVisible().catch(() => false));
        check(`${tag}: skeleton không quay mãi khi đã lỗi`, await waitGone(page, 3000));
        const hits = await visibleHits(page, (c.empty || []).filter(Boolean)); check(`${tag}: không hiện trạng thái rỗng giả khi lỗi`, hits.length === 0, hits.join(' | '));
        await shot(page, `${(c.label ? 'khach-moi-me' : c.id)}-390-loi`);
        S.fail.on = false; const n0 = S.reqs.length;
        const retry = page.getByRole('button', { name: 'Thử lại', exact: true }); if (await retry.first().isVisible().catch(() => false)) await retry.first().click();
        let ok = true; try { await c.ready(page).waitFor({ state: 'visible', timeout: 9000 }); } catch { ok = false; }
        check(`${tag}: bấm Thử lại thì gửi lại yêu cầu và nội dung thật hiện`, ok && S.reqs.length > n0);
        check(`${tag}: nội dung về thì thông báo lỗi biến mất`, (await alert.count()) === 0);
        await S.ctx.close();
      }
      { // 404 ngân sách = chưa có dữ liệu, không phải lỗi
        const S = track(await load(browser, srv.base, 'ngan-sach', { delay: () => 100, noBudget: true })); const { page } = S;
        let ok = true; try { await page.getByText(/Chưa có hạng mục/).first().waitFor({ state: 'visible', timeout: 7000 }); } catch { ok = false; }
        check('ngân sách trả 404: hiện trạng thái rỗng như cũ, không skeleton quay mãi', ok && (await waitGone(page, 2000)));
        check('ngân sách trả 404: không hiện thông báo lỗi', (await page.getByRole('alert').filter({ hasText: /Không tải được/ }).count()) === 0);
        await S.ctx.close();
      }
      { // chat: gợi ý vendor lỗi giữ câu cũ
        const S = track(await load(browser, srv.base, 'ngan-sach', { delay: () => 0, fail: { on: true, match: /vendors\/match/ } })); const { page } = S;
        await page.getByRole('button', { name: /Nhà hàng tiệc cưới/ }).first().click(); await page.getByRole('button', { name: 'Tìm nhà hàng tiệc cưới' }).click();
        let ok = true; try { await page.getByText(/Không tải được gợi ý/).first().waitFor({ state: 'visible', timeout: 6000 }); } catch { ok = false; }
        check('chat gợi ý vendor lỗi: vẫn hiện "Không tải được gợi ý. Thử lại sau giúp Tơ Hồng nhé."', ok);
        check('chat gợi ý vendor lỗi: không còn skeleton', await waitGone(page, 3000));
        await S.ctx.close();
      }
      { // admin lỗi: ErrorNote như cũ
        const S = track(await L.scenario(browser, srv.base, { admin: true, delay: () => 100, fail: { on: true, match: /members-list/ } })); const { page } = S;
        const alert = page.getByRole('alert');
        let ok = true; try { await alert.first().waitFor({ state: 'visible', timeout: 6000 }); } catch { ok = false; }
        check('admin lỗi: hiện thông báo lỗi (role=alert) kèm nút "Thử lại"', ok && await page.getByRole('button', { name: 'Thử lại', exact: true }).first().isVisible().catch(() => false));
        check('admin lỗi: không còn skeleton trong vùng danh sách', (await page.getByRole('region', { name: 'Danh sách thành viên' }).getByRole('status', { name: /Đang tải/ }).count()) === 0);
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC6: thời điểm hiện ===== */
    if (wants(6)) { crit = 6; try {
      // init chạy trong trang: ghi lúc đầu tiên có vùng aria-busy nhìn thấy CÓ khối skeleton tô màu (busyAt) và lúc đầu tiên có chữ rỗng giả/chữ chờ nhìn thấy (fakeAt), tính từ timeOrigin (lúc bắt đầu điều hướng).
      const init = (src) => { window.__busyAt = null; window.__fakeAt = null; window.__fake = null; const res = src.map((x) => new RegExp(x[0], x[1]));
        const painted = (root) => [...root.querySelectorAll('*')].some((e) => { if (e.children.length || (e.textContent || '').trim()) return false; const r = e.getBoundingClientRect(); const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/); const p = m ? m[1].split(',').map(parseFloat) : null; return r.width >= 8 && r.height >= 4 && p && (p.length < 4 || p[3] > 0); });
        const scan = () => { const now = Date.now();
          if (window.__busyAt === null && [...document.querySelectorAll('[aria-busy="true"]')].some((e) => e.getBoundingClientRect().height > 0 && painted(e))) window.__busyAt = now;
          if (window.__fakeAt === null) for (const e of document.querySelectorAll('body *')) { const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(); if (!own || !res.some((r) => r.test(own))) continue;
            const r = e.getBoundingClientRect(); if (r.width <= 8 || r.height <= 8) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue; window.__fakeAt = now; window.__fake = own.slice(0, 40); break; } };
        new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); };
      for (const sc of TABS) {
        const pairs = [PLAIN, ...sc.empty].map((r) => [r.source, r.flags]);
        { // tải nhanh: không nháy
          const S = track(await L.scenario(browser, srv.base, { hash: sc.id, delay: () => 20, init: [init, pairs] }));
          await S.page.getByText(sc.at).first().waitFor({ state: 'visible', timeout: 9000 }); await S.page.waitForTimeout(400);
          const o = await S.page.evaluate(() => ({ b: window.__busyAt, f: window.__fake }));
          check(`${sc.id}: tải nhanh (~20ms mỗi yêu cầu) thì skeleton không hề hiện`, o.b === null, 'skeleton hiện lúc ' + o.b);
          await S.ctx.close();
        }
        { // /api/me trễ 1s, dữ liệu trễ 1,5s: skeleton phải hiện 100-250ms từ lúc điều hướng, tức TRONG lúc chờ /api/me
          const S = track(await L.scenario(browser, srv.base, { hash: sc.id, delay: (p) => (p === '/api/me' ? 1000 : 1500), init: [init, pairs] }));
          await S.page.waitForTimeout(1300); // /api/me đã về (1s), dữ liệu chưa (2,5s)
          const o = await S.page.evaluate(() => ({ b: window.__busyAt, f: window.__fake, fa: window.__fakeAt }));
          const d = o.b && S.t0 ? o.b - S.t0 : null; // gốc thời gian = lúc yêu cầu /api/me đầu tiên tới máy chủ giả (app bắt đầu chờ), không tính thời gian tải và chạy JS
          check(`${sc.id}: khối skeleton hiện trong 100-300ms kể từ yêu cầu /api/me đầu`, d !== null && d >= 100 && d <= 300, d === null ? 'không hiện' : Math.round(d) + 'ms');
          check(`${sc.id}: khối skeleton hiện TRƯỚC khi /api/me trả về (me trễ 1s)`, d !== null && d < 1000, d === null ? 'không hiện' : Math.round(d) + 'ms');
          check(`${sc.id}: suốt lúc chờ (gồm chờ /api/me) không có chữ rỗng giả hay chữ chờ trơn`, o.fa === null, o.f);
          await S.ctx.close();
        }
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC4b: làm mới (B4) ===== */
    if (wants(4)) { crit = 4; try {
      { // màn dựng lại bằng key (Khách mời) mà chưa có dữ liệu: cùng luật skeleton, không rỗng giả
        let slow = false;
        const S = track(await load(browser, srv.base, 'khach-moi', { delay: (p) => (slow && /guests$/.test(p) ? 1500 : 0) })); const { page } = S;
        await page.getByText(/^Nhà trai$/).first().waitFor({ state: 'visible', timeout: 9000 });
        slow = true; S.chatAction = 'add_guest';
        await page.getByRole('button', { name: 'AI', exact: true }).first().click();
        await page.getByRole('textbox', { name: 'Nhắn cho Tơ Hồng' }).fill('thêm khách'); await page.keyboard.press('Enter');
        await page.getByText('Mình đã thêm xong rồi nhé').first().waitFor({ state: 'visible', timeout: 6000 }).catch(async (e) => { throw new Error('không thấy trả lời giả của chat; nút: ' + (await page.getByRole('textbox').count()) + ' ô nhập, yêu cầu chat ' + S.reqs.filter((r) => /chat/.test(r.key)).length); });
        await page.getByRole('button', { name: 'Đóng', exact: true }).first().click(); await page.waitForTimeout(500);
        const got = await statusOf(page).first().isVisible().catch(() => false);
        check('làm mới Khách mời (màn dựng lại, chưa có dữ liệu): hiện skeleton, không phải màn rỗng giả', got);
        const hits = await visibleHits(page, [PLAIN, ...TABS[3].empty]); check('làm mới Khách mời: lúc chờ không có chữ rỗng giả hay nút thêm', hits.length === 0, hits.join(' | '));
        await S.ctx.close();
      }
      { // màn còn dữ liệu (Ngân sách, không dựng lại): giữ dữ liệu, không chèn skeleton
        let slow = false;
        const S = track(await load(browser, srv.base, 'ngan-sach', { delay: (p) => (slow && /budget$/.test(p) ? 1500 : 0) })); const { page } = S;
        const row = page.getByRole('button', { name: /Nhà hàng tiệc cưới/ }).first(); await row.waitFor({ state: 'visible', timeout: 9000 });
        slow = true; S.chatAction = 'add_budget_item';
        await page.getByRole('button', { name: 'AI', exact: true }).first().click();
        await page.getByRole('textbox', { name: 'Nhắn cho Tơ Hồng' }).fill('thêm khoản'); await page.keyboard.press('Enter');
        await page.getByText('Mình đã thêm xong rồi nhé').first().waitFor({ state: 'visible', timeout: 6000 }).catch(async (e) => { throw new Error('không thấy trả lời giả của chat; nút: ' + (await page.getByRole('textbox').count()) + ' ô nhập, yêu cầu chat ' + S.reqs.filter((r) => /chat/.test(r.key)).length); });
        await page.getByRole('button', { name: 'Đóng', exact: true }).first().click(); await page.waitForTimeout(500);
        const n0 = S.reqs.filter((r) => r.key === 'GET /api/couples/c-test/budget').length;
        check('làm mới Ngân sách (còn dữ liệu): đang tải lại thì không chèn skeleton', !(await statusOf(page).first().isVisible().catch(() => false)));
        check('làm mới Ngân sách: dữ liệu cũ vẫn nhìn thấy trong lúc tải lại', await row.isVisible().catch(() => false), 'đã gọi budget ' + n0 + ' lần');
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC7: prefers-reduced-motion ===== */
    if (wants(7)) { crit = 7; try {
      const running = (page) => page.evaluate(`(() => { const R = ${REGION_JS}; if (!R) return null; return document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && R.root.contains(a.effect.target)).length; })()`);
      for (const sc of TABS) {
        for (const reduced of [false, true]) {
          const S = track(await load(browser, srv.base, sc.id, { reduced })); const { page } = S;
          const got = await waitStatus(page); const n = got ? await running(page) : null; const leaves = got ? (await skelLeaves(page))?.leaves?.length : 0;
          if (!reduced) check(`${sc.id}: mặc định skeleton có chuyển động (pulse/shimmer)`, got && n >= 1, got ? 'không có animation chạy' : 'không thấy skeleton');
          else { check(`${sc.id}: bật reduced-motion thì không animation nào chạy trong skeleton`, got && n === 0, got ? n + ' animation vẫn chạy' : 'không thấy skeleton'); check(`${sc.id}: reduced-motion vẫn còn khối skeleton tĩnh nhìn thấy`, got && leaves >= 3); }
          await S.ctx.close();
        }
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC8: truy cập ===== */
    if (wants(8)) { crit = 8; try {
      for (const sc of [...TABS, SUB]) {
        const S = track(await load(browser, srv.base, sc.id)); const { page } = S;
        const got = await waitStatus(page);
        if (!got) { check(`${sc.id}: có role=status "Đang tải" để kiểm`, false); await S.ctx.close(); continue; }
        const st = statusOf(page).first();
        check(`${sc.id}: status nằm trong (hoặc là) vùng aria-busy="true"`, await st.evaluate((e) => !!e.closest('[aria-busy="true"]')));
        check(`${sc.id}: vùng aria-busy chỉ bọc nội dung chờ, không chứa header (tiêu đề, nút Mở menu, AI) hay thanh tab`, await page.evaluate(`(() => { const R = ${REGION_JS}; if (!R) return false; const r = R.root; return !r.querySelector('button[aria-label="Mở menu"]') && ![...r.querySelectorAll('button')].some((b) => ['AI', 'Trang chủ', 'Kế hoạch', 'Ngân sách', 'Khách mời'].includes(b.textContent.trim().replace(/^\\W+/, ''))); })()`));
        const snap = await st.ariaSnapshot().catch(() => '');
        check(`${sc.id}: cây truy cập của vùng chờ chỉ có nhãn "Đang tải" (không nút, liên kết, ô nhập, chữ thừa)`, /Đang tải/.test(snap) && !/\b(button|link|textbox|searchbox|checkbox|img)\b/.test(snap) && snap.split('\n').length <= 3, snap);
        check(`${sc.id}: không phần tử nào trong vùng chờ focus được`, await page.evaluate(`(() => { const R = ${REGION_JS}; return !R || R.root.querySelectorAll('a,button,input,select,textarea,[tabindex],[contenteditable]').length === 0; })()`));
        let bad = null; for (let i = 0; i < 14 && !bad; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('[aria-busy="true"]')))) bad = 'sau ' + (i + 1) + ' lần Tab'; }
        check(`${sc.id}: nhấn Tab 14 lần, focus không vào vùng chờ`, !bad, bad);
        await waitGone(page);
        check(`${sc.id}: tải xong thì không còn aria-busy="true" và role=status "Đang tải"`, (await statusOf(page).count()) === 0 && (await page.locator('[aria-busy="true"]').count()) === 0);
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC9: màu token ===== */
    if (wants(9)) { crit = 9; try {
      for (const sc of [...TABS, SUB]) {
        const S = track(await load(browser, srv.base, sc.id)); const { page } = S;
        const got = await waitStatus(page);
        if (!got) { check(`${sc.id}: có skeleton để đo màu`, false); await S.ctx.close(); continue; }
        const r = await page.evaluate(`(() => { const R = ${REGION_JS}; if (!R) return null; const norm = (v) => { const d = document.createElement('div'); d.style.background = v; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
          const ok = new Set(['var(--line-100)', 'var(--line-200)', 'var(--sand)', 'var(--linen)'].map(norm)); const bad = R.leaves.filter((l) => !ok.has(l.bg)).map((l) => l.bg); return { n: R.leaves.length, bad: [...new Set(bad)] }; })()`);
        check(`${sc.id}: mọi khối skeleton tô bằng token có sẵn (--line-100, --line-200, --sand, --linen)`, !!r && r.n >= 3 && r.bad.length === 0, r ? 'màu lạ: ' + r.bad.join(' ; ') : 'không đo được');
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC10: không cuộn ngang ===== */
    if (wants(10)) { crit = 10; try {
      for (const w of [390, 320]) for (const sc of [...TABS, SUB]) {
        const S = track(await load(browser, srv.base, sc.id, { viewport: { width: w, height: 844 } })); const { page } = S;
        const got = await waitStatus(page);
        const o = got ? await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })) : null;
        check(`${sc.id}@${w}: lúc chờ có skeleton và không cuộn ngang`, got && o.sw <= o.cw, got ? `scrollWidth ${o.sw} > ${o.cw}` : 'không thấy skeleton');
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    /* ===== TC11: không đổi API ===== */
    if (wants(11)) { crit = 11; try {
      // Trần theo từng đường dẫn = số đo trên main 218e623: GET summary 3, GET budget 3, mọi đường khác 1 (me, timeline, guests, conversations, subscription, upgrade-request, connect-requests, PUT timeline).
      const capOf = (k) => (/^GET \/api\/couples\/c-test\/(summary|budget)$/.test(k) ? 3 : 1);
      for (const sc of [...TABS, SUB]) {
        const S = track(await load(browser, srv.base, sc.id, { delay: () => 30 })); const { page } = S;
        try { await (sc.ready ? sc.ready(page) : page.getByText(sc.at).first()).waitFor({ state: 'visible', timeout: 9000 }); } catch { /* đo cả khi chưa hiện */ }
        await page.waitForTimeout(600);
        const keys = S.reqs.map((r) => r.key); const stray = [...new Set(keys.filter((k) => !L.ALLOWED.some((re) => re.test(k))))];
        check(`${sc.id}: chỉ gọi các endpoint đã có`, stray.length === 0, stray.join(' | '));
        const cnt = {}; keys.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; }); const over = Object.entries(cnt).filter(([k, n]) => n > capOf(k)).map(([k, n]) => `${k} x${n} (trần ${capOf(k)})`);
        check(`${sc.id}: không đường dẫn nào gọi nhiều hơn số đo trên main (summary 3, budget 3, còn lại 1)`, over.length === 0, over.join(' | ') + ' ' + JSON.stringify(cnt))
        if (process.env.T061_COUNTS) console.log('     đếm', sc.id, JSON.stringify(cnt));;
        await S.ctx.close();
      }
    } catch (e) { check('luồng đo gặp lỗi: ' + String(e.message).split('\n')[0], false); } }

    for (const S of allScenarios) { if (S.errors.length) { crit = 0; check('không lỗi JavaScript trong trang', false, S.errors[0]); break; } }
    for (const S of allScenarios) { if (S.external.filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)).length) { crit = 0; check('không gọi ra mạng ngoài (trừ phông chữ)', false, S.external[0]); break; } }
  } finally { await browser.close().catch(() => {}); try { fs.rmSync(dist, { recursive: true, force: true }); } catch { /* */ } await srv.close().catch(() => {}); L.killAll(); }
  if (fails.length) { console.log('FAIL ' + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : '')); process.exit(1); }
  console.log('PASS'); process.exit(0);
})().catch((e) => { console.log('FAIL harness: ' + (e && e.stack || e)); process.exit(2); });
