#!/usr/bin/env python3
"""T-218 adversary 05 (tầng 3): tính lại tập S và luật giá của spec T-217 (Định nghĩa S, Hành vi 1, 1b) ĐỘC LẬP với helper _t217.py, rồi so từng bản ghi
vendors.json ở HEAD của TOHONG_REPO với bản dự kiến dựng từ nền (merge-base với origin/main, hoặc T217_BASE_REF).
Kiểm thêm: gốc file y nguyên; thứ tự id y nguyên; định dạng json.dumps(indent=2, ensure_ascii=False) không xuống dòng cuối; diff đúng 213 dòng thêm, 213 xoá;
chỉ vendors.json và enrich-report.json trong tools/scraper/output đổi; Thiskyhall Sala và marry_604e8973f53e giữ price_range; Bình Quới 2 không đổi; mọi note mới kết thúc
đúng " (nguồn: Google AI Mode)" một lần. Hạng mục pool (điều 4) đo bằng build_pool.py chạy trên bản sao tạm của tools/scraper (nguồn ở HEAD), mạng bị chặn.
Chạy: python3 -I <file>. Biến: TOHONG_REPO."""
import json, os, subprocess, sys, tempfile, shutil, unicodedata
HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
T = os.path.realpath(os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong"))
VP = "tools/scraper/output/HCMC/venue/vendors.json"
fails = []
def bad(m): fails.append(m)
def git(*a): return subprocess.run(["git", "-C", T, *a], capture_output=True, text=True, check=True).stdout
base_ref = os.environ.get("T217_BASE_REF")
if not base_ref:
    for r in ("origin/main", "main"):
        try: base_ref = git("merge-base", "HEAD", r).strip(); break
        except subprocess.CalledProcessError: pass
base_raw, head_raw = git("show", f"{base_ref}:{VP}"), git("show", f"HEAD:{VP}")
base, head = json.loads(base_raw), json.loads(head_raw)
B = {v["id"]: v for v in base["vendors"]}; Hd = {v["id"]: v for v in head["vendors"]}
if [v["id"] for v in base["vendors"]] != [v["id"] for v in head["vendors"]]: bad("thứ tự/tập id đổi")
for k in set(base) | set(head):
    if k != "vendors" and base.get(k) != head.get(k): bad(f"gốc file đổi khoá {k}")
if json.dumps(head, indent=2, ensure_ascii=False) != head_raw: bad("định dạng vendors.json khác json.dumps(indent=2, ensure_ascii=False) không xuống dòng cuối")
changed = [l for l in git("diff", "--name-only", base_ref, "HEAD", "--", "tools/scraper/output").split("\n") if l]
if sorted(changed) != sorted([VP, "tools/scraper/output/HCMC/enrich-report.json"]): bad(f"file đổi trong output: {changed}")
ns = git("diff", "--numstat", base_ref, "HEAD", "--", VP).split()
if ns[:2] != ["213", "213"]: bad(f"diff vendors.json {ns[:2]}, mong 213/213")
# audit
aud = json.loads(git("show", f"{base_ref}:tools/scraper/output/HCMC/venue/enrichment-audit.json"))
last = {}
for r in aud: last[r["vendor_id"]] = r
closed = {i for i, r in last.items() if r.get("closed_state") == "temporarily_closed" or (r.get("status") == "temporarily_closed" and r.get("retry") is True)}
# hạng mục pool qua build_pool.py trên bản sao tạm
tmp = tempfile.mkdtemp(prefix="t218-adv05-")
try:
    sc = os.path.join(tmp, "scraper")
    shutil.copytree(os.path.join(T, "tools", "scraper"), sc, ignore=shutil.ignore_patterns("pool-vendors.json", "__pycache__", "*.pyc"))
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    open(os.path.join(nd, "sitecustomize.py"), "w").write("import socket\ndef _no(*a, **k):\n    raise OSError('mạng bị chặn')\nsocket.socket.connect = _no\nsocket.create_connection = _no\n")
    out = os.path.join(tmp, "pool.json")
    p = subprocess.run([sys.executable, "build_pool.py", "--out", out], cwd=sc, capture_output=True, text=True, env=dict(os.environ, PYTHONPATH=nd, GOOGLE_MAPS_API_KEY=""), timeout=600)
    if p.returncode: print("FAIL build_pool lỗi " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
    d = json.load(open(out, encoding="utf-8")); pv = d["vendors"] if isinstance(d, dict) else d
    first = {v["id"]: (v.get("categories") or [None])[0] for v in pv}
finally:
    shutil.rmtree(tmp, ignore_errors=True)
def aim(v): return [e for e in (v.get("enrichment_log") or []) if e.get("source") == "google_ai_mode"]
def c1(v):
    for e in aim(v):
        ch = e.get("changes") or {}
        if (isinstance(ch.get("description"), str) and ch["description"].strip()) or "capacity_min" in ch or "capacity_max" in ch: return True
    return False
S = [i for i, v in B.items() if c1(v) and i not in closed and i != "marry_b92e8a86175d" and first.get(i) == "venue"]
def untrust(v):
    xs = []
    pr = v.get("price_range") or {}
    if isinstance(pr, dict) and isinstance(pr.get("note"), str): xs.append(pr["note"])
    if isinstance(v.get("verification_notes"), str): xs.append(v["verification_notes"])
    xs += [e["changes"]["verification_notes"] for e in aim(v) if isinstance((e.get("changes") or {}).get("verification_notes"), str)]
    return any(p in unicodedata.normalize("NFC", x).lower() for x in xs for p in ("chưa đủ tin cậy", "không đủ tin cậy"))
num = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool)
def elig(v):
    pr = v.get("price_range")
    return isinstance(pr, dict) and pr.get("price_source") == "google_ai_mode" and pr.get("unit") == "per_table" and num(pr.get("min_vnd")) and num(pr.get("max_vnd")) \
        and 0 < pr["min_vnd"] <= pr["max_vnd"] and pr["min_vnd"] >= 2_000_000 and pr["max_vnd"] <= 20_000_000 and not untrust(v)
E = {i for i in S if elig(B[i])}
if len(S) != 85: bad(f"|S| tính độc lập = {len(S)}, spec nói 85")
if len(E) != 64: bad(f"số bản ghi đổi giá tính độc lập = {len(E)}, spec nói 64")
if "marry_f8b40ba4ddef" not in S or "marry_f8b40ba4ddef" in E: bad("Thiskyhall Sala: phải thuộc S và không đổi giá")
for i, b in B.items():
    exp = json.loads(json.dumps(b))
    if i in S: exp["verification_status"] = "verified"
    if i in E:
        exp["price_range"]["price_source"] = "verified"
        exp["price_range"]["note"] = (b["price_range"].get("note") or "") + " (nguồn: Google AI Mode)"
    if exp != Hd[i]:
        ks = [k for k in set(exp) | set(Hd[i]) if exp.get(k) != Hd[i].get(k)]
        bad(f"{i}: lệch luật S/1b ở {ks}")
for i in E:
    n = Hd[i]["price_range"]["note"]
    if n.count("(nguồn: Google AI Mode)") != 1 or not n.endswith(" (nguồn: Google AI Mode)"): bad(f"{i}: hậu tố note sai")
if fails:
    print(f"FAIL {fails[0]}" + (f" (+{len(fails)-1} lỗi nữa)" if len(fails) > 1 else "")); sys.exit(1)
print(f"PASS |S|={len(S)}, {len(E)} giá đổi, diff 213/213 khớp luật")
