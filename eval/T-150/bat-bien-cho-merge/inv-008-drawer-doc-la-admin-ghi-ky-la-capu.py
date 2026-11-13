#!/usr/bin/env python3
"""Nguồn: T-150 (spec products/T-150-drawer-moi-admin-nhan-reviews.md v1, Hành vi 1 + "Bất biến đề xuất"; ADR-083 mục 2), rút bởi spec-critic tại Spec Gate 2026-11-13.
Nằm ở eval/T-150/bat-bien-cho-merge/ cho tới khi PR back của T-150 merge (trên main hiện tại ý (b) đỏ vì route còn chỉ Capu);
Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/ và đặt số. Gốc HQ dò ngược tới scripts/gate.py (không đếm cấp), chép sang bể không phải sửa.
INV-??? (planner/admin/vendor-enrich) · Drawer chi tiết vendor-enrich: ĐỌC là mọi platform admin, GHI và KÝ là Capu.
  (a) người không nằm trong ADMIN_USER_IDS (không token, token rác, user thường, ADMIN_USER_IDS rỗng/thiếu, token dev khi DEV_AUTH_BYPASS tắt,
      người chỉ có trong CAPU_USER_IDS) gọi /api/admin/vendor-enrich/<id>/detail (id thật, id không có, POST) luôn nhận 403, thân đúng {"error":"forbidden"};
  (b) mọi admin (kể cả khi CAPU_USER_IDS rỗng hay chỉ có người khác) GET detail id thật nhận 200 và thân GIỐNG HỆT thân Capu nhận;
  (c) admin không phải Capu: Approve và Sửa thủ công đều ra review by_capu=false; export ký (/api/internal/vendor-enrich/export) không có mục nào của họ,
      có mục của Capu; Capu quyết rồi thì admin khác ghi đè (PUT) hay rút lại (DELETE) đều nhận 409 decided_by_capu;
  (d) đọc detail (chặn lẫn mở) không ghi R2 và không làm export đổi.
Lý do: ADR-083 nới quyền ĐỌC; không có bất biến thì lần nới sau có thể nới luôn quyền ghi/ký mà không ai thấy (ý (c) chồng một phần inv-004, ghi riêng cho rõ ranh giới đọc/ghi).
Tự chứa: worker thật của tohong-back + R2 giả của chính repo (test/helpers/memoryBucket.js), khoá Ed25519 sinh tạm, fetch toàn cục bị chặn; không ghi gì trong repo.
Repo: TOHONG_BACK_REPO hoặc ../tohong-back cạnh gốc HQ. Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import os, shutil, subprocess, sys, tempfile


def find_hq(start):
    d = start
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)
    return None


HQ_DIR = find_hq(os.path.dirname(os.path.abspath(__file__))) or os.getcwd()
BACK = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ_DIR, "..", "tohong-back"))
             if p and os.path.isfile(os.path.join(p, "worker.js"))), None)
if not BACK:
    print("FAIL không thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)

JS = r"""
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const BACK = process.argv[2];
const outbound = [];
globalThis.fetch = async (u) => { outbound.push(String(u?.url || u)); throw new Error("mạng bị chặn"); };
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
const { default: worker } = await imp("worker.js");
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const t = fs.readFileSync(path.join(BACK, "lib", "vendorEnrichReport.generated.js"), "utf8");
const report = JSON.parse(t.slice(t.indexOf("=", t.indexOf("export const VENDOR_ENRICH_REPORT")) + 1).trim().replace(/;\s*$/, ""));
const fails = [];
const check = (n, ok, x) => { if (!ok) fails.push(n + (x === undefined ? "" : " [" + String(JSON.stringify(x)).slice(0, 140) + "]")); };
async function call(env, method, p, token, body) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const pend = [];
  const res = await worker.fetch(new Request("http://localhost" + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env, { waitUntil: (x) => pend.push(x) });
  const text = await res.text();
  await Promise.allSettled(pend);
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
const A = "user_inv_admin", C = "user_inv_capu", base = "/api/admin/vendor-enrich";
const mk = (bucket, extra = {}, drop = []) => { const e = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: A + "," + C, CAPU_USER_IDS: C, ...extra }; for (const k of drop) delete e[k]; return e; };
const row = report.vendors.find((r) => r.pool_input) || report.vendors[0];
const det = base + "/" + row.id + "/detail";

/* (a) người ngoài */
const b1 = new MemoryBucket();
const blocked = [
  ["không token", mk(b1), undefined], ["token rác", mk(b1), "khong-phai-token"], ["user thường", mk(b1), "dev:user_inv_other"],
  ["ADMIN_USER_IDS rỗng", mk(b1, { ADMIN_USER_IDS: "" }), "dev:" + C], ["ADMIN_USER_IDS thiếu", mk(b1, {}, ["ADMIN_USER_IDS"]), "dev:" + C],
  ["token dev khi DEV_AUTH_BYPASS tắt", mk(b1, { DEV_AUTH_BYPASS: "" }), "dev:" + C],
  ["chỉ có trong CAPU_USER_IDS", mk(b1, { ADMIN_USER_IDS: A, CAPU_USER_IDS: C }), "dev:" + C],
];
for (const [cn, env, tok] of blocked)
  for (const [m, p, body] of [["GET", det], ["GET", base + "/inv_khong_co_that/detail"], ["POST", det, {}]]) {
    const r = await call(env, m, p, tok, body);
    check("(a) " + cn + " " + m + " " + p.slice(base.length) + " -> 403 forbidden", r.status === 403 && r.json && r.json.error === "forbidden" && Object.keys(r.json).length === 1 && !r.text.includes(row.name), [r.status, r.text.slice(0, 60)]);
  }

