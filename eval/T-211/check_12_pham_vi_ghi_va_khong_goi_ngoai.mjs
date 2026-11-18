#!/usr/bin/env node
// T-211 tiêu chí 12 (repo tohong-back): sửa/bỏ địa chỉ + SĐT chỉ ghi bản ghi sửa của vendor và Nhật ký (không đụng dữ liệu cặp đôi, hồ sơ, hội thoại, ngân sách; không tạo khoá R2 lạ) và KHÔNG gọi mạng ngoài (không Google Maps/Places).
// Chạy từ gốc tohong-hq: node eval/T-211/check_12_pham_vi_ghi_va_khong_goi_ngoai.mjs
import { setup, reporter, outbound, addrOf, snapshot, diff, OVERLAY_KEY, AUDIT_PREFIX } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, del, bucket, guard, T } = S;
for (const [k, v] of Object.entries(guard)) bucket.data.set(k, v.replaceAll("VENDOR_ID", T.id));
const s0 = snapshot(bucket);
const r1 = await put({ address: "12 Nguyễn Huệ, Quận 1", contact: { phone: "0912345678" } });
R.check("tiền điều kiện: sửa 200", r1.status === 200 && addrOf(await detail()) === "12 Nguyễn Huệ, Quận 1", [r1.status, r1.json?.error]);
await put({ address: "99 Lê Lợi, Quận 1" }); await put({ address: null }); await put({ address: "abc" });
await del();
const d = diff(s0, snapshot(bucket));
const stray = [...d.added, ...d.changed].filter((k) => k !== OVERLAY_KEY && !k.startsWith(AUDIT_PREFIX));
R.check("chỉ khoá bản ghi sửa vendor và dòng Nhật ký thay đổi (không khoá nào khác, kể cả hồ sơ/ngân sách/hội thoại cặp đôi)", stray.length === 0 && d.removed.length === 0, d);
R.check("dữ liệu cặp đôi gieo sẵn còn nguyên từng byte", Object.entries(guard).every(([k, v]) => bucket.data.get(k) === v.replaceAll("VENDOR_ID", T.id)));
R.check("không request ra ngoài (Google Maps/Places hay nơi nào khác)", outbound.length === 0, outbound);
R.done();
