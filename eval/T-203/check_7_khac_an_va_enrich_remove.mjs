#!/usr/bin/env node
// T-203 tiêu chí 7 (repo tohong-back): "Xoá" khác "Ẩn" và khác action enrich "remove".
//  - Xoá KHÔNG bật cờ Ẩn; Ẩn vẫn như cũ (còn trong danh sách admin mặc định, nhãn Đang ẩn, không thành Đã xoá).
//  - Review enrich "remove" (chờ Capu/áp dụng qua export) KHÔNG xoá gì: vendor vẫn hiện với cặp đôi và còn trong danh sách admin.
//  - Chi tiết enrich của vendor đã xoá báo pool.visible=false, lý do mã overlay_deleted.
// Chạy từ gốc tohong-hq: node eval/T-203/check_7_khac_an_va_enrich_remove.mjs
import fs from "node:fs";
import path from "node:path";
import { fresh, pickTarget, asAdmin, asCouple, DEL, listAll, BACK, VENDOR_POOL, reporter, outbound, loadOverlay } from "./lib/common.mjs";
const R = reporter();
const { env } = fresh();
const A = asAdmin(env), C = asCouple(env);
const src = fs.readFileSync(path.join(BACK, "lib", "vendorEnrichReport.generated.js"), "utf8");
const REPORT = JSON.parse(src.match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const inPool = new Set(VENDOR_POOL.map((v) => v.id));
const rows = REPORT.vendors.filter((r) => inPool.has(r.id) && !r.override);
R.check("tiền điều kiện: báo cáo enrich có vendor còn trong pool", rows.length >= 2, rows.length);
const Tp = await pickTarget(env, "photography");
const H = rows[1].id, D = Tp.id, E = rows[0].id; // H: chỉ Ẩn (có trong báo cáo enrich); D: Xoá; E: review enrich remove rồi Xoá
const status = async (id) => (await C("POST", "/api/vendors/status", { ids: [id] })).json?.vendors?.[id];

// Ẩn (hành vi hiện có, bảo vệ không hồi quy)
const hp = await A("PUT", `/api/admin/vendors/${H}/override`, { hidden: true, hidden_reason: "eval ẩn", expected_version: 0 });
R.check("Ẩn vendor: 200", hp.status === 200, [hp.status, hp.text.slice(0, 60)]);
const def = await listAll(A), hrow = def.rows.find((r) => r.id === H);
R.check("Ẩn: vendor VẪN ở danh sách admin mặc định, hidden:true, deleted:false", hrow?.hidden === true && hrow?.deleted === false, hrow);
R.check("Ẩn: vendor KHÔNG ở nhãn Đã xoá", !(await listAll(A, "label=deleted")).rows.some((r) => r.id === H));
R.check("Ẩn: cặp đôi thấy hidden:true (đường status), ghép theo id không còn", (await status(H))?.hidden === true && !((await C("GET", `/api/vendors/match?ids=${H}`)).json?.vendors || []).some((v) => v.id === H));

// Xoá không phải Ẩn
const dd = await A("POST", DEL(D), { expected_version: 0, reason: "eval xoá" });
R.check("Xoá vendor khác: 200", dd.status === 200, [dd.status, dd.text.slice(0, 60)]);
const det = (await A("GET", `/api/admin/vendors/${D}`)).json;
R.check("Xoá không bật cờ Ẩn: override không có hidden:true, không có hidden_reason", det?.override?.hidden !== true && det?.override?.hidden_reason === undefined, det?.override);
R.check("Xoá không biến vendor thành 'Đang ẩn' ở danh sách admin (nhãn hidden không có nó)", !(await listAll(A, "label=hidden")).rows.some((r) => r.id === D));

// Enrich remove: chỉ là review chờ, không xoá
const rv = await A("PUT", `/api/admin/vendor-enrich/${E}/review`, { decision: "manual", action: "remove", note: "eval T-203" });
R.check("enrich: ghi review 'remove' 200", rv.status === 200, [rv.status, rv.text.slice(0, 80)]);
const def2 = await listAll(A), erow = def2.rows.find((r) => r.id === E);
R.check("enrich remove: vendor VẪN ở danh sách admin mặc định, deleted:false, hidden:false", erow?.deleted === false && erow?.hidden === false, erow);
R.check("enrich remove: KHÔNG ở nhãn Đã xoá", !(await listAll(A, "label=deleted")).rows.some((r) => r.id === E));
R.check("enrich remove: cặp đôi vẫn thấy (hidden không phải true)", (await status(E))?.hidden !== true);
const ed = await A("GET", `/api/admin/vendor-enrich/${E}/detail`);
R.check("enrich remove: chi tiết enrich báo pool.visible true", ed.status === 200 && ed.json?.pool?.visible === true, [ed.status, ed.json?.pool?.visible]);

// Chi tiết enrich của vendor đã xoá
const ex = await A("POST", DEL(E), { expected_version: (await A("GET", `/api/admin/vendors/${E}`)).json?.version ?? 0, reason: "eval xoá vendor có review" });
R.check("xoá vendor đang có review enrich 'remove': 200", ex.status === 200, [ex.status, ex.text.slice(0, 60)]);
const ed2 = await A("GET", `/api/admin/vendor-enrich/${E}/detail`);
R.check("chi tiết enrich của vendor đã xoá: pool.in_pool true, pool.visible false, reasons có code overlay_deleted kèm chữ giải thích", ed2.status === 200 && ed2.json?.pool?.in_pool === true && ed2.json?.pool?.visible === false && (ed2.json?.pool?.reasons || []).some((x) => x.code === "overlay_deleted" && typeof x.text === "string" && x.text.length > 5), [ed2.status, ed2.json?.pool?.visible, ed2.json?.pool?.reasons]);
const ed3 = await A("GET", `/api/admin/vendor-enrich/${H}/detail`);
R.check("chi tiết enrich của vendor chỉ Ẩn (hành vi cũ): visible false, reasons có overlay_hidden và KHÔNG có overlay_deleted", ed3.status === 200 && ed3.json?.pool?.visible === false && (ed3.json?.pool?.reasons || []).some((x) => x.code === "overlay_hidden") && !(ed3.json?.pool?.reasons || []).some((x) => x.code === "overlay_deleted"), ed3.json?.pool?.reasons);
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
