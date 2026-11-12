#!/usr/bin/env python3
"""T-125 adv-04 (tầng 3, adversary 2026-11-12; nguồn: ChatGPT review chéo back#46, adversary dựng lại) · File review trên R2 đúng cú pháp JSON
nhưng SAI schema cũng là file hỏng, không phải kho rỗng.
Input phá: khoá `data/admin/vendor_enrich_reviews.json` = `{}`, `{"vendors":[…]}`, `{"vendors":"bad"}`, `{"vendors":null}`, `[]`, `null`, `42`,
`{"reviews":{…}}`. Hiện tại (back 900f2bb): `normalize()` coi mọi thứ đó là `{vendors:{}}` → export 200 `count:0` (Capu thấy lô trống) và PUT kế tiếp
GHI ĐÈ file, xoá mất nội dung cũ; `readFresh` chỉ bắt SyntaxError. Cùng luật với adv-02 (file hỏng cú pháp → 500 `reviews_corrupt`).
Mong đợi: mỗi ca, danh sách, export, PUT, DELETE đều trả 500 `reviews_corrupt`, và khoá R2 giữ nguyên byte (không route nào ghi đè).
Đối chứng: `{"vendors":{}}` (kho rỗng hợp lệ) → danh sách 200, export 200 count 0, PUT 200.
Chạy: python3 -I eval/T-125/adv-04-…py (TOHONG_BACK_REPO hoặc ../tohong-back). Thoát 0 = PASS."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
BACK = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back"))
             if p and os.path.isfile(os.path.join(p, "worker.js"))), None)
if not BACK or not os.path.isfile(os.path.join(BACK, "lib", "vendorEnrichReport.generated.js")):
    print("FAIL không thấy tohong-back có bảng enrich vendor (đặt TOHONG_BACK_REPO)"); sys.exit(1)
def run(helper):
    p = subprocess.run(["node", os.path.join(HERE, "lib", helper)], cwd=BACK, capture_output=True, text=True, timeout=300,
                       env=dict(os.environ, TOHONG_BACK_REPO=BACK))
    if p.returncode != 0:
        print("FAIL không chạy được API back: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
    return json.loads(p.stdout.strip().splitlines()[-1])
res = run("adv_r2_schema.mjs")
bad = []
for name, r in res.items():
    for route in ("list", "export", "put", "del"):
        x = r[route]
        if not (x["status"] == 500 and x["error"] == "reviews_corrupt"):
            bad.append(f"R2 = {name}: {route} trả {x['status']} {x['error'] or ''}{' count=%s' % x['count'] if x['count'] is not None else ''} (mong 500 reviews_corrupt)")
    if not r["unchanged"]:
        bad.append(f"R2 = {name}: file review bị ghi đè")
# đối chứng: kho rỗng hợp lệ vẫn dùng được
ctl = subprocess.run(["node", "--input-type=module", "-e", r"""
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const L = await import(pathToFileURL(process.env.LIB).href);
const rep = JSON.parse(fs.readFileSync(path.join(L.BACK, "lib", "vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const id = rep.vendors.find((r) => r.approvable && !r.override).id;
const b = new L.MemoryBucket(); b.data.set("data/admin/vendor_enrich_reviews.json", '{"vendors":{}}'); const env = L.makeEnv(b);
const a = await L.asAdmin(env, "GET", "/api/admin/vendor-enrich?limit=1"); const e = await L.asAdmin(env, "GET", "/api/admin/vendor-enrich/export");
const p = await L.asAdmin(env, "PUT", `/api/admin/vendor-enrich/${id}/review`, { decision: "approve" });
console.log(JSON.stringify([a.status, e.status, e.json?.count, p.status])); process.exit(0);
"""], cwd=BACK, capture_output=True, text=True, timeout=300,
    env=dict(os.environ, TOHONG_BACK_REPO=BACK, LIB=os.path.join(HQ, "eval", "T-124", "lib", "back.mjs")))
try:
    c = json.loads(ctl.stdout.strip().splitlines()[-1])
except Exception:
    c = None
if c != [200, 200, 0, 200]:
    bad.append(f"đối chứng kho rỗng hợp lệ {{\"vendors\":{{}}}} phải 200/200 count 0/200, thấy {c} {ctl.stderr[-200:]}")
if bad:
    print(f"FAIL {bad[0]}" + (f" (+{len(bad)-1} lỗi nữa)" if len(bad) > 1 else "")); sys.exit(1)
print(f"PASS {len(res)} kiểu file sai schema: mọi route 500 reviews_corrupt, không ghi đè; kho rỗng hợp lệ vẫn dùng được"); sys.exit(0)
