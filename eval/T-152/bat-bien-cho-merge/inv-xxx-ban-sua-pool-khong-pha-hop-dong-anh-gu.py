#!/usr/bin/env python3
"""Nguồn: T-152 (spec products/T-152-drawer-phu-pool-dau-anh-admin-sua-pool.md, Hành vi 4 và "Bất biến đề xuất"); bản đề xuất của product, chờ Spec Gate (spec-critic) rồi Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/ và đặt số.
Nằm ở eval/T-152/bat-bien-cho-merge/ cho tới khi PR back của T-152 merge và bất biến xanh trên main (ADR-028).
INV-??? (planner/admin/vendor-enrich) · Bản sửa pool của admin (overlay R2) KHÔNG BAO GIỜ phá hợp đồng dữ liệu vendor mà cặp đôi thấy: sau mọi bản sửa hợp lệ (và mọi bản sửa bị từ chối), vendor hiệu lực ở
  tab Vendor (GET /api/vendors/<id>) có: styles ⊆ nhãn của styleContract (STYLE_LABELS_VI); mọi ảnh có url https ở host www.marry.vn hoặc lh3.googleusercontent.com; mọi ảnh Google có attribution khác rỗng (inv-013) và url nằm trong ảnh Google của CHÍNH vendor đó ở pool
  gốc (nên vẫn truy được về place_id, inv-014: overlay không thể thêm ảnh Google mới); tên 1..120, mô tả 1..300 ký tự; capacity chỉ ở venue với 1 <= min <= max <= 5000.
Lý do: inv-013/014 và hợp đồng style chỉ đo FILE pool; overlay là đường thứ hai sinh ra dữ liệu cặp đôi thấy, không đi qua generator. Không có bất biến này thì một lần nới kiểm hợp lệ ở overlay làm hỏng ghi công ảnh Google hay gu mà không eval nào đỏ.
Tự chứa: worker thật + R2 giả, mạng bị chặn, không ghi repo. Chưa áp dụng (PASS) khi PUT trường `name` chưa đổi tên hiệu lực (chưa có tính năng). Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import os, shutil, subprocess, sys, tempfile
HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):
    HQ = os.path.dirname(HQ)
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back")) if c and os.path.isfile(os.path.join(c, "worker.js"))), None)
if not B:
    print("PASS chưa áp dụng (không thấy tohong-back)"); sys.exit(0)
JS = r'''
import { pathToFileURL } from "url"; import path from "path"; import fs from "fs";
const B = process.env.INV_BACK; const imp = (p) => import(pathToFileURL(path.join(B, p)).href);
globalThis.fetch = async () => { throw new Error("mạng bị chặn"); };
const { default: worker } = await imp("worker.js"); const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const { STYLE_LABELS_VI } = await imp("lib/styleContract.js");
const t = fs.readFileSync(path.join(B, "lib/vendorPool.generated.js"), "utf8"); const i = t.indexOf("export const GENERATED_VENDOR_POOL = ") + 37; const POOL = JSON.parse(t.slice(i, t.indexOf("];", i) + 1));
const bucket = new MemoryBucket(); const env = { CHAT_DATA: bucket, DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: "u_admin" };
const call = async (m, p, tok, body) => { const r = await worker.fetch(new Request("http://x" + p, { method: m, headers: { Authorization: "Bearer dev:" + tok, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} }); const x = await r.text(); let j = null; try { j = JSON.parse(x); } catch {} return { s: r.status, j }; };
const ver = {}; const put = async (id, b) => { const r = await call("PUT", `/api/admin/vendors/${id}/override`, "u_admin", { expected_version: ver[id] || 0, ...b }); if (r.s === 200) ver[id] = r.j.version; return r; };
const probe = POOL.find((v) => v.category === "venue");
const p0 = await put(probe.id, { name: "Tên thử bất biến ZZ" });
const g0 = await call("GET", `/api/vendors/${probe.id}`, "u_khach");
if (!(p0.s === 200 && g0.j?.vendor?.name === "Tên thử bất biến ZZ")) { console.log("PASS chưa áp dụng (overlay chưa nhận sửa tên)"); process.exit(0); }
await put(probe.id, { name: null });
const labels = Object.keys(STYLE_LABELS_VI); const MARRY = (n) => ({ url: `https://www.marry.vn/images/detailed/9/inv${n}.jpg` });
const ids = POOL.filter((v, k) => k % 40 === 0).map((v) => v.id);
for (const [n, id] of ids.entries()) {
  const v = POOL.find((x) => x.id === id), gp = (v.photos || []).filter((p) => p.source === "google");
  await put(id, { name: "Tên " + n, description: "Mô tả " + n, styles: [labels[n % labels.length]], photos: [...gp.slice(0, 1), MARRY(n)].slice(0, 4), ...(v.category === "venue" ? { capacity: { min: 10 + n, max: 100 + n } } : {}) });
  // thử phá: phải bị từ chối, không đổi gì
  await put(id, { styles: ["gothic"] }); await put(id, { photos: [{ url: "https://lh3.googleusercontent.com/khong-co-" + n + "=s800" }] }); await put(id, { photos: [{ url: "javascript:1" }] }); await put(id, { name: "" }); await put(id, { capacity: { min: 5, max: 1 } });
}
const bad = [];
for (const v of POOL) {
  const r = await call("GET", `/api/vendors/${v.id}`, "u_khach"); const e = r.j?.vendor; if (!e) { bad.push(`${v.id}: không đọc được`); continue; }
  if (!(e.name?.length >= 1 && e.name.length <= 120)) bad.push(`${v.id}: tên`);
  if (!(typeof e.description === "string" && e.description.length <= 300)) bad.push(`${v.id}: mô tả`);
  if ((e.styles || []).some((s) => !labels.includes(s))) bad.push(`${v.id}: styles ${JSON.stringify(e.styles)}`);
  const orig = new Set((v.photos || []).filter((p) => p.source === "google").map((p) => p.url));
  for (const p of e.photos || []) {
    let h = ""; try { const u = new URL(p.url); h = u.protocol === "https:" ? u.hostname : ""; } catch {}
    if (!(h === "www.marry.vn" || h === "lh3.googleusercontent.com")) bad.push(`${v.id}: host ảnh ${p.url}`);
    if (h === "lh3.googleusercontent.com" && !(typeof p.attribution === "string" && p.attribution.trim() && orig.has(p.url))) bad.push(`${v.id}: ảnh Google không ghi công hoặc ngoài pool`);
  }
  if (e.capacity && !(v.category === "venue" && Number.isInteger(e.capacity.min) && Number.isInteger(e.capacity.max) && e.capacity.min >= 1 && e.capacity.min <= e.capacity.max && e.capacity.max <= 5000)) bad.push(`${v.id}: capacity ${JSON.stringify(e.capacity)}`);
}
if (bad.length) { console.log("FAIL " + bad.length + " vi phạm, vd " + bad[0]); process.exit(1); }
console.log("PASS " + ids.length + " vendor đã sửa, " + POOL.length + " vendor hiệu lực đều giữ hợp đồng ảnh/gu/độ dài");
'''
T = tempfile.mkdtemp(prefix="inv-t152-")
try:
    f = os.path.join(T, "inv.mjs"); open(f, "w", encoding="utf-8").write(JS)
    p = subprocess.run(["node", f], env=dict(os.environ, INV_BACK=B), capture_output=True, text=True, timeout=600)
    out = (p.stdout.strip().splitlines() or [""])[-1]
    if p.returncode == 0 and out.startswith("PASS"): print(out); sys.exit(0)
    print(out if out.startswith("FAIL") else "FAIL " + (p.stderr.strip().splitlines() or ["node lỗi"])[-1]); sys.exit(1)
except FileNotFoundError:
    print("FAIL không có node trên PATH"); sys.exit(1)
finally:
    shutil.rmtree(T, ignore_errors=True)
