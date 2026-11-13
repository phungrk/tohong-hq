#!/usr/bin/env node
// T-151 adv-02 (adversary, tầng 3): nhãn `reviews` của field_notes ở các biên mà dữ liệu thật (eval T-147 #3) không có.
// Spec products/T-150-drawer-moi-admin-nhan-reviews.md Hành vi 2: N = số phần tử top_reviews CÓ `text` (tối đa 5), M = số phần tử `reviews` của pool (thiếu = 0);
// N khác M -> đúng MỘT ghi chú {field:"reviews", code:"kept_from_base", text:"giữ từ pool nền (ADR-025, --styles-only): nguồn hiện có N bài đánh giá có chữ, pool có M"}, đứng SAU mọi ghi chú khác;
// N bằng M -> không có ghi chú; báo cáo không có nguồn -> không có ghi chú reviews; không sập (200).
// Bản sao tạm của back, sửa báo cáo + pool nhúng. Chạy: cd <tohong-back> && node <hq>/eval/T-151/adv-02-nhan-reviews-bien.mjs
import fs from "node:fs";
import path from "node:path";
import { BACK, load, embedded, copyBack, outbound, reporter } from "../T-147/lib/back147.mjs";

const R = reporter();
process.on("uncaughtException", (e) => { console.log("FAIL ngoại lệ: " + String(e && e.message).slice(0, 200)); process.exit(1); });
const report = embedded(BACK, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
const pf0 = fs.readFileSync(path.join(BACK, "lib", "vendorPool.generated.js"), "utf8");
const pool0 = JSON.parse(pf0.slice(pf0.indexOf("= [") + 2, pf0.lastIndexOf("]") + 1));
const inPool = new Set(pool0.map((v) => v.id));
const rows = report.vendors.filter((r) => inPool.has(r.id) && r.pool_input && r.pool_input.record && !r.override);
const T = (k) => ({ author: `A${k}`, rating: 5, text: `bài ${k}` });
const P = (k) => ({ author: `A${k}`, rating: 5, text: `bài ${k}` });
const msg = (n, m) => `giữ từ pool nền (ADR-025, --styles-only): nguồn hiện có ${n} bài đánh giá có chữ, pool có ${m}`;
// [tên ca, top_reviews nguồn (undefined = xoá khoá), reviews pool (undefined = xoá khoá), chữ mong đợi | null]
const CASES = [
  ["0 bài nguồn, pool không có khoá reviews", undefined, undefined, null],
  ["0 bài nguồn (mảng rỗng), pool reviews []", [], [], null],
  ["7 bài có chữ ở nguồn, pool 5: cắt 5 -> khớp", [1, 2, 3, 4, 5, 6, 7].map(T), [1, 2, 3, 4, 5].map(P), null],
  ["7 bài có chữ ở nguồn, pool 3", [1, 2, 3, 4, 5, 6, 7].map(T), [1, 2, 3].map(P), msg(5, 3)],
  ["bài không có chữ / chữ rỗng / null không được đếm", [{ text: "" }, { rating: 5 }, null, { author: "x", text: null }, T(1)], undefined, msg(1, 0)],
  ["top_reviews không phải mảng", "chuoi", [1, 2].map(P), msg(0, 2)],
  ["hai bài trùng lặp vẫn là hai phần tử", [T(1), T(1)], [1, 2].map(P), null],
  ["hai bài trùng lặp, pool 1", [T(1), T(1)], [P(1)], msg(2, 1)],
  ["pool có 2, nguồn không có khoá", undefined, [1, 2].map(P), msg(0, 2)],
];
if (rows.length < CASES.length + 1) { console.log("FAIL dữ liệu thật thiếu vendor trong pool có nguồn"); process.exit(2); }
const noSrc = rows[CASES.length];
const dir = copyBack((d) => {
  const rf = path.join(d, "lib", "vendorEnrichReport.generated.js");
  const rep = embedded(d, "vendorEnrichReport.generated.js", "VENDOR_ENRICH_REPORT");
  const by = new Map(rep.vendors.map((r) => [r.id, r]));
  CASES.forEach(([, src], i) => { const rec = by.get(rows[i].id).pool_input.record; if (src === undefined) delete rec.top_reviews; else rec.top_reviews = src; });
  delete by.get(noSrc.id).pool_input;
  fs.writeFileSync(rf, "// AUTO-GENERATED — do not edit manually.\nexport const VENDOR_ENRICH_REPORT = " + JSON.stringify(rep) + ";\n");
  const pf = path.join(d, "lib", "vendorPool.generated.js");
  const t = fs.readFileSync(pf, "utf8");
  const i0 = t.indexOf("= [") + 2, j0 = t.lastIndexOf("]") + 1;
  const arr = JSON.parse(t.slice(i0, j0));
  const pb = new Map(arr.map((v) => [v.id, v]));
  CASES.forEach(([, , pr], i) => { const v = pb.get(rows[i].id); if (pr === undefined) delete v.reviews; else v.reviews = pr; });
  pb.get(noSrc.id).reviews = [1, 2, 3].map(P);
  fs.writeFileSync(pf, t.slice(0, i0) + JSON.stringify(arr) + t.slice(j0));
});
try {
  const S = await load(dir);
  const env = S.makeEnv(new S.MemoryBucket());
  for (let i = 0; i < CASES.length; i++) {
    const [cn, , , want] = CASES[i];
    const r = await S.asCapu(env, "GET", `/api/admin/vendor-enrich/${rows[i].id}/detail`);
    const fn = r.json?.pool?.field_notes || [];
    const rv = fn.filter((n) => n.field === "reviews");
    const ok = r.status === 200 && (want === null ? rv.length === 0
      : rv.length === 1 && rv[0].code === "kept_from_base" && rv[0].text === want && fn[fn.length - 1].field === "reviews");
    R.check(`${cn} -> ${want === null ? "không có ghi chú reviews" : JSON.stringify(want.split(": ")[1])}`, ok, [r.status, rv]);
  }
  const n = await S.asCapu(env, "GET", `/api/admin/vendor-enrich/${noSrc.id}/detail`);
  R.check("báo cáo không có nguồn (thiếu pool_input), pool có 3 bài: 200, không có ghi chú reviews", n.status === 200 && n.json.source.available === false && !(n.json.pool.field_notes || []).some((x) => x.field === "reviews"), [n.status, n.json?.pool?.field_notes]);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
