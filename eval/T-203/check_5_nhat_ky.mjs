#!/usr/bin/env node
// T-203 tiêu chí 5 (repo tohong-back): mỗi lần xoá / khôi phục THÀNH CÔNG ghi đúng một dòng Nhật ký (vendor.delete / vendor.restore); lần bị từ chối không ghi dòng nào.
// Chạy từ gốc tohong-hq: node eval/T-203/check_5_nhat_ky.mjs
import { fresh, pickTarget, asAdmin, DEL, RES, ADMIN, snapshot, diff, AUDIT_PREFIX, reporter, outbound } from "./lib/common.mjs";
const R = reporter();
const { env, bucket } = fresh();
const A = asAdmin(env);
const T = await pickTarget(env);
const audit = async (qs = "") => (await A("GET", `/api/admin/audit?limit=50${qs}`)).json?.entries || [];
const n0 = (await audit()).length;

// bị từ chối: không dòng nào
const s0 = snapshot(bucket);
const bad = [await A("POST", DEL(T.id), { expected_version: 0, reason: "" }), await A("POST", DEL(T.id), { expected_version: 0, reason: "   " }), await A("POST", DEL(T.id), { expected_version: 0 }),
  await A("POST", DEL(T.id), { expected_version: 0, reason: "x".repeat(301) }), await A("POST", DEL("khong_co_vendor_nay"), { expected_version: 0, reason: "x" }), await A("POST", RES(T.id), { expected_version: 0 })];
R.check("xoá thiếu lý do / lý do trắng / quá 300 ký tự -> 400; id lạ -> 404; khôi phục khi chưa xoá -> 409", bad[0].status === 400 && bad[1].status === 400 && bad[2].status === 400 && bad[3].status === 400 && bad[4].status === 404 && bad[5].status === 409, bad.map((x) => x.status));
R.check("mã lỗi thiếu lý do là delete_reason_required, lý do quá dài là delete_reason_too_long", bad[0].json?.error === "delete_reason_required" && bad[1].json?.error === "delete_reason_required" && bad[2].json?.error === "delete_reason_required" && bad[3].json?.error === "delete_reason_too_long", bad.slice(0, 4).map((x) => x.text.slice(0, 60)));
const d0 = diff(s0, snapshot(bucket));
R.check("các lần bị từ chối không ghi gì vào R2 (không bản ghi, không dòng nhật ký)", d0.added.length + d0.removed.length + d0.changed.length === 0, d0);

const reason = "Vendor đóng cửa, khách phản ánh";
const del = await A("POST", DEL(T.id), { expected_version: 0, reason: `  ${reason}  ` });
R.check("xoá 200 (lý do được cắt khoảng trắng hai đầu)", del.status === 200, [del.status, del.text.slice(0, 80)]);
const dEntries = await audit("&action=vendor.delete");
const e = dEntries[0];
R.check("lọc action=vendor.delete: đúng 1 dòng", dEntries.length === 1, dEntries.length);
R.check("dòng xoá: target_type vendor, target_id đúng, admin_id là người xoá, có thời điểm", e?.target_type === "vendor" && e?.target_id === T.id && e?.admin_id === ADMIN && !Number.isNaN(Date.parse(e?.at)), e);
R.check("dòng xoá: before.deleted không phải true; after.deleted === true, after.deleted_reason đúng lý do (đã cắt khoảng trắng)", e?.before?.deleted !== true && e?.after?.deleted === true && e?.after?.deleted_reason === reason, [e?.before, e?.after]);
const v = (await A("GET", `/api/admin/vendors/${T.id}`)).json?.version ?? 0;
const res = await A("POST", RES(T.id), { expected_version: v });
R.check("khôi phục 200", res.status === 200, [res.status, res.text.slice(0, 80)]);
const rEntries = await audit("&action=vendor.restore");
const r = rEntries[0];
R.check("lọc action=vendor.restore: đúng 1 dòng", rEntries.length === 1, rEntries.length);
R.check("dòng khôi phục: target_type vendor, target_id đúng, admin_id đúng; before.deleted === true kèm lý do cũ; after.deleted không phải true", r?.target_type === "vendor" && r?.target_id === T.id && r?.admin_id === ADMIN && r?.before?.deleted === true && r?.before?.deleted_reason === reason && r?.after?.deleted !== true, r);
const all = await audit();
R.check("tổng nhật ký tăng đúng 2 dòng, khôi phục nằm trên xoá (mới nhất trước)", all.length - n0 === 2 && all[0]?.action === "vendor.restore" && all[1]?.action === "vendor.delete", all.map((x) => x.action));
const keys = [...snapshot(bucket).keys()].filter((k) => k.startsWith(AUDIT_PREFIX));
R.check("nhật ký chỉ-thêm: hai dòng là hai khoá R2 riêng, dòng xoá còn nguyên sau khi khôi phục", keys.length === 2 && (await audit("&action=vendor.delete")).length === 1, keys.length);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
