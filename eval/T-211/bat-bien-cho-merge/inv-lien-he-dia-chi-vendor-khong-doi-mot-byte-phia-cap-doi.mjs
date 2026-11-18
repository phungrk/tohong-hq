#!/usr/bin/env node
// Bất biến đề xuất · ĐÍCH: eval/invariants/planner/vendor/ (bề mặt cặp đôi) · nguồn: T-211 (spec products/T-211-sua-tay-dia-chi-sdt-vendor.md v1, Hành vi 7; FR-036 tohong/specs/002-admin-phase1/spec.md:276;
// bất biến đề xuất 1 + 2 của spec, gộp). Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào bể; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-211/bat-bien-cho-merge/ cho tới khi PR back của T-211 merge (ADR-028). Trên main hiện tại (chưa sửa được địa chỉ) script này ĐỎ ở tiền điều kiện; đó là đúng.
// Lưu ý: nếu Capu sau này chọn cho cặp đôi thấy địa chỉ/SĐT vendor (câu hỏi mở của T-211, ADR-134) thì bất biến này lỗi thời có chủ đích: Chief sửa qua decisions/, không để việc mới đỏ oan.
// INV-??? · Địa chỉ và liên hệ vendor (SĐT, Zalo, website) do admin nhập là dữ liệu chỉ admin thấy:
//   (1) mọi bề mặt cặp đôi (chi tiết vendor, ghép theo id / hạng mục, trạng thái, đếm hạng mục, ứng viên chat, khối ứng viên đưa vào prompt AI) Y HỆT TỪNG BYTE trước và sau khi admin nhập
//       hay đổi chúng, kể cả địa chỉ nói tỉnh khác city của vendor và kể cả khi vendor đang Ẩn (nên không lộ và không đổi ghép);
//   (2) luồng kết nối của cặp đôi (gửi yêu cầu, xem yêu cầu của mình) không chứa chúng;
//   (3) đối chứng: admin đọc lại được đúng giá trị (thử nghiệm có nghĩa).
// Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, asAdmin, asCouple, chatMatch, loadOverlay, reporter, outbound, BACK } = L;
const { formatMatchBlock } = await import(pathToFileURL(path.join(BACK, "lib", "matchFormatter.js")).href);
const R = reporter();
const ov = (id) => `/api/admin/vendors/${id}/override`;

const { env, bucket } = fresh();
const A = asAdmin(env), C = asCouple(env);
const T = await pickTarget(env, "photography");
bucket.data.set("data/couples/couple_1/members.json", JSON.stringify([{ user_id: "couple_1", role: "owner" }]));
const detail = async () => (await A("GET", `/api/admin/vendors/${T.id}`)).json || {};
const put = async (body) => A("PUT", ov(T.id), { expected_version: (await detail()).version || 0, ...body });
const snap = async () => {
  await loadOverlay(env, { force: true });
  const g = async (m, p, b) => { const r = await C(m, p, b); return `${r.status} ${r.text}`; };
  const cm = chatMatch(T.mp);
  return {
    "GET /api/vendors/:id": await g("GET", `/api/vendors/${T.id}`),
    "GET /api/vendors/match?ids": await g("GET", `/api/vendors/match?ids=${T.id}`),
    "GET /api/vendors/match?category": await g("GET", `/api/vendors/match?category=${T.category}&limit=50`),
    "POST /api/vendors/status": await g("POST", "/api/vendors/status", { ids: [T.id] }),
    "GET /api/vendors/categories": await g("GET", "/api/vendors/categories"),
    "ứng viên chat": JSON.stringify(cm),
    "khối ứng viên trong prompt AI": String(formatMatchBlock(cm, { guest_count: 100 })),
  };
};
const KEYS = ["SENTINELADDR", "SENTINELZALO", "sentinel-web", "912345678", "912 345 678", "2838222222", "3822 2222"];
const leaks = (t) => KEYS.filter((k) => String(t).toLowerCase().includes(k.toLowerCase()));

const cmp = (label, a, b) => { for (const k of Object.keys(a)) R.check(`${label} · ${k}: y hệt từng byte`, a[k] === b[k], [a[k].slice(0, 80), b[k].slice(0, 80)]); };
const b0 = await snap();
R.check("tiền điều kiện: bề mặt cặp đôi trả 200 và khối prompt có nội dung", ["GET /api/vendors/:id", "POST /api/vendors/status"].every((k) => b0[k].startsWith("200 ")) && b0["khối ứng viên trong prompt AI"].length > 20, Object.values(b0).map((x) => x.slice(0, 4)));

const EDITS = [
  { address: "SENTINELADDR 12 Nguyễn Huệ, Quận 1, TP.HCM", contact: { phone: "0912 345 678", zalo: "SENTINELZALO", website: "https://sentinel-web.example" } },
  { address: "SENTINELADDR 5 Bạch Đằng, Hải Châu, Đà Nẵng", contact: { phone: "+84 28 3822 2222", zalo: "SENTINELZALO", website: "https://sentinel-web.example" } },
];
for (const [i, e] of EDITS.entries()) {
  const r = await put(e);
  const d = await detail();
  R.check(`lần sửa ${i + 1}: admin lưu 200 và đọc lại đúng địa chỉ (đối chứng)`, r.status === 200 && d.override?.address === e.address && typeof d.override?.contact?.phone === "string", [r.status, r.json?.error, d.override]);
  cmp(`sau lần sửa ${i + 1}`, b0, await snap());
}
// Vendor đang Ẩn: bề mặt cặp đôi so với chính nó khi Ẩn mà chưa có liên hệ/địa chỉ
{
  const { env: env2, bucket: bucket2 } = fresh();
  const A2 = asAdmin(env2), C2 = asCouple(env2);
  const det2 = async () => (await A2("GET", `/api/admin/vendors/${T.id}`)).json || {};
  const put2 = async (body) => A2("PUT", ov(T.id), { expected_version: (await det2()).version || 0, ...body });
  const s2 = async () => { await loadOverlay(env2, { force: true }); return { st: (await C2("POST", "/api/vendors/status", { ids: [T.id] })).text, one: (await C2("GET", `/api/vendors/${T.id}`)).text, chat: JSON.stringify(chatMatch(T.mp)) }; };
  await put2({ hidden: true, hidden_reason: "bất biến" });
  const h0 = await s2();
  const r = await put2(EDITS[0]);
  const h1 = await s2();
  R.check("vendor đang Ẩn: sửa 200; /status, /:id, ứng viên chat y hệt trước khi nhập liên hệ/địa chỉ", r.status === 200 && h0.st === h1.st && h0.one === h1.one && h0.chat === h1.chat, [r.status, leaks(h1.st + h1.one)]);
  void bucket2;
}
// Luồng kết nối của cặp đôi
await loadOverlay(env, { force: true });
const mk = await C("POST", "/api/couples/couple_1/connect-requests", { vendor_id: T.id, contact: { phone: "0901234567" }, note: "bất biến", source: "chat", client_request_id: "inv-t211" });
R.check("cặp đôi gửi yêu cầu kết nối: 2xx, phản hồi không chứa địa chỉ/liên hệ vendor", mk.status >= 200 && mk.status < 300 && leaks(mk.text).length === 0, [mk.status, leaks(mk.text)]);
const ls = await C("GET", "/api/couples/couple_1/connect-requests");
R.check("cặp đôi xem yêu cầu của mình: không chứa địa chỉ/liên hệ vendor", ls.status === 200 && leaks(ls.text).length === 0, [ls.status, leaks(ls.text)]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
