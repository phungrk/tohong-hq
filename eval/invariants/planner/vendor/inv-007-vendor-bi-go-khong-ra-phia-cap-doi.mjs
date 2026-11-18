#!/usr/bin/env node
// Bất biến đề xuất (vùng planner/vendor) · nguồn: T-203 (spec products/T-203-xoa-vendor-khoi-phuc.md v2, Tình huống 2 "giống hệt vendor đang Ẩn, ở mọi bề mặt"; bất biến đề xuất số 1).
// Rút khi qua Spec Gate 2026-11-18 (spec-critic). Chief of Staff đặt số khi đưa vào eval/invariants/planner/vendor/; nhớ giữ eval/T-203/lib/common.mjs.
// Nằm ở eval/T-203/bat-bien-cho-merge/ cho tới khi PR T-203 merge (ADR-028). Trên main hiện tại vế "Ẩn" xanh, vế "Xoá" ĐỎ (chưa có route xoá); đó là đúng.
// INV-??? · Vendor trong pool đang bị gỡ (cờ Ẩn, cờ Xoá, hoặc cả hai) KHÔNG BAO GIỜ ra phía cặp đôi: không ở ghép theo id, không ở ghép theo hạng mục,
//   không ở ứng viên chat, không được đếm ở /api/vendors/categories; và vẫn hiển thị được ở kế hoạch đã lưu: /api/vendors/status có mục hidden:true (không null),
//   /api/vendors/:id 200 với vendor.hidden:true, match:null. Ba cách gỡ cho đúng cùng một kết quả ở mọi bề mặt (một luật "vendor đang bị gỡ", không hai nhánh).
// Thoát 0 = đạt, 1 = vi phạm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// Dò ngược tới gốc tohong-hq (có scripts/gate.py), không đếm cấp thư mục (ADR-057/070, _shared/inv-004).
let HQ = path.dirname(fileURLToPath(import.meta.url)); while (HQ !== path.dirname(HQ) && !fs.existsSync(path.join(HQ, "scripts", "gate.py"))) HQ = path.dirname(HQ);
const L = await import(pathToFileURL(path.join(HQ, "eval", "T-203", "lib", "common.mjs")).href);
const { fresh, pickTarget, chatIds, asAdmin, asCouple, DEL, VENDOR_POOL, reporter, outbound, loadOverlay, resetOverlayCache } = L;
const R = reporter();

async function surfaces(env, T) {
  const C = asCouple(env);
  await loadOverlay(env, { force: true });
  const id = T.id;
  const byIds = await C("GET", `/api/vendors/match?ids=${id}`);
  const inCat = await C("GET", `/api/vendors/match?category=${T.category}&limit=50`);
  const cats = await C("GET", "/api/vendors/categories");
  const st = await C("POST", "/api/vendors/status", { ids: [id] });
  const one = await C("GET", `/api/vendors/${id}`);
  return {
    byIds: (byIds.json?.vendors || []).some((v) => v.id === id),
    inCat: (inCat.json?.vendors || []).some((v) => v.id === id),
    catCount: (cats.json || []).find((c) => c.category === T.category)?.count ?? null,
    chat: (await chatIds(env, T.mp)).includes(id),
    status: st.json?.vendors?.[id] ?? null,
    one: { s: one.status, hidden: one.json?.vendor?.hidden, match: one.json?.match, name: one.json?.vendor?.name },
  };
}
const WAYS = {
  "Ẩn": async (A, id) => [await A("PUT", `/api/admin/vendors/${id}/override`, { hidden: true, hidden_reason: "bất biến", expected_version: 0 })],
  "Xoá": async (A, id) => [await A("POST", DEL(id), { expected_version: 0, reason: "bất biến" })],
  "Ẩn rồi Xoá": async (A, id) => { const h = await A("PUT", `/api/admin/vendors/${id}/override`, { hidden: true, hidden_reason: "bất biến", expected_version: 0 }); return [h, await A("POST", DEL(id), { expected_version: h.json?.version ?? 1, reason: "bất biến" })]; },
};
for (const category of ["photography", "makeup", "decor"]) {
  resetOverlayCache();
  const T = await pickTarget(fresh().env, category);
  if (!T.id) { R.check(`tiền điều kiện ${category}: có vendor ứng viên chat`, false); continue; }
  const name = VENDOR_POOL.find((v) => v.id === T.id)?.name;
  resetOverlayCache();
  const base = await surfaces(fresh().env, T);
  R.check(`${category}: tiền điều kiện: vendor ${T.id} đang hiện (ghép theo id + chat)`, base.byIds && base.chat, [base.byIds, base.chat]);
  const results = {};
  for (const [way, fn] of Object.entries(WAYS)) {
    resetOverlayCache();
    const { env } = fresh();
    const rs = await fn(asAdmin(env), T.id);
    R.check(`${category}/${way}: thao tác admin 200`, rs.every((r) => r.status === 200), rs.map((r) => [r.status, r.text.slice(0, 50)]));
    const s = await surfaces(env, T);
    results[way] = s;
    R.check(`${category}/${way}: không ở ghép theo id, ghép theo hạng mục, ứng viên chat`, !s.byIds && !s.inCat && !s.chat, [s.byIds, s.inCat, s.chat]);
    R.check(`${category}/${way}: đếm hạng mục giảm đúng 1`, base.catCount !== null && s.catCount === base.catCount - 1, [base.catCount, s.catCount]);
    R.check(`${category}/${way}: /status có mục hidden:true (không null)`, s.status !== null && s.status.hidden === true, s.status);
    R.check(`${category}/${way}: /:id 200, hidden:true, match:null, còn tên`, s.one.s === 200 && s.one.hidden === true && s.one.match === null && s.one.name === name, s.one);
  }
  const ways = Object.keys(results);
  R.check(`${category}: ba cách gỡ cho cùng một kết quả ở mọi bề mặt cặp đôi`, ways.every((w) => JSON.stringify(results[w]) === JSON.stringify(results[ways[0]])), ways.map((w) => results[w].status));
}
R.check("không request ra ngoài", outbound.length === 0, outbound);
R.done();
