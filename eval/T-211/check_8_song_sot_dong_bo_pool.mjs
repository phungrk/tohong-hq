#!/usr/bin/env node
// T-211 tiêu chí 8 (repo tohong-back): bản sửa địa chỉ/SĐT sống sót qua (a) isolate mới (đọc lại từ R2), (b) pool sinh lại (vendor đổi nội dung; vendor rời pool), (c) ghi đồng thời: hai vendor khác nhau đều giữ, cùng vendor sai phiên bản -> 409.
// Chạy từ gốc tohong-hq: node eval/T-211/check_8_song_sot_dong_bo_pool.mjs
import { setup, reporter, outbound, addrOf, phoneOf, resetOverlayCache, loadOverlay, VENDOR_POOL, PUT } from "./lib/common.mjs";
const R = reporter();
const S = await setup();
const { put, detail, A, env, bucket, T } = S;
const ADDR = "12 Nguyễn Huệ, Quận 1, TP.HCM", PH = "0912345678";
const r = await put({ address: ADDR, contact: { phone: PH } });
R.check("tiền điều kiện: lưu 200", r.status === 200 && addrOf(await detail()) === ADDR, [r.status, r.json?.error]);
const ver = (await detail()).version;
// (a) isolate mới
resetOverlayCache(); await loadOverlay(env, { force: true });
let d = await detail();
R.check("(a) isolate mới (cache sạch, đọc lại R2): địa chỉ + SĐT còn, phiên bản giữ", addrOf(d) === ADDR && phoneOf(d) === PH && d.version === ver, d.override);
// (b) pool sinh lại: nội dung vendor đổi
const pv = VENDOR_POOL.find((x) => x.id === T.id);
const keep = { description: pv.description, name: pv.name, photos: pv.photos, city: pv.city };
pv.description = "Mô tả mới sau lần sinh lại pool"; pv.name = pv.name + " (đổi tên ở nguồn)"; pv.photos = [...(pv.photos || [])].reverse();
resetOverlayCache(); await loadOverlay(env, { force: true });
d = await detail();
R.check("(b1) pool sinh lại, vendor đổi tên/mô tả/ảnh ở nguồn: địa chỉ + SĐT sửa tay còn nguyên, không phiên bản mới", addrOf(d) === ADDR && phoneOf(d) === PH && d.version === ver && d.in_pool === true, [d.override, d.version]);
const lst = await A("GET", `/api/admin/vendors?limit=200&q=${encodeURIComponent(pv.name)}`);
R.check("(b2) danh sách admin vẫn đánh dấu vendor overridden", (lst.json?.vendors || []).some((x) => x.id === T.id && x.overridden === true), (lst.json?.vendors || []).length);
// vendor rời pool (pipeline gỡ): bản sửa vẫn còn ở chi tiết, không mất
const idx = VENDOR_POOL.findIndex((x) => x.id === T.id);
const removed = VENDOR_POOL.splice(idx, 1)[0];
resetOverlayCache(); await loadOverlay(env, { force: true });
d = await detail();
R.check("(b3) vendor rời pool: chi tiết admin 200, in_pool:false, địa chỉ + SĐT vẫn còn", d.in_pool === false && addrOf(d) === ADDR && phoneOf(d) === PH, [d.in_pool, d.override]);
VENDOR_POOL.splice(idx, 0, removed);
Object.assign(pv, keep);
resetOverlayCache(); await loadOverlay(env, { force: true });
R.check("(b4) vendor quay lại pool: bản sửa đúng như cũ", addrOf(await detail()) === ADDR && phoneOf(await detail()) === PH);
// (c) đồng thời
const other = VENDOR_POOL.find((x) => x.id !== T.id && x.category === T.category);
const [p1, p2] = await Promise.all([put({ address: "1 Hai Bà Trưng, Q.1" }, T.id, (await detail()).version), put({ address: "2 Trần Hưng Đạo, Q.5", contact: { phone: "0987654321" } }, other.id, 0)]);
R.check("(c1) hai admin ghi đồng thời hai vendor khác nhau: cả hai 200, cả hai bản sửa còn", p1.status === 200 && p2.status === 200 && addrOf(await detail()) === "1 Hai Bà Trưng, Q.1" && addrOf(await detail(other.id)) === "2 Trần Hưng Đạo, Q.5" && phoneOf(await detail(other.id)) === "0987654321", [p1.status, p2.status]);
const stale = await A("PUT", PUT(T.id), { expected_version: (await detail()).version - 1, address: "7 Stale, Quận 7" });
const same = await A("PUT", PUT(T.id), { expected_version: 0, address: "8 Stale, Quận 8" });
R.check("(c2) expected_version cũ: 409 version_conflict, không ghi, bản của người kia còn", stale.status === 409 && stale.json?.error === "version_conflict" && same.status === 409 && addrOf(await detail()) === "1 Hai Bà Trưng, Q.1", [stale.status, same.status, stale.json?.error]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
