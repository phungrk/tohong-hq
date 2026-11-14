// T-157 adv-05 · biến thể của adv-02/adv-03 sau bản sửa 4cdafb1 (spec T-152 4.2; phân xử Chief: "tên một dòng, không ký tự ẩn").
// (a) Tên/mô tả chỉ gồm ký tự Default_Ignorable_Code_Point ngoài BMP (tag U+E0020–E007F, U+1D173–1D17A, U+1BCA0–1BCA3)
//     hoặc ô trống chữ nổi U+2800 -> trống với cặp đôi. Mong đợi 400 invalid_name / invalid_description.
// (b) Host ảnh mà chuỗi thô KHÔNG phải www.marry.vn nhưng trình duyệt (WHATWG) quy về www.marry.vn: %2E trong host,
//     chữ toàn khổ (ｗｗｗ, U+FF0E), gạch nối mềm U+00AD, thiếu "//" ("https:www.marry.vn", "https:/www.marry.vn").
//     Bộ đọc RFC 3986 (Python urlsplit) đọc host khác hoặc không có host -> hai cách đọc. Mong đợi 400 invalid_photos,
//     hoặc 200 với url lưu có phần authority thô đúng www.marry.vn (không phân biệt hoa thường, cổng 443 hoặc rỗng).
// Không chặn nhầm: tên có emoji cờ (dùng tag chars bên trong chuỗi có chữ), URL marry chữ Việt trong pool.
import { boot, pool, A1 } from "../../T-152/lib/back152.mjs";
import { reporter as rep0 } from "../../T-152/lib/back152.mjs";
const reporter = () => { const r = rep0(); const all = []; return { check(n, ok, x) { if (!ok) all.push(n + (x !== undefined ? " [" + String(JSON.stringify(x)).slice(0, 160) + "]" : "")); r.check(n, ok, x); }, done() { for (const l of all) console.error("  - " + l); r.done(); } }; };
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, info, pub } = await boot();
const P = pool();
const v = P.find((x) => x.category === "photography" && !(x.photos || []).some((p) => p.source === "google"));
const ver = async () => (await info(v.id)).json?.version ?? 0;
const names = { "tag U+E0020/E0041": "\u{E0020}\u{E0041}", "U+1D173": "\u{1D173}\u{1D17A}", "U+1BCA0": "\u{1BCA0}", "U+2800": "⠀⠀", "trộn": " \u{E0020}⠀​ " };
for (const [k, n] of Object.entries(names)) {
  const w0 = bucket.putLog.length;
  const r = await put(v.id, { expected_version: await ver(), name: n }, A1);
  R.check(`tên chỉ ký tự vô hình (${k}) -> 400 invalid_name, không ghi`, r.status === 400 && r.json?.error === "invalid_name" && bucket.putLog.length === w0, [r.status, r.text.slice(0, 60)]);
}
const rd = await put(v.id, { expected_version: await ver(), description: "\u{E0041}\u{E0042}⠀" }, A1);
R.check("mô tả chỉ ký tự vô hình (tag, U+2800) -> 400 invalid_description", rd.status === 400 && rd.json?.error === "invalid_description", [rd.status, rd.text.slice(0, 60)]);
const flag = await put(v.id, { expected_version: await ver(), name: "Studio \u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} Ánh" }, A1);
R.check("tên có chữ thật + emoji cờ (tag chars bên trong) vẫn 200", flag.status === 200, [flag.status, flag.text.slice(0, 60)]);
const rawHostOk = (u) => { const m = /^https:\/\/([^/?#]*)/i.exec(u); return !!m && /^www\.marry\.vn(:443|:)?$/i.test(m[1]); };
const urls = { "%2E trong host": "https://www%2Emarry.vn/images/a.jpg", "%2E trước vn": "https://www.marry%2Evn/images/a.jpg", "toàn khổ ｗｗｗ": "https://ｗｗｗ.marry.vn/images/a.jpg", "dấu chấm toàn khổ": "https://www．marry．vn/images/a.jpg", "gạch nối mềm": "https://www.mar­ry.vn/images/a.jpg", "thiếu //": "https:www.marry.vn/images/a.jpg", "thiếu một /": "https:/www.marry.vn/images/a.jpg" };
for (const [k, u] of Object.entries(urls)) {
  const r = await put(v.id, { expected_version: await ver(), photos: [{ url: u }] }, A1);
  const got = ((await pub(`/api/vendors/${v.id}`)).json?.vendor?.photos || []).map((p) => p.url);
  R.check(`host ảnh hai cách đọc (${k}): 400 invalid_photos, hoặc url lưu có host thô www.marry.vn`, (r.status === 400 && r.json?.error === "invalid_photos") || (r.status === 200 && got.every(rawHostOk)), [r.status, JSON.stringify(got).slice(0, 100)]);
}
const viet = P.find((x) => (x.photos || []).some((p) => p.source === "marry" && /[^\x00-\x7f]/.test(p.url)));
const back = await put(viet.id, { expected_version: 0, photos: viet.photos.filter((p) => p.source === "marry").slice(0, 3).reverse().map((p) => ({ url: p.url })) }, A1);
R.check("gửi lại ảnh marry thật của pool (chữ Việt, đổi thứ tự) vẫn 200", back.status === 200, [back.status, back.text.slice(0, 80)]);
R.done();
