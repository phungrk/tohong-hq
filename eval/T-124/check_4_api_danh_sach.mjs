#!/usr/bin/env node
// T-124 tiêu chí 4 (repo tohong-back): GET /api/admin/vendor-enrich trả đúng bảng, đếm, lọc, chia trang.
// Chạy: node eval/T-124/check_4_api_danh_sach.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). Gọi thẳng worker.fetch với R2 giả; không mạng.
// Hợp đồng: GET /api/admin/vendor-enrich?filter=<all|full|no_google_photo|name_similar|addr_diff|tên nhóm>&category=<id>&q=<từ khoá>&offset=&limit=
//   -> 200, Cache-Control: no-store, {summary:{total,groups,chips,approvable,data_as_of}, total, offset, limit, rows:[{n,id,name,category,catLabel,group,marry,google,approvable,override,review}]}
//   summary luôn là của TOÀN BỘ danh sách (không đổi theo filter); total là số dòng sau lọc; n = offset + vị trí + 1; limit mặc định 50, tối đa 100.
//   Dữ liệu = báo cáo nhúng ở back (lib/vendorEnrichReport.generated.js). q so không dấu, không phân biệt hoa thường, trên tên vendor.
//   filter lạ -> 400 {"error":"invalid_filter"}; POST/PUT/DELETE trên đường dẫn danh sách -> 405.
import fs from "node:fs";
import path from "node:path";
import { BACK, MemoryBucket, makeEnv, asAdmin, call, reporter, outbound } from "./lib/back.mjs";

const R = reporter();
const fp = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(fp)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const m = fs.readFileSync(fp, "utf8").match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/);
let rep; try { rep = JSON.parse(m[1]); } catch { console.log("FAIL file dữ liệu nhúng không phải JSON thuần"); process.exit(1); }
const all = rep.vendors;
const env = makeEnv(new MemoryBucket());
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const CHIP = { all: () => true, full: (r) => r.group === "full", name_similar: (r) => r.group === "name_similar",
  addr_diff: (r) => r.group === "addr_diff_accepted" || r.group === "name_same_addr_diff", no_google_photo: (r) => !r.google || r.google.photo_count === 0 };
const GROUPS = ["full", "matched_no_photo", "addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar", "not_found", "temp_closed", "not_enriched"];

let r = await asAdmin(env, "GET", "/api/admin/vendor-enrich");
R.check("GET danh sách trả 200", r.status === 200, r.status);
if (r.status !== 200) R.done();
const j = r.json;
R.check("summary bằng summary của báo cáo", JSON.stringify(j.summary && { t: j.summary.total, g: j.summary.groups, c: j.summary.chips, a: j.summary.approvable }) === JSON.stringify({ t: rep.summary.total, g: rep.summary.groups, c: rep.summary.chips, a: rep.summary.approvable }), j.summary);
R.check("tổng các nhóm bằng total (một vendor một nhóm)", Object.values(j.summary.groups).reduce((a, b) => a + b, 0) === j.summary.total && j.summary.total === all.length);
R.check("mặc định 50 dòng, n bắt đầu từ 1, total = tổng", j.rows.length === Math.min(50, all.length) && j.rows[0].n === 1 && j.total === all.length && j.limit === 50 && j.offset === 0, [j.rows.length, j.total, j.limit]);
const row = j.rows[0];
R.check("dòng có đủ trường: id, name, category, catLabel, group, marry.address, google, approvable, override, review", ["id", "name", "category", "catLabel", "group", "marry", "google", "approvable", "override", "review"].every((k) => k in row) && row.marry && "address" in row.marry, Object.keys(row));
R.check("thứ tự dòng bằng thứ tự báo cáo", j.rows.every((x, i) => x.id === all[i].id && x.group === all[i].group));
R.check("Cache-Control no-store", true); // kiểm thật ở dưới bằng call thô
{ const res = await (await import("./lib/back.mjs")).worker.fetch(new Request("http://localhost/api/admin/vendor-enrich", { headers: { Authorization: "Bearer dev:user_admin" } }), env, { waitUntil() {} }); R.check("header Cache-Control chứa no-store", /no-store/.test(res.headers.get("Cache-Control") || "")); }

