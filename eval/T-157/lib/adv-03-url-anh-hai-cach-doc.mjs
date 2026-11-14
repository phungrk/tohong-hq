// T-157 adv-03 · spec T-152 4.2 photos: "mỗi url ... giao thức https, hostname đúng www.marry.vn (không userinfo, không đuôi giả);
// không trùng url". Server lưu NGUYÊN chuỗi gửi lên, nên chuỗi phải được mọi bộ đọc URL hiểu như nhau.
// Input phá:
//  - "https://www.marry.vn\@evil.com/a.jpg": trình duyệt (WHATWG) đọc host www.marry.vn, nhưng bộ đọc RFC 3986
//    (Python urllib.parse, inv/kịch bản Python, công cụ mirror) đọc userinfo "www.marry.vn\" và host evil.com.
//  - URL có khoảng trắng/xuống dòng/tab (đầu, cuối, giữa): WHATWG lặng lẽ bỏ, chuỗi lưu vẫn mang ký tự đó
//    (ô "Ảnh (mỗi dòng một URL)" của drawer tách một URL thành hai dòng).
//  - Hai URL chỉ khác hoa/thường ở host là CÙNG một URL -> phải coi là trùng.
// Mong đợi: 400 invalid_photos, hoặc 200 mà url lưu không còn '\', khoảng trắng hay ký tự điều khiển.
// Không chặn nhầm: URL marry có chữ Việt (có thật trong pool) và query có '@' vẫn 200.
import { boot, pool, A1 } from "../../T-152/lib/back152.mjs";
import { reporter as rep0 } from "../../T-152/lib/back152.mjs";
// in mọi dòng lỗi ra stderr, dòng kết luận ra stdout như khung chung
const reporter = () => { const r = rep0(); const all = []; return { check(n, ok, x) { if (!ok) all.push(n + (x !== undefined ? " [" + String(JSON.stringify(x)).slice(0, 160) + "]" : "")); r.check(n, ok, x); }, done() { for (const l of all) console.error("  - " + l); r.done(); } }; };
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, info, pub } = await boot();
const P = pool();
const v = P.find((x) => x.category === "photography" && !(x.photos || []).some((p) => p.source === "google"));
const ver = async () => (await info(v.id)).json?.version ?? 0;
const clean = (u) => !/[\\\s\u0000-\u001f\u007f-\u009f]/.test(u);
const urls = (o) => ((o?.photos) || []).map((p) => p.url);
const r1 = await put(v.id, { expected_version: await ver(), photos: [{ url: "https://www.marry.vn\\@evil.com/a.jpg" }] }, A1);
R.check("url có '\\@' (RFC 3986: userinfo + host evil.com) -> 400 invalid_photos", r1.status === 400 && r1.json?.error === "invalid_photos", [r1.status, r1.text.slice(0, 100)]);
for (const [k, u] of Object.entries({ "đầu dấu cách": " https://www.marry.vn/images/a1.jpg", "cuối tab": "https://www.marry.vn/images/a2.jpg\t", "giữa xuống dòng": "https://www.marry.vn/images/a\n3.jpg", "đầu xuống dòng": "\nhttps://www.marry.vn/images/a4.jpg" })) {
  const r = await put(v.id, { expected_version: await ver(), photos: [{ url: u }] }, A1);
  const got = urls((await pub(`/api/vendors/${v.id}`)).json?.vendor);
  R.check(`url có khoảng trắng/điều khiển (${k}): 400 invalid_photos, hoặc url lưu đã sạch`, (r.status === 400 && r.json?.error === "invalid_photos") || (r.status === 200 && got.every(clean)), [r.status, JSON.stringify(got).slice(0, 120)]);
}
const w0 = bucket.putLog.length;
const r2 = await put(v.id, { expected_version: await ver(), photos: [{ url: "https://www.marry.vn/images/b.jpg" }, { url: "https://WWW.MARRY.VN/images/b.jpg" }] }, A1);
R.check("hai url chỉ khác hoa/thường ở host là trùng -> 400 invalid_photos, không ghi", r2.status === 400 && r2.json?.error === "invalid_photos" && bucket.putLog.length === w0, [r2.status, r2.text.slice(0, 100)]);
// không chặn nhầm
const viet = P.flatMap((x) => (x.photos || []).filter((p) => p.source === "marry")).find((p) => /[^\x00-\x7f]/.test(p.url));
const ok = await put(v.id, { expected_version: await ver(), photos: [{ url: viet.url }, { url: "https://www.marry.vn/images/c.jpg?w=800&ref=a@b" }] }, A1);
R.check("url marry có chữ Việt (có thật trong pool) và query có '@' vẫn 200", ok.status === 200, [ok.status, ok.text.slice(0, 100)]);
const eff = urls((await pub(`/api/vendors/${v.id}`)).json?.vendor);
R.check("ảnh hiệu lực đủ 2 ảnh vừa lưu", eff.length === 2, JSON.stringify(eff).slice(0, 160));
R.done();
