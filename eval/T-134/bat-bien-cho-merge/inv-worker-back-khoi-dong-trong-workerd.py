#!/usr/bin/env python3
"""Bất biến chờ merge (vùng planner, mọi việc chạm tohong-back) · nguồn: T-134 adv-01 (adversary, 2026-11-12).
INV-??? · Worker tohong-back khởi động được trên runtime thật (workerd qua miniflare của repo) với đúng wrangler.toml của repo
  (compatibility_date / compatibility_flags như production): bundle `wrangler deploy --dry-run` (offline) rồi khởi động không lỗi,
  GET /api/admin không token → 403. Nếu worker.js có route /api/internal/vendor-enrich/export: với ENRICH_EXPORT_TOKEN đúng → 200 và entry
  Capu ký Ed25519 kiểm được bằng eval/T-129/lib/signing.mjs (hoặc eval/lib/signing.mjs sau khi CoS chuyển).
Lý do: eval Node import worker.js nên có node:crypto, Buffer…; workerd không có khi thiếu `nodejs_compat` → cả Worker chết sau deploy tự động
  (T-134: back#48 import "node:crypto" không có cờ). Bất biến khoá mọi việc back vào runtime thật.
Tự chứa: chép repo back vào thư mục tạm, node_modules symlink; R2/KV giả của miniflare; không mạng, không Google.
Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm.
"""
import json, os, shutil, subprocess, sys, tempfile

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
NM = os.path.realpath(os.path.join(BACK, "node_modules"))
for need in (".bin/wrangler", "miniflare/package.json"):
    if not os.path.exists(os.path.join(NM, need)):
        print(f"FAIL thiếu node_modules/{need} trong {BACK} (npm ci)"); sys.exit(1)
SIGNING = next((p for p in (os.path.join(HQ, "eval", "lib", "signing.mjs"), os.path.join(HQ, "eval", "T-129", "lib", "signing.mjs")) if os.path.isfile(p)), "")
HAS_EXPORT = "/api/internal/vendor-enrich/export" in open(os.path.join(BACK, "worker.js"), encoding="utf-8").read()

tmp = tempfile.mkdtemp(prefix="inv-workerd-")
try:
    app = os.path.join(tmp, "app")
    shutil.copytree(BACK, app, symlinks=True, ignore=shutil.ignore_patterns(".git", "node_modules", ".wrangler", ".dev.vars"))
    os.symlink(NM, os.path.join(app, "node_modules"))
    out = os.path.join(tmp, "out")
    env = dict(os.environ, WRANGLER_SEND_METRICS="false", CI="1", HOME=os.path.join(tmp, "home"))
    b = subprocess.run([os.path.join(NM, ".bin", "wrangler"), "deploy", "--dry-run", "--outdir", out], cwd=app, env=env,
                       capture_output=True, text=True, timeout=300)
    if b.returncode != 0 or not os.path.isfile(os.path.join(out, "worker.js")):
        print("FAIL wrangler deploy --dry-run không bundle được:\n" + (b.stdout + b.stderr)[-2000:]); sys.exit(1)

    js = r"""
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const [app, out, signingPath, hasExport] = process.argv.slice(2);
const require = createRequire(path.join(app, "package.json"));
const { Miniflare } = require("miniflare");
const { makeKey, verifyEntry } = signingPath ? await import("file://" + signingPath) : { makeKey: () => ({ id: "k1", privateB64: "" }), verifyEntry: () => false };
const toml = fs.readFileSync(path.join(app, "wrangler.toml"), "utf8");
const date = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1];
const flags = JSON.parse(((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || "[]").replace(/'/g, '"'));
const k = makeKey("k1");
const TOKEN = "adv134-token-0123456789abcdef";
const CAPU = "user_adv134capuAAAAAAAA";
const report = await import("file://" + path.join(app, "lib", "vendorEnrichReport.generated.js"));
const row = report.VENDOR_ENRICH_REPORT.vendors.find((v) => v.approvable && !v.override);
let mf;
const fail = async (m) => { console.log("FAIL " + m); try { await mf?.dispose(); } catch {} process.exit(1); };
try {
  mf = new Miniflare({
    modules: true, scriptPath: path.join(out, "worker.js"), compatibilityDate: date, compatibilityFlags: flags,
    r2Buckets: ["CHAT_DATA"], kvNamespaces: ["RATE_LIMIT"], cf: { country: "VN" },
    bindings: { ADMIN_USER_IDS: CAPU, CAPU_USER_IDS: CAPU, ENRICH_EXPORT_TOKEN: TOKEN, ENRICH_SIGNING_KEY: k.privateB64, ENRICH_SIGNING_KEY_ID: k.id },
  });
  await mf.ready;
} catch (e) {
  await fail(`Worker không khởi động trong workerd (compatibility_date=${date}, flags=${JSON.stringify(flags)}): ${String(e && e.message || e).split("\n")[0]}`);
}
const r0 = await mf.dispatchFetch("http://localhost/api/admin").catch((e) => ({ status: "ERR " + e.message }));
if (r0.status !== 403) await fail(`GET /api/admin không token: mong 403, thấy ${r0.status}`);
if (hasExport !== "1") { await mf.dispose(); console.log(`PASS Worker khởi động trong workerd (flags=${JSON.stringify(flags)}), /api/admin 403`); process.exit(0); }
const bucket = await mf.getR2Bucket("CHAT_DATA");
await bucket.put("data/admin/vendor_enrich_reviews.json", JSON.stringify({ vendors: { [row.id]: {
  state: "pending", decision: "approve", action: "accept_place", place_id: row.google.place_id,
  reason: "Admin duyệt nhận khớp Google: adv", reviewed_by: CAPU, reviewed_at: "2026-11-12T01:02:03.456Z", by_capu: true } } }));
const r1 = await mf.dispatchFetch("http://localhost/api/internal/vendor-enrich/export", { headers: { Authorization: `Bearer ${TOKEN}` } });
const txt = await r1.text();
if (r1.status !== 200) await fail(`export nội bộ trong workerd: mong 200, thấy ${r1.status} ${txt.slice(0, 200)}`);
const ex = JSON.parse(txt);
if (ex.count !== 1 || ex.entries.length !== 1) await fail(`export nội bộ: mong 1 entry Capu, thấy ${txt.slice(0, 300)}`);
if (!verifyEntry(ex.entries[0], k.publicKey)) await fail("chữ ký Ed25519 do workerd sinh không kiểm được bằng định nghĩa chuẩn");
await mf.dispose();
console.log(`PASS Worker khởi động trong workerd (flags=${JSON.stringify(flags)}), /api/admin 403, export nội bộ ký đúng`);
"""
    script = os.path.join(tmp, "run.mjs")
    open(script, "w").write(js)
    p = subprocess.run(["node", script, app, out, SIGNING, "1" if HAS_EXPORT and SIGNING else "0"], cwd=tmp, env=env, capture_output=True, text=True, timeout=300)
    lines = [l for l in (p.stdout or "").splitlines() if l.startswith(("PASS", "FAIL"))]
    print("\n".join(lines) or ("FAIL node lỗi:\n" + (p.stdout + p.stderr)[-2000:]))
    sys.exit(0 if p.returncode == 0 and lines and lines[-1].startswith("PASS") else 1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
