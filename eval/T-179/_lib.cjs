/* T-179 khung dùng chung cho eval front (App THẬT qua Root, như eval/T-171/check_6): Ngân sách > Nhà hàng tiệc cưới > nút "Tìm nhà hàng tiệc cưới" > luồng vendor trong khung chat.
 * Dùng lại _lib.cjs của T-171 (vite dev + Playwright + API giả CÓ TRẠNG THÁI: PUT/PATCH đổi dự toán/số khách, GET match/chi tiết tính điểm theo trạng thái; GET budget trả hạng mục venue + guests).
 * Alpha Hall: 3,9tr/bàn, điểm 70 + 30 x điểm ngân sách; Beta Hall: 80 cố định. Số khách 200 = 20 bàn. Dự toán Tiệc cưới 90 -> Alpha 100%, Alpha > Beta; 40 -> Alpha 70%, Beta > Alpha; 70 -> Alpha 83%.
 * Đo CHỮ NGƯỜI DÙNG THẤY và số lần gọi API; không đọc tên hàm/state của front. "Danh sách" = khối có tiêu đề "Gợi ý phù hợp" chứa các hàng vendor (a.vm-card-in).
 * Biến: TOHONG_FRONT_REPO (mặc định ../tohong-front), PLAYWRIGHT_PATH. */
const path = require('path');
const base = require(path.join(__dirname, '..', 'T-171', '_lib.cjs'));
const { sleep } = base;

/* Mọi danh sách vendor đang có trong DOM (kể cả lúc khung chat đóng), theo thứ tự xuất hiện: { text, names, pcts, label, rows }. */
const LISTS_JS = () => {
  const rows = [...document.querySelectorAll('a.vm-card-in')]; const parents = [...new Set(rows.map((r) => r.parentElement))];
  return parents.map((p) => {
    let shell = p; while (shell && !/Gợi ý phù hợp/.test(shell.innerText || '')) shell = shell.parentElement;
    const text = (shell || p).innerText.replace(/\s+/g, ' ').trim();
    const mine = rows.filter((r) => r.parentElement === p);
    const names = mine.map((r) => (/([A-Z][a-z]+) Hall/.exec(r.innerText) || [])[1] || r.innerText.split('\n')[0]);
    const pcts = mine.map((r) => (/(\d+)%/.exec(r.innerText) || [])[1] || null);
    const label = (/(Theo dự toán [\d,]+tr(?: · \d+ khách)?|Chưa có dự toán cho hạng mục này)/.exec(text) || [])[1] || null;
    return { text, names, pcts, label, rows: mine.length };
  });
};
const lists = (pg) => pg.evaluate(LISTS_JS);
const body = (pg) => pg.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const FIND = 'Tìm nhà hàng tiệc cưới';
/* bấm nút Tìm vendor của hạng mục (màn Ngân sách phải đang hiện, khung chat đóng); chờ tới khi số danh sách = want (hoặc hết ms) rồi chờ lắng. */
async function pressFind(pg, want, ms = 6000) {
  await pg.getByText(FIND).first().click();
  const t0 = Date.now(); while (Date.now() - t0 < ms) { const L = await lists(pg); if (L.length >= want && L.every((l) => l.rows > 0)) break; await sleep(150); }
  await sleep(600); return lists(pg);
}
/* bấm nút Tìm vendor rồi chờ cố định (dùng khi KHÔNG mong có danh sách mới). */
async function pressFindQuiet(pg, ms = 1800) { await pg.getByText(FIND).first().click(); await sleep(ms); return lists(pg); }
const closeChat = async (pg) => { await pg.getByRole('button', { name: 'Đóng', exact: true }).first().click(); await sleep(500); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fixed = (L) => L.map((l) => [l.names, l.pcts, l.label, l.text]);  // ảnh chụp nội dung các danh sách để so "giữ nguyên"
const openApp = (dev, br, S, ...r) => base_openApp(dev, br, S, ...r);
let base_openApp; // gán trong run()

async function run(scenario) {
  return base.run(async (h) => { base_openApp = h.openApp; await scenario({ ...h, lists, body, pressFind, pressFindQuiet, closeChat, same, fixed, openApp }); });
}
module.exports = { run, sleep, lists, body, pressFind, pressFindQuiet, closeChat, same, fixed, FIND };
