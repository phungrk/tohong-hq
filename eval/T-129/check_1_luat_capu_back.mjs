#!/usr/bin/env node
// T-129 tiêu chí 1 (repo tohong-back): cú bấm Approve / Sửa thủ công của Capu là quyết định; admin khác bấm vẫn là "chờ Capu"; không giả mạo được từ thân yêu cầu.
// Chạy: cd /home/user/tohong-back && node /home/user/tohong-hq/eval/T-129/check_1_luat_capu_back.mjs   (TOHONG_BACK_REPO hoặc ../tohong-back). worker.fetch thật + R2 giả; mạng bị chặn.
// Hợp đồng (bổ sung cho T-124 Hành vi 3, 4, 6):
//  Biến môi trường mới CAPU_USER_IDS (Clerk user id cách nhau dấu phẩy, cùng cách đọc ADMIN_USER_IDS: cắt khoảng trắng, bỏ mục rỗng). Người là Capu <=> có trong ADMIN_USER_IDS VÀ trong CAPU_USER_IDS.
//  Thiếu hoặc rỗng CAPU_USER_IDS: không ai là Capu (đóng mặc định). User chỉ có trong CAPU_USER_IDS mà không có trong ADMIN_USER_IDS: vẫn 403 forbidden ở mọi route admin.
//  PUT …/review: review trả về và lưu có `by_capu` (boolean) = người bấm là Capu (từ TOKEN; thân yêu cầu có `by_capu`, `reviewed_by`, `capu` đều bị bỏ qua). GET danh sách trả `review.by_capu`.
//  `by_capu` trả ra ở mọi phản hồi là giá trị HIỆU LỰC: true chỉ khi lúc bấm người đó là Capu VÀ hiện giờ vẫn là Capu (gỡ id khỏi CAPU_USER_IDS thì mọi review chờ của id đó thành false, không cần ghi R2).
//  Review có by_capu hiệu lực true chỉ Capu mới PUT đè hoặc DELETE được; admin khác nhận 409 {"error":"decided_by_capu"} và R2 không đổi. Capu đè hoặc rút review của admin khác được (đè thì thành by_capu true).
//  Nhật ký admin (vendor_enrich.review) ghi `after.by_capu`.
//  GET export (admin): {count, waiting_capu, skipped_not_approvable, entries}; entries CHỈ gồm review by_capu hiệu lực true, sắp theo vendor_id, mỗi entry {vendor_id, action, place_id|maps_link, reason, reviewer_label, reviewed_at, by_capu:true}
//  với reviewer_label = "admin:" + 8 ký tự hex đầu của sha256(user id) ; KHÔNG có trường reviewed_by và không chuỗi user id nào xuất hiện trong thân export; waiting_capu = số review chờ nhưng không phải của Capu.
//  GHI THÊM (ADR-066, M3): mỗi entry export có `key_id` (= ENRICH_SIGNING_KEY_ID) và `sig` (Ed25519 base64url không đệm, 86 ký tự) trên (key_id, vendor_id, action, place_id, maps_link, reason, reviewer_label, reviewed_at)
//  theo định dạng của eval/T-129/lib/signing.mjs; thân export có `exported_at` (ISO). ENRICH_SIGNING_KEY (PKCS8 DER base64 của khoá Ed25519) thiếu/hỏng hoặc ENRICH_SIGNING_KEY_ID sai dạng ^k[0-9a-z]{1,8}$:
//  cả hai route export trả 503 {"error":"signing_unavailable"} (không bao giờ trả entry chưa ký). waiting_capu chỉ đếm review chờ của dòng còn trong báo cáo, chưa có override, không phải Approve hết approvable, và không phải của Capu.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BACK, MemoryBucket, makeEnv, call, reporter, outbound } from "./lib/back.mjs";
import { makeKey, signingEnv, verifyEntry } from "./lib/signing.mjs";

