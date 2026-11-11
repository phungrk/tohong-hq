#!/usr/bin/env python3
"""Bất biến chờ merge (vùng planner/admin/vendor-enrich) · nguồn: T-125 adv-01, adversary 2026-11-11 (Code Gate T-125).
INV-??? · maps_link mà API admin của tohong-back nhận (PUT /api/admin/vendor-enrich/<id>/review, accept_place, trả 200)
thì `enrichment.overrides.valid_maps_link` của tohong cũng nhận, với đúng chuỗi back đã lưu.
Lý do: export của back là đầu vào của `apply_admin_reviews.py`; một link hai bên đọc host khác nhau (WHATWG URL coi `\\` là `/`,
`urllib.parse` thì không: `https://goo.gl\\@evil.com` là goo.gl ở back, evil.com ở tohong) làm cả lô Capu đã xác nhận bị
`APPLY_REFUSED bad_entry`, hoặc tệ hơn nếu chiều ngược lại xảy ra: tohong nhận một nơi khác với nơi admin đã thấy.
Tự chứa: dựng worker thật của back với R2 giả trong bộ nhớ (test/helpers/memoryBucket.js), fetch toàn cục bị chặn.
Chưa áp dụng (PASS) khi back chưa có lib/vendorEnrichReport.generated.js. Repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back.
Chạy: python3 -I <file>. Thoát 0 = đạt."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "decisions")) and os.path.isdir(os.path.join(d, "eval")):
            return d
        d = os.path.dirname(d)
HQ = hq_root(HERE) or os.getcwd()
def find(env, rel, probe):
    for p in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if p and os.path.exists(os.path.join(p, probe)):
            return os.path.abspath(p)
TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrichment", "overrides.py"))
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
if not TOHONG or not BACK:
    print("FAIL không thấy repo tohong / tohong-back"); sys.exit(1)
if not os.path.isfile(os.path.join(BACK, "lib", "vendorEnrichReport.generated.js")):
    print("PASS chưa áp dụng (back chưa có bảng enrich vendor)"); sys.exit(0)
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(TOHONG, "tools", "scraper"))
from enrichment.overrides import valid_maps_link  # noqa: E402

LINKS = ["https://share.google/tYZdblcikIDPqVJX6", "https://maps.app.goo.gl/AbCdEf123", "https://goo.gl/maps/xyz", "https://google.com/maps",
         "https://www.google.com/maps/place/?q=place_id:ChIJ_Q8PLiQvdTERNk66UVRKf8U",
         "https://goo.gl\\@evil.com", "https://share.google\\@evil.com/x", "https://maps.app.goo.gl\\@evil.com/x", "https://www.google.com\\@evil.com/maps",
         "https://www.google.com\\maps", "https://goo.gl\\\\evil.com", "https://%67oo.gl/x", "https:goo.gl/x", "https:/goo.gl/x", "https:\\\\goo.gl\\x",
         "https://goo.gl\t/x", "https://goo.gl./x", "https://goo.gl:443/x", "https://GOO.GL/x", "https://www.google.com/maps\\..\\url"]
JS = r"""
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const BACK = process.env.BACK;
globalThis.fetch = async (u) => { throw new Error("mạng bị chặn " + u); };
const { default: worker } = await import(pathToFileURL(path.join(BACK, "worker.js")).href);
const { MemoryBucket } = await import(pathToFileURL(path.join(BACK, "test/helpers/memoryBucket.js")).href);
const rep = JSON.parse(fs.readFileSync(path.join(BACK, "lib/vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const id = rep.vendors.find((r) => !r.override).id;
const out = {};
for (const link of JSON.parse(process.env.LINKS)) {
  const env = { CHAT_DATA: new MemoryBucket(), DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: "user_admin" };
  const req = new Request(`http://localhost/api/admin/vendor-enrich/${id}/review`, { method: "PUT",
    headers: { Authorization: "Bearer dev:user_admin", "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "manual", action: "accept_place", maps_link: link }) });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  let j = null; try { j = JSON.parse(await res.text()); } catch {}
  out[link] = { status: res.status, stored: j?.review?.maps_link ?? null };
}
console.log(JSON.stringify(out)); process.exit(0);
"""
p = subprocess.run(["node", "--input-type=module", "-e", JS], cwd=BACK, capture_output=True, text=True, timeout=300,
                   env=dict(os.environ, BACK=BACK, LINKS=json.dumps(LINKS)))
if p.returncode != 0:
    print("FAIL không chạy được worker back: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
res = json.loads(p.stdout.strip().splitlines()[-1])
bad = [f"{l!r} (lưu {r['stored']!r})" for l, r in res.items() if r["status"] == 200 and not valid_maps_link(r["stored"] or l)]
miss = [l for l in LINKS[:5] if res[l]["status"] != 200 or not valid_maps_link(l)]
if miss:
    print(f"FAIL link hợp lệ bị một bên từ chối: {miss[0]!r}"); sys.exit(1)
if bad:
    print(f"FAIL back nhận mà tohong valid_maps_link từ chối: {bad[0]}" + (f" (+{len(bad)-1})" if len(bad) > 1 else "")); sys.exit(1)
print(f"PASS {len(LINKS)} link: mọi link back nhận thì tohong cũng nhận"); sys.exit(0)
