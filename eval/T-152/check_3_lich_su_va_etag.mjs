#!/usr/bin/env node
// T-152 tiêu chí 3 (tohong-back): lịch sử sửa + ghi R2 có kiểm etag + hợp đồng DELETE. Đo qua API/hành vi; KHÔNG đọc hay chèn thẳng cấu trúc tài liệu R2 (dựng trạng thái chỉ bằng route PUT/DELETE).
//  - GET /api/admin/vendors/<id> trả thêm: history (mới nhất trước, tối đa 20), edited_fields, editable {fields, styles, limits}, version.
//    Mỗi mục history = {seq (số nguyên tăng), at (ISO), by (user id), action: "edit" | "clear", changes: {<trường>: {before, after}}}; before/after là giá trị HIỆU LỰC trước/sau; bỏ sửa thì after = giá trị pool.
//    Sửa liên hệ chỉ ghi changes.contact = {changed:true}, KHÔNG có số/zalo/website trong history.
//  - "Không đổi gì" so với giá trị HIỆU LỰC đang có (không phải với ghi đè đã lưu): PUT mà mọi trường bằng giá trị hiệu lực -> 200, không ghi R2, version giữ, không thêm lịch sử, vendor không thành "overridden".
//    Cụ thể thân đầy đủ mà tab Vendor admin luôn gửi (price_verified:false, hidden:false, hidden_reason:'', contact:null, priceMin:null, priceMax:null) lên vendor chưa có ghi đè không tạo gì.
//  - DELETE (nút "Bỏ ghi đè" của tab Vendor) xoá MỌI trường đã sửa của vendor (kể cả tên, ảnh sửa trong drawer): sau đó `override` = null, vendor không còn nhãn "overridden", DELETE lần hai 404 override_not_found,
//    giá trị hiệu lực = pool gốc; LỊCH SỬ vẫn còn (mục đầu action "clear").
//  - Etag: ghi dùng If-Match; hai admin ghi đồng thời vào hai vendor khác nhau thì cả hai bản sửa đều còn; người kia đổi cùng vendor giữa lúc đọc và ghi, hoặc expected_version cũ -> 409 version_conflict, không ghi.
import { boot, pick, A1, A2, reporter, outbound, OVERLAY_KEY } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { B, bucket, e, put, del, info, pub } = await boot();
const { venue, photog } = pick();
const t0 = Date.now();
const ver = async (id) => (await info(id)).json?.version ?? -1;
const up = async (id, body, u) => { const r = await put(id, { expected_version: await ver(id), ...body }, u); return r; };
// no-op trên vendor chưa có ghi đè (thân đầy đủ của tab Vendor)
const w00 = bucket.putLog.length;
const full = { expected_version: 0, price_verified: false, hidden: false, hidden_reason: "", contact: null, priceMin: null, priceMax: null };
const n1 = await put(photog.id, full);
let ip = (await info(photog.id)).json || {};
R.check("thân đầy đủ của tab Vendor lên vendor chưa có ghi đè: 200, không ghi R2, override null, version 0, không lịch sử", n1.status === 200 && bucket.putLog.length === w00 && ip.override === null && ip.version === 0 && (ip.history || []).length === 0 && Array.isArray(ip.history), [n1.status, bucket.putLog.length - w00, ip.version]);
const n2 = await put(photog.id, { expected_version: 0, name: photog.name });
R.check("PUT name = đúng tên pool (bằng giá trị hiệu lực): không ghi, không tạo ghi đè", n2.status === 200 && bucket.putLog.length === w00 && (await info(photog.id)).json?.override === null, [n2.status, bucket.putLog.length - w00]);
const lst0 = (await B.call(e, "GET", `/api/admin/vendors?label=overridden&q=${encodeURIComponent(photog.name.slice(0, 12))}`, { token: `dev:${A1}` })).json?.vendors || [];
R.check("vendor đó không có nhãn overridden trong danh sách admin", !lst0.some((x) => x.id === photog.id));
await up(venue.id, { name: "Tên A1" }, A1);
await up(venue.id, { styles: ["korean"] }, A2);
await up(venue.id, { name: null }, A1);
let i = (await info(venue.id)).json || {};
const h = i.history || [];
R.check("history: 3 mục, mới nhất trước, seq giảm dần", h.length === 3 && h[0].seq > h[1].seq && h[1].seq > h[2].seq, JSON.stringify(h).slice(0, 200));
R.check("history: by đúng (A1, A2, A1 từ mới tới cũ), action edit, at là ISO trong khoảng chạy", h.map((x) => x.by).join() === [A1, A2, A1].join() && h.every((x) => x.action === "edit" && Date.parse(x.at) >= t0 - 1000 && Date.parse(x.at) <= Date.now() + 1000 && /^\d{4}-\d\d-\d\dT/.test(x.at)), JSON.stringify(h).slice(0, 200));
R.check("history trước/sau: lần 1 name {before: tên pool, after: 'Tên A1'}", h[2]?.changes?.name?.before === venue.name && h[2]?.changes?.name?.after === "Tên A1", JSON.stringify(h[2]));
R.check("history trước/sau: lần 2 styles {before: styles pool, after: ['korean']}", JSON.stringify(h[1]?.changes?.styles) === JSON.stringify({ before: venue.styles, after: ["korean"] }), JSON.stringify(h[1]));
R.check("history trước/sau: lần 3 (bỏ sửa name) {before: 'Tên A1', after: tên pool}", h[0]?.changes?.name?.before === "Tên A1" && h[0]?.changes?.name?.after === venue.name, JSON.stringify(h[0]));
R.check("edited_fields chỉ còn styles; editable có đủ 5 trường, 10 nhãn gu", JSON.stringify(i.edited_fields) === '["styles"]' && ["name", "description", "styles", "photos", "capacity"].every((f) => i.editable?.fields?.includes(f)) && i.editable?.styles?.length === 10, JSON.stringify([i.edited_fields, i.editable]).slice(0, 200));
const w0 = bucket.putLog.length; const v0 = await ver(venue.id);
const noop = await up(venue.id, { styles: ["korean"] }, A1);
R.check("PUT bằng giá trị hiệu lực đang có: 200, không ghi R2, version giữ", noop.status === 200 && bucket.putLog.length === w0 && (await ver(venue.id)) === v0, [noop.status, bucket.putLog.length - w0]);
R.check("không thêm mục lịch sử", ((await info(venue.id)).json?.history || []).length === 3);
await up(venue.id, { contact: { phone: "0909000111" } }, A1);
i = (await info(venue.id)).json || {};
R.check("sửa liên hệ: history có changes.contact = {changed:true}, không lộ số", i.history?.[0]?.changes?.contact?.changed === true && !JSON.stringify(i.history).includes("0909000111"), String(JSON.stringify(i.history?.[0])));
for (let k = 0; k < 24; k++) await up(venue.id, { description: `mô tả lần ${k}` }, k % 2 ? A1 : A2);
i = (await info(venue.id)).json || {};
R.check("history giữ đúng 20 mục mới nhất", i.history?.length === 20 && i.history[0].changes.description.after === "mô tả lần 23" && i.history[19].changes.description.after === "mô tả lần 4", [i.history?.length, i.history?.[0]?.changes?.description?.after, i.history?.[19]?.changes?.description?.after]);
// DELETE
await up(venue.id, { name: "Tên trước khi bỏ ZZ", photos: [{ url: "https://www.marry.vn/images/detailed/9/zz.jpg" }] }, A1);
const d = await del(venue.id, { expected_version: await ver(venue.id) }, A2);
i = (await info(venue.id)).json || {};
const eff = (await pub(`/api/vendors/${venue.id}`)).json?.vendor || {};
R.check("DELETE: 200; override null; version 0; không còn edited_fields", d.status === 200 && i.override === null && i.version === 0 && (i.edited_fields || []).length === 0, [d.status, String(JSON.stringify(i.override)), i.version]);
R.check("DELETE xoá MỌI trường đã sửa: tab Vendor trả tên, mô tả, ảnh của pool gốc", eff.name === venue.name && eff.description === venue.description && JSON.stringify(eff.photos) === JSON.stringify(venue.photos), JSON.stringify(eff).slice(0, 160));
R.check("DELETE: lịch sử còn, mục đầu action 'clear' nêu các trường bị bỏ, không lộ số", i.history?.[0]?.action === "clear" && !!i.history[0].changes?.name && !!i.history[0].changes?.photos && !JSON.stringify(i.history).includes("0909000111"), String(JSON.stringify(i.history?.[0])).slice(0, 200));
const d2 = await del(venue.id, { expected_version: 0 }, A2);
R.check("DELETE lần hai: 404 override_not_found", d2.status === 404 && d2.json?.error === "override_not_found", [d2.status, d2.text.slice(0, 80)]);
const lst1 = (await B.call(e, "GET", `/api/admin/vendors?label=overridden&q=${encodeURIComponent(venue.name.slice(0, 12))}`, { token: `dev:${A1}` })).json?.vendors || [];
R.check("sau DELETE vendor không còn nhãn overridden trong danh sách admin", !lst1.some((x) => x.id === venue.id));
// etag: hai vendor khác nhau, đồng thời. Người kia ghi qua đúng route PUT, chen vào giữa lúc đọc và ghi của ta.
let fired = false;
bucket.beforePut = async (key) => {
  if (key !== OVERLAY_KEY || fired) return; fired = true;
  await put(photog.id, { expected_version: 0, name: "Của người khác ZZ" }, A2);
};
const race = await put(venue.id, { expected_version: 0, name: "Tên đua ZZ" }, A1);
bucket.beforePut = null;
const gp = (await pub(`/api/vendors/${photog.id}`)).json?.vendor, gv = (await pub(`/api/vendors/${venue.id}`)).json?.vendor;
R.check("ghi đồng thời vào vendor khác: ghi của mình vẫn 200 (thử lại sau 412)", race.status === 200 && fired, [race.status, race.text.slice(0, 100), fired]);
R.check("không mất bản sửa của người kia (ghi có If-Match, không ghi đè mù)", gp?.name === "Của người khác ZZ" && gv?.name === "Tên đua ZZ", [gp?.name, gv?.name]);
// cùng vendor
fired = false;
bucket.beforePut = async (key) => {
  if (key !== OVERLAY_KEY || fired) return; fired = true;
  await put(venue.id, { expected_version: await ver(venue.id), name: "Người kia sửa trước ZZ" }, A2);
};
const v2 = await ver(venue.id);
const clash = await put(venue.id, { expected_version: v2, name: "Của mình ZZ" }, A1);
bucket.beforePut = null;
R.check("người kia đổi cùng vendor giữa lúc đọc và ghi: 409 version_conflict", clash.status === 409 && clash.json?.error === "version_conflict", [clash.status, clash.text.slice(0, 100)]);
R.check("và bản của người kia còn nguyên", (await pub(`/api/vendors/${venue.id}`)).json?.vendor?.name === "Người kia sửa trước ZZ");
const stale = await put(venue.id, { expected_version: 1, name: "Cũ ZZ" }, A1);
R.check("expected_version cũ: 409 version_conflict, không ghi", stale.status === 409 && stale.json?.error === "version_conflict" && (await pub(`/api/vendors/${venue.id}`)).json?.vendor?.name === "Người kia sửa trước ZZ", [stale.status, stale.text.slice(0, 80)]);
R.check("không gọi mạng", outbound.length === 0, outbound);
R.done();
