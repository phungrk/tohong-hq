#!/usr/bin/env python3
"""T-124 tiêu chí 7 (repo tohong): từ file export của admin tới manual_overrides.json theo cơ chế T-110, giữ nguyên INV-020, không gọi Google.
Lệnh (hợp đồng): python3 tools/scraper/apply_admin_reviews.py --state HCMC --reviews <export.json> --decision decisions/<file>.md --approved-on YYYY-MM-DD
                 [--output-dir <thư mục chứa HCMC/>] [--hq <gốc tohong-hq>]
  Việc nó làm: thêm vào output/HCMC/manual_overrides.json (tạo nếu chưa có, schema_version 1) một mục cho mỗi entry của export, theo thứ tự vendor_id, SAU các mục đã có:
  {vendor_id, action, maps_link|place_id (nếu có), reason = "<reason của export> [duyệt qua admin: admin:<8 ký tự đầu của sha256(reviewed_by)>, <reviewed_at>]" (nhãn băm, KHÔNG đưa Clerk user id thô vào repo; tra ngược bằng nhật ký admin), approved_by:"capu", approved_on, decision}.
  Không thêm trường nào khác (T-110 schema). Mục đã có cho vendor đó: GIỮ NGUYÊN byte, in "SKIP_EXISTING <vendor_id>", mã thoát vẫn 0 cho các mục còn lại.
  Từ chối cả lượt (thoát 2, file không đổi byte, in "APPLY_REFUSED <mã> [<vendor_id>]"): vendor không có ở vendors.json/removed_vendors.json nào (unknown_vendor); entry không qua
  kiểm schema của enrichment.overrides.validate (bad_entry); --decision không dạng decisions/<tên>.md (bad_decision); khi có --hq: file không có, không có `decided_by: capu` ở frontmatter,
  hoặc không nhắc đủ vendor_id sẽ được thêm (bad_decision). Chạy lại cùng đầu vào: file giữ nguyên byte. Không mở mạng.
Đo trên bản sao dữ liệu thật: (a) 7 entry export (3 Approve, remove, temporarily_closed, reject_match, 1 vendor đã có mục từ ADR-048) -> thêm đúng 6 mục, bỏ qua 1, 4 mục cũ giữ byte;
(b) enrichment.overrides.load_overrides đọc được file; không mục nào có trường ngoài T-110; (c) INV-020 NGUYÊN VĂN (bản trong bể, chạy trong HQ giả có decision) PASS, và ĐỎ khi decision thiếu một vendor_id;
(d) từ chối đúng 5 ca xấu, file không đổi; (e) chạy lại không đổi byte; (f) resolve_overrides.py --dry-run đếm đúng các mục accept_place mới (chưa có `resolved`) để bước resolve/enrich sau áp dụng, mạng bị chặn.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, hashlib, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import _t124 as t

root = t.tohong_root()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
if not os.path.isfile(os.path.join(root, "tools", "scraper", "apply_admin_reviews.py")):
    print("FAIL thiếu tools/scraper/apply_admin_reviews.py trong repo tohong"); sys.exit(1)

snap = t.facts_from_repo(root)   # dữ liệu SỐNG của repo tohong (không cứng theo ảnh chụp: PR dữ liệu mới có thể gỡ/nhận vendor)
def pick(group, n=1, skip=()):
    return [f for f in snap if t.classify(f) == group and t.candidate_place_id(f) and f["id"] not in skip][:n]
ap = pick("name_similar") + pick("name_same_addr_diff") + pick("unverified")
nf = pick("not_found", 3)
EXISTING = "marry_d4380c0b3cf3"
AT = "2026-11-12T03:04:05Z"
LABEL = "admin:" + hashlib.sha256(b"user_admin").hexdigest()[:8]
def reason(s): return s
entries = [{"vendor_id": f["id"], "action": "accept_place", "place_id": t.candidate_place_id(f), "reason": "Admin duyệt nhận khớp Google", "reviewed_by": "user_admin", "reviewed_at": AT} for f in ap]
entries += [{"vendor_id": nf[0]["id"], "action": "remove", "reason": "Không có trên Maps", "reviewed_by": "user_admin", "reviewed_at": AT},
            {"vendor_id": nf[1]["id"], "action": "temporarily_closed", "reason": "Maps ghi tạm đóng", "reviewed_by": "user_admin", "reviewed_at": AT},
            {"vendor_id": nf[2]["id"], "action": "reject_match", "place_id": t.candidate_place_id(nf[2]), "reason": "Sai nơi", "reviewed_by": "user_admin", "reviewed_at": AT},
            {"vendor_id": EXISTING, "action": "remove", "reason": "Không được đè mục có sẵn", "reviewed_by": "user_admin", "reviewed_at": AT}]
entries.sort(key=lambda e: e["vendor_id"])
new_ids = [e["vendor_id"] for e in entries if e["vendor_id"] != EXISTING]

tmp = tempfile.mkdtemp(prefix="t124-")
bad = []
def run(cmd_args, cwd, env=None, expect=None):
    p = subprocess.run([sys.executable] + cmd_args, cwd=cwd, env=env or NONET, capture_output=True, text=True, timeout=300)
    return p
try:
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    shutil.copy(os.path.join(HERE, "lib", "nonet_sitecustomize.py"), os.path.join(nd, "sitecustomize.py"))
    NONET = dict(os.environ, PYTHONPATH=nd, GOOGLE_MAPS_API_KEY="")
    th = os.path.join(tmp, "tohong"); os.makedirs(th)
    shutil.copytree(os.path.join(root, "tools", "scraper"), os.path.join(th, "tools", "scraper"), ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    sc = os.path.join(th, "tools", "scraper")
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    old_bytes = open(mo, "rb").read(); old = json.loads(old_bytes)
    ex = os.path.join(tmp, "export.json"); json.dump({"count": len(entries), "entries": entries}, open(ex, "w"), ensure_ascii=False)
    # HQ giả: chỉ có decision của ADR-048 (cho 4 mục cũ) và decision mới (đủ id)
    hq = os.path.join(tmp, "hq"); os.makedirs(os.path.join(hq, "decisions")); os.makedirs(os.path.join(hq, "eval", "invariants", "planner", "vendor", "images"))
    for f in os.listdir(os.path.join(t.HQ, "decisions")):
        if f.startswith("2026-11-08-adr-048"): shutil.copy(os.path.join(t.HQ, "decisions", f), os.path.join(hq, "decisions", f))
    inv = os.path.join(t.HQ, "eval", "invariants", "planner", "vendor", "images", "inv-020-duyet-tay-co-quyet-dinh-cua-capu.py")
    shutil.copy(inv, os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py"))
    dec_rel = "decisions/2026-11-12-adr-999-duyet-qua-admin.md"
    def write_dec(ids, who="capu"):
        open(os.path.join(hq, dec_rel), "w", encoding="utf-8").write("---\ntype: decision\nid: ADR-999\ndecided_by: %s\n---\n# Duyệt qua admin\n%s\n" % (who, "\n".join(ids)))
    write_dec(new_ids)
    base = ["apply_admin_reviews.py", "--state", "HCMC", "--reviews", ex, "--decision", dec_rel, "--approved-on", "2026-11-12", "--output-dir", os.path.join(sc, "output"), "--hq", hq]
    def refused(name, args, code="APPLY_REFUSED"):
        before = open(mo, "rb").read()
        p = run(args, sc)
        if p.returncode != 2 or code not in (p.stdout + p.stderr) or open(mo, "rb").read() != before:
            bad.append("%s: mong thoát 2 + %s + file không đổi; thấy thoát %s, đổi=%s, %r" % (name, code, p.returncode, open(mo, "rb").read() != before, (p.stdout + p.stderr)[-120:]))
    # (d) ca xấu trước (file phải không đổi)
    def with_ex(mut):
        e2 = copy.deepcopy(entries); mut(e2); p2 = os.path.join(tmp, "bad.json"); json.dump({"entries": e2}, open(p2, "w")); return base[:4] + [p2] + base[5:]
    refused("vendor lạ", with_ex(lambda e: e.append({"vendor_id": "marry_ffffffffffff", "action": "remove", "reason": "x", "reviewed_by": "u", "reviewed_at": AT})), "unknown_vendor")
    xtra = pick("name_similar", 2)[1]["id"]
    refused("accept_place thiếu đích", with_ex(lambda e: e.append({"vendor_id": xtra, "action": "accept_place", "reason": "x", "reviewed_by": "u", "reviewed_at": AT})), "bad_entry")
    refused("remove mang place_id", with_ex(lambda e: [x.update(place_id="ChIJxxxxxxxxxxxxxxxxxxxx") for x in e if x["action"] == "remove" and x["vendor_id"] != EXISTING]), "bad_entry")
    refused("decision sai dạng", base[:6] + ["../x.md"] + base[7:], "bad_decision")
    write_dec(new_ids[:-1]); refused("decision thiếu một vendor_id", base, "bad_decision")
    write_dec(new_ids, who="chief-of-staff"); refused("decision không phải decided_by: capu", base, "bad_decision")
    write_dec(new_ids)
    # (a) chạy thật
    p = run(base, sc)
    if p.returncode != 0:
        bad.append("apply thoát %s: %s" % (p.returncode, (p.stdout + p.stderr).strip()[-200:]))
    else:
        out = p.stdout + p.stderr
        if "SKIP_EXISTING " + EXISTING not in out: bad.append("không in SKIP_EXISTING cho vendor đã có mục")
        doc = json.load(open(mo, encoding="utf-8"))
        ov = doc["overrides"]
        if ov[:len(old["overrides"])] != old["overrides"]: bad.append("các mục cũ bị đổi")
        add = ov[len(old["overrides"]):]
        if [e["vendor_id"] for e in add] != new_ids: bad.append("mục mới %r, mong %r (đúng thứ tự vendor_id, bỏ vendor đã có)" % ([e["vendor_id"] for e in add], new_ids))
        src = {e["vendor_id"]: e for e in entries}
        allowed = {"vendor_id", "action", "maps_link", "place_id", "reason", "approved_by", "approved_on", "decision"}
        for e in add:
            s = src.get(e["vendor_id"], {})
            if set(e) - allowed: bad.append("%s có trường ngoài T-110: %s" % (e["vendor_id"], sorted(set(e) - allowed)))
            if e.get("approved_by") != "capu" or e.get("approved_on") != "2026-11-12" or e.get("decision") != dec_rel: bad.append("%s: approved_by/approved_on/decision sai" % e["vendor_id"])
            if e.get("action") != s.get("action") or e.get("place_id") != s.get("place_id"): bad.append("%s: action/place_id không theo export" % e["vendor_id"])
            if not (e["reason"].startswith(s.get("reason", "?")) and LABEL in e["reason"] and "user_admin" not in e["reason"] and AT in e["reason"]): bad.append("%s: reason thiếu lý do gốc hoặc dấu vết người duyệt: %r" % (e["vendor_id"], e["reason"]))
        # (b) load_overrides của chính pipeline
        q = run(["-c", "import sys,pathlib; sys.path.insert(0,'.'); from enrichment import overrides as o; d=o.load_overrides(pathlib.Path('output/HCMC')); print('OK',len(d['overrides']))"], sc, env=NONET)
        if q.returncode != 0 or "OK %d" % len(ov) not in q.stdout: bad.append("enrichment.overrides.load_overrides từ chối file: %s" % (q.stderr or q.stdout).strip()[-200:])
        # (c) INV-020 nguyên văn
        env2 = dict(NONET, TOHONG_REPO=th)
        i1 = run([os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py")], hq, env=env2)
        if i1.returncode != 0 or not i1.stdout.startswith("PASS"): bad.append("INV-020 đỏ trên kết quả: %s" % i1.stdout.strip()[:160])
        write_dec(new_ids[:-1])
        i2 = run([os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py")], hq, env=env2)
        if i2.returncode == 0: bad.append("đối chứng: INV-020 phải ĐỎ khi decision thiếu một vendor_id")
        write_dec(new_ids)
        # (e) chạy lại
        b1 = open(mo, "rb").read()
        p2 = run(base, sc)
        if p2.returncode != 0 or open(mo, "rb").read() != b1: bad.append("chạy lại cùng đầu vào làm đổi file hoặc lỗi (thoát %s)" % p2.returncode)
        # (f) bước resolve sau đếm mục accept_place mới
        n_acc = sum(1 for e in ov if e["action"] == "accept_place" and not e.get("resolved"))
        r = run(["resolve_overrides.py", "--state", "HCMC", "--dry-run"], sc)
        m = re.search(r"DRY RUN: (\d+) mục", r.stdout)
        if r.returncode != 0 or not m or int(m.group(1)) != n_acc or n_acc < 3:
            bad.append("resolve_overrides.py --dry-run phải đếm %d mục accept_place chưa resolve, thấy %r (thoát %s)" % (n_acc, r.stdout.strip()[:80], r.returncode))
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
    sys.exit(1 if bad else 0)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
