#!/usr/bin/env node
// T-152 tiêu chí 3 (tohong-back): lịch sử sửa + ghi R2 có kiểm etag.
//  - GET /api/admin/vendors/<id> trả thêm: history (mới nhất trước, tối đa 20), edited_fields (các trường đang bị sửa), editable {fields, styles, limits}, version.
//    Mỗi mục history = {seq (số nguyên tăng), at (ISO), by (user id người sửa), action: "edit" | "clear", changes: {<trường>: {before, after}}}; before/after là giá trị HIỆU LỰC (cặp đôi thấy) trước/sau; bỏ sửa thì after = giá trị pool gốc.
//    Sửa liên hệ (contact) chỉ ghi changes.contact = {changed:true}, KHÔNG có số/zalo/website trong history. PUT không đổi gì: 200, không ghi R2, không thêm mục, không đổi version.
//  - Etag: ghi dùng If-Match; hai admin ghi đồng thời vào hai vendor khác nhau thì cả hai bản sửa đều còn (không mất bản nào); ghi đè lên bản đã đổi bởi người khác (expected_version cũ) -> 409 version_conflict và không ghi.
import { boot, pick, A1, A2, reporter, outbound, OVERLAY_KEY } from "./lib/back152.mjs";
const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ khi chạy (hợp đồng chưa đúng?): " + String(e && e.message).slice(0, 200)); process.exit(1); });
const { B, bucket, put, del, info, doc } = await boot();
const { venue, photog } = pick();
const t0 = Date.now();
let v = 0; const up = async (body, u) => { const r = await put(venue.id, { expected_version: v, ...body }, u); if (r.status === 200) v = r.json?.version; return r; };
await up({ name: "Tên A1" }, A1);
await up({ styles: ["korean"] }, A2);
await up({ name: null }, A1);
let i = (await info(venue.id)).json || {};
const h = i.history || [];
R.check("history: 3 mục, mới nhất trước, seq giảm dần", h.length === 3 && h[0].seq > h[1].seq && h[1].seq > h[2].seq, JSON.stringify(h).slice(0, 200));
R.check("history: by đúng người sửa (A1, A2, A1 từ mới tới cũ), action edit, at là ISO trong khoảng chạy", h.map((x) => x.by).join() === [A1, A2, A1].join() && h.every((x) => x.action === "edit" && Date.parse(x.at) >= t0 - 1000 && Date.parse(x.at) <= Date.now() + 1000 && /^\d{4}-\d\d-\d\dT/.test(x.at)), JSON.stringify(h).slice(0, 200));
R.check("history trước/sau: lần 1 name {before: tên pool, after: 'Tên A1'}", h[2]?.changes?.name?.before === venue.name && h[2]?.changes?.name?.after === "Tên A1", JSON.stringify(h[2]));
R.check("history trước/sau: lần 2 styles {before: styles pool, after: ['korean']}", JSON.stringify(h[1]?.changes?.styles) === JSON.stringify({ before: venue.styles, after: ["korean"] }), JSON.stringify(h[1]));
R.check("history trước/sau: lần 3 (bỏ sửa name) {before: 'Tên A1', after: tên pool}", h[0]?.changes?.name?.before === "Tên A1" && h[0]?.changes?.name?.after === venue.name, JSON.stringify(h[0]));
R.check("edited_fields chỉ còn styles; có editable.fields đủ 5 trường và limits", JSON.stringify(i.edited_fields) === '["styles"]' && ["name", "description", "styles", "photos", "capacity"].every((f) => i.editable?.fields?.includes(f)) && i.editable?.styles?.length === 10 && i.version === v, JSON.stringify([i.edited_fields, i.editable, i.version]).slice(0, 200));
// no-op
const w0 = bucket.putLog.length;
const noop = await up({ styles: ["korean"] }, A1);
R.check("PUT không đổi gì: 200, không ghi R2, version giữ", noop.status === 200 && bucket.putLog.length === w0 && noop.json?.version === v, [noop.status, bucket.putLog.length - w0]);
R.check("PUT không đổi gì: không thêm mục lịch sử", ((await info(venue.id)).json?.history || []).length === 3);
// liên hệ
await up({ contact: { phone: "0909000111" } }, A1);
i = (await info(venue.id)).json || {};
R.check("sửa liên hệ: history có changes.contact = {changed:true}, không lộ số", i.history?.[0]?.changes?.contact?.changed === true && !JSON.stringify(i.history).includes("0909000111"), JSON.stringify(i.history?.[0]));
// cắt 20
for (let k = 0; k < 24; k++) await up({ description: `mô tả lần ${k}` }, k % 2 ? A1 : A2);
i = (await info(venue.id)).json || {};
R.check("history giữ đúng 20 mục mới nhất", i.history?.length === 20 && i.history[0].changes.description.after === "mô tả lần 23" && i.history[19].changes.description.after === "mô tả lần 4", [i.history?.length, i.history?.[0]?.changes?.description?.after, i.history?.[19]?.changes?.description?.after]);
// DELETE
const d = await del(venue.id, { expected_version: v }, A2);
i = (await info(venue.id)).json || {};
R.check("DELETE override: 200; mục đầu action 'clear' nêu các trường bị bỏ", d.status === 200 && i.history?.[0]?.action === "clear" && !!i.history[0].changes?.description && !JSON.stringify(i.history[0]).includes("0909000111"), [d.status, String(JSON.stringify(i.history?.[0])).slice(0, 200)]);
// etag: ghi đồng thời hai vendor khác nhau
let fired = false;
bucket.beforePut = async (key) => {
  if (key !== OVERLAY_KEY || fired) return; fired = true;
  const cur = JSON.parse(bucket.data.get(OVERLAY_KEY));
  cur.seq += 1; cur.vendors[photog.id] = { name: "Của người khác ZZ", version: cur.seq, updated_by: A2, updated_at: new Date().toISOString() };
  await bucket.put(OVERLAY_KEY, JSON.stringify(cur));
};
const cur = doc().vendors[venue.id]?.version || 0;
const race = await put(venue.id, { expected_version: cur, name: "Tên đua ZZ" }, A1);
bucket.beforePut = null;
const after = doc();
R.check("ghi đồng thời vào vendor khác: ghi của mình vẫn 200 (thử lại sau 412)", race.status === 200, [race.status, race.text.slice(0, 100)]);
R.check("không mất bản sửa của người kia (ghi có If-Match, không ghi đè mù)", after.vendors[photog.id]?.name === "Của người khác ZZ" && after.vendors[venue.id]?.name === "Tên đua ZZ", JSON.stringify(Object.keys(after.vendors)));
// cùng vendor
fired = false;
bucket.beforePut = async (key) => {
  if (key !== OVERLAY_KEY || fired) return; fired = true;
  const c = JSON.parse(bucket.data.get(OVERLAY_KEY)); c.seq += 1; c.vendors[venue.id] = { ...c.vendors[venue.id], name: "Người kia sửa trước ZZ", version: c.seq };
  await bucket.put(OVERLAY_KEY, JSON.stringify(c));
};
const v2 = doc().vendors[venue.id].version;
const clash = await put(venue.id, { expected_version: v2, name: "Của mình ZZ" }, A1);
bucket.beforePut = null;
R.check("người kia đổi cùng vendor giữa lúc đọc và ghi: 409 version_conflict", clash.status === 409 && clash.json?.error === "version_conflict", [clash.status, clash.text.slice(0, 100)]);
R.check("và bản của người kia còn nguyên", doc().vendors[venue.id].name === "Người kia sửa trước ZZ");
const stale = await put(venue.id, { expected_version: 1, name: "Cũ ZZ" }, A1);
R.check("expected_version cũ: 409 version_conflict, không ghi", stale.status === 409 && stale.json?.error === "version_conflict" && doc().vendors[venue.id].name === "Người kia sửa trước ZZ", [stale.status, stale.text.slice(0, 80)]);
R.check("không gọi mạng", outbound.length === 0, outbound);
R.done();
