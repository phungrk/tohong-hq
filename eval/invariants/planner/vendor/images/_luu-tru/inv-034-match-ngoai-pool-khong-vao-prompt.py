#!/usr/bin/env python3
"""Nguồn: T-136 (spec products/T-136-chat-vendor-theo-pool.md v3, "Bất biến đề xuất" INV-B; Hành vi A1, A5), qua Spec Gate 2026-11-12 (spec-critic).
Nằm ở eval/T-136/bat-bien-cho-merge/ cho tới khi PR code T-136 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào
eval/invariants/planner/vendor/images/ (số 034 của vùng này).
INV-034 · Mọi match matcher trả về mà id (vendor_id, rồi vendor.id, rồi id) không trùng khớp từng ký tự với id của một vendor trong pool hiện hành
(lib/vendorPool.generated.js) KHÔNG xuất hiện trong system prompt do buildChatContext dựng; match có id trong pool vẫn xuất hiện; phần tử rác (null,
không phải object) không làm buildChatContext ném. Matcher GIẢ (fetch bị thay), không mạng. Repo back: $TOHONG_BACK_REPO, rồi cwd nếu có
lib/contextBuilder.js, rồi <gốc HQ>/../tohong-back. Chỉ đọc repo; script node tạm nằm trong thư mục tạm và bị xoá. Chạy không tham số (python3 -I)."""
import os, shutil, subprocess, sys, tempfile

HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != "/" and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # ADR-057/070: tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(HQ, "..", "tohong-back"))
          if c and os.path.isfile(os.path.join(c, "lib", "contextBuilder.js"))), None)
if not B:
    print("PASS chưa áp dụng (không thấy tohong-back)"); sys.exit(0)
JS = r'''
import { pathToFileURL } from "url"; import path from "path";
const B = process.env.INV_BACK; const imp = (p) => import(pathToFileURL(path.join(B, p)).href);
const { buildChatContext } = await imp("lib/contextBuilder.js");
const { MemoryBucket } = await imp("test/helpers/memoryBucket.js");
const { GENERATED_VENDOR_POOL: POOL } = await imp("lib/vendorPool.generated.js");
const ids = new Set(POOL.map((v) => v.id));
const ok = POOL.find((v) => v.category === "photography") || POOL[0];
const outs = ["marry_inv034dead01", "marry_photography_inv034-slug-cu", ok.id.toUpperCase()].filter((x) => !ids.has(x));
const it = (id, name) => ({ vendor_id: id, name, final_score: 80, price_range: { min_vnd: 1e6, max_vnd: 2e6 }, style_tags: [] });
const payload = { matches: [
  ...outs.map((id, k) => it(id, "INVZZ_" + k)),
  { vendor: { id: "marry_inv034dead02", name: "INVZZ_LONG" } }, { id: "marry_inv034dead03", name: "INVZZ_ID" },
  { name: "INVZZ_KHONG_ID" }, { vendor_id: 12345, name: "INVZZ_SO" }, null, 7,
  it(ok.id, ok.name) ], total_pool: 10, passed_filters: 10 };
const orig = globalThis.fetch; let sp = "", err = null;
globalThis.fetch = async (url) => { if (!String(url).startsWith("https://m.test/")) throw new Error("không được gọi mạng: " + url);
  return new Response(JSON.stringify(payload), { status: 200 }); };
const ow = console.warn; console.warn = () => {};
try { sp = (await buildChatContext({ CHAT_DATA: new MemoryBucket(), MATCHER_URL: "https://m.test", MATCHER_API_KEY: "k" }, "c1", null,
  "Tìm photographer chụp ảnh cưới giúp anh chị 30tr", null, "u1")).systemPrompt; } catch (e) { err = e; }
console.warn = ow; globalThis.fetch = orig;
if (err) { console.log("FAIL buildChatContext ném với match rác/ngoài pool: " + err.message); process.exit(1); }
const leak = sp.match(/INVZZ_[A-Z_0-9]+/g);
if (leak) { console.log("FAIL match ngoài pool lọt vào prompt: " + [...new Set(leak)].join(", ")); process.exit(1); }
if (!sp.includes(ok.name)) { console.log("FAIL vendor trong pool (" + ok.id + ") không vào prompt"); process.exit(1); }
console.log("PASS");
'''
T = tempfile.mkdtemp(prefix="inv034-")
try:
    f = os.path.join(T, "inv034.mjs"); open(f, "w", encoding="utf-8").write(JS)
    env = dict(os.environ, INV_BACK=B)
    try:
        p = subprocess.run(["node", f], env=env, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        print("FAIL không có node trên PATH"); sys.exit(1)
    out = (p.stdout.strip().splitlines() or [""])[-1]
    if p.returncode == 0 and out.startswith("PASS"):
        print(out); sys.exit(0)
    print(out if out.startswith("FAIL") else "FAIL " + (p.stderr.strip().splitlines() or ["node lỗi"])[-1]); sys.exit(1)
finally:
    shutil.rmtree(T, ignore_errors=True)
