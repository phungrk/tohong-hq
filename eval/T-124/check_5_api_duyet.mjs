#!/usr/bin/env node
// T-124 tiêu chí 5 (repo tohong-back): Approve / Sửa thủ công ghi một "quyết định chờ áp dụng" có người duyệt; không đụng dữ liệu vendor đang chạy; không gọi Google.
// Chạy: node eval/T-124/check_5_api_duyet.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). worker.fetch thật + R2 giả; fetch ra ngoài bị chặn và đếm.
// Hợp đồng (mọi đường dẫn dưới /api/admin/vendor-enrich/, dùng id vendor dạng marry_<hex>):
//  PUT    <id>/review  {decision:"approve"}  -> 200 {review}. Chỉ khi dòng approvable; không thì 409 {"error":"not_approvable"}. Hành động = accept_place với place_id = google.place_id của dòng.
//  PUT    <id>/review  {decision:"manual", action, maps_link?, place_id?, note?}  action ∈ accept_place|remove|temporarily_closed|reject_match
//         accept_place: đúng MỘT trong maps_link (https, host share.google | goo.gl | maps.app.goo.gl | google.com/maps…) hoặc place_id; thiếu -> 400 missing_target; cả hai -> 400 ambiguous_target; link sai -> 400 bad_link.
//         remove, temporarily_closed: có maps_link/place_id -> 400 unexpected_field; note bắt buộc (400 note_required). reject_match: place_id mặc định = google.place_id của dòng (không có -> 400 missing_target), maps_link -> 400 unexpected_field, note bắt buộc.
//         note tối đa 300 ký tự (400 note_too_long). decision/action lạ -> 400 invalid_decision. id không có trong báo cáo -> 404 not_found. Dòng đã có override (đã áp ở lần enrich trước) -> 409 already_overridden.
//  review lưu: {state:"pending", decision, action, place_id|maps_link, reason (khác rỗng; Approve tự sinh), reviewed_by (= user id admin, lấy từ token, KHÔNG từ thân yêu cầu), reviewed_at (ISO)}. Mỗi vendor một review, PUT lại thì thay.
//  DELETE <id>/review -> 200 {review:null} (rút lại; idempotent).   GET export -> {count, entries:[{vendor_id, action, place_id|maps_link, reason, reviewed_by, reviewed_at}]} chỉ review đang chờ, sắp theo vendor_id; KHÔNG có approved_by/decision.
//  Mọi PUT/DELETE ghi nhật ký admin (GET /api/admin/audit?action=vendor_enrich.review | vendor_enrich.review_withdraw, admin_id = người duyệt, target_id = id vendor).
//  Chỉ được ghi vào khoá R2 có "vendor_enrich_reviews" và nhật ký audit; KHÔNG ghi data/admin/vendor_overrides.json (overlay giá/ẩn) và không thêm khoá nào khác.
import fs from "node:fs";
import path from "node:path";
import { BACK, MemoryBucket, makeEnv, asAdmin, reporter, outbound } from "./lib/back.mjs";

const R = reporter();
const fp = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(fp)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(fp, "utf8").match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const rows = rep.vendors;
const appr = rows.filter((r) => r.approvable && !r.override);
const nonAppr = rows.find((r) => !r.approvable && !r.override);
const ovr = rows.find((r) => r.override);
const withG = rows.find((r) => r.google && !r.override && !r.approvable) || rows.find((r) => r.google && !r.override);
const bare = rows.find((r) => !r.google && !r.override);
if (appr.length < 6 || !nonAppr || !withG) { console.log("FAIL báo cáo thiếu ca để đo (cần >= 6 dòng approvable, 1 dòng không approvable)"); process.exit(1); }
const bucket = new MemoryBucket();
const env = makeEnv(bucket);
const URL_ = (id, s = "review") => `/api/admin/vendor-enrich/${id}/${s}`;
const before = JSON.stringify(await asAdmin(env, "GET", "/api/admin/vendor-enrich?limit=100").then((x) => x.json.summary));
const OK_PID = "ChIJ_Q8PLiQvdTERNk66UVRKf8U";

