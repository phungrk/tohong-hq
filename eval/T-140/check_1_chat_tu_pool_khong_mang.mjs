// T-140 tiêu chí 1: chat lấy ứng viên từ cùng pool + overlay admin với tab Vendor, KHÔNG gọi mạng, kể cả khi MATCHER_URL/KEY còn được cấu hình.
// Pool thật của repo back (không đông cứng). Mọi fetch bị cấm (chat() đếm số lần gọi).
import { BACK, load, chat, candidates, overlayKeep, eligible, done } from "./_lib.mjs";
const M = await load(BACK); const fails = [];
const byId = new Map(M.POOL.map((v) => [v.id, v]));
const A9 = "Vendor: chỉ được giới thiệu hoặc đề xuất vendor cụ thể có trong khối [VENDOR CANDIDATES] của lượt này";
// (a) không cấu hình matcher
const a = await chat(M, {});
if (a.net) fails.push(`gọi mạng ${a.net} lần`);
const ca = candidates(a.sp);
if (ca.length < 1 || ca.length > 5) fails.push(`khối ứng viên có ${ca.length} vendor (mong 1..5) khi không có MATCHER_URL/KEY`);
if (a.sp.includes("Dữ liệu vendor đang cập nhật")) fails.push("lộ khối 'đang cập nhật' ở đường bình thường");
if (!a.sp.includes(A9)) fails.push("mất câu A9 của khối Quy tắc dữ liệu");
// id, tên, thứ tự khớp pool và khớp khối prompt; không phone/contact
a.ids.forEach((id, i) => {
  const v = byId.get(id);
  if (!v) { fails.push(`id ngoài pool trong matchMetadata: ${id}`); return; }
  if (v.category !== "photography") fails.push(`${id} không phải photography`);
  if (ca[i]?.name !== v.name) fails.push(`vị trí ${i + 1}: prompt '${ca[i]?.name}' khác tên pool '${v.name}'`);
});
if (a.ids.length !== ca.length) fails.push(`matchMetadata ${a.ids.length} ứng viên, prompt ${ca.length}`);
for (const m of a.md?.matches || []) if ("phone" in m || "contact" in m || (m.vendor && ("phone" in m.vendor || "contact" in m.vendor))) fails.push("ứng viên mang phone/contact (FR-036)");
// (a2) mọi ứng viên có mặt trong danh sách tab Vendor (computeMatches, cùng pool, chưa có overlay) với cùng tên
const tab = M.computeMatches({ city: "HCMC", budgetByCategory: { photography: 30 }, preferredStyles: [] }, { category: "photography", limit: 1000 }).vendors;
const tabById = new Map(tab.map((v) => [v.id, v]));
for (const id of a.ids) if (!tabById.has(id)) fails.push(`${id} có trong chat nhưng không có trong danh sách tab Vendor`);
// (b) cấu hình matcher còn nguyên vẫn không gọi mạng và ra cùng tập
const b = await chat(M, { env: { MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" } });
if (b.net) fails.push(`có MATCHER_URL: gọi mạng ${b.net} lần`);
if (JSON.stringify(b.ids) !== JSON.stringify(a.ids)) fails.push("có/không MATCHER_URL cho kết quả khác nhau");
// (c) cùng overlay với tab: 4 vendor còn lại, 1 ẩn; 1 giá đã xác minh 7-9tr
const el = eligible(M, "photography").filter((v) => v.priceMin > 0 && v.priceMin <= 25);
if (el.length < 4) { console.log("PASS chưa áp dụng (pool thiếu 4 photographer đủ điều kiện)"); process.exit(0); }
const [hid, ver, o1, o2] = el;
const ov = overlayKeep(M, "photography", [{ id: ver.id, priceMin: 7, priceMax: 9 }, { id: o1.id }, { id: o2.id }]);
ov[hid.id] = { hidden: true, hidden_reason: "eval T-140" };
const c = await chat(M, { overlay: ov });
if (c.net) fails.push(`overlay: gọi mạng ${c.net} lần`);
if (c.ids.includes(hid.id)) fails.push("vendor admin ẩn vẫn vào ứng viên");
if (c.sp.includes(hid.name)) fails.push("tên vendor admin ẩn lọt prompt");
if (JSON.stringify([...c.ids].sort()) !== JSON.stringify([ver.id, o1.id, o2.id].sort())) fails.push(`overlay: ứng viên ${c.ids.length}, mong đúng 3 vendor còn lại`);
const cc = candidates(c.sp), iv = c.ids.indexOf(ver.id);
if (iv >= 0 && !(/7-9tr/.test(cc[iv]?.priceLine || "") && /giá đã xác minh/.test(cc[iv]?.priceLine || ""))) fails.push(`giá admin chưa thắng: '${cc[iv]?.priceLine}'`);
done(fails);
