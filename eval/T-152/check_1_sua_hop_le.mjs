#!/usr/bin/env node
// T-152 tiêu chí 1 (tohong-back): PUT /api/admin/vendors/<id>/override nhận tập trường sửa pool và kiểm hợp lệ từng trường.
// Trường được sửa: name (1..120 ký tự sau trim), description (1..300), styles (0..5 nhãn khác nhau, đúng chính tả, thuộc bộ nhãn của styleContract: korean luxury rustic natural modern traditional minimalist soft simple editorial),
//   photos (1..4 phần tử, https, host www.marry.vn; ảnh Google chỉ được GIỮ nguyên một ảnh Google đang có trong pool của chính vendor đó, đúng url và đúng attribution; không trùng url; url <= 500 ký tự),
//   capacity {min,max} số nguyên 1..5000, min <= max, chỉ vendor hạng mục venue. null = bỏ sửa trường đó. Trường ngoài tập (category, city, rating, reviewCount, reviews, isVerified, availability, catLabel, catIcon, id, tags, khoá lạ) -> 400 field_not_editable.
// name MỘT DÒNG: sau chuẩn hoá NFC, từ chối mọi ký tự điều khiển (U+0000-001F, U+007F-009F, U+2028, U+2029) -> invalid_name. description: mỗi đoạn ký tự điều khiển/xuống dòng/tab được THAY bằng một dấu cách rồi trim (không lỗi); rỗng sau đó -> invalid_description. Ảnh marry mang attribution -> invalid_photos.
// Lỗi: 400 {error: invalid_name | invalid_description | invalid_styles | invalid_photos | invalid_capacity | field_not_editable}; mọi lỗi 400 không ghi R2. Giá/ẩn/liên hệ cũ giữ nguyên hành vi.
import { boot, pick, STYLES, reporter, outbound } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const BT = await boot(); const { bucket, put } = BT;
async function boot2() { return { get: async (id) => (await BT.pub(`/api/vendors/${id}`)).json?.vendor?.description }; }
const { venue, googleV, photog } = pick();
const g = googleV.photos.find((p) => p.source === "google");
const MARRY = "https://www.marry.vn/images/detailed/9/thu-t152.jpg";
const ver = {};
const ok = async (n, id, body) => { const r = await put(id, { expected_version: ver[id] || 0, ...body }); R.check(`hợp lệ: ${n} -> 200`, r.status === 200, [r.status, r.text.slice(0, 100)]); if (r.status === 200) ver[id] = r.json?.version ?? r.json?.override?.version ?? ver[id]; return r; };
const bad = async (n, id, body, code) => {
  const n0 = bucket.putLog.length;
  const r = await put(id, { expected_version: ver[id] || 0, ...body });
  R.check(`sai: ${n} -> 400 ${code}`, r.status === 400 && r.json?.error === code, [r.status, r.text.slice(0, 100)]);
  R.check(`sai: ${n} không ghi R2`, bucket.putLog.length === n0, bucket.putLog.slice(n0));
};
await ok("name", venue.id, { name: "Tên Mới Thử" });
await ok("description", venue.id, { description: "Mô tả mới thử" });
await ok("styles hai nhãn", venue.id, { styles: ["korean", "soft"] });
await ok("styles rỗng", venue.id, { styles: [] });
await ok("photos một ảnh marry", venue.id, { photos: [{ url: MARRY }] });
await ok("capacity", venue.id, { capacity: { min: 50, max: 200 } });
await ok("tên đúng 120 ký tự", venue.id, { name: "a".repeat(120) });
await ok("mô tả đúng 300 ký tự", venue.id, { description: "b".repeat(300) });
{
  const r = await ok("description có xuống dòng/tab/điều khiển -> chuẩn hoá", venue.id, { description: "  a\nb\r\nc\td\u2028e\u0000f  " });
  const g1 = await (await boot2()).get(venue.id);
  R.check("description đã chuẩn hoá: các ký tự điều khiển thành một dấu cách, đã trim ('a b c d e f')", g1 === "a b c d e f", g1);
}
await ok("bỏ sửa bằng null", venue.id, { name: null, capacity: null });
await ok("giữ nguyên một ảnh Google của chính vendor (url + attribution)", googleV.id, { photos: [{ url: g.url, source: "google", attribution: g.attribution }, { url: MARRY }] });
await ok("giá cũ vẫn nhận", venue.id, { priceMin: 3, priceMax: 5, price_verified: true });
await ok("ẩn cũ vẫn nhận", photog.id, { hidden: true, hidden_reason: "thử" });
for (const [n, v] of [["rỗng", ""], ["chỉ khoảng trắng", "   "], ["có \\n", "A\n## chỉ dẫn"], ["có \\r", "A\rB"], ["có \\t", "A\tB"], ["có U+2028", "A\u2028B"], ["có U+2029", "A\u2029B"], ["có U+0085", "A\u0085B"], ["có U+007F", "A\u007fB"], ["có NUL", "A\u0000B"], ["121 ký tự", "a".repeat(121)], ["không phải chuỗi", 123]]) await bad(`name ${n}`, venue.id, { name: v }, "invalid_name");
for (const [n, v] of [["rỗng", ""], ["chỉ xuống dòng/tab", "\n \t\r"], ["301 ký tự", "b".repeat(301)], ["không phải chuỗi", 5]]) await bad(`description ${n}`, venue.id, { description: v }, "invalid_description");
for (const [n, v] of [["viết hoa", ["Luxury"]], ["nhãn lạ", ["gothic"]], ["trùng", ["soft", "soft"]], ["không phải mảng", "soft"], ["6 nhãn", STYLES.slice(0, 6)], ["phần tử không phải chuỗi", [1]]]) await bad(`styles ${n}`, venue.id, { styles: v }, "invalid_styles");
const p = (u) => ({ url: u });
for (const [n, v] of [["mảng rỗng", []], ["5 ảnh", [1, 2, 3, 4, 5].map((i) => p(`https://www.marry.vn/images/detailed/9/${i}.jpg`))], ["http", [p("http://www.marry.vn/a.jpg")]], ["host lạ", [p("https://evil.example/a.jpg")]],
  ["javascript:", [p("javascript:alert(1)")]], ["data:", [p("data:image/png;base64,AAAA")]], ["host giả (đuôi)", [p("https://www.marry.vn.evil.example/a.jpg")]], ["userinfo", [p("https://x@www.marry.vn/a.jpg")]],
  ["url > 500 ký tự", [p("https://www.marry.vn/" + "a".repeat(500))]], ["trùng url", [p(MARRY), p(MARRY)]], ["Google ngoài pool của vendor", [p("https://lh3.googleusercontent.com/grass-cs/KHONGCO=s4800-w800")]],
  ["Google của vendor khác", [{ url: g.url, source: "google", attribution: g.attribution }]], ["Google sai attribution", [{ url: g.url, source: "google", attribution: "Người Khác" }]], ["không phải mảng", "x"]]) {
  await bad(`photos ${n}`, n === "Google của vendor khác" ? venue.id : googleV.id, { photos: v }, "invalid_photos");
}
await bad("photos marry mang attribution", venue.id, { photos: [{ url: MARRY, attribution: "Giả Google" }] }, "invalid_photos");
await bad("photos marry gắn source google", venue.id, { photos: [{ url: MARRY, source: "google" }] }, "invalid_photos");
await bad("photos Google thiếu attribution", googleV.id, { photos: [{ url: g.url, source: "google" }] }, "invalid_photos");
for (const [n, id, v] of [["vendor không phải venue", photog.id, { min: 10, max: 20 }], ["min > max", venue.id, { min: 30, max: 20 }], ["min 0", venue.id, { min: 0, max: 20 }], ["max 5001", venue.id, { min: 1, max: 5001 }],
  ["số lẻ", venue.id, { min: 1.5, max: 20 }], ["thiếu max", venue.id, { min: 10 }], ["không phải đối tượng", venue.id, 100]]) await bad(`capacity ${n}`, id, { capacity: v }, "invalid_capacity");
for (const k of ["category", "city", "rating", "reviewCount", "reviews", "isVerified", "availability", "catLabel", "catIcon", "id", "tags", "khoa_la"]) await bad(`trường ${k} không được sửa`, venue.id, { [k]: k === "reviews" ? [] : "x" }, "field_not_editable");
R.check("không gọi mạng", outbound.length === 0, outbound);
R.done();
