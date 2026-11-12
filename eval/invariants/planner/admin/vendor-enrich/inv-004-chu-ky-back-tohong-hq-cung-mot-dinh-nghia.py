#!/usr/bin/env python3
"""Bất biến chờ merge (vùng planner/admin/vendor-enrich) · nguồn: T-129 (spec v3, Hành vi 3-5; Spec Gate 2026-11-12, spec-critic; ADR-065, ADR-066).
INV-??? · Cú bấm của Capu đi trọn một vòng mà không mất chữ ký: mọi entry export của tohong-back (đường máy /api/internal/vendor-enrich/export)
  (a) chỉ là review của Capu (by_capu true), không chứa Clerk user id thô, và kiểm được bằng ĐỊNH NGHĨA CHUẨN eval/lib/capu_decision.py (hoặc eval/T-129/capu_decision.py);
  (b) được apply_admin_reviews.py của tohong nhận (APPLY_OK) bằng khoá công khai tương ứng; review của admin không phải Capu không bao giờ thành mục;
  (c) mọi mục apply sinh ra đều hợp lệ theo check_entry của bất biến (INV-020 v2), kể cả mục accept_place bằng maps_link sau khi giả lập bước resolve
      ghi place_id + resolved (resolve_overrides.py, T-110).
Lý do: chữ ký có ba nơi đọc (back ký, tohong kiểm trên đường thật, HQ kiểm offline). Nếu một nơi đổi định dạng (thứ tự trường, mã hoá, trường nào được ký)
  thì hoặc PR dữ liệu bị từ chối, hoặc bể tầng 2 đỏ vĩnh viễn sau merge (D2 của T-129). Bất biến khoá ba nơi vào một định nghĩa.
Tự chứa: worker thật của back + R2 giả (test/helpers/memoryBucket.js), khoá Ed25519 sinh tạm, fetch toàn cục bị chặn; apply chạy trên bản sao tạm của tools/scraper.
Chưa áp dụng (PASS) khi back chưa có đường /api/internal/vendor-enrich/export. Repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back.
Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm. Không gọi Google."""
import base64, importlib.util, json, os, re, shutil, subprocess, sys, tempfile

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


TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrich.py"))
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
if not TOHONG or not BACK:
    print("FAIL không thấy repo tohong / tohong-back"); sys.exit(1)
