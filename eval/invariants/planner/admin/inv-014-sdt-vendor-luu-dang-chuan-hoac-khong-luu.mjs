#!/usr/bin/env node
// Bất biến đề xuất · ĐÍCH: eval/invariants/planner/admin/ · nguồn: T-211 (spec products/T-211-sua-tay-dia-chi-sdt-vendor.md v1, Hành vi 2 và 3, "Lỗi: ... không ghi gì").
// Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào bể; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-211/bat-bien-cho-merge/ cho tới khi PR back của T-211 merge (ADR-028). Trên main hiện tại script này ĐỎ; đó là đúng.
// INV-??? · Số điện thoại / địa chỉ vendor admin gõ tay chỉ có hai kết cục: được lưu ở dạng chuẩn (SĐT: chỉ chữ số, đúng một dạng số Việt Nam — di động 10 số,
//   cố định 02 + 9 số, tổng đài 1800/1900), hoặc bị từ chối 400 (invalid_phone / invalid_address) mà KHÔNG ghi gì (lưu trữ y nguyên, phiên bản giữ, giá trị cũ còn).
//   Không bao giờ có trạng thái lưng chừng (lưu một nửa yêu cầu, lưu chuỗi thô, lặng lẽ coi là rỗng).
// Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, asAdmin, snapshot, diff, reporter, outbound } = L;
const R = reporter();
const ov = (id) => `/api/admin/vendors/${id}/override`;
const { env, bucket } = fresh();
const A = asAdmin(env);
const T = await pickTarget(env, "photography");
const detail = async () => (await A("GET", `/api/admin/vendors/${T.id}`)).json || {};
const put = async (body) => A("PUT", ov(T.id), { expected_version: (await detail()).version || 0, ...body });
const CANON = /^(0[35789]\d{8}|02\d{9}|1[89]00\d{4,6})$/;
const GOOD = ["0912 345 678", "+84 912-345-678", "0084 98 765 4321", "(028) 3822 2222", "+84 236 3123 456", "1900 1234", "1800-123456", " 0321.234.567\n"];
const BAD = ["0912345678 / 0987654321", "0412345678", "091234567", "+1 415 555 0100", "0912 345 678 ext 3", "O912345678", 912345678, ["0912345678"]];
const ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM";
const seed = await put({ address: ADDR, contact: { phone: "0987654321" } });
R.check("tiền điều kiện: lưu địa chỉ + SĐT 200", seed.status === 200 && (await detail()).override?.address === ADDR, [seed.status, seed.json?.error]);
for (const p of GOOD) {
  const r = await put({ address: ADDR, contact: { phone: p } });
  const got = (await detail()).override?.contact?.phone;
  R.check(`SĐT ${JSON.stringify(p)}: 200 và lưu dạng chuẩn chỉ chữ số`, r.status === 200 && typeof got === "string" && CANON.test(got), [r.status, r.json?.error, got]);
}
await put({ address: ADDR, contact: { phone: "0987654321" } });
for (const [label, body, code] of [
  ...BAD.map((p) => [`SĐT ${JSON.stringify(p)}`, { address: "99 Lê Lợi, Quận 1", contact: { phone: p } }, "invalid_phone"]),
  ["địa chỉ quá ngắn kèm SĐT hợp lệ", { address: "abc", contact: { phone: "0912345678" } }, "invalid_address"],
  ["địa chỉ toàn dấu câu", { address: "-----", contact: { phone: "0912345678" } }, "invalid_address"],
  ["địa chỉ quá dài", { address: "a".repeat(251) }, "invalid_address"],
]) {
  const s0 = snapshot(bucket), v0 = (await detail()).version;
  const r = await put(body);
  const d = diff(s0, snapshot(bucket)), after = await detail();
  R.check(`${label}: 400 ${code}, không ghi gì, giá trị cũ còn nguyên (cả trường hợp lệ đi kèm)`,
    r.status === 400 && r.json?.error === code && d.added.length + d.removed.length + d.changed.length === 0 && after.version === v0 && after.override?.address === ADDR && after.override?.contact?.phone === "0987654321",
    [r.status, r.json?.error, d, after.override?.address, after.override?.contact?.phone]);
}
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
