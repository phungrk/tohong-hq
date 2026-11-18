#!/usr/bin/env node
// T-211 tiêu chí 1 (repo tohong-back): số điện thoại vendor admin nhập (contact.phone) được kiểm định dạng Việt Nam và chuẩn hoá về chuỗi chỉ-chữ-số.
// Chạy từ gốc tohong-hq: node eval/T-211/check_1_sdt.mjs
import { setup, reporter, outbound, OVERLAY_KEY } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, bucket, T } = S;
const OK = [
  ["0912345678", "0912345678"], ["0912 345 678", "0912345678"], ["091-234-5678", "0912345678"], ["(091) 234.5678", "0912345678"],
  [" 0912345678 ", "0912345678"], ["0912345678\n", "0912345678"], ["+84 912 345 678", "0912345678"], ["+84912345678", "0912345678"],
  ["84912345678", "0912345678"], ["0084 912 345 678", "0912345678"], ["0987654321", "0987654321"], ["0321234567", "0321234567"],
  ["0521234567", "0521234567"], ["0721234567", "0721234567"], ["0821234567", "0821234567"],
  ["028 3822 2222", "02838222222"], ["(028) 3822-2222", "02838222222"], ["+84 28 3822 2222", "02838222222"], ["024 3825 1234", "02438251234"], ["0236 3123 456", "02363123456"],
  ["1900 1234", "19001234"], ["1800 6789", "18006789"], ["1900-123456", "1900123456"],
  ["‪0912 345 678‬", "0912345678"], ["0912​345678", "0912345678"], ["0912 345 678", "0912345678"],
];
for (const [input, want] of OK) {
  const r = await put({ contact: { phone: input } });
  const got = (await detail()).override?.contact?.phone;
  R.check(`hợp lệ ${JSON.stringify(input)} -> 200, lưu ${want}`, r.status === 200 && got === want, [r.status, r.json?.error, got]);
}
const BAD = ["123", "abc", "09123", "0912345678 / 0987654321", "0912345678, 0987654321", "0912345678; 0987654321", "0912 345 678 ext 3", "O912345678", "+1 415 555 0100",
  "+84 0912 345 678", "0112345678", "0412345678", "0212345678", "091234567", "09123456789", "1900", "190012", "19001234567890", "+0912345678", "09-12-34-56-78x",
  "０９１２３４５６７８", "0912\n345678", "0912345678 (anh Hùng)", "x".repeat(41), "0912 ".repeat(9), 912345678, ["0912345678"], { n: "0912345678" }, true];
const base = await detail();
await put({ contact: { phone: "0912345678" } });
const s0 = S.snapshot(bucket), v0 = (await detail()).version;
for (const input of BAD) {
  const r = await put({ contact: { phone: input } });
  R.check(`không hợp lệ ${JSON.stringify(input).slice(0, 40)} -> 400 invalid_phone`, r.status === 400 && r.json?.error === "invalid_phone", [r.status, r.json?.error]);
}
const d0 = S.diff(s0, S.snapshot(bucket));
R.check("các lần bị từ chối không ghi gì (không đổi R2, không đổi phiên bản, số cũ còn nguyên)", d0.added.length + d0.removed.length + d0.changed.length === 0 && (await detail()).version === v0 && (await detail()).override?.contact?.phone === "0912345678", d0);
// Số cũ (nhập trước T-211, chữ tự do) đã nằm sẵn trong R2: nếu giữ nguyên thì lưu zalo không bị 400; đổi số thì phải qua kiểm định.
const S2 = await setup();
const LEG = "0909 000 111 (anh Hùng)";
S2.bucket.data.set(OVERLAY_KEY, JSON.stringify({ seq: 1, vendors: { [S2.T.id]: { contact: { phone: LEG }, version: 1, updated_at: "2026-01-01T00:00:00.000Z", updated_by: "admin" } }, history: {} }));
const { loadOverlay, resetOverlayCache } = await import("./lib/common.mjs");
resetOverlayCache(); await loadOverlay(S2.env, { force: true });
const keep = await S2.put({ contact: { phone: LEG, zalo: "0909000111" } });
R.check("số cũ giữ nguyên chuỗi + đổi zalo: 200, số cũ không bị ép chuẩn hoá", keep.status === 200 && (await S2.detail()).override?.contact?.phone === LEG && (await S2.detail()).override?.contact?.zalo === "0909000111", [keep.status, keep.json?.error]);
const chg = await S2.put({ contact: { phone: "0909 000 11" } });
R.check("đổi số cũ sang giá trị sai: 400 invalid_phone", chg.status === 400 && chg.json?.error === "invalid_phone", [chg.status, chg.json?.error]);
const chg2 = await S2.put({ contact: { phone: "0909 000 222" } });
R.check("đổi số cũ sang giá trị đúng: 200, lưu dạng chuẩn", chg2.status === 200 && (await S2.detail()).override?.contact?.phone === "0909000222", [chg2.status, chg2.json?.error]);
R.check("tiền điều kiện: pool gốc không có trường phone/address (không có giá trị gốc để điền sẵn)", base.vendor?.phone === undefined && base.vendor?.address === undefined, Object.keys(base.vendor || {}));
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
