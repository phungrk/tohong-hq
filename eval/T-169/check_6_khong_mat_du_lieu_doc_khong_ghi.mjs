// T-169 tiêu chí 6. KHÔNG MẤT DỮ LIỆU và KHÔNG DI TRÚ HÀNG LOẠT:
//  (a) ĐỌC không ghi: mọi bề mặt (GET hồ sơ, summary, Khách mời, Ngân sách, tab Vendor, một lượt chat) không ghi lại profile.yaml, budget.json, guests.json (dữ liệu cũ lệch được chuẩn hoá khi đọc, không đổi tại chỗ);
//  (b) GHI không mất: sau mỗi đường ghi, MỌI đường dẫn khoá có trước trong hồ sơ, bảng ngân sách và danh sách khách vẫn còn; mọi giá trị không thuộc thông tin vừa ghi giữ nguyên
//      (tên, vùng, shortlist, loại trừ, hạng mục + khoản chi của bảng, danh sách khách, khoá lạ `x_ghi_chu_la`); trường cũ của thông tin vừa ghi còn đó (chỉ đổi giá trị).
// Chạy từ gốc tohong-hq: node eval/T-169/check_6_khong_mat_du_lieu_doc_khong_ghi.mjs
import { setup, bucket, readAll, api, chatAction, checker, storedProfile, storedBudget, LECH, BANG, ids, done, KEY } from "./_lib.mjs";
const { fails, eq } = checker(); const M = await setup();
const ov = M.hideAllBut([ids.R1, ids.HN]);
const DS = { capacity: 80, guests: [{ id: "g1", name: "Khách Thử", side: "trai", status: "yes", count: 2, role: "Bạn bè" }], updated_at: "2026-11-01T00:00:00.000Z" };
const leaves = (o, pre = "", out = new Map()) => { if (Array.isArray(o)) { if (!o.length) out.set(pre, "[]"); o.forEach((v, i) => (v && typeof v === "object" ? leaves(v, `${pre}[${i}]`, out) : out.set(`${pre}[${i}]`, v))); } else if (o && typeof o === "object") { const ks = Object.keys(o); if (!ks.length) out.set(pre, "{}"); for (const k of ks) leaves(o[k], pre ? `${pre}.${k}` : k, out); } else out.set(pre, o); return out; };
const snapshot = async (b) => ({ p: leaves(await storedProfile(M, b)), d: leaves(await storedBudget(M, b)), g: leaves(JSON.parse(b.data.get(KEY.guests) ?? "null")) });
// khoá của thông tin: được phép đổi giá trị (không được biến mất). Khác thì phải giữ nguyên giá trị.
const INFO = { date: ["couple.wedding_date", "wedding_date"], guests: ["guest_count", "preferences.guest_count", "couple.guest_count", "guests", "capacity", "total_tr"], budget: ["budget", "total_tr"], city: ["couple.city", "city", "location.city"], style: ["preferences.style_tags", "style_tags", "preferences.theme"], ten: ["couple.bride_name", "couple.groom_name"], vung: ["families.bride_region", "families.groom_region"] };
const base = (path) => path.replace(/\[\d+\]/g, "");
const mayChange = (path, kinds) => kinds.some((k) => INFO[k].includes(base(path))) || /^categories\[\d+\]\.allocated_tr$/.test(path) || path === "updated_at";
function lost(name, before, after, kinds) {
  for (const part of ["p", "d", "g"]) for (const [k, v] of before[part]) {
    const key = (part === "p" ? "" : part === "d" ? "" : "") + k;
    if (!after[part].has(k) && /\[\d+\]/.test(k) && mayChange(k, kinds)) continue; // mảng của thông tin vừa ghi co lại: được
    if (!after[part].has(k)) { fails.push(`${name}: MẤT khoá ${part === "p" ? "hồ sơ" : part === "d" ? "bảng ngân sách" : "danh sách khách"} "${k}"`); continue; }
    if (JSON.stringify(after[part].get(k)) !== JSON.stringify(v) && !(part === "p" ? mayChange(k, kinds) : part === "d" ? mayChange(k, kinds) : mayChange(k, kinds))) fails.push(`${name}: ĐỔI giá trị không thuộc thông tin vừa ghi: ${part}:${k} ${JSON.stringify(v)} -> ${JSON.stringify(after[part].get(k))}`);
  }
}
const mk = () => bucket(M, { profile: LECH(), budget: BANG({ guests: 237, total_tr: 500 }), guests: DS, overlay: ov });

// (a) đọc không ghi
{ const b = mk(); const before = JSON.stringify([...b.data.entries()].filter(([k]) => [KEY.profile, KEY.budget, KEY.guests].includes(k)));
  b.putLog.length = 0; const r = await readAll(M, b); for (const e of r.err) fails.push(`đọc: ${e}`);
  const wrote = b.putLog.filter((k) => [KEY.profile, KEY.budget, KEY.guests].includes(k));
  eq("đọc: không ghi profile.yaml / budget.json / guests.json", wrote, []);
  eq("đọc: nội dung ba tệp y nguyên", JSON.stringify([...b.data.entries()].filter(([k]) => [KEY.profile, KEY.budget, KEY.guests].includes(k))), before); }

// (b) ghi không mất, từng đường
const writes = [
  ["PATCH onboarding", ["date", "guests", "budget", "city", "style", "ten", "vung"], (b) => api(M, b, "PATCH", "", { couple: { bride_name: "Tên Mới", wedding_date: "2028-02-10", city: "Hà Nội" }, families: { bride_region: "Bac" }, preferences: { style_tags: ["modern"], guest_count: 180 }, guest_count: 180, budget: 400 })],
  ["PATCH ngày (Dashboard)", ["date"], (b) => api(M, b, "PATCH", "", { couple: { wedding_date: "2028-01-05" } })],
  ["chat guest_count", ["guests"], (b) => chatAction(M, b, { guest_count: 120 })],
  ["chat wedding_date", ["date"], (b) => chatAction(M, b, { wedding_date: "2028-03-03" })],
  ["chat budget", ["budget"], (b) => chatAction(M, b, { budget: 350 })],
  ["chat city", ["city"], (b) => chatAction(M, b, { city: "HN" })],
  ["chat style_preferences", ["style"], (b) => chatAction(M, b, { style_preferences: ["luxury"] })],
  ["PUT /budget", ["guests", "budget"], (b) => api(M, b, "PUT", "budget", { categories: BANG().categories, total_tr: 999, guests: 150, mung_tr: 7 })],
];
for (const [name, kinds, run] of writes) {
  const b = mk(); const before = await snapshot(b); const r = await run(b);
  if (!r || r.status >= 400 || r.success === false) { fails.push(`${name}: ghi lỗi`); continue; }
  lost(name, before, await snapshot(b), kinds);
}
done(fails);
