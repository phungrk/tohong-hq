#!/usr/bin/env node
// Bất biến đề xuất (vùng planner/admin) · nguồn: T-203 (spec products/T-203-xoa-vendor-khoi-phuc.md v2, Tình huống 3 "Vendor đã xoá và không còn trong pool" + "Chiều ngược";
// bất biến đề xuất số 4; defect handoffs/T-203-D1.md D1). Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào eval/invariants/planner/admin/; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-203/bat-bien-cho-merge/ cho tới khi PR T-203 merge (ADR-028). Trên main hiện tại (chưa có route xoá) script này ĐỎ; đó là đúng.
// INV-??? · Vendor mang cờ xoá KHÔNG BAO GIỜ kẹt và luôn có đúng một chỗ ở admin:
//   với mọi tổ hợp (còn/không còn trong pool) x (có/không bản sửa) x (ẩn/không ẩn): vendor đã xoá có mặt ở nhãn "Đã xoá" (label=deleted), không ở danh sách mặc định,
//   không ở bất kỳ nhãn nào khác, không bao giờ có orphan:true; "Khôi phục" luôn 200. Pipeline đưa vendor đã xoá trở lại pool: cờ xoá vẫn thắng (cặp đôi thấy hidden:true, vẫn ở "Đã xoá").
// Mô phỏng pipeline bằng cách rút/đưa lại phần tử VENDOR_POOL (cùng mô-đun với worker); không gieo khoá R2 tay. Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, asAdmin, asCouple, DEL, RES, listAll, loadOverlay, VENDOR_POOL, reporter, outbound } = L;
const R = reporter();
const { env } = fresh();
const A = asAdmin(env), C = asCouple(env);
const OTHER_LABELS = ["orphan", "hidden", "overridden", "estimated", "verified", "has_contact", "missing_contact", "estimate_category", "legacy_marry"];
const ov = (id) => `/api/admin/vendors/${id}/override`;
const ver = async (id) => (await A("GET", `/api/admin/vendors/${id}`)).json?.version ?? 0;

// 8 vendor khác nhau: (giữ/rời pool) x (có bản sửa giá / không) x (ẩn / không)
const cats = ["photography", "makeup", "decor", "venue", "attire", "music", "flower", "mc"];
const picked = [];
for (const c of cats) {
  const t = await pickTarget(env, c);
  for (const id of t.ids) if (!picked.includes(id)) { picked.push(id); break; }
}
for (const v of VENDOR_POOL) { if (picked.length >= 8) break; if (!picked.includes(v.id)) picked.push(v.id); }
R.check("tiền điều kiện: 8 vendor khác nhau trong pool", picked.length === 8 && new Set(picked).size === 8, picked.length);
const cases = picked.map((id, i) => ({ id, leave: !!(i & 1), edit: !!(i & 2), hide: !!(i & 4) }));
for (const k of cases) {
  const patch = { ...(k.edit ? { priceMin: 11, priceMax: 22 } : {}), ...(k.hide ? { hidden: true, hidden_reason: "bất biến: ẩn" } : {}) };
  if (Object.keys(patch).length) {
    const p = await A("PUT", ov(k.id), { ...patch, expected_version: 0 });
    R.check(`chuẩn bị ${k.id}: bản sửa ${JSON.stringify(patch)} 200`, p.status === 200, [p.status, p.text.slice(0, 60)]);
  }
  const d = await A("POST", DEL(k.id), { expected_version: await ver(k.id), reason: "bất biến: xoá" });
  R.check(`xoá ${k.id} 200`, d.status === 200, [d.status, d.text.slice(0, 60)]);
}
const dropped = [];
for (const k of cases.filter((x) => x.leave)) { const i = VENDOR_POOL.findIndex((v) => v.id === k.id); dropped.push({ i, v: VENDOR_POOL.splice(i, 1)[0] }); }
await loadOverlay(env, { force: true });

const tag = (k) => `${k.id} (${k.leave ? "rời pool" : "trong pool"}, ${k.edit ? "có bản sửa" : "không bản sửa"}, ${k.hide ? "ẩn" : "không ẩn"})`;
const del = await listAll(A, "label=deleted"), def = await listAll(A);
const others = {};
for (const l of OTHER_LABELS) others[l] = await listAll(A, `label=${l}`);
for (const k of cases) {
  const row = del.rows.find((r) => r.id === k.id);
  R.check(`${tag(k)}: có mặt ở "Đã xoá", deleted:true, không orphan:true, in_pool đúng`, del.status === 200 && !!row && row.deleted === true && row.orphan !== true && row.in_pool === !k.leave, row);
  R.check(`${tag(k)}: không ở danh sách mặc định`, !def.rows.some((r) => r.id === k.id));
  const inOther = OTHER_LABELS.filter((l) => others[l].rows.some((r) => r.id === k.id));
  R.check(`${tag(k)}: không ở nhãn nào khác`, inOther.length === 0, inOther);
}
// Không trạng thái kẹt: khôi phục luôn 200 (còn hay rời pool)
for (const k of cases) {
  const r = await A("POST", RES(k.id), { expected_version: await ver(k.id) });
  R.check(`${tag(k)}: khôi phục 200 (không kẹt)`, r.status === 200, [r.status, r.text.slice(0, 80)]);
}
const delAfter = await listAll(A, "label=deleted");
R.check("sau khôi phục: không vendor nào còn ở \"Đã xoá\"", !cases.some((k) => delAfter.rows.some((r) => r.id === k.id)), delAfter.total);

// Chiều ngược: xoá, rời pool, quay lại pool -> cờ xoá vẫn thắng
const back = dropped.reverse();
for (const b of back) VENDOR_POOL.splice(b.i, 0, b.v);
const Z = cases.find((k) => !k.hide && !k.leave);
const dz = await A("POST", DEL(Z.id), { expected_version: await ver(Z.id), reason: "bất biến: xoá rồi quay lại" });
const iz = VENDOR_POOL.findIndex((v) => v.id === Z.id), vz = VENDOR_POOL.splice(iz, 1)[0];
await loadOverlay(env, { force: true });
VENDOR_POOL.splice(iz, 0, vz);
await loadOverlay(env, { force: true });
const st = await C("POST", "/api/vendors/status", { ids: [Z.id] });
const zr = (await listAll(A, "label=deleted")).rows.find((r) => r.id === Z.id);
R.check("vendor đã xoá quay lại pool: cặp đôi thấy hidden:true, admin vẫn thấy ở \"Đã xoá\" (in_pool:true), không ở mặc định",
  dz.status === 200 && st.json?.vendors?.[Z.id]?.hidden === true && !!zr && zr.in_pool === true && !(await listAll(A)).rows.some((r) => r.id === Z.id), [dz.status, st.json?.vendors?.[Z.id], zr]);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