for (const [f, pred] of [...Object.entries(CHIP), ...GROUPS.map((g) => [g, (x) => x.group === g])]) {
  const want = all.filter(pred);
  const a = await asAdmin(env, "GET", `/api/admin/vendor-enrich?filter=${f}&limit=100`);
  R.check(`filter=${f}: total = ${want.length}`, a.status === 200 && a.json.total === want.length, [a.status, a.json?.total]);
  if (a.status === 200) R.check(`filter=${f}: dòng đúng và đúng thứ tự (trang 1)`, a.json.rows.every((x, i) => x.id === want[i]?.id) && a.json.rows.length === Math.min(100, want.length));
  if (f in j.summary.chips && f !== "all") R.check(`ô đếm ${f} bằng số dòng lọc được`, j.summary.chips[f] === want.length, [j.summary.chips[f], want.length]);
}
let p = await asAdmin(env, "GET", "/api/admin/vendor-enrich?limit=1000");
R.check("limit=1000 bị kẹp về 100", p.status === 200 && p.json.rows.length === 100 && p.json.limit === 100, [p.status, p.json?.rows?.length]);
p = await asAdmin(env, "GET", "/api/admin/vendor-enrich?offset=50&limit=10");
R.check("offset=50&limit=10: 10 dòng, n từ 51, đúng dòng thứ 51 của báo cáo", p.status === 200 && p.json.rows.length === 10 && p.json.rows[0].n === 51 && p.json.rows[0].id === all[50].id, [p.json?.rows?.[0]?.n]);
const last = Math.max(0, all.length - 3);
p = await asAdmin(env, "GET", `/api/admin/vendor-enrich?offset=${last}&limit=50`);
R.check("trang cuối chỉ còn 3 dòng", p.status === 200 && p.json.rows.length === all.length - last, p.json?.rows?.length);
const sample = all.find((x) => /[^\x00-\x7f]/.test(x.name)) || all[0];
const word = fold(sample.name).split(/\s+/).find((w) => w.length >= 4) || fold(sample.name).slice(0, 4);
const wantQ = all.filter((x) => fold(x.name).includes(word));
p = await asAdmin(env, "GET", `/api/admin/vendor-enrich?q=${encodeURIComponent(word.toUpperCase())}&limit=100`);
R.check(`q=${word}: không dấu, không phân biệt hoa thường, total ${wantQ.length}`, p.status === 200 && p.json.total === wantQ.length && p.json.rows[0]?.n === 1, [p.json?.total]);
const cat = all[0].category; const wantC = all.filter((x) => x.category === cat);
p = await asAdmin(env, "GET", `/api/admin/vendor-enrich?category=${cat}&limit=100`);
R.check(`category=${cat}: total ${wantC.length}`, p.status === 200 && p.json.total === wantC.length && p.json.rows.every((x) => x.category === cat), p.json?.total);
p = await asAdmin(env, "GET", `/api/admin/vendor-enrich?filter=full&category=${cat}&q=${encodeURIComponent(word)}`);
R.check("lọc kết hợp: summary vẫn là của toàn bộ", p.status === 200 && p.json.summary.total === all.length, p.json?.summary?.total);
p = await asAdmin(env, "GET", "/api/admin/vendor-enrich?filter=khong_co");
R.check("filter lạ -> 400 invalid_filter", p.status === 400 && p.json?.error === "invalid_filter", [p.status, p.json]);
p = await asAdmin(env, "POST", "/api/admin/vendor-enrich", {});
R.check("POST trên danh sách -> 405", p.status === 405, p.status);
R.check("không gọi mạng ra ngoài (Google)", outbound.length === 0, outbound);
R.done();
