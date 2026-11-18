#!/usr/bin/env node
// T-203 tiêu chí 4 (repo tohong-back): khôi phục đưa vendor về ĐÚNG trạng thái trước khi xoá (kể cả đang ẩn, kể cả không có bản sửa nào);
// trong lúc đang xoá không sửa / bỏ ghi đè được (tránh vô tình khôi phục hoặc làm mất bản sửa); lỗi đúng mã, không ghi gì khi lỗi.
// Chạy từ gốc tohong-hq: node eval/T-203/check_4_khoi_phuc_dung_trang_thai.mjs
import { fresh, pickTarget, chatIds, asAdmin, asCouple, DEL, RES, meta, listAll, snapshot, diff, reporter, outbound, loadOverlay, VENDOR_POOL } from "./lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env), C = asCouple(env);
const T = await pickTarget(env, "photography");
const T2 = await pickTarget(env, "makeup"), T3 = await pickTarget(env, "decor");
const ids = [T.id, T2.id, T3.id];
R.check("tiền điều kiện: ba vendor khác nhau để thử", ids.every(Boolean) && new Set(ids).size === 3, ids);
const ov = (id) => `/api/admin/vendors/${id}/override`;

const state = async (id, T0) => {
  await loadOverlay(env, { force: true });
  const d = await A("GET", `/api/admin/vendors/${id}`);
  const row = (await listAll(A, `q=${encodeURIComponent(VENDOR_POOL.find((v) => v.id === id).name.slice(0, 14))}`)).rows.find((r) => r.id === id) || null;
  const st = await C("POST", "/api/vendors/status", { ids: [id] });
  return {
    deleted: d.json?.deleted, override: meta(d.json?.override), effective: d.json?.effective, edited: d.json?.edited_fields, version: d.json?.version,
    row: row && { ...row, version: undefined }, status: st.json?.vendors?.[id], chat: (await chatIds(env, T0.mp)).includes(id),
  };
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cycle = async (name, id, T0, prep) => {
  if (prep) { const r = await A("PUT", ov(id), prep); if (r.status !== 200) { R.check(`${name}: chuẩn bị bản sửa`, false, [r.status, r.text.slice(0, 80)]); return; } }
  const s0 = await state(id, T0);
  const del = await A("POST", DEL(id), { expected_version: s0.version ?? 0, reason: `eval ${name}` });
  R.check(`${name}: xoá 200`, del.status === 200, [del.status, del.text.slice(0, 80)]);
  const sd = await state(id, T0);
  R.check(`${name}: đang xoá: deleted:true và chat không còn`, sd.deleted === true && sd.chat === false, [sd.deleted, sd.chat]);
  R.check(`${name}: đang xoá: bản sửa trước đó (giá, liên hệ, ẩn...) vẫn thấy nguyên trong chi tiết admin`, same(sd.override, s0.override), [sd.override, s0.override]);
  const snap = snapshot(bucket);
  const e1 = await A("PUT", ov(id), { priceMin: 1, expected_version: sd.version });
  const e2 = await A("DELETE", ov(id), { expected_version: sd.version });
  const e3 = await A("POST", DEL(id), { expected_version: sd.version, reason: "lần hai" });
  const e4 = await A("POST", RES(id), { expected_version: (sd.version ?? 0) + 7 });
  R.check(`${name}: đang xoá: sửa ghi đè -> 409 vendor_deleted`, e1.status === 409 && e1.json?.error === "vendor_deleted", [e1.status, e1.text.slice(0, 60)]);
  R.check(`${name}: đang xoá: Bỏ ghi đè -> 409 vendor_deleted`, e2.status === 409 && e2.json?.error === "vendor_deleted", [e2.status, e2.text.slice(0, 60)]);
  R.check(`${name}: xoá lần hai -> 409 already_deleted`, e3.status === 409 && e3.json?.error === "already_deleted", [e3.status, e3.text.slice(0, 60)]);
  R.check(`${name}: khôi phục sai expected_version -> 409 version_conflict`, e4.status === 409 && e4.json?.error === "version_conflict", [e4.status, e4.text.slice(0, 60)]);
  const d = diff(snap, snapshot(bucket));
  R.check(`${name}: bốn lần bị từ chối không ghi gì (R2 y nguyên)`, d.added.length + d.removed.length + d.changed.length === 0, d);
  const res = await A("POST", RES(id), { expected_version: sd.version ?? 0 });
  R.check(`${name}: khôi phục 200 {ok:true}`, res.status === 200 && res.json?.ok === true, [res.status, res.text.slice(0, 80)]);
  const s1 = await state(id, T0);
  R.check(`${name}: sau khôi phục deleted:false`, s1.deleted === false, s1.deleted);
  R.check(`${name}: bản sửa y hệt trước xoá`, same(s1.override, s0.override), [s1.override, s0.override]);
  R.check(`${name}: giá/nội dung hiệu lực y hệt`, same(s1.effective, s0.effective));
  R.check(`${name}: edited_fields y hệt`, same(s1.edited, s0.edited), [s1.edited, s0.edited]);
  R.check(`${name}: hàng ở danh sách admin y hệt (kể cả Đang ẩn, Đã ghi đè)`, same(s1.row, s0.row) && s1.row !== null, [s1.row, s0.row]);
  R.check(`${name}: phía cặp đôi y hệt (status, ứng viên chat)`, same(s1.status, s0.status) && s1.chat === s0.chat, [s1.status, s0.status, s1.chat, s0.chat]);
  const dd = await A("GET", `/api/admin/vendors/${id}`);
  R.check(`${name}: không còn thông tin xoá (deleted_info rỗng)`, !dd.json?.deleted_info, dd.json?.deleted_info);
  const lab = await listAll(A, "label=deleted");
  R.check(`${name}: không còn trong nhãn Đã xoá`, !lab.rows.some((r) => r.id === id), lab.total);
  const r2 = await A("POST", RES(id), { expected_version: dd.json?.version ?? 0 });
  R.check(`${name}: khôi phục khi không ở trạng thái xoá -> 409 not_deleted`, r2.status === 409 && r2.json?.error === "not_deleted", [r2.status, r2.text.slice(0, 60)]);
  return { s0, s1 };
};

// A: có bản sửa giá + xác minh + liên hệ
await cycle("A(có bản sửa)", T.id, T, { priceMin: 7, priceMax: 9, price_verified: true, contact: { phone: "0900000001", zalo: "z1" } });
// B: đang ẩn: khôi phục xong VẪN ẩn, đúng lý do
const B = await cycle("B(đang ẩn)", T2.id, T2, { hidden: true, hidden_reason: "đang ẩn trước khi xoá" });
if (B) {
  R.check("B: sau khôi phục vẫn ẩn đúng lý do cũ", B.s1.override?.hidden === true && B.s1.override?.hidden_reason === "đang ẩn trước khi xoá" && B.s1.status?.hidden === true && B.s1.chat === false, [B.s1.override, B.s1.status, B.s1.chat]);
  const h = await listAll(A, "label=hidden");
  R.check("B: sau khôi phục có lại trong nhãn Đang ẩn và trong danh sách mặc định", h.rows.some((r) => r.id === T2.id && r.hidden === true && r.deleted === false));
}
// C: không có bản sửa nào: khôi phục xong override rỗng, hàng không Đã ghi đè
const Cc = await cycle("C(không có bản sửa)", T3.id, T3, null);
if (Cc) R.check("C: sau khôi phục override null, overridden:false", Cc.s1.override == null && Cc.s1.row?.overridden === false, [Cc.s1.override, Cc.s1.row?.overridden]);

// D: lỗi id / trạng thái
const unk = await A("POST", DEL("khong_co_vendor_nay"), { expected_version: 0, reason: "x" });
const unk2 = await A("POST", RES("khong_co_vendor_nay"), { expected_version: 0 });
R.check("xoá/khôi phục id không có trong pool -> 404 vendor_not_found", unk.status === 404 && unk.json?.error === "vendor_not_found" && unk2.status === 404 && unk2.json?.error === "vendor_not_found", [unk.status, unk.text.slice(0, 60), unk2.status]);
const orph = await A("PUT", ov("mo_coi_x"), { priceMin: 1, expected_version: 0 });
const orphDel = await A("POST", DEL("mo_coi_x"), { expected_version: orph.json?.version ?? 1, reason: "x" });
R.check("vendor mồ côi (có ghi đè, không còn trong pool): xoá -> 404 vendor_not_found (không xoá được thứ cặp đôi vốn không thấy)", orph.status === 200 && orphDel.status === 404 && orphDel.json?.error === "vendor_not_found", [orph.status, orphDel.status, orphDel.text.slice(0, 60)]);
const m = await A("GET", "/api/admin/vendors/" + T.id + "/delete"), m2 = await A("PUT", RES(T.id), {});
R.check("sai phương thức (GET delete, PUT restore) -> 405", m.status === 405 && m2.status === 405, [m.status, m2.status]);
const anon = await (await import("./lib/common.mjs")).call(env, "POST", DEL(T.id), { body: { expected_version: 0, reason: "x" } });
const couple = await C("POST", DEL(T.id), { expected_version: 0, reason: "x" });
const dres = await A("GET", `/api/admin/vendors/${T.id}`);
R.check("không đăng nhập / không phải admin: 401|403, và không xoá được", [401, 403].includes(anon.status) && [401, 403].includes(couple.status) && dres.json?.deleted === false, [anon.status, couple.status, dres.json?.deleted]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