let r = await asAdmin(env, "PUT", URL_(appr[0].id), { decision: "approve", reviewed_by: "ke_gia_mao" });
R.check("Approve dòng approvable -> 200", r.status === 200, [r.status, r.json]);
const rv = r.json?.review || {};
R.check("review: pending, accept_place, place_id = google.place_id, lý do khác rỗng", rv.state === "pending" && rv.action === "accept_place" && rv.place_id === appr[0].google.place_id && String(rv.reason || "").trim() !== "", rv);
R.check("reviewed_by = admin trong token (không lấy từ thân yêu cầu), reviewed_at là ISO", rv.reviewed_by === "user_admin" && !Number.isNaN(Date.parse(rv.reviewed_at)), [rv.reviewed_by, rv.reviewed_at]);
r = await asAdmin(env, "PUT", URL_(nonAppr.id), { decision: "approve" });
R.check("Approve dòng không approvable -> 409 not_approvable", r.status === 409 && r.json?.error === "not_approvable", [r.status, r.json]);
r = await asAdmin(env, "PUT", URL_("marry_000000000000"), { decision: "approve" });
R.check("id không có trong báo cáo -> 404 not_found", r.status === 404 && r.json?.error === "not_found", [r.status, r.json]);
if (ovr) { r = await asAdmin(env, "PUT", URL_(ovr.id), { decision: "manual", action: "remove", note: "x" }); R.check("dòng đã có override -> 409 already_overridden", r.status === 409 && r.json?.error === "already_overridden", [r.status, r.json]); }

const man = (id, body) => asAdmin(env, "PUT", URL_(id), { decision: "manual", ...body });
const A1 = appr[1].id, A2 = appr[2].id, A3 = appr[3].id, A4 = appr[4].id, A5 = appr[5].id;
r = await man(A1, { action: "accept_place", place_id: OK_PID, note: "Capu tra Maps" });
R.check("Sửa thủ công accept_place + place_id -> 200, review khớp", r.status === 200 && r.json.review.action === "accept_place" && r.json.review.place_id === OK_PID && r.json.review.reason.includes("Capu tra Maps"), r.json);
r = await man(A1, { action: "accept_place", maps_link: "https://share.google/tYZdblcikIDPqVJX6" });
R.check("PUT lại thay review cũ (mỗi vendor một review): giờ là maps_link, hết place_id", r.status === 200 && r.json.review.maps_link === "https://share.google/tYZdblcikIDPqVJX6" && !r.json.review.place_id, r.json);
for (const [name, body, code] of [
  ["accept_place thiếu đích", { action: "accept_place" }, "missing_target"],
  ["accept_place có cả link và place_id", { action: "accept_place", maps_link: "https://goo.gl/maps/abc", place_id: OK_PID }, "ambiguous_target"],
  ["accept_place link http", { action: "accept_place", maps_link: "http://share.google/x" }, "bad_link"],
  ["accept_place link host lạ", { action: "accept_place", maps_link: "https://evil.example/maps" }, "bad_link"],
  ["remove có place_id", { action: "remove", place_id: OK_PID, note: "n" }, "unexpected_field"],
  ["remove thiếu note", { action: "remove" }, "note_required"],
  ["temporarily_closed thiếu note", { action: "temporarily_closed", note: "   " }, "note_required"],
  ["reject_match có maps_link", { action: "reject_match", maps_link: "https://goo.gl/maps/abc", note: "n" }, "unexpected_field"],
  ["note quá 300 ký tự", { action: "remove", note: "a".repeat(301) }, "note_too_long"],
  ["action lạ", { action: "delete_all", note: "n" }, "invalid_decision"],
]) { const x = await man(A2, body); R.check(`${name} -> 400 ${code}`, x.status === 400 && x.json?.error === code, [x.status, x.json]); }
r = await asAdmin(env, "PUT", URL_(A2), { decision: "lạ" });
R.check("decision lạ -> 400 invalid_decision", r.status === 400 && r.json?.error === "invalid_decision", [r.status, r.json]);
const ex2 = (await asAdmin(env, "GET", "/api/admin/vendor-enrich/export")).json;
R.check("các lần PUT lỗi không để lại review nào cho vendor đó", !ex2?.entries?.some((e) => e.vendor_id === A2), ex2?.entries?.length);
r = await man(A2, { action: "remove", note: "Không có trên Maps" });
R.check("remove + note -> 200, không mang place_id/maps_link", r.status === 200 && r.json.review.action === "remove" && !r.json.review.place_id && !r.json.review.maps_link, r.json);
r = await man(A3, { action: "temporarily_closed", note: "Maps ghi tạm đóng" });
R.check("temporarily_closed + note -> 200", r.status === 200 && r.json.review.action === "temporarily_closed", r.json);
const gid = withG.google?.place_id;
r = await man(withG.id, { action: "reject_match", note: "Sai nơi" });
R.check("reject_match không nêu place_id: lấy google.place_id của dòng", r.status === 200 && r.json.review.action === "reject_match" && r.json.review.place_id === gid, r.json);
if (bare) { r = await man(bare.id, { action: "reject_match", note: "n" }); R.check("reject_match dòng không có Google -> 400 missing_target", r.status === 400 && r.json?.error === "missing_target", [r.status, r.json]); }

