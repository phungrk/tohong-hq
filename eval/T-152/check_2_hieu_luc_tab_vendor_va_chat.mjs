#!/usr/bin/env node
// T-152 tiêu chí 2 (tohong-back): bản sửa của admin có hiệu lực NGAY ở tab Vendor và ở chat, không qua pool sinh lại.
//  - Ngay sau khi PUT trả 200 (cùng isolate, không chờ hết cache 5 phút): GET /api/vendors/<id> và GET /api/vendors/match trả name/description/styles/tags(=styles)/photos/capacity đã sửa;
//    chatMatch (đường chat, ADR-077) trả name và style_tags đã sửa, ứng viên vẫn là vendor của pool (vendor_id), vendor bị ẩn không vào, giá sửa vẫn vào price_range.
//  - Bền: đọc lại từ R2 trong isolate mới (xoá cache rồi nạp) vẫn thấy bản sửa. Bỏ sửa (null / DELETE) trả đúng giá trị pool gốc.
//  - Không ghi ngược nguồn: bản sửa chỉ nằm ở khoá data/admin/ của R2; lib/vendorPool.generated.js không đổi byte.
import crypto from "node:crypto";
import path from "node:path";
import { boot, pick, pool, lib, readText, reporter, outbound, BACK } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const poolFile = path.join(BACK, "lib", "vendorPool.generated.js");
const sha = () => crypto.createHash("sha256").update(readText(poolFile)).digest("hex");
const sha0 = sha();
const { B, bucket, e, put, del, pub } = await boot();
const { venue } = pick();
const P = pool();
const NAME = "Tên Admin Sửa ZZ-152", DESC = "Mô tả do admin sửa ZZ-152", MARRY = "https://www.marry.vn/images/detailed/9/zz152.jpg";
// Dựng trạng thái qua route PUT (không chèn thẳng tài liệu R2): ẩn mọi venue khác trừ hai vendor để vendor thử chắc chắn vào top 5 của chat.
const others = P.filter((v) => v.category === "venue" && v.id !== venue.id);
const keep = others.slice(0, 2).map((v) => v.id);
const hiddenIds = new Set();
for (const v of others.filter((x) => !keep.includes(x.id))) {
  const h = await put(v.id, { expected_version: 0, hidden: true, hidden_reason: "gieo T-152" });
  if (h.status !== 200) { R.check("dựng ẩn vendor khác qua PUT", false, [h.status, h.text.slice(0, 80)]); R.done(); }
  hiddenIds.add(v.id);
}
const ov = await lib("lib/vendorOverlay.js");
const cm = await lib("lib/chatMatcher.js");
ov.resetOverlayCache();
const r = await put(venue.id, { expected_version: 0, name: NAME, description: DESC, styles: ["korean"], photos: [{ url: MARRY }], capacity: { min: 50, max: 120 }, priceMin: 7, priceMax: 9, price_verified: true });
R.check("PUT sửa nhiều trường: 200", r.status === 200, [r.status, r.text.slice(0, 120)]);
const one = await pub(`/api/vendors/${venue.id}`);
const v1 = one.json?.vendor || {};
R.check("tab Vendor (chi tiết): name, description, styles, tags, photos, capacity, giá đã sửa ngay", v1.name === NAME && v1.description === DESC && JSON.stringify(v1.styles) === '["korean"]' && JSON.stringify(v1.tags) === '["korean"]' &&
  v1.photos?.length === 1 && v1.photos[0].url === MARRY && v1.capacity?.min === 50 && v1.capacity?.max === 120 && v1.priceMin === 7 && v1.priceMax === 9, one.text.slice(0, 200));
const list = await pub(`/api/vendors/match?category=venue&limit=50`);
const hit = (list.json?.vendors || []).find((x) => x.id === venue.id);
R.check("tab Vendor (danh sách ghép): vendor thử hiện với tên đã sửa", !!hit && hit.name === NAME, hit ? hit.name : list.status);
const mp = { city: "HCMC", category: "venue", budget_for_category: 200e6, wedding_date: "2029-03-20", guest_count: 100, style_preferences: ["korean"], dealbreakers: [] };
const chat = () => cm.chatMatch(mp);
await ov.loadOverlay(e);
let c = chat().matches.find((m) => m.vendor_id === venue.id);
R.check("chat: ứng viên vendor thử mang tên sửa, style_tags ['korean'], price_range 7-9tr", !!c && c.name === NAME && JSON.stringify(c.style_tags) === '["korean"]' && c.price_range?.min_vnd === 7e6 && c.price_range?.max_vnd === 9e6, c);
R.check("chat: mọi vendor_id thuộc pool; vendor bị ẩn không vào", chat().matches.every((m) => P.some((v) => v.id === m.vendor_id)) && !chat().matches.some((m) => hiddenIds.has(m.vendor_id)));
ov.resetOverlayCache();
await ov.loadOverlay(e);
c = chat().matches.find((m) => m.vendor_id === venue.id);
R.check("isolate mới đọc lại R2: chat vẫn thấy tên sửa (bền)", !!c && c.name === NAME);
const poolAfter = (await pub(`/api/vendors/${venue.id}`)).json?.vendor;
R.check("isolate mới: tab Vendor vẫn thấy bản sửa", poolAfter?.name === NAME && poolAfter?.description === DESC);
const cur = r.json?.version;
const r2 = await put(venue.id, { expected_version: cur, name: null, description: null, styles: null, photos: null, capacity: null, priceMin: null, priceMax: null });
R.check("bỏ sửa tất cả bằng null: 200", r2.status === 200, [r2.status, r2.text.slice(0, 100)]);
const back = (await pub(`/api/vendors/${venue.id}`)).json?.vendor || {};
R.check("sau khi bỏ sửa: trả đúng giá trị pool gốc (name, description, styles, photos, capacity, giá)", back.name === venue.name && back.description === venue.description && JSON.stringify(back.styles) === JSON.stringify(venue.styles) &&
  JSON.stringify(back.photos) === JSON.stringify(venue.photos) && JSON.stringify(back.capacity) === JSON.stringify(venue.capacity) && back.priceMin === venue.priceMin, JSON.stringify(back).slice(0, 200));
const keys = [...bucket.data.keys()];
R.check("mọi khoá R2 đã ghi nằm dưới data/admin/ (không ghi nguồn)", bucket.putLog.every((k) => k.startsWith("data/admin/")), [...new Set(bucket.putLog)]);
R.check("lib/vendorPool.generated.js không đổi byte", sha() === sha0);
R.check("không gọi mạng", outbound.length === 0, outbound);
R.done();
