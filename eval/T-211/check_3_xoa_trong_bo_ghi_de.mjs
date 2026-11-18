#!/usr/bin/env node
// T-211 tiêu chí 3 (repo tohong-back): giá trị trống = xoá trường (không lỗi); xoá từng trường không đụng trường khác; Bỏ ghi đè (DELETE) xoá cả hai về "chưa có"; lưu y giá trị cũ là không làm gì.
// Chạy từ gốc tohong-hq: node eval/T-211/check_3_xoa_trong_bo_ghi_de.mjs
import { setup, reporter, outbound, addrOf, phoneOf } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, del, bucket, audit } = S;
const ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM", PH = "0912345678";
const before = JSON.stringify((await detail()).vendor);
const seed = await put({ address: ADDR, contact: { phone: PH, zalo: "0909000111", website: "https://v.example" } });
R.check("tiền điều kiện: lưu địa chỉ + SĐT + zalo + website 200", seed.status === 200 && addrOf(await detail()) === ADDR && phoneOf(await detail()) === PH, [seed.status, seed.json?.error]);
// Không làm gì: cùng giá trị (kể cả viết khác đi) -> 200, không ghi, không phiên bản, không nhật ký, không lịch sử
{
  const v0 = (await detail()).version, h0 = (await detail()).history.length, a0 = (await audit()).length, w0 = bucket.putLog.length;
  const r1 = await put({ address: "  12  Nguyễn Huệ, Quận 1, TP.HCM " });
  const r2 = await put({ contact: { phone: "0912 345 678", zalo: "0909000111", website: "https://v.example" } });
  const d = await detail();
  R.check("lưu lại đúng giá trị (viết khác khoảng trắng / dấu cách SĐT): 200, không ghi R2, không đổi phiên bản, không thêm lịch sử, không thêm Nhật ký",
    r1.status === 200 && r2.status === 200 && bucket.putLog.length === w0 && d.version === v0 && d.history.length === h0 && (await audit()).length === a0, [r1.status, r2.status, bucket.putLog.length - w0, d.version - v0]);
}
// Xoá địa chỉ bằng null: SĐT, zalo, website còn
let r = await put({ address: null });
let d = await detail();
R.check("address:null -> 200, địa chỉ mất, SĐT/zalo/website còn nguyên", r.status === 200 && addrOf(d) === null && !("address" in (d.override || {})) && phoneOf(d) === PH && d.override?.contact?.zalo === "0909000111" && d.override?.contact?.website === "https://v.example", [r.status, d.override]);
for (const empty of ["", "   ", "​‪", "\n\t "]) {
  await put({ address: ADDR });
  r = await put({ address: empty });
  d = await detail();
  R.check(`address ${JSON.stringify(empty)} (trống sau chuẩn hoá) = xoá: 200, không có trường address`, r.status === 200 && addrOf(d) === null && phoneOf(d) === PH, [r.status, r.json?.error, d.override]);
}
// Xoá SĐT bằng cách gửi contact không có phone: zalo/website còn; địa chỉ còn
await put({ address: ADDR });
for (const emptyPhone of [{ zalo: "0909000111", website: "https://v.example" }, { phone: "", zalo: "0909000111", website: "https://v.example" }, { phone: "  ", zalo: "0909000111", website: "https://v.example" }, { phone: null, zalo: "0909000111", website: "https://v.example" }]) {
  await put({ contact: { phone: PH, zalo: "0909000111", website: "https://v.example" } });
  r = await put({ contact: emptyPhone });
  d = await detail();
  R.check(`contact ${JSON.stringify(emptyPhone).slice(0, 40)}: SĐT bị xoá, zalo/website/địa chỉ còn`, r.status === 200 && phoneOf(d) === null && d.override?.contact?.zalo === "0909000111" && d.override?.contact?.website === "https://v.example" && addrOf(d) === ADDR, [r.status, r.json?.error, d.override]);
}
// Xoá hết: không còn bản ghi
await put({ contact: { phone: PH } });
r = await put({ address: null, contact: null });
d = await detail();
R.check("address:null + contact:null: không còn bản sửa nào (override null)", r.status === 200 && d.override === null, [r.status, d.override]);
// Xoá khi chưa có: không làm gì
{
  const w0 = bucket.putLog.length;
  const r1 = await put({ address: null }), r2 = await put({ address: "" });
  R.check("xoá địa chỉ khi chưa có địa chỉ: 200, không ghi gì", r1.status === 200 && r2.status === 200 && bucket.putLog.length === w0, [r1.status, r2.status, bucket.putLog.length - w0]);
}
// Bỏ ghi đè cả vendor: DELETE
await put({ address: ADDR, contact: { phone: PH, zalo: "0909000111" } });
const del1 = await del();
d = await detail();
R.check("Bỏ ghi đè (DELETE): 200; override null; phiên bản 0; không còn địa chỉ/SĐT", del1.status === 200 && d.override === null && d.version === 0, [del1.status, d.override, d.version]);
R.check("giá trị gốc: vendor pool y nguyên (không trường address/phone; không đổi byte nào)", JSON.stringify(d.vendor) === before && d.vendor?.address === undefined && d.vendor?.phone === undefined);
const del2 = await S.A("DELETE", `/api/admin/vendors/${S.T.id}/override?expected_version=0`);
R.check("DELETE lần hai: 404 override_not_found", del2.status === 404 && del2.json?.error === "override_not_found", [del2.status, del2.json?.error]);
R.check("Bỏ ghi đè xoá cả hai trường cùng lúc, chỉ một dòng Nhật ký vendor.override_clear cho lần đó", (await audit("&action=vendor.override_clear")).length === 1, null);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