// hai PUT đồng thời cho hai vendor: cả hai phải còn (ghi có kiểm etag, không mất cập nhật)
const par = await Promise.all([asAdmin(env, "PUT", URL_(A4), { decision: "approve" }), asAdmin(env, "PUT", URL_(A5), { decision: "approve" })]);
R.check("hai PUT đồng thời đều 200", par.every((x) => x.status === 200), par.map((x) => x.status));
const ex = (await asAdmin(env, "GET", "/api/admin/vendor-enrich/export")).json;
const ids = (ex?.entries || []).map((e) => e.vendor_id);
const want = [appr[0].id, A1, A2, A3, withG.id, A4, A5].sort();
R.check("export: đúng các review đang chờ (7), sắp theo vendor_id, count khớp", ex?.count === want.length && JSON.stringify(ids) === JSON.stringify(want), [ex?.count, ids.length]);
R.check("export: mỗi mục có vendor_id, action, reason, reviewed_by=user_admin, reviewed_at; không có approved_by/decision", (ex?.entries || []).every((e) => e.vendor_id && e.action && String(e.reason || "").trim() && e.reviewed_by === "user_admin" && e.reviewed_at && !("approved_by" in e) && !("decision" in e)), ex?.entries?.[0]);
R.check("export: accept_place có đúng một trong place_id/maps_link; remove/temporarily_closed không có cả hai", (ex?.entries || []).every((e) => e.action === "accept_place" ? (!!e.place_id !== !!e.maps_link) : e.action === "reject_match" ? !!e.place_id && !e.maps_link : (!e.place_id && !e.maps_link)), ex?.entries);

const list = (await asAdmin(env, "GET", "/api/admin/vendor-enrich?limit=100")).json;
const byId = Object.fromEntries((await asAdmin(env, "GET", `/api/admin/vendor-enrich?limit=100&offset=0`)).json.rows.map((x) => [x.id, x]));
const cand = (await asAdmin(env, "GET", `/api/admin/vendor-enrich?q=${encodeURIComponent(appr[0].name)}&limit=100`)).json.rows.find((x) => x.id === appr[0].id);
R.check("danh sách: dòng đã duyệt hiện review.state=pending + người duyệt", cand?.review?.state === "pending" && cand.review.reviewed_by === "user_admin", cand?.review);
R.check("Approve/Sửa không đổi nhóm hay số đếm (nhóm đổi chỉ ở lần enrich sau)", JSON.stringify(list.summary) === before && cand?.group === appr[0].group, [list.summary, before]);

r = await asAdmin(env, "DELETE", URL_(A5));
R.check("DELETE rút lại -> 200 {review:null}", r.status === 200 && r.json?.review === null, [r.status, r.json]);
r = await asAdmin(env, "DELETE", URL_(A5));
R.check("DELETE lần hai vẫn 200 (idempotent)", r.status === 200, r.status);
const ex3 = (await asAdmin(env, "GET", "/api/admin/vendor-enrich/export")).json;
R.check("sau rút lại, export còn 6", ex3?.count === 6 && !ex3.entries.some((e) => e.vendor_id === A5), ex3?.count);

const audit = (await asAdmin(env, "GET", "/api/admin/audit?action=vendor_enrich.review&limit=200")).json;
const mine = (audit?.entries || []).filter((e) => e.admin_id === "user_admin");
R.check("nhật ký audit có vendor_enrich.review cho từng lần PUT thành công (>= 8), target_id là id vendor", mine.length >= 8 && mine.some((e) => e.target_id === appr[0].id), mine.length);
const aw = (await asAdmin(env, "GET", "/api/admin/audit?action=vendor_enrich.review_withdraw&limit=50")).json;
R.check("nhật ký audit có vendor_enrich.review_withdraw cho lần rút lại", (aw?.entries || []).some((e) => e.admin_id === "user_admin" && e.target_id === A5), aw?.entries?.length);

const keys = [...new Set(bucket.putLog)];
const stray = keys.filter((k) => !/vendor_enrich_reviews/.test(k) && !k.startsWith("data/admin/audit/"));
R.check("chỉ ghi khoá vendor_enrich_reviews và audit; không ghi vendor_overrides.json hay khoá nào khác", stray.length === 0 && !keys.includes("data/admin/vendor_overrides.json"), stray);
R.check("không gọi mạng ra ngoài (Google) trong mọi thao tác", outbound.length === 0, outbound);
R.done();
