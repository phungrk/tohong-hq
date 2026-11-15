// T-173 · eval đối kháng 04 (adversary). DỮ LIỆU LẠ / R2 LỖI: ĐỌC KHÔNG SẬP, KHÔNG GHI (spec T-169 H4, H2; ghi chú engineering lựa chọn 8).
// Hồ sơ cũ có kiểu sai (mảng thay số, chuỗi thay mảng, số thay chuỗi, `couple` là chuỗi, `preferences` null), bảng ngân sách hỏng (JSON lỗi, `guests`/`total_tr` là chuỗi),
// và R2 ném lỗi khi đọc budget.json (chat nay đọc bảng MỌI lượt). Kỳ vọng: GET hồ sơ, summary, Khách mời, Ngân sách, tab Vendor và một lượt chat
// không trả 5xx / không ném, và không ghi profile.yaml, budget.json, guests.json.
// Chạy từ gốc tohong-hq: node eval/T-173/adv-04-du-lieu-la-loi-r2-doc-khong-sap-khong-ghi.mjs
import { setup, bucket, readAll, chat, api, ids, done, KEY } from "../T-169/_lib.mjs";
const fails = []; const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const base = { couple: { bride_name: "Cô Dâu Thử", groom_name: "Chú Rể Thử", city: "HCMC", wedding_date: "2027-12-29" }, guest_count: 200, budget: 300, preferences: { style_tags: ["korean"] } };
const CA = [
  ["guest_count là mảng, budget là chuỗi số", { ...base, guest_count: [200], budget: "300" }],
  ["style_tags là chuỗi, theme là chuỗi", { ...base, preferences: { style_tags: "korean", theme: "luxury" }, style_tags: "rustic" }],
  ["city là số, wedding_date là số", { ...base, couple: { ...base.couple, city: 123, wedding_date: 20271229 } }],
  ["couple là chuỗi, preferences null", { ...base, couple: "Alice & Capu", preferences: null }],
  ["hồ sơ rỗng {}", {}],
  ["giá trị NaN/âm/Infinity", { ...base, guest_count: -5, budget: -100, preferences: { guest_count: "Infinity" } }],
];
const FILES = [KEY.profile, KEY.budget, KEY.guests];
const run = async (tag, b) => {
  const before = JSON.stringify(FILES.map((k) => b.data.get(k) ?? null)); b.putLog.length = 0;
  const r = await readAll(M, b); for (const e of r.err) fails.push(`${tag}: ${e}`);
  const wrote = b.putLog.filter((k) => FILES.includes(k)); if (wrote.length) fails.push(`${tag}: đọc mà GHI ${JSON.stringify(wrote)}`);
  if (JSON.stringify(FILES.map((k) => b.data.get(k) ?? null)) !== before) fails.push(`${tag}: nội dung tệp đổi sau khi chỉ đọc`);
  return r;
};
for (const [tag, profile] of CA) await run(tag, bucket(M, { profile, budget: { categories: [{ id: "venue", name: "Tiệc cưới", allocated_tr: 90, items: [] }], total_tr: "500", guests: "250", mung_tr: 0 }, overlay: ov }));
// budget.json không phải JSON / R2 ném lỗi khi đọc budget.json: chỉ đo các bề mặt mà T-173 MỚI cho đọc bảng (chat mọi lượt, GET /api/couples/:id, GET /guests).
// summary và GET /budget đã sập với budget.json hỏng từ trước (main 1519d44), ngoài phạm vi spec này.
for (const [tag, hong] of [["budget.json không phải JSON", (b) => b.data.set(KEY.budget, "{hỏng")], ["R2 ném lỗi khi đọc budget.json", (b) => { b.data.set(KEY.budget, JSON.stringify({ categories: [], total_tr: 300, guests: 200 })); const g = b.get.bind(b); b.get = async (k) => { if (k === KEY.budget) throw new Error("R2 lỗi giả"); return g(k); }; }]]) {
  const b = bucket(M, { profile: base, overlay: ov }); hong(b); const before = b.data.get(KEY.profile); b.putLog.length = 0;
  for (const msg of ["chào em", "Tìm nhà hàng tiệc cưới giúp anh chị"]) { const c = await chat(M, b, msg); if (c.err) fails.push(`${tag}: chat "${msg}" ném ${c.err.message}`); else if (!c.block) fails.push(`${tag}: chat "${msg}" không có khối hồ sơ`); }
  const p = await api(M, b, "GET", ""); if (p.status >= 500 || p.err) fails.push(`${tag}: GET /api/couples/:id ${p.status} ${p.err?.message ?? ""}`);
  const gs = await api(M, b, "GET", "guests"); if (gs.status >= 500 || gs.err) fails.push(`${tag}: GET /guests ${gs.status} ${gs.err?.message ?? ""}`);
  if (b.putLog.filter((k) => FILES.includes(k)).length || b.data.get(KEY.profile) !== before) fails.push(`${tag}: đọc mà ghi R2`); }
done(fails);
