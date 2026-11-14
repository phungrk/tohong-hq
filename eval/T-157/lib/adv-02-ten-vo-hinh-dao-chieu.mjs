// T-157 adv-02 · spec T-152 4.2: name "chuỗi một dòng: NFC, trim, dài 1..120; từ chối mọi ký tự điều khiển";
// description "rỗng sau chuẩn hoá -> lỗi; không bao giờ có ký tự điều khiển". Tên hiệu lực vào thẳng
// khối [VENDOR CANDIDATES] của chat (lib/matchFormatter.js) và thẻ vendor của cặp đôi.
// Input phá: tên chỉ gồm ký tự vô hình (U+200B, U+2060, U+FEFF, U+00AD) => tên trống với cặp đôi;
// tên có ký tự điều khiển hướng chữ (Unicode Bidi_Control: U+202A–202E embed/override, U+2066–2069 isolate)
// => đảo chiều hiển thị tên và chữ đi sau trong khối prompt. Mong đợi: 400 invalid_name / invalid_description
// (hoặc với mô tả: được bỏ đi khi chuẩn hoá). Tên thật có emoji ghép (ZWJ) hay ngoặc vuông vẫn 200.
import { boot, pool, A1 } from "../../T-152/lib/back152.mjs";
import { reporter as rep0 } from "../../T-152/lib/back152.mjs";
// in mọi dòng lỗi ra stderr, dòng kết luận ra stdout như khung chung
const reporter = () => { const r = rep0(); const all = []; return { check(n, ok, x) { if (!ok) all.push(n + (x !== undefined ? " [" + String(JSON.stringify(x)).slice(0, 160) + "]" : "")); r.check(n, ok, x); }, done() { for (const l of all) console.error("  - " + l); r.done(); } }; };
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { bucket, put, info, pub } = await boot();
const P = pool();
const v = P.find((x) => x.category === "photography");
const ver = async () => (await info(v.id)).json?.version ?? 0;
const BIDI = /[‪-‮⁦-⁩]/;
const invisible = { "U+200B": "​", "U+200B x3": "​​​", "U+2060": "⁠", "U+FEFF+U+200B": "﻿​", "U+00AD": "­", "U+200B + dấu cách": " ​ ​ " };
for (const [k, n] of Object.entries(invisible)) {
  const w0 = bucket.putLog.length;
  const r = await put(v.id, { expected_version: await ver(), name: n }, A1);
  R.check(`tên chỉ ký tự vô hình (${k}) -> 400 invalid_name, không ghi`, r.status === 400 && r.json?.error === "invalid_name" && bucket.putLog.length === w0, [r.status, r.text.slice(0, 80)]);
}
const bidi = { "RLO U+202E": "‮abcStudio", "LRO U+202D": "Studio‭abc", "RLE U+202B": "‫Studio", "RLI..PDI U+2067/2069": "Studio ⁧x⁩", "PDF U+202C": "Studio‬" };
for (const [k, n] of Object.entries(bidi)) {
  const w0 = bucket.putLog.length;
  const r = await put(v.id, { expected_version: await ver(), name: n }, A1);
  R.check(`tên có ký tự điều khiển hướng chữ (${k}) -> 400 invalid_name, không ghi`, r.status === 400 && r.json?.error === "invalid_name" && bucket.putLog.length === w0, [r.status, r.text.slice(0, 80)]);
}
const eff = (await pub(`/api/vendors/${v.id}`)).json?.vendor || {};
R.check("tên hiệu lực ở tab Vendor không trống/vô hình, không có ký tự hướng chữ", eff.name && eff.name.replace(/[\s­​-‏⁠-⁤﻿]/g, "").length > 0 && !BIDI.test(eff.name), JSON.stringify(eff.name));
// mô tả
const rd = await put(v.id, { expected_version: await ver(), description: "​⁠﻿" }, A1);
R.check("mô tả chỉ ký tự vô hình -> 400 invalid_description", rd.status === 400 && rd.json?.error === "invalid_description", [rd.status, rd.text.slice(0, 80)]);
const rb = await put(v.id, { expected_version: await ver(), description: "Mô tả ‮gnaỏđ‬ thật" }, A1);
const d = (await pub(`/api/vendors/${v.id}`)).json?.vendor?.description || "";
R.check("mô tả có ký tự override hướng chữ: 400 invalid_description, hoặc 200 và giá trị lưu không còn ký tự đó", (rb.status === 400 && rb.json?.error === "invalid_description") || (rb.status === 200 && !BIDI.test(d)), [rb.status, JSON.stringify(d).slice(0, 80)]);
// không chặn nhầm
const ok1 = await put(v.id, { expected_version: await ver(), name: "Studio 👨‍👩‍👧 Ánh" }, A1);
R.check("tên hợp lệ có emoji ghép (ZWJ U+200D) vẫn 200", ok1.status === 200, [ok1.status, ok1.text.slice(0, 80)]);
const ok2 = await put(v.id, { expected_version: await ver(), name: "[Paper Color] - Thiệp nổi 3D" }, A1);
R.check("tên có ngoặc vuông (có thật trong pool) vẫn 200", ok2.status === 200, [ok2.status, ok2.text.slice(0, 80)]);
const lrm = P.find((x) => /‎/.test(x.description || ""));
if (lrm) {
  const r = await put(lrm.id, { expected_version: 0, description: lrm.description }, A1);
  R.check("gửi lại đúng mô tả pool (có U+200E) không 400", r.status === 200, [r.status, r.text.slice(0, 80)]);
}
R.done();
