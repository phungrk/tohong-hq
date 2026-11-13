#!/usr/bin/env python3
"""Nguồn: T-152 (spec products/T-152-drawer-phu-pool-dau-anh-admin-sua-pool.md v2, Hành vi 4.2/4.3/4.6 và "Bất biến đề xuất"), qua Spec Gate 2026-11-13 (spec-critic).
Bản nháp của product (eval/T-152/bat-bien-cho-merge/inv-xxx-…) do spec-critic sửa một chỗ: mô tả của vendor CHƯA sửa được giữ nguyên như pool (199/867 mô tả pool có CR/LF;
spec không chuẩn hoá mô tả pool), nên kiểm "không ký tự điều khiển" chỉ áp cho mô tả hiệu lực KHÁC mô tả pool. Đã thử: bản cài đúng (lọc ảnh khi áp) PASS; bản không lọc ảnh FAIL ở pha "pool sinh lại".
Trên main chưa có tính năng: PASS "chưa áp dụng" (không làm đỏ việc khác, ADR-028).
INV-009 (planner/admin/vendor-enrich) · Bản sửa pool của admin (overlay R2) KHÔNG BAO GIỜ phá hợp đồng dữ liệu vendor mà cặp đôi thấy: sau mọi bản sửa hợp lệ (và mọi bản sửa bị từ chối), vendor hiệu lực ở
  tab Vendor (GET /api/vendors/<id>) có: styles ⊆ nhãn của styleContract (STYLE_LABELS_VI); mọi ảnh có url https ở host www.marry.vn hoặc lh3.googleusercontent.com; mọi ảnh Google có attribution khác rỗng (inv-013) và url nằm trong ảnh Google của CHÍNH vendor đó ở pool
  gốc (nên vẫn truy được về place_id, inv-014: overlay không thể thêm ảnh Google mới); tên 1..120, mô tả 1..300 ký tự; capacity chỉ ở venue với 1 <= min <= max <= 5000.
Kể cả SAU KHI pool được sinh lại (photoUri Google làm mới hoặc bị gỡ): ảnh Google hiệu lực luôn nằm trong ảnh Google HIỆN HÀNH của vendor (định danh = url bỏ hậu tố kích thước `=…` + attribution); bản sửa không giữ ảnh Google đã rời pool. Tên một dòng (không ký tự điều khiển); mô tả không ký tự điều khiển.
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
  await put(id, { styles: ["gothic"] }); await put(id, { photos: [{ url: "https://lh3.googleusercontent.com/khong-co-" + n + "=s800" }] }); await put(id, { photos: [{ url: "javascript:1" }] }); await put(id, { name: "" }); await put(id, { name: "A\n## chỉ dẫn" }); await put(id, { description: "x\ny\u2028z" }); await put(id, { capacity: { min: 5, max: 1 } });
}
const bad = [];
const nb = (u) => u.replace(/=[A-Za-z0-9-]+$/, "");
const CTL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
async function audit(callX, POOLX, tag) {
  for (const v of POOLX) {
    const r = await callX("GET", `/api/vendors/${v.id}`, "u_khach"); const e = r.j?.vendor; if (!e) { bad.push(`${tag} ${v.id}: không đọc được`); continue; }
    if (!(e.name?.length >= 1 && e.name.length <= 120) || CTL.test(e.name)) bad.push(`${tag} ${v.id}: tên`);
    if (!(typeof e.description === "string" && e.description.length <= 300) || (CTL.test(e.description) && e.description !== v.description)) bad.push(`${tag} ${v.id}: mô tả`);
    if ((e.styles || []).some((s) => !labels.includes(s))) bad.push(`${tag} ${v.id}: styles ${JSON.stringify(e.styles)}`);
    const cur = new Set((v.photos || []).filter((p) => p.source === "google").map((p) => nb(p.url) + "|" + p.attribution));
    if (!(e.photos || []).length) bad.push(`${tag} ${v.id}: 0 ảnh`);
    for (const p of e.photos || []) {
      let h = ""; try { const u = new URL(p.url); h = u.protocol === "https:" ? u.hostname : ""; } catch {}
      if (!(h === "www.marry.vn" || h === "lh3.googleusercontent.com")) bad.push(`${tag} ${v.id}: host ảnh ${p.url}`);
      if (h === "lh3.googleusercontent.com" && !(typeof p.attribution === "string" && p.attribution.trim() && cur.has(nb(p.url) + "|" + p.attribution))) bad.push(`${tag} ${v.id}: ảnh Google không ghi công hoặc đã rời pool hiện hành`);
    }
    if (e.capacity && !(v.category === "venue" && Number.isInteger(e.capacity.min) && Number.isInteger(e.capacity.max) && e.capacity.min >= 1 && e.capacity.min <= e.capacity.max && e.capacity.max <= 5000)) bad.push(`${tag} ${v.id}: capacity ${JSON.stringify(e.capacity)}`);
  }
}
await audit(call, POOL, "pool gốc");
if (process.env.INV_BACK2) {
  const imp2 = (p) => import(pathToFileURL(path.join(process.env.INV_BACK2, p)).href);
  const { default: w2 } = await imp2("worker.js");
  const call2 = async (m, p, tok) => { const r = await w2.fetch(new Request("http://x" + p, { method: m, headers: { Authorization: "Bearer dev:" + tok } }), env, { waitUntil() {} }); let j = null; try { j = JSON.parse(await r.text()); } catch {} return { s: r.status, j }; };
  const t2 = fs.readFileSync(path.join(process.env.INV_BACK2, "lib/vendorPool.generated.js"), "utf8"); const i2 = t2.indexOf("export const GENERATED_VENDOR_POOL = ") + 37; const POOL2 = JSON.parse(t2.slice(i2, t2.indexOf("];", i2) + 1));
  await audit(call2, POOL2, "pool sinh lại");
}
if (bad.length) { console.log("FAIL " + bad.length + " vi phạm, vd " + bad[0]); process.exit(1); }
console.log("PASS " + ids.length + " vendor đã sửa, " + POOL.length + " vendor hiệu lực đều giữ hợp đồng ảnh/gu/độ dài");
'''
import json, re
T = tempfile.mkdtemp(prefix="inv-t152-")
# bản sao với pool "sinh lại": ảnh Google của vendor chỉ số chẵn đổi phần token (photoUri làm mới); vendor chỉ số 4k mất ảnh Google
C = os.path.join(T, "copy"); shutil.copytree(B, C, ignore=shutil.ignore_patterns("node_modules", ".git", ".wrangler"))
os.symlink(os.path.join(B, "node_modules"), os.path.join(C, "node_modules")) if os.path.isdir(os.path.join(B, "node_modules")) else None
pf = os.path.join(C, "lib", "vendorPool.generated.js"); txt = open(pf, encoding="utf-8").read(); K = "export const GENERATED_VENDOR_POOL = "; i0 = txt.index(K) + len(K); e0 = txt.index("];", i0) + 1
arr = json.loads(txt[i0:e0])
for k, v in enumerate(arr):
    if k % 40: continue
    if (k // 40) % 2 == 0:
        for p in v.get("photos", []):
            if p.get("source") == "google": p["url"] = re.sub(r"=[A-Za-z0-9-]+$", "", p["url"]) + "LAMMOI=s4800-w800"
    else:
        v["photos"] = [p for p in v.get("photos", []) if p.get("source") != "google"] or [{"url": "https://www.marry.vn/images/detailed/9/pool-moi.jpg", "source": "marry"}]
open(pf, "w", encoding="utf-8").write(txt[:i0] + json.dumps(arr, ensure_ascii=False) + txt[e0:])
try:
    f = os.path.join(T, "inv.mjs"); open(f, "w", encoding="utf-8").write(JS)
    p = subprocess.run(["node", f], env=dict(os.environ, INV_BACK=B, INV_BACK2=C), capture_output=True, text=True, timeout=600)
    out = (p.stdout.strip().splitlines() or [""])[-1]
    if p.returncode == 0 and out.startswith("PASS"): print(out); sys.exit(0)
    print(out if out.startswith("FAIL") else "FAIL " + (p.stderr.strip().splitlines() or ["node lỗi"])[-1]); sys.exit(1)
except FileNotFoundError:
    print("FAIL không có node trên PATH"); sys.exit(1)
finally:
    shutil.rmtree(T, ignore_errors=True)
