// INV-006 · Nguồn: T-172 (spec products/T-172-loi-ai-khong-neu-nguon-gia.md v2, H4 + H5), rút vào bể bởi spec-critic khi T-172 v2 qua Spec Gate 2026-11-15.
// Bổ sung phía AI cho planner/vendor/inv-003 và không phụ thuộc nhãn. Phần F của bản thay inv-003 (eval/T-172/check_7) có F3/F4 ("mục/prompt khác twin") đã được F2 hay
// chip "Lý do khớp" thoả sẵn. Vì thế một bản cài bỏ hẳn tín hiệu ước tính khỏi prompt vẫn qua F, và inv-003 bị nới.
// Tính chất: hai vendor sinh đôi (cùng hạng mục, cùng số, cùng mọi thứ, chỉ khác nguồn giá: estimate_category và legacy_marry). Sau khi bỏ tên vendor, dòng "Phù hợp vì",
// dòng "Lý do khớp" và dòng "Theo số bàn" (là những chỗ đã khác nhau vì chip/ngân sách chứ không vì tín hiệu ước tính), thì:
//   (1) mục của hai vendor trong khối ứng viên chat vẫn phải khác nhau;
//   (2) prompt câu AI "vì sao hợp" (system + user) của hai vendor vẫn phải khác nhau.
// Nghĩa là AI luôn nhận được một tín hiệu riêng cho vendor có giá ước tính, để còn tuân thủ "không khẳng định ngân sách".
// Tín hiệu có thể là nhãn (trước T-172) hay cờ "chưa đủ cơ sở" (sau T-172); bất biến không đo chữ nên xanh cả hai bên. Đo trên ảnh và venue. Không mạng (LLM giả).
// Back hay khung eval không có: PASS "chưa áp dụng". Chạy: node <file>. Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
import { existsSync as __ex } from "fs"; import { fileURLToPath as __f, pathToFileURL as __u } from "url"; import __p from "path";
let __hq = __p.dirname(__f(import.meta.url)); while (!__ex(__p.join(__hq, "scripts", "gate.py")) && __p.dirname(__hq) !== __hq) __hq = __p.dirname(__hq);
const back = process.env.TOHONG_BACK_REPO || __p.join(__hq, "..", "tohong-back");
if (!__ex(__p.join(back, "lib", "vendorPrice.js")) || !__ex(__p.join(__hq, "eval", "T-172", "_lib.mjs"))) { console.log("PASS chưa áp dụng (back chưa có nguồn giá hoặc thiếu khung eval)"); process.exit(0); }
const L = await import(__u(__p.join(__hq, "eval", "T-172", "_lib.mjs")).href);
const fails = []; const bad = (m) => fails.push(m);
L.setNow("2026-11-14T08:00:00Z");
const DROP = /^\s*(Phù hợp vì:|Lý do khớp:|Theo số bàn:)/;
const norm = (text, name) => text.split(name).join("X").split("\n").filter((l) => !DROP.test(l)).join("\n");
for (const [cat, a, b, profile] of [["photography", 6, 8, L.coupleProfile({ budget: 300 })], ["venue", 4, 4.6, L.coupleProfile({ budget: 300, guest_count: 200 })]]) {
  const { M, ids, ov, nameOf } = await L.twinBack([{ cat, price: L.EST(a, b) }, { cat, price: L.REAL(a, b) }]);
  const r = await L.chat(M, { message: L.MSG_BY_CAT[cat], profile, overlay: ov });
  const ents = L.entries(L.candBlock(r.sp || ""), { e: nameOf(ids[0]), g: nameOf(ids[1]) });
  if (!ents.e || !ents.g) bad(`${cat} chat: thiếu ứng viên sinh đôi trong khối (không đo được)`);
  else if (norm(ents.e.join("\n"), nameOf(ids[0])) === norm(ents.g.join("\n"), nameOf(ids[1]))) bad(`${cat} chat: mục của vendor ước tính giống hệt twin giá riêng (ngoài tên/Phù hợp vì/Theo số bàn): AI không có tín hiệu ước tính`);
  const p = [];
  for (const i of [0, 1]) { const o = await L.openDetail(M, ids[i], { overlay: ov, profile, reply: L.whyEcho }); const c = o.calls[0]; p.push(c ? norm(c.system + "\n" + c.user, nameOf(ids[i])) : null); }
  if (p[0] == null || p[1] == null) bad(`${cat} câu AI: không thấy lượt gọi LLM giả (không đo được)`);
  else if (p[0] === p[1]) bad(`${cat} câu AI "vì sao hợp": prompt của vendor ước tính giống hệt twin giá riêng (ngoài tên/Lý do khớp): AI không có tín hiệu ước tính`);
}
L.restoreNow();
if (fails.length) { console.log("FAIL " + fails[0] + (fails.length > 1 ? ` (+${fails.length - 1} lỗi nữa)` : "")); process.exit(1); }
console.log("PASS AI luôn nhận tín hiệu riêng cho vendor giá ước tính (chat + câu vì sao hợp)");
