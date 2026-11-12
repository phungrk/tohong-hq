#!/usr/bin/env python3
"""Eval đối kháng T-134 (tầng 3) · adversary · 2026-11-12 (vòng v2).
Input phá: chữ ký sinh TRONG WORKERD (WebCrypto thật, không Node) cho reason Unicode khó: dấu tiếng Việt dựng sẵn (NFC) và tổ hợp (NFD),
  emoji ngoài BMP, ký tự 4 byte, dấu ngoặc kép / gạch dọc / dấu phẩy / dấu hai chấm (ký tự phân cách của chuỗi ký), kèm ba dạng mục tiêu
  (accept_place place_id, accept_place maps_link, remove không mục tiêu); rồi đưa NGUYÊN VĂN thân export đó cho apply_admin_reviews.py của tohong.
Mong đợi (spec T-129 Hành vi 3-4; inv-003 chờ merge khoá cùng định nghĩa nhưng chạy back bằng Node):
  apply in APPLY_OK added=3, mỗi mục giữ reason byte-đúng (không chuẩn hoá NFC/NFD), và sửa 1 ký tự NFD→NFC trong reason → bad_signature.
Tự chứa: chép back và tools/scraper vào thư mục tạm; miniflare của repo back; khoá Ed25519 sinh tạm; không mạng, không Google.
Repo: TOHONG_BACK_REPO / TOHONG_REPO hoặc ../tohong-back, ../tohong. Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm.
"""
import base64, json, os, shutil, subprocess, sys, tempfile, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))


def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)


HQ = hq_root(HERE) or os.getcwd()
find = lambda env, rel, probe: next((os.path.abspath(p) for p in (os.environ.get(env), os.path.join(HQ, "..", rel))
                                     if p and os.path.isfile(os.path.join(p, probe))), None)
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "enrich.py"))
if not BACK or not TOHONG:
    print("FAIL không thấy repo tohong-back / tohong"); sys.exit(1)
NM = os.path.realpath(os.path.join(BACK, "node_modules"))
if not os.path.exists(os.path.join(NM, "miniflare", "package.json")):
    print("FAIL thiếu node_modules/miniflare (npm ci)"); sys.exit(1)

NFD = unicodedata.normalize("NFD", "Nguyễn Thị Hồng")
NOTE_LINK = f"{NFD} | \"x\",1:2, 💍𝄞 end"
NOTE_RM = "Đã đóng cửa vĩnh viễn, 12:3,|k1| \U0001F470"

JS = r"""
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const [app, out, notesJson] = process.argv.slice(2);
const NOTES = JSON.parse(notesJson);
const require = createRequire(path.join(app, "package.json"));
const { Miniflare } = require("miniflare");
const toml = fs.readFileSync(path.join(app, "wrangler.toml"), "utf8");
const date = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1];
const flags = JSON.parse(((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || "[]").replace(/'/g, '"'));
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32).toString("base64");
const TOKEN = "adv134-token-0123456789abcdef", CAPU = "user_adv134capuAAAAAAAA";
const { VENDOR_ENRICH_REPORT: R } = await import("file://" + path.join(app, "lib", "vendorEnrichReport.generated.js"));
const free = R.vendors.filter((v) => !v.override);
const a = free.find((v) => v.approvable), b = free.filter((v) => !v.approvable)[0], c = free.filter((v) => !v.approvable)[1];
const mf = new Miniflare({ modules: true, scriptPath: path.join(out, "worker.js"), compatibilityDate: date, compatibilityFlags: flags,
  r2Buckets: ["CHAT_DATA"], kvNamespaces: ["RATE_LIMIT"], cf: { country: "VN" },
  bindings: { ADMIN_USER_IDS: CAPU, CAPU_USER_IDS: CAPU, ENRICH_EXPORT_TOKEN: TOKEN, ENRICH_SIGNING_KEY: priv, ENRICH_SIGNING_KEY_ID: "k7z" } });
try {
  const at = "2026-11-12T01:02:03.456Z";
  const base = { state: "pending", reviewed_by: CAPU, by_capu: true };
  const bucket = await mf.getR2Bucket("CHAT_DATA");
  await bucket.put("data/admin/vendor_enrich_reviews.json", JSON.stringify({ vendors: {
    [a.id]: { ...base, decision: "approve", action: "accept_place", place_id: a.google.place_id, reason: `Admin duyệt nhận khớp Google: ${a.google.name || a.google.place_id}`, reviewed_at: at },
    [b.id]: { ...base, decision: "manual", action: "accept_place", maps_link: "https://maps.app.goo.gl/AbCdEf123", reason: `Admin sửa thủ công: gắn đúng nơi trên Google Maps. ${NOTES.link}`, reviewed_at: "2026-11-10T23:59:59.999Z" },
    [c.id]: { ...base, decision: "manual", action: "remove", reason: `Admin sửa thủ công: gỡ vendor (không có trên Maps). ${NOTES.rm}`, reviewed_at: "2026-11-11T00:00:00.000Z" },
  } }));
  const r = await mf.dispatchFetch("http://localhost/api/internal/vendor-enrich/export", { headers: { Authorization: `Bearer ${TOKEN}` } });
  const txt = await r.text();
  if (r.status !== 200) { console.log(`FAIL export trong workerd ${r.status} ${txt.slice(0, 200)}`); process.exit(1); }
  console.log("EXPORT " + Buffer.from(txt, "utf8").toString("base64"));
  console.log("PUB " + pub);
} finally { await mf.dispose(); }
"""

