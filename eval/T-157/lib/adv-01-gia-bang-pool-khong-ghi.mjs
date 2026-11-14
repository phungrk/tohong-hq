// T-157 adv-01 · spec T-152 4.2: "PUT không đổi gì trả 200, không ghi R2, không tăng version, không thêm lịch sử.
// 'Không đổi gì' so với giá trị HIỆU LỰC đang có (pool + ghi đè), không so với ghi đè đã lưu."
// và 4.4: "một lần ghi, một etag, nên không có chuyện đã sửa mà thiếu lịch sử".
// Input phá: tab Vendor admin gửi priceMin/priceMax BẰNG đúng giá pool (giá hiệu lực không đổi).
import { boot, pool, A1 } from "../../T-152/lib/back152.mjs";
import { reporter as rep0 } from "../../T-152/lib/back152.mjs";
// in mọi dòng lỗi ra stderr, dòng kết luận ra stdout như khung chung
const reporter = () => { const r = rep0(); const all = []; return { check(n, ok, x) { if (!ok) all.push(n + (x !== undefined ? " [" + String(JSON.stringify(x)).slice(0, 160) + "]" : "")); r.check(n, ok, x); }, done() { for (const l of all) console.error("  - " + l); r.done(); } }; };
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, info, pub } = await boot();
const P = pool();
const [v1, v2] = P.filter((v) => v.category === "photography" && v.priceMin > 0 && v.priceMax >= v.priceMin).slice(0, 2);
// (a) vendor chưa có ghi đè
let w0 = bucket.putLog.length;
const r1 = await put(v1.id, { expected_version: 0, priceMin: v1.priceMin, priceMax: v1.priceMax }, A1);
let i1 = (await info(v1.id)).json || {};
R.check("giá = giá pool lên vendor chưa có ghi đè: 200, không ghi R2", r1.status === 200 && bucket.putLog.length === w0, [r1.status, bucket.putLog.length - w0]);
R.check("không tạo ghi đè: override null, version 0", i1.override === null && i1.version === 0, [String(JSON.stringify(i1.override)).slice(0, 120), i1.version]);
R.check("không có nhãn 'admin sửa' (edited_fields rỗng) và không lịch sử", (i1.edited_fields || []).length === 0 && (i1.history || []).length === 0, [JSON.stringify(i1.edited_fields), (i1.history || []).length]);
// (b) vendor đã có ghi đè khác (tên): giá = pool không phải thay đổi
await put(v2.id, { expected_version: 0, name: "Tên sửa adv01" }, A1);
let i2 = (await info(v2.id)).json || {};
const vv = i2.version, hl = (i2.history || []).length;
w0 = bucket.putLog.length;
const r2 = await put(v2.id, { expected_version: vv, priceMin: v2.priceMin }, A1);
i2 = (await info(v2.id)).json || {};
R.check("vendor đã có ghi đè: priceMin = giá hiệu lực -> 200, không ghi, version giữ, không thêm lịch sử", r2.status === 200 && bucket.putLog.length === w0 && i2.version === vv && (i2.history || []).length === hl, [r2.status, bucket.putLog.length - w0, i2.version, vv]);
R.check("edited_fields không có priceMin", !(i2.edited_fields || []).includes("priceMin"), JSON.stringify(i2.edited_fields));
// bất kỳ lần ghi nào cũng phải có lịch sử (không 'đã sửa mà thiếu lịch sử')
const v3 = P.filter((v) => v.category === "photography" && v.priceMin > 0)[2];
const r3 = await put(v3.id, { expected_version: 0, priceMin: v3.priceMin, price_verified: true }, A1);
const i3 = (await info(v3.id)).json || {};
R.check("ghi thật (price_verified) thì có mục lịch sử", r3.status === 200 && (i3.history || []).length === 1, [r3.status, (i3.history || []).length]);
const eff = (await pub(`/api/vendors/${v1.id}`)).json?.vendor || {};
R.check("tab Vendor vẫn giá pool", eff.priceMin === v1.priceMin && eff.priceMax === v1.priceMax, [eff.priceMin, eff.priceMax]);
R.done();
