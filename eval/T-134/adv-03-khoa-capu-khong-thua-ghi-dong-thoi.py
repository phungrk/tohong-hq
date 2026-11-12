#!/usr/bin/env python3
"""Eval đối kháng T-134 (tầng 3) · adversary · 2026-11-12.
Input phá: ĐỒNG THỜI. Admin khác (không phải Capu) PUT / DELETE review của một dòng, trong khi Capu Approve đúng dòng đó và ghi R2
  xong ngay sau khi yêu cầu của admin đã đọc R2 lần đầu (giữa lần đọc "review cũ" và lần đọc-sửa-ghi có etag).
Mong đợi (spec T-129 Hành vi 2: "review có by_capu hiệu lực true chỉ Capu mới PUT đè hoặc DELETE được; admin khác nhận 409
  decided_by_capu, R2 không đổi"; T-124/T-125: ghi có kiểm etag, hai ghi đồng thời không mất cái nào):
  yêu cầu của admin khác bị từ chối 409 decided_by_capu (hoặc version_conflict) và R2 vẫn giữ review by_capu true của Capu.
Lỗi tìm được trên back#48: lib/vendorEnrich.js kiểm `prior` bằng một readReviews() RIÊNG, NGOÀI vòng mutate có etag của putReview /
  withdrawReview; lần đọc-sửa-ghi sau đó thấy review của Capu nhưng không kiểm lại → ghi đè / xoá quyết định của Capu, etag khớp.
Tự chứa: gọi thẳng lib/vendorEnrich.js với R2 giả trong bộ nhớ (test/helpers/memoryBucket.js), móc get để chèn cú bấm của Capu.
Repo: TOHONG_BACK_REPO hoặc ../tohong-back. Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm. Không mạng.
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
const imp = (rel) => import(pathToFileURL(path.join(BACK, rel)).href);
const ve = await imp("lib/vendorEnrich.js");
if (typeof ve.withdrawEnrichReview !== "function" || typeof ve.putEnrichReview !== "function") { console.log("FAIL thiếu putEnrichReview/withdrawEnrichReview"); process.exit(1); }
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const { VENDOR_ENRICH_REPORT } = await imp("lib/vendorEnrichReport.generated.js");
const KEY = "data/admin/vendor_enrich_reviews.json";
const CAPU = "user_adv134capuAAAAAAAA", OTHER = "user_adv134otherBBBBBBB";
const base = { ADMIN_USER_IDS: `${CAPU},${OTHER}`, CAPU_USER_IDS: CAPU };
const row = VENDOR_ENRICH_REPORT.vendors.find((v) => v.approvable && !v.override);
const errs = [];

async function scenario(name, seedOther, adminCall) {
  const bucket = new MemoryBucket();
  const raw = { ...base, CHAT_DATA: bucket };
  if (seedOther) await ve.putEnrichReview(raw, row.id, { decision: "manual", action: "remove", note: "đề xuất của admin khác" }, OTHER);
  // Móc: lần get ĐẦU TIÊN của yêu cầu admin trả bản đọc lúc đó, nhưng trước khi trả, Capu Approve xong (ghi R2).
  let hooked = false;
  const hookBucket = Object.create(bucket);
  hookBucket.get = async (key) => {
    const r = await bucket.get(key);
    const snap = r ? { ...r, text: (await r.text()), } : null;
    if (!hooked && key === KEY) { hooked = true; await ve.putEnrichReview(raw, row.id, { decision: "approve" }, CAPU); }
    return snap ? { httpEtag: snap.httpEtag, etag: snap.etag, text: async () => snap.text } : null;
  };
  const env = { ...base, CHAT_DATA: hookBucket };
  let status = 200, err = "";
  try { await adminCall(env); } catch (e) { status = e.status || 500; err = e.message; }
  const after = JSON.parse(bucket.data.get(KEY) || '{"vendors":{}}').vendors[row.id];
  const kept = after && after.by_capu === true && after.reviewed_by === CAPU;
  if (!hooked) errs.push(`${name}: móc không chạy (eval cần sửa)`);
  else if (!kept) errs.push(`${name}: admin khác trả ${status}${err ? " " + err : ""}, R2 sau đó ${after ? JSON.stringify({ by_capu: after.by_capu, action: after.action }) : "KHÔNG CÒN review"} — quyết định của Capu bị ${after ? "đè" : "xoá"}`);
  else if (status === 200) errs.push(`${name}: R2 giữ review Capu nhưng admin khác nhận 200 (mong 409)`);
}

await scenario("PUT đè (dòng trống)", false, (env) => ve.putEnrichReview(env, row.id, { decision: "manual", action: "remove", note: "đè" }, OTHER));
await scenario("PUT đè (dòng có review admin khác)", true, (env) => ve.putEnrichReview(env, row.id, { decision: "manual", action: "remove", note: "đè" }, OTHER));
await scenario("DELETE rút", true, (env) => ve.withdrawEnrichReview(env, row.id, OTHER));
if (errs.length) { for (const e of errs) console.log("FAIL " + e); process.exit(1); }
console.log("PASS ghi đồng thời: admin khác không đè/rút được quyết định Capu vừa ghi");
"""

with tempfile.TemporaryDirectory(prefix="adv134-03-") as tmp:
    f = os.path.join(tmp, "run.mjs")
    open(f, "w").write(JS)
    p = subprocess.run(["node", f, BACK], cwd=tmp, capture_output=True, text=True, timeout=120)
    lines = [l for l in p.stdout.splitlines() if l.startswith(("PASS", "FAIL"))]
    print("\n".join(lines) or ("FAIL node lỗi:\n" + (p.stdout + p.stderr)[-2000:]))
    sys.exit(0 if p.returncode == 0 and lines and lines[-1].startswith("PASS") else 1)