errs = []
tmp = tempfile.mkdtemp(prefix="adv134-05-")
try:
    app = os.path.join(tmp, "app")
    shutil.copytree(BACK, app, symlinks=True, ignore=shutil.ignore_patterns(".git", "node_modules", ".wrangler", ".dev.vars"))
    os.symlink(NM, os.path.join(app, "node_modules"))
    out = os.path.join(tmp, "out")
    env = dict(os.environ, WRANGLER_SEND_METRICS="false", CI="1", HOME=os.path.join(tmp, "home"))
    bd = subprocess.run([os.path.join(NM, ".bin", "wrangler"), "deploy", "--dry-run", "--outdir", out], cwd=app, env=env, capture_output=True, text=True, timeout=300)
    if bd.returncode != 0:
        print("FAIL bundle:\n" + (bd.stdout + bd.stderr)[-1500:]); sys.exit(1)
    js = os.path.join(tmp, "run.mjs")
    open(js, "w").write(JS)
    p = subprocess.run(["node", js, app, out, json.dumps({"link": NOTE_LINK, "rm": NOTE_RM})], cwd=tmp, env=env, capture_output=True, text=True, timeout=300)
    kv = dict(l.split(" ", 1) for l in p.stdout.splitlines() if l.startswith(("EXPORT ", "PUB ", "FAIL ")))
    if "FAIL" in kv or "EXPORT" not in kv:
        print("FAIL " + kv.get("FAIL", (p.stdout + p.stderr)[-1500:])); sys.exit(1)
    raw = base64.b64decode(kv["EXPORT"])
    exp = json.loads(raw.decode("utf-8"))
    if exp.get("count") != 3:
        errs.append(f"export workerd: mong 3 entry, thấy {exp.get('count')}")
    sc = os.path.join(tmp, "tohong", "tools", "scraper")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", ".cache", "*.pyc"))
    keys = os.path.join(tmp, "keys.json")
    json.dump({"schema_version": 1, "keys": {"k7z": kv["PUB"]}}, open(keys, "w"))
    expf = os.path.join(tmp, "export.json")
    open(expf, "wb").write(raw)  # nguyên văn byte từ workerd
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    before = open(mo, "rb").read() if os.path.exists(mo) else b""
    run = lambda f: subprocess.run([sys.executable, "-I", os.path.join(sc, "apply_admin_reviews.py"), "--state", "HCMC", "--reviews", f, "--keys", keys],
                                   cwd=sc, capture_output=True, text=True, timeout=300)
    # (1) đổi NFD → NFC trong reason: phải bad_signature, file không đổi
    tam = json.loads(raw.decode("utf-8"))
    for e in tam["entries"]:
        if NFD in e["reason"]:
            e["reason"] = e["reason"].replace(NFD, unicodedata.normalize("NFC", NFD))
    tf = os.path.join(tmp, "tampered.json")
    json.dump(tam, open(tf, "w", encoding="utf-8"), ensure_ascii=False)
    q = run(tf)
    if q.returncode != 2 or "APPLY_REFUSED bad_signature" not in q.stdout:
        errs.append(f"reason NFD→NFC không bị bắt: thoát {q.returncode} {q.stdout.strip()[-200:]!r}")
    if (open(mo, "rb").read() if os.path.exists(mo) else b"") != before:
        errs.append("file bị đổi sau lượt bị từ chối")
    # (2) nguyên văn: APPLY_OK added=3, reason giữ byte
    q = run(expf)
    if q.returncode != 0 or "APPLY_OK added=3" not in q.stdout:
        errs.append(f"apply của tohong không nhận chữ ký do workerd ký: thoát {q.returncode} {(q.stdout + q.stderr).strip()[-300:]!r}")
    else:
        doc = json.load(open(mo, encoding="utf-8"))
        by = {x["vendor_id"]: x for x in doc["overrides"]}
        for e in exp["entries"]:
            m = by.get(e["vendor_id"])
            if not m or not m["reason"].startswith(e["reason"] + " [duyệt qua admin: "):
                errs.append(f"{e['vendor_id']}: reason không giữ nguyên byte")
            if m and (("maps_link" in e) != ("maps_link" in m) or ("place_id" in m) != ("place_id" in e)):
                errs.append(f"{e['vendor_id']}: trường mục tiêu lệch export")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if errs:
    for e in errs:
        print("FAIL " + e)
    sys.exit(1)
print("PASS chữ ký WebCrypto sinh trong workerd (Unicode NFD/emoji/ký tự phân cách, 3 dạng mục tiêu) được apply của tohong nhận; sửa NFD→NFC bị bad_signature")