/* (b) mọi admin đọc như Capu */
const capu = await call(mk(b1), "GET", det, "dev:" + C);
check("(b) Capu GET detail 200", capu.status === 200 && capu.json && capu.json.id === row.id, [capu.status, capu.text.slice(0, 60)]);
for (const [cn, env] of [["CAPU_USER_IDS rỗng", mk(b1, { CAPU_USER_IDS: "" })], ["CAPU_USER_IDS thiếu", mk(b1, {}, ["CAPU_USER_IDS"])], ["CAPU_USER_IDS chỉ có người khác", mk(b1)]]) {
  const r = await call(env, "GET", det, "dev:" + A);
  check("(b) admin không phải Capu (" + cn + ") GET detail 200, thân giống Capu", r.status === 200 && r.text === capu.text, [r.status, r.text.slice(0, 60)]);
}
check("(d) đọc detail không ghi R2", b1.putLog.length === 0, b1.putLog);

/* (c) ghi và ký vẫn chỉ Capu */
const { privateKey } = crypto.generateKeyPairSync("ed25519");
const TOK = "inv-vendor-enrich-may-xuat-thu";
const b2 = new MemoryBucket();
const env2 = mk(b2, { ENRICH_EXPORT_TOKEN: TOK, ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "kinv" });
const appr = report.vendors.filter((r) => r.approvable && !r.override);
const free = report.vendors.filter((r) => !r.override && !r.approvable);
if (appr.length < 2 || free.length < 1) { console.log("FAIL dữ liệu thật không đủ dòng để thử (" + appr.length + " approvable, " + free.length + " khác)"); process.exit(1); }
const [vA, vC] = appr, vM = free[0];
const rv = (id) => base + "/" + id + "/review";
const pA = await call(env2, "PUT", rv(vA.id), "dev:" + A, { decision: "approve" });
check("(c) Approve của admin không phải Capu: by_capu=false", pA.status === 200 && pA.json?.review?.by_capu === false, [pA.status, pA.text.slice(0, 80)]);
const pM = await call(env2, "PUT", rv(vM.id), "dev:" + A, { decision: "manual", action: "remove", note: "thu bat bien" });
check("(c) Sửa thủ công của admin không phải Capu: by_capu=false", pM.status === 200 && pM.json?.review?.by_capu === false, [pM.status, pM.text.slice(0, 80)]);
const pC = await call(env2, "PUT", rv(vC.id), "dev:" + C, { decision: "approve" });
check("(c) Approve của Capu: by_capu=true", pC.status === 200 && pC.json?.review?.by_capu === true, [pC.status, pC.text.slice(0, 80)]);
const ex = await call(env2, "GET", "/api/internal/vendor-enrich/export", TOK);
const ids = (ex.json?.entries || []).map((e) => e.vendor_id);
check("(c) export ký chỉ có mục của Capu", ex.status === 200 && ids.length === 1 && ids[0] === vC.id && (ex.json.entries || []).every((e) => e.by_capu === true), [ex.status, ids]);
await call(env2, "GET", base + "/" + vA.id + "/detail", "dev:" + A);
const ex2 = await call(env2, "GET", "/api/internal/vendor-enrich/export", TOK);
check("(d) mở detail không đổi export", JSON.stringify((ex2.json?.entries || []).map((e) => e.vendor_id)) === JSON.stringify(ids) && ex2.json?.waiting_capu === ex.json?.waiting_capu, [ex2.json?.count, ex2.json?.waiting_capu]);
const oA = await call(env2, "PUT", rv(vC.id), "dev:" + A, { decision: "approve" });
check("(c) Capu quyết rồi, admin khác ghi đè: 409 decided_by_capu", oA.status === 409 && oA.json?.error === "decided_by_capu", [oA.status, oA.text.slice(0, 60)]);
const wA = await call(env2, "DELETE", rv(vC.id), "dev:" + A);
check("(c) Capu quyết rồi, admin khác rút lại: 409 decided_by_capu", wA.status === 409 && wA.json?.error === "decided_by_capu", [wA.status, wA.text.slice(0, 60)]);
check("không gọi mạng", outbound.length === 0, outbound);
console.log(fails.length ? "FAIL " + fails[0] + (fails.length > 1 ? " (+" + (fails.length - 1) + " lỗi nữa)" : "") : "PASS");
process.exit(fails.length ? 1 : 0);
"""

tmp = tempfile.mkdtemp(prefix="inv-drawer-quyen-")
try:
    f = os.path.join(tmp, "run.mjs")
    open(f, "w", encoding="utf-8").write(JS)
    try:
        r = subprocess.run(["node", f, BACK], cwd=tmp, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        print("FAIL chạy quá 600 giây"); sys.exit(1)
    out = (r.stdout or "").strip().splitlines()
    last = out[-1] if out else ""
    if r.returncode == 0 and last == "PASS":
        print("PASS"); sys.exit(0)
    print(last if last.startswith("FAIL") else "FAIL " + ((r.stdout or "") + (r.stderr or ""))[-200:].replace("\n", " "))
    sys.exit(1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