src = ""
for root, _, files in os.walk(BACK):
    if "node_modules" in root or "/." in root:
        continue
    for f in files:
        if f.endswith(".js"):
            try:
                src += open(os.path.join(root, f), encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                pass
if "/api/internal/vendor-enrich/export" not in src or not os.path.isfile(os.path.join(BACK, "lib", "vendorEnrichReport.generated.js")):
    print("PASS chưa áp dụng (back chưa có đường xuất có chữ ký)"); sys.exit(0)

CD = None
for rel in (("eval", "lib", "capu_decision.py"), ("eval", "T-129", "capu_decision.py")):
    f = os.path.join(HQ, *rel)
    if os.path.isfile(f):
        sp = importlib.util.spec_from_file_location("capu_decision", f); CD = importlib.util.module_from_spec(sp); sp.loader.exec_module(CD); break
if CD is None:
    print("FAIL thiếu eval/lib/capu_decision.py (định nghĩa chuẩn chữ ký Capu)"); sys.exit(1)
sys.dont_write_bytecode = True

JS = r"""
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { pathToFileURL } from "node:url";
const BACK = process.env.BACK;
globalThis.fetch = async (u) => { throw new Error("mạng bị chặn " + u); };
const { default: worker } = await import(pathToFileURL(path.join(BACK, "worker.js")).href);
const { MemoryBucket } = await import(pathToFileURL(path.join(BACK, "test/helpers/memoryBucket.js")).href);
const rep = JSON.parse(fs.readFileSync(path.join(BACK, "lib/vendorEnrichReport.generated.js"), "utf8").match(/VENDOR_ENRICH_REPORT\s*=\s*([\s\S]*?);\s*$/)[1]);
const free = rep.vendors.filter((r) => !r.override);
const appr = free.filter((r) => r.approvable);
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const TOKEN = "inv-t129-khoa-may-0123456789abcdef";
const CAPU = "user_capuinv00001", ADM = "user_adminv00002";
const env = { CHAT_DATA: new MemoryBucket(), DEV_AUTH_BYPASS: "1", ADMIN_USER_IDS: `${CAPU},${ADM}`, CAPU_USER_IDS: CAPU,
  ENRICH_EXPORT_TOKEN: TOKEN, ENRICH_SIGNING_KEY: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"), ENRICH_SIGNING_KEY_ID: "k1" };
const call = async (tok, method, p, body) => {
  const headers = { Authorization: `Bearer ${tok}` }; if (body) headers["Content-Type"] = "application/json";
  const res = await worker.fetch(new Request(`http://localhost${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  return { status: res.status, text: await res.text() };
};
const rv = (id) => `/api/admin/vendor-enrich/${id}/review`;
const used = new Set(); const pick = (arr) => { const r = arr.find((x) => !used.has(x.id)); if (r) used.add(r.id); return r?.id; };
const ids = { approve: pick(appr), link: pick(free), remove: pick(free), other: pick(appr) };
const puts = [
  await call(`dev:${CAPU}`, "PUT", rv(ids.approve), { decision: "approve" }),
  await call(`dev:${CAPU}`, "PUT", rv(ids.link), { decision: "manual", action: "accept_place", maps_link: "https://share.google/InvT129abc", note: "Có trên Maps" }),
  await call(`dev:${CAPU}`, "PUT", rv(ids.remove), { decision: "manual", action: "remove", note: "Không có trên Maps" }),
  await call(`dev:${ADM}`, "PUT", rv(ids.other), { decision: "approve" }),
];
const ex = await call(TOKEN, "GET", "/api/internal/vendor-enrich/export");
console.log(JSON.stringify({ ids, puts: puts.map((p) => p.status), status: ex.status, text: ex.text,
  pub: publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64") }));
process.exit(0);
"""
p = subprocess.run(["node", "--input-type=module", "-e", JS], cwd=BACK, capture_output=True, text=True, timeout=300, env=dict(os.environ, BACK=BACK))
if p.returncode != 0:
    print("FAIL không chạy được worker back: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
r = json.loads(p.stdout.strip().splitlines()[-1])
ids, pub = r["ids"], r["pub"]
if any(s != 200 for s in r["puts"]) or r["status"] != 200:
    print("FAIL cú bấm hoặc export không thành công: PUT %s, export %s" % (r["puts"], r["status"])); sys.exit(1)
if re.search(r"user_[A-Za-z0-9]{10,}", r["text"]):
    print("FAIL export chứa Clerk user id thô"); sys.exit(1)
ex = json.loads(r["text"])
ents = ex.get("entries") or []
got = sorted(e.get("vendor_id") for e in ents)
want = sorted([ids["approve"], ids["link"], ids["remove"]])
if got != want:
    print("FAIL export phải có đúng ba review của Capu (không có review của admin khác): thấy %s" % got); sys.exit(1)
for e in ents:
    if e.get("by_capu") is not True or "reviewed_by" in e:
        print("FAIL entry %s: by_capu=%r hoặc có reviewed_by" % (e.get("vendor_id"), e.get("by_capu"))); sys.exit(1)
    data = CD.payload(e.get("key_id"), e["vendor_id"], e.get("action"), None if e.get("maps_link") else e.get("place_id"),
                      e.get("maps_link"), e.get("reason"), e.get("reviewer_label"), e.get("reviewed_at"))
    if e.get("key_id") != "k1" or not CD.verify_signature(pub, data, str(e.get("sig") or "")):
        print("FAIL chữ ký của entry %s không kiểm được bằng định nghĩa chuẩn" % e["vendor_id"]); sys.exit(1)

tmp = tempfile.mkdtemp(prefix="inv-t129-")
try:
    sc = os.path.join(tmp, "tools", "scraper")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    before = json.load(open(mo, encoding="utf-8"))
    n0 = len(before.get("overrides") or [])
    exf = os.path.join(tmp, "export.json"); open(exf, "w", encoding="utf-8").write(r["text"])
    kf = os.path.join(tmp, "keys.json"); json.dump({"schema_version": 1, "keys": {"k1": pub}}, open(kf, "w"))
    a = subprocess.run([sys.executable, "apply_admin_reviews.py", "--state", "HCMC", "--reviews", exf, "--keys", kf, "--output-dir", os.path.join(sc, "output")],
                       cwd=sc, capture_output=True, text=True, timeout=300, env=dict(os.environ, GOOGLE_MAPS_API_KEY=""))
    if a.returncode != 0 or "APPLY_OK" not in a.stdout:
        print("FAIL tohong từ chối export có chữ ký của back: %s" % (a.stdout + a.stderr).strip()[-200:]); sys.exit(1)
    new = (json.load(open(mo, encoding="utf-8")).get("overrides") or [])[n0:]
    keys = {"k1": pub}
    for e in new:
        ok, why = CD.check_entry(e, keys)
        if not ok:
            print("FAIL mục %s do apply sinh không hợp lệ theo bất biến: %s" % (e.get("vendor_id"), why)); sys.exit(1)
        if e.get("action") == "accept_place" and e.get("maps_link"):
            e2 = dict(e, place_id="ChIJinvT129resolvedxxxxxxxx", resolved={"place_id": "ChIJinvT129resolvedxxxxxxxx"})
            ok, why = CD.check_entry(e2, keys)
            if not ok:
                print("FAIL mục link %s vỡ chữ ký sau khi resolve ghi place_id + resolved: %s" % (e.get("vendor_id"), why)); sys.exit(1)
    if sorted(e.get("vendor_id") for e in new) != want:
        print("FAIL apply sinh mục %s, mong %s" % (sorted(e.get("vendor_id") for e in new), want)); sys.exit(1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("PASS 3 cú bấm của Capu: back ký, tohong nhận, bất biến kiểm được (kể cả mục link sau resolve); review của admin khác không vào"); sys.exit(0)
