#!/usr/bin/env python3
"""Nguồn: T-204 (products/T-204-co-mo-admin-tinh-la-capu.md, Hành vi 4-5; ADR-126), rút bởi spec-critic tại Spec Gate 2026-11-18.
Nằm ở eval/T-204/bat-bien-cho-merge/ cho tới khi PR back của T-204 merge (trên main hiện tại ĐỎ: export chưa có mục của danh tính cố định);
Chief of Staff đưa vào eval/invariants/planner/admin/ (kèm lib/open_admin_export.mjs, lib/open_admin_common.mjs) và đặt số. Tự chứa, không đọc file nào trong eval/T-204;
gốc HQ dò ngược tới scripts/gate.py (ADR-070, không đếm cấp), lib tìm cạnh file này, nên chép sang bể không phải sửa.
INV-??? (planner/admin) · Mục export ký do danh tính cố định "admin-khong-dang-nhap" tạo khi ADMIN_OPEN="1" (bản ghi cũ Approve + bản mới Sửa thủ công link, gỡ)
luôn được tools/scraper/apply_admin_reviews.py THẬT của tohong nhận đầu-cuối: APPLY_OK, đúng các mục đó được sinh ra, mỗi mục qua eval/lib/capu_decision.py
(check_entry), decision chứa ":admin:2ddfc6ef@", reason chứa "[duyệt qua admin: admin:2ddfc6ef,", approved_by=capu.
Lý do: back và tohong là hai repo; ai đổi dạng nhãn (khác LABEL_RE), thêm trường bị apply từ chối (Clerk id thô, reviewed_by), hay đổi phần được ký ở một phía
thì 132 review của Capu qua cờ mở admin không còn vào pool mà không ai thấy.
Repo: TOHONG_REPO, TOHONG_BACK_REPO hoặc ../tohong, ../tohong-back cạnh gốc HQ. apply chạy trên bản sao tạm; không sửa repo nào; mạng bị chặn ở worker.
Bản sao tạm bỏ mục sẵn có của các id đang thử trong manual_overrides.json (ADR-131), nên kết quả không phụ thuộc override đã duyệt trong tohong.
Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm, 2 = thiếu repo."""
import importlib.util, json, os, shutil, subprocess, sys, tempfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
HQ = HERE
while HQ != os.path.dirname(HQ) and not os.path.exists(os.path.join(HQ, "scripts", "gate.py")):
    HQ = os.path.dirname(HQ)
def find(env, rel, probe):
    for p in (os.environ.get(env), os.path.join(HQ, "..", rel)):
        if p and os.path.exists(os.path.join(p, probe)):
            return os.path.abspath(p)
TOHONG = find("TOHONG_REPO", "tohong", os.path.join("tools", "scraper", "apply_admin_reviews.py"))
BACK = find("TOHONG_BACK_REPO", "tohong-back", "worker.js")
if not TOHONG or not BACK:
    print("FAIL không thấy repo tohong / tohong-back"); sys.exit(2)
sp = importlib.util.spec_from_file_location("capu_decision", os.path.join(HQ, "eval", "lib", "capu_decision.py")); CD = importlib.util.module_from_spec(sp); sp.loader.exec_module(CD)
LABEL = "admin:2ddfc6ef"
p = subprocess.run(["node", os.path.join(HERE, "lib", "open_admin_export.mjs")], capture_output=True, text=True, timeout=300, env=dict(os.environ, TOHONG_BACK_REPO=BACK))
if p.returncode != 0:
    print("FAIL không chạy được worker back: " + (p.stdout + p.stderr)[-300:]); sys.exit(1)
r = json.loads(p.stdout.strip().splitlines()[-1])
want = sorted(r["ids"].values())
if r["status"] != 200:
    print("FAIL export không 200: %s" % r["status"]); sys.exit(1)
ents = json.loads(r["export"]).get("entries") or []
if sorted(e.get("vendor_id") for e in ents) != want:
    print("FAIL export phải có đúng 3 mục của danh tính cố định khi cờ bật, thấy %s" % sorted(e.get("vendor_id") for e in ents)); sys.exit(1)
tmp = tempfile.mkdtemp(prefix="t204-")
try:
    sc = os.path.join(tmp, "tools", "scraper")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    # ADR-131: bản sao tạm trung tính với các id đang thử (bỏ mục sẵn có của chúng, giữ mọi mục khác để validate vẫn chạy trên dữ liệu thật),
    # để kết quả không phụ thuộc vào override nào đã được duyệt vào repo tohong.
    doc0 = json.load(open(mo, encoding="utf-8"))
    doc0["overrides"] = [x for x in (doc0.get("overrides") or []) if x.get("vendor_id") not in set(want)]
    open(mo, "w", encoding="utf-8").write(json.dumps(doc0, ensure_ascii=False, indent=2) + "\n")
    n0 = len(doc0["overrides"])
    exf = os.path.join(tmp, "export.json"); open(exf, "w", encoding="utf-8").write(r["export"])
    kf = os.path.join(tmp, "keys.json"); json.dump({"schema_version": 1, "keys": {"k204": r["pub"]}}, open(kf, "w"))
    a = subprocess.run([sys.executable, "apply_admin_reviews.py", "--state", "HCMC", "--reviews", exf, "--keys", kf, "--output-dir", os.path.join(sc, "output")],
                       cwd=sc, capture_output=True, text=True, timeout=300, env=dict(os.environ, GOOGLE_MAPS_API_KEY=""))
    if a.returncode != 0 or "APPLY_OK" not in a.stdout:
        print("FAIL tohong từ chối export mở-admin: %s" % (a.stdout + a.stderr).strip()[-200:]); sys.exit(1)
    new = (json.load(open(mo, encoding="utf-8")).get("overrides") or [])[n0:]
    if sorted(e.get("vendor_id") for e in new) != want:
        print("FAIL apply sinh mục %s, mong %s" % (sorted(e.get("vendor_id") for e in new), want)); sys.exit(1)
    for e in new:
        ok, why = CD.check_entry(e, {"k204": r["pub"]})
        if not ok:
            print("FAIL mục %s không hợp lệ theo định nghĩa chuẩn: %s" % (e.get("vendor_id"), why)); sys.exit(1)
        if e.get("approved_by") != "capu" or (":%s@" % LABEL) not in e.get("decision", "") or ("[duyệt qua admin: %s," % LABEL) not in e.get("reason", ""):
            print("FAIL mục %s thiếu nhãn %s trong decision/reason hoặc approved_by != capu" % (e.get("vendor_id"), LABEL)); sys.exit(1)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
print("PASS export khi cờ mở admin (cũ + mới) qua apply_admin_reviews.py thật, nhãn %s" % LABEL); sys.exit(0)
