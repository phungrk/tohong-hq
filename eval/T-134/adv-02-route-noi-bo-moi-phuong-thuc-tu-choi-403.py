#!/usr/bin/env python3
"""Eval đối kháng T-134 (tầng 3) · adversary · 2026-11-12.
Input phá: phương thức lạ trên `/api/internal/vendor-enrich/export` đi qua worker.fetch thật (không gọi thẳng handler):
  OPTIONS / HEAD / POST / PUT / PATCH / DELETE không có khoá máy, và các phương thức đó có khoá đúng.
Mong đợi (spec T-129 Hành vi 3, "Đường xuất cho workflow"): "phương thức khác GET → 405 (sau khi qua khoá); mọi từ chối → 403
  {"error":"forbidden"} (đúng một khoá, no-store, R2 không đổi)". Nên: không khoá → 403 forbidden + Cache-Control no-store cho MỌI
  phương thức (kể cả OPTIONS), không cấp CORS (Access-Control-Allow-Origin) cho người chưa qua khoá; có khoá + không phải GET → 405 no-store.
Lỗi tìm được trên back#48: worker.js trả preflight() 204 + CORS "*" cho OPTIONS ở dòng đầu, trước route nội bộ, nên OPTIONS không khoá
  nhận 204 thay vì 403 (eval #2 không thử OPTIONS qua worker.fetch).
Tự chứa: R2 giả trong bộ nhớ (test/helpers/memoryBucket.js của back), fetch toàn cục bị chặn. Repo: TOHONG_BACK_REPO hoặc ../tohong-back.
Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm.
"""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)


HQ = hq_root(HERE) or os.getcwd()
BACK = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back"))
             if p and os.path.isfile(os.path.join(p, "worker.js"))), None)
if not BACK:
    print("FAIL không thấy repo tohong-back"); sys.exit(1)

JS = r"""
import path from "node:path";
import { pathToFileURL } from "node:url";
const BACK = process.argv[2];
globalThis.fetch = async () => { throw new Error("mạng bị chặn"); };
const { default: worker } = await import(pathToFileURL(path.join(BACK, "worker.js")).href);
const { MemoryBucket } = await import(pathToFileURL(path.join(BACK, "test", "helpers", "memoryBucket.js")).href);
const TOKEN = "adv134-token-0123456789abcdef";
const bucket = new MemoryBucket();
const env = { CHAT_DATA: bucket, ADMIN_USER_IDS: "user_adv134capuAAAAAAAA", CAPU_USER_IDS: "user_adv134capuAAAAAAAA", ENRICH_EXPORT_TOKEN: TOKEN };
const errs = [];
const URL_ = "http://localhost/api/internal/vendor-enrich/export";
for (const method of ["OPTIONS", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
  for (const [label, headers, want] of [
    ["không khoá", { Origin: "https://evil.example", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" }, 403],
    ["khoá đúng", { Authorization: `Bearer ${TOKEN}` }, 405],
  ]) {
    if (method === "OPTIONS" && want === 405) continue; // OPTIONS có khoá: không bắt buộc ở spec, bỏ qua
    const r = await worker.fetch(new Request(URL_, { method, headers }), env, { waitUntil() {} });
    const cc = r.headers.get("Cache-Control") || "";
    const body = method === "HEAD" ? "" : await r.text();
    if (r.status !== want) errs.push(`${method} ${label}: mong ${want}, thấy ${r.status}`);
    else if (!/no-store/.test(cc)) errs.push(`${method} ${label}: thiếu Cache-Control no-store (thấy ${JSON.stringify(cc)})`);
    else if (want === 403 && method !== "HEAD" && body !== JSON.stringify({ error: "forbidden" })) errs.push(`${method} ${label}: thân ${body.slice(0, 80)}`);
    if (want === 403 && r.headers.get("Access-Control-Allow-Origin")) errs.push(`${method} ${label}: cấp CORS Access-Control-Allow-Origin=${r.headers.get("Access-Control-Allow-Origin")} cho người chưa qua khoá`);
  }
}
if (bucket.putLog.length) errs.push(`R2 bị ghi: ${bucket.putLog.join(",")}`);
if (errs.length) { for (const e of errs) console.log("FAIL " + e); process.exit(1); }
console.log("PASS mọi phương thức không khoá → 403 forbidden no-store, có khoá → 405, không CORS, R2 không đổi");
"""

with tempfile.TemporaryDirectory(prefix="adv134-02-") as tmp:
    f = os.path.join(tmp, "run.mjs")
    open(f, "w").write(JS)
    p = subprocess.run(["node", f, BACK], cwd=tmp, capture_output=True, text=True, timeout=120)
    lines = [l for l in p.stdout.splitlines() if l.startswith(("PASS", "FAIL"))]
    print("\n".join(lines) or ("FAIL node lỗi:\n" + (p.stdout + p.stderr)[-2000:]))
    sys.exit(0 if p.returncode == 0 and lines and lines[-1].startswith("PASS") else 1)