const R = reporter();
const fp = path.join(BACK, "lib", "vendorEnrichReport.generated.js");
if (!fs.existsSync(fp)) { console.log("FAIL thiếu lib/vendorEnrichReport.generated.js ở tohong-back"); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(fp, "utf8").match(/export\s+const\s+VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const appr = rep.vendors.filter((r) => r.approvable && !r.override);
if (appr.length < 8) { console.log("FAIL báo cáo thiếu dòng approvable để đo"); process.exit(1); }
const [A, B, C, D, E, F] = appr.map((r) => r.id);
const label = (u) => "admin:" + crypto.createHash("sha256").update(u).digest("hex").slice(0, 8);
const U = { capu: "user_capu_0001", adm: "user_admin_0002", adm2: "user_admin_0003", outsider: "user_capuonly_0004" };
const base = "/api/admin/vendor-enrich";
const bucket = new MemoryBucket();
const KEY = makeKey("k1");
const ENV = { ...signingEnv(KEY), ADMIN_USER_IDS: `${U.capu}, ${U.adm},${U.adm2},,`, CAPU_USER_IDS: ` ${U.capu} ,${U.outsider},` };
const env = makeEnv(bucket, ENV);
const as = (e, u, method, p, body) => call(e, method, p, { token: `dev:${u}`, body });
const rv = (id) => `${base}/${id}/review`;
const listRow = async (e, u, id) => (await as(e, u, "GET", `${base}?limit=100&q=${encodeURIComponent(rep.vendors.find((r) => r.id === id).name)}`)).json?.rows?.find((x) => x.id === id);
const reviewsKeyBytes = () => [...bucket.data.entries()].filter(([k]) => /vendor_enrich_reviews/.test(k)).map(([, v]) => v).join("|");

// khoá R2 có sẵn một review "ma" (id không còn trong báo cáo) của admin khác: không được tính vào waiting_capu
bucket.data.set("data/admin/vendor_enrich_reviews.json", JSON.stringify({ vendors: { marry_000000000001: { state: "pending", decision: "approve", action: "accept_place", place_id: "ChIJghostXXXXXXXXXXXXXXXX", reason: "cũ", reviewed_by: U.adm, reviewed_at: "2026-11-01T00:00:00Z", by_capu: false } } }));
// 1. ai bấm thì review mang by_capu đúng; thân yêu cầu không giả mạo được
let r = await as(env, U.capu, "PUT", rv(A), { decision: "approve" });
R.check("Capu Approve -> 200, review.by_capu === true, reviewed_by = Capu (từ token)", r.status === 200 && r.json?.review?.by_capu === true && r.json.review.reviewed_by === U.capu, r.json);
r = await as(env, U.adm, "PUT", rv(B), { decision: "approve" });
R.check("admin khác Approve -> 200, review.by_capu === false", r.status === 200 && r.json?.review?.by_capu === false && r.json.review.reviewed_by === U.adm, r.json);
r = await as(env, U.adm, "PUT", rv(C), { decision: "approve", by_capu: true, capu: true, reviewed_by: U.capu, decided_by: "capu" });
R.check("thân yêu cầu có by_capu/capu/reviewed_by/decided_by bị bỏ qua: admin khác vẫn by_capu false, reviewed_by từ token", r.status === 200 && r.json?.review?.by_capu === false && r.json.review.reviewed_by === U.adm, r.json);
r = await as(env, U.capu, "PUT", rv(D), { decision: "manual", action: "remove", note: "Không có trên Maps" });
R.check("Capu Sửa thủ công -> by_capu true", r.status === 200 && r.json?.review?.by_capu === true, r.json);
r = await as(env, U.outsider, "PUT", rv(E), { decision: "approve" });
R.check("user chỉ có trong CAPU_USER_IDS (không phải admin) -> 403 forbidden, không thành Capu", r.status === 403 && r.json?.error === "forbidden" && Object.keys(r.json).length === 1, [r.status, r.json]);
const lA = await listRow(env, U.adm, A), lB = await listRow(env, U.adm, B);
R.check("GET danh sách: review.by_capu true ở dòng của Capu, false ở dòng của admin khác", lA?.review?.by_capu === true && lB?.review?.by_capu === false, [lA?.review?.by_capu, lB?.review?.by_capu]);

// 2. khoá quyết định của Capu
const snap = reviewsKeyBytes();
r = await as(env, U.adm, "PUT", rv(A), { decision: "manual", action: "remove", note: "đè" });
R.check("admin khác PUT đè review của Capu -> 409 decided_by_capu", r.status === 409 && r.json?.error === "decided_by_capu", [r.status, r.json]);
r = await as(env, U.adm, "DELETE", rv(A));
R.check("admin khác DELETE review của Capu -> 409 decided_by_capu", r.status === 409 && r.json?.error === "decided_by_capu", [r.status, r.json]);
R.check("hai lần bị chặn thì R2 không đổi byte", reviewsKeyBytes() === snap);
r = await as(env, U.adm2, "DELETE", rv(B));
R.check("admin khác rút review của admin khác (không phải Capu) vẫn được (200)", r.status === 200 && r.json?.review === null, [r.status, r.json]);
r = await as(env, U.adm, "PUT", rv(B), { decision: "approve" });
r = await as(env, U.capu, "PUT", rv(B), { decision: "approve" });
R.check("Capu đè review của admin khác -> 200 và thành by_capu true", r.status === 200 && r.json?.review?.by_capu === true, r.json);
r = await as(env, U.capu, "DELETE", rv(D));
R.check("Capu rút review của chính mình -> 200 {review:null}", r.status === 200 && r.json?.review === null, r.json);
await as(env, U.capu, "PUT", rv(D), { decision: "manual", action: "remove", note: "Không có trên Maps" });
await as(env, U.adm, "PUT", rv(F), { decision: "approve" });

// 3. export của admin: chỉ review của Capu, có nhãn băm, không lộ id
const ex = await as(env, U.adm, "GET", `${base}/export`);
const ids = (ex.json?.entries || []).map((x) => x.vendor_id);
R.check("export: chỉ review by_capu (A, B, D), sắp theo vendor_id, waiting_capu đếm phần còn lại (C, F)", ex.status === 200 && JSON.stringify(ids) === JSON.stringify([A, B, D].sort()) && ex.json.count === 3 && ex.json.waiting_capu === 2, [ex.status, ids, ex.json?.count, ex.json?.waiting_capu]);
const e0 = (ex.json?.entries || []).find((x) => x.vendor_id === D) || {};
R.check("entry: reviewer_label = admin:<8 hex đầu của sha256(user id Capu)>, by_capu true, reviewed_at ISO, action/reason đúng", e0.reviewer_label === label(U.capu) && e0.by_capu === true && !Number.isNaN(Date.parse(e0.reviewed_at)) && e0.action === "remove" && String(e0.reason).includes("Không có trên Maps"), e0);
R.check("export không có trường reviewed_by và thân không chứa user id nào", ex.json.entries.every((x) => !("reviewed_by" in x)) && !/user_(capu|admin|capuonly)/.test(ex.text), ex.text.slice(0, 200));

R.check("mỗi entry có key_id = k1 và chữ ký Ed25519 đúng (kiểm độc lập bằng khoá công khai)", ex.json.entries.length === 3 && ex.json.entries.every((x) => x.key_id === "k1" && verifyEntry(x, KEY.publicKey)), ex.json.entries.map((x) => [x.key_id, x.sig?.length]));
R.check("sửa một trường bất kỳ của entry thì chữ ký hết đúng", ["reason", "action", "vendor_id", "reviewed_at", "reviewer_label"].every((f) => !verifyEntry({ ...e0, [f]: e0[f] + "x" }, KEY.publicKey)));
R.check("thân export có exported_at ISO", !Number.isNaN(Date.parse(ex.json.exported_at)), ex.json.exported_at);
const other = makeKey("k1");
R.check("chữ ký không đúng dưới khoá công khai khác", !verifyEntry(e0, other.publicKey));
for (const [name, extra] of [["thiếu ENRICH_SIGNING_KEY", { ENRICH_SIGNING_KEY: "" }], ["ENRICH_SIGNING_KEY hỏng", { ENRICH_SIGNING_KEY: "bm90LWEta2V5" }], ["ENRICH_SIGNING_KEY_ID sai dạng", { ENRICH_SIGNING_KEY_ID: "K 1" }]]) {
  const bad = makeEnv(bucket, { ...ENV, ...extra });
  const x = await as(bad, U.adm, "GET", `${base}/export`);
  R.check(`${name}: export admin -> 503 signing_unavailable, không entry nào`, x.status === 503 && x.json?.error === "signing_unavailable" && !/"sig"|reviewer_label|vendor_id/.test(x.text), [x.status, x.text.slice(0, 80)]);
}

// 4. nhật ký
const audit = (await as(env, U.adm, "GET", "/api/admin/audit?action=vendor_enrich.review&limit=200")).json;
const mine = (audit?.entries || []).filter((e) => e.target_id === A);
R.check("nhật ký vendor_enrich.review của cú bấm Capu ghi after.by_capu true và admin_id = Capu", mine.some((e) => e.admin_id === U.capu && e.after?.by_capu === true), mine.map((e) => [e.admin_id, e.after?.by_capu]));

// 5. đóng mặc định và thu hồi
const noCapu = makeEnv(bucket, { ...signingEnv(KEY), ADMIN_USER_IDS: ENV.ADMIN_USER_IDS });
const rowA = await listRow(noCapu, U.adm, A);
const ex2 = await as(noCapu, U.adm, "GET", `${base}/export`);
R.check("CAPU_USER_IDS thiếu: review cũ của Capu thành by_capu false, export trống, waiting_capu = số review chờ (5)", rowA?.review?.by_capu === false && ex2.json?.count === 0 && ex2.json?.waiting_capu === 5, [rowA?.review?.by_capu, ex2.json]);
const emptyCapu = makeEnv(bucket, { ...signingEnv(KEY), ADMIN_USER_IDS: ENV.ADMIN_USER_IDS, CAPU_USER_IDS: "" });
const ex3 = await as(emptyCapu, U.capu, "GET", `${base}/export`);
R.check("CAPU_USER_IDS rỗng: không ai là Capu (export trống)", ex3.json?.count === 0, ex3.json?.count);
r = await as(noCapu, U.capu, "PUT", rv(E), { decision: "approve" });
R.check("CAPU_USER_IDS thiếu: Capu bấm Approve vẫn lưu nhưng by_capu false (chờ Capu)", r.status === 200 && r.json?.review?.by_capu === false, r.json);
const putsGet = bucket.putLog.length;
await as(noCapu, U.adm, "GET", `${base}/export`); await listRow(noCapu, U.adm, A);
R.check("hai lần GET liên tiếp không ghi R2", bucket.putLog.length === putsGet, bucket.putLog.slice(putsGet));
R.check("không gọi mạng ra ngoài", outbound.length === 0, outbound);
R.done();
