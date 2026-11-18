#!/usr/bin/env node
// T-203 tiêu chí 6 (repo tohong-back): xoá KHÔNG xoá vĩnh viễn dữ liệu nào và KHÔNG đụng dữ liệu người dùng.
// Sau xoá và sau khôi phục: R2 chỉ khác ở (a) tài liệu bản sửa vendor, (b) dòng nhật ký mới; không khoá nào bị mất; hồ sơ/ngân sách/hội thoại của cặp đôi (có nhắc vendor đã xoá) y nguyên từng byte; vendor vẫn nằm trong pool; lịch sử sửa còn đủ.
// Chạy từ gốc tohong-hq: node eval/T-203/check_6_khong_xoa_vinh_vien.mjs
import { fresh, pickTarget, asAdmin, DEL, RES, OVERLAY_KEY, AUDIT_PREFIX, snapshot, diff, reporter, outbound, VENDOR_POOL } from "./lib/common.mjs";
const R = reporter();
const { env, bucket, guard } = fresh();
const A = asAdmin(env);
const T = await pickTarget(env);
for (const [k, v] of Object.entries(guard)) bucket.data.set(k, v.replaceAll("VENDOR_ID", T.id));
const guardKeys = Object.keys(guard);
// 20 lần sửa = lịch sử đã đầy tới trần HISTORY_MAX (20): xoá/khôi phục KHÔNG được đẩy dòng cũ nhất ra (xoá/khôi phục chỉ ghi Nhật ký, không ghi "Lịch sử sửa").
let ver = 0, put = null;
for (let i = 1; i <= 20; i++) {
  put = await A("PUT", `/api/admin/vendors/${T.id}/override`, i < 20 ? { priceMin: 100 + i, priceMax: 200 + i, expected_version: ver } : { priceMin: 8, priceMax: 9, contact: { phone: "0900000002" }, expected_version: ver });
  if (put.status !== 200) break;
  ver = put.json?.version ?? ver + 1;
}
R.check("chuẩn bị: 20 lần sửa thành công, có bản sửa trước khi xoá", put?.status === 200, [put?.status, put?.text?.slice(0, 60)]);
const hist0 = (await A("GET", `/api/admin/vendors/${T.id}`)).json;
const H0 = JSON.stringify(hist0.history || []);
R.check("chuẩn bị: Lịch sử sửa đúng 20 dòng (đầy trần)", (hist0.history || []).length === 20, (hist0.history || []).length);
const S0 = snapshot(bucket);

const del = await A("POST", DEL(T.id), { expected_version: hist0.version, reason: "eval T-203" });
R.check("xoá 200", del.status === 200, [del.status, del.text.slice(0, 60)]);
const S1 = snapshot(bucket), d1 = diff(S0, S1);
R.check("sau xoá: không khoá R2 nào bị mất", d1.removed.length === 0, d1.removed);
R.check("sau xoá: chỉ tài liệu bản sửa vendor đổi, chỉ thêm dòng nhật ký", d1.changed.every((k) => k === OVERLAY_KEY) && d1.added.length >= 1 && d1.added.every((k) => k.startsWith(AUDIT_PREFIX)), d1);
R.check("sau xoá: hồ sơ / ngân sách / hội thoại của cặp đôi (có nhắc vendor) y nguyên từng byte", guardKeys.every((k) => S1.get(k) === S0.get(k)));
R.check("vendor vẫn nằm trong pool (không bị gỡ khỏi dữ liệu nguồn)", VENDOR_POOL.some((v) => v.id === T.id));
const mid = (await A("GET", `/api/admin/vendors/${T.id}`)).json;
R.check("sau xoá: chi tiết admin vẫn trả đủ vendor gốc + bản sửa + Lịch sử sửa y nguyên 20 dòng, không thêm, không mất, không đổi (xoá/khôi phục chỉ vào Nhật ký)", mid?.vendor?.id === T.id && mid?.override?.priceMin === 8 && mid?.override?.contact?.phone === "0900000002" && JSON.stringify(mid?.history || []) === H0, [mid?.vendor?.id, mid?.override, mid?.history?.length, hist0.history?.length]);

const res = await A("POST", RES(T.id), { expected_version: mid.version });
R.check("khôi phục 200", res.status === 200, [res.status, res.text.slice(0, 60)]);
const S2 = snapshot(bucket), d2 = diff(S1, S2);
R.check("sau khôi phục: không khoá nào bị mất; chỉ bản sửa vendor đổi + thêm nhật ký", d2.removed.length === 0 && d2.changed.every((k) => k === OVERLAY_KEY) && d2.added.every((k) => k.startsWith(AUDIT_PREFIX)), d2);
R.check("sau khôi phục: dữ liệu cặp đôi vẫn y nguyên từng byte", guardKeys.every((k) => S2.get(k) === S0.get(k)));
const fin = (await A("GET", `/api/admin/vendors/${T.id}`)).json;
R.check("sau khôi phục: bản sửa giá + liên hệ còn đủ; Lịch sử sửa y nguyên 20 dòng, không thêm, không mất, không đổi (xoá/khôi phục chỉ vào Nhật ký)", fin?.override?.priceMin === 8 && fin?.override?.contact?.phone === "0900000002" && JSON.stringify(fin?.history || []) === H0, [fin?.override, fin?.history?.length]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
