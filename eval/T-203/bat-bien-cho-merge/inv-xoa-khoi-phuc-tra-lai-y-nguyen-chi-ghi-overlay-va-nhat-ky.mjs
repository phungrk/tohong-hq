#!/usr/bin/env node
// Bất biến đề xuất (vùng planner/admin) · nguồn: T-203 (spec products/T-203-xoa-vendor-khoi-phuc.md v2, Tình huống 3-4, Ràng buộc "chỉ thêm khoá deleted* vào tài liệu overlay admin";
// bất biến đề xuất số 2 và 3; defect handoffs/T-203-D1.md D1, D3). Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào eval/invariants/planner/admin/; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-203/bat-bien-cho-merge/ cho tới khi PR T-203 merge (ADR-028). Trên main hiện tại (chưa có route xoá) script này ĐỎ; đó là đúng.
// INV-??? · "Xoá rồi Khôi phục" là phép không làm gì: với mọi trạng thái bản sửa (có bản sửa / đang ẩn / không có bản sửa / Lịch sử sửa đầy 20 dòng)
//   và cả khi vendor rời pool trong lúc đang xoá, sau Khôi phục vendor ở ĐÚNG chỗ nó sẽ ở nếu chưa từng bị xoá: chi tiết admin (bản sửa, giá hiệu lực, edited_fields,
//   Lịch sử sửa), hàng danh sách admin (hoặc không có hàng), phía cặp đôi (/status, ứng viên chat) y hệt bản đối chứng không xoá.
//   Mọi lần ghi vendor của admin (sửa ghi đè, xoá, khôi phục) chỉ đổi tài liệu overlay và thêm dòng Nhật ký: không khoá R2 nào mất, không khoá nào khác đổi.
// Đối chứng "chưa từng bị xoá" dựng bằng chính worker trên R2 giả thứ hai (cùng chuỗi sửa, không xoá). Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, chatIds, asAdmin, asCouple, DEL, RES, OVERLAY_KEY, AUDIT_PREFIX, snapshot, diff, meta, listAll, loadOverlay, resetOverlayCache, VENDOR_POOL, reporter, outbound } = L;
const R = reporter();
const ov = (id) => `/api/admin/vendors/${id}/override`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noVer = (r) => (r ? { ...r, version: undefined } : null);

const t = await pickTarget(fresh().env, "photography"), t2 = await pickTarget(fresh().env, "makeup"), t3 = await pickTarget(fresh().env, "decor");
const ids = [t.id, t2.id, t3.id];
R.check("tiền điều kiện: ba vendor khác nhau", ids.every(Boolean) && new Set(ids).size === 3, ids);
const full20 = Array.from({ length: 20 }, (_, i) => ({ priceMin: 100 + i, priceMax: 200 + i }));
const CASES = [
  { name: "có bản sửa + Lịch sử sửa đầy 20 dòng", T: t, edits: [...full20, { contact: { phone: "0900000003" }, price_verified: true }] },
  { name: "đang ẩn", T: t2, edits: [{ hidden: true, hidden_reason: "bất biến: ẩn trước khi xoá" }] },
  { name: "không có bản sửa", T: t3, edits: [] },
];

// Dựng một thế giới: chuỗi sửa, (tuỳ) xoá, (tuỳ) rời pool, (tuỳ) khôi phục. Trả trạng thái quan sát được + kiểm R2 mỗi lần ghi.
async function world(c, { remove, leave }) {
  resetOverlayCache();
  const { env, bucket } = fresh();
  const A = asAdmin(env), Cp = asCouple(env);
  const id = c.T.id;
  const ver = async () => (await A("GET", `/api/admin/vendors/${id}`)).json?.version ?? 0;
  const write = async (label, fn) => {
    const s0 = snapshot(bucket); const r = await fn(); const d = diff(s0, snapshot(bucket));
    R.check(`${c.name}: ${label}: 200`, r.status === 200, [r.status, r.text.slice(0, 60)]);
    R.check(`${c.name}: ${label}: không khoá R2 nào mất; chỉ tài liệu overlay đổi; chỉ thêm dòng Nhật ký`, d.removed.length === 0 && d.changed.every((k) => k === OVERLAY_KEY) && d.added.every((k) => k.startsWith(AUDIT_PREFIX)), d);
  };
  for (const [i, e] of c.edits.entries()) await write(`sửa ${i + 1}`, async () => A("PUT", ov(id), { ...e, expected_version: await ver() }));
  if (remove) await write("xoá", async () => A("POST", DEL(id), { expected_version: await ver(), reason: "bất biến" }));
  let drop = null;
  if (leave) { const i = VENDOR_POOL.findIndex((v) => v.id === id); drop = { i, v: VENDOR_POOL.splice(i, 1)[0] }; await loadOverlay(env, { force: true }); }
  if (remove) await write("khôi phục", async () => A("POST", RES(id), { expected_version: await ver() }));
  await loadOverlay(env, { force: true });
  const d = await A("GET", `/api/admin/vendors/${id}`);
  const all = await listAll(A), orphan = await listAll(A, "label=orphan");
  const st = await Cp("POST", "/api/vendors/status", { ids: [id] });
  const out = {
    detailStatus: d.status,
    override: meta(d.json?.override ?? null), effective: d.json?.effective ?? null, edited: d.json?.edited_fields ?? null, history: (d.json?.history ?? null) && d.json.history.map(({ at, ...h }) => h), // bỏ thời điểm (hai thế giới chạy ở hai lúc) deleted: d.json?.deleted === true,
    row: noVer(all.rows.find((r) => r.id === id) || null), orphanRow: noVer(orphan.rows.find((r) => r.id === id) || null),
    status: st.json?.vendors?.[id] ?? null, chat: (await chatIds(env, c.T.mp)).includes(id),
  };
  if (drop) VENDOR_POOL.splice(drop.i, 0, drop.v);
  return out;
}
const strip = (o) => { const x = { ...o }; delete x.deleted; return x; };
for (const c of CASES) {
  for (const leave of [false, true]) {
    const ref = await world(c, { remove: false, leave });
    const got = await world(c, { remove: true, leave });
    const where = leave ? "rời pool trong lúc đang xoá" : "còn trong pool";
    R.check(`${c.name} (${where}): sau Khôi phục không còn cờ xoá`, got.deleted === false, got.deleted);
    for (const k of Object.keys(strip(ref))) {
      R.check(`${c.name} (${where}): ${k} y hệt bản chưa từng bị xoá`, same(got[k], ref[k]), [got[k], ref[k]]);
    }
  }
}
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
