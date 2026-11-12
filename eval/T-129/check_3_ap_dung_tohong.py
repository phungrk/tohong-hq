#!/usr/bin/env python3
"""T-129 tiêu chí 3 (repo tohong): từ file export CHỈ chứa review của Capu tới manual_overrides.json, không cần file decisions/ của lô; INV-020 v2 xanh; không gọi Google.
Lệnh (hợp đồng, thay hợp đồng của T-124 #7; `--decision` không còn tồn tại):
  python3 tools/scraper/apply_admin_reviews.py --state HCMC --reviews <export.json> --approved-on YYYY-MM-DD [--output-dir <thư mục chứa HCMC/>] [--hq <gốc tohong-hq>]
Export (back sinh, Hành vi 3): {count, entries:[{vendor_id, action, [place_id|maps_link], reason, reviewer_label:"admin:<8 hex>", reviewed_at:"<ISO UTC Z>", by_capu:true}]} — KHÔNG có reviewed_by thô.
Việc nó làm: thêm vào output/HCMC/manual_overrides.json, theo thứ tự vendor_id SAU các mục đã có, mỗi entry một mục đúng schema T-110 (không trường lạ):
  {vendor_id, action, [maps_link|place_id], reason = "<reason> [duyệt qua admin: <reviewer_label>, <reviewed_at>]", approved_by:"capu", approved_on, decision:"admin-review:<reviewer_label>@<reviewed_at>"}.
  Vendor đã có mục: giữ nguyên byte, in "SKIP_EXISTING <id>". Thành công in "APPLY_OK added=N skipped=M" và mỗi mục thêm một dòng "ADDED <vendor_id> <action> <reviewer_label>" (để nhét vào thân PR).
  Từ chối cả lượt (thoát 2, file không đổi byte, in "APPLY_REFUSED <mã> [<id>]"): entry không có by_capu === true (not_capu); entry có trường reviewed_by (id thô) hoặc reviewer_label sai dạng admin:<8 hex> hoặc reviewed_at sai dạng (bad_entry);
  vendor lạ (unknown_vendor); không qua enrichment.overrides.validate (bad_entry); file overrides hỏng (bad_overrides_file); với --hq: nhãn không thuộc `capu_admin_labels` của decisions/ nào có decided_by: capu (label_not_capu).
  Chạy lại cùng đầu vào: file giữ nguyên byte. Không mở mạng. enrichment.overrides.load_overrides đọc được file (decision dạng mới được chấp nhận; dạng decisions/<tên>.md vẫn hợp lệ).
Đo trên bản sao dữ liệu thật: (a) 8 entry (3 Approve, remove, temporarily_closed, reject_match, 1 vendor đã có mục từ ADR-048) -> thêm đúng 6 mục, bỏ qua 1, 4 mục cũ giữ byte; (b) load_overrides đọc được, không trường ngoài T-110;
(c) INV-020 v2 (bản đề xuất) PASS trong HQ giả có ADR khai nhãn, và ĐỎ khi ADR không khai nhãn; (d) từ chối đúng các ca xấu, file không đổi; (e) chạy lại không đổi byte; (f) resolve_overrides.py --dry-run đếm đúng mục accept_place mới; mạng bị chặn.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, hashlib, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-124"))
import _t124 as t

root = t.tohong_root()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
if not os.path.isfile(os.path.join(root, "tools", "scraper", "apply_admin_reviews.py")):
    print("FAIL thiếu tools/scraper/apply_admin_reviews.py trong repo tohong (đợi PR T-125 merge)"); sys.exit(1)

snap = t.facts_from_repo(root)
def pick(group, n=1):
    return [f for f in snap if t.classify(f) == group and t.candidate_place_id(f)][:n]
ap = pick("name_similar") + pick("name_same_addr_diff") + pick("unverified")
nf = pick("not_found", 3)
EXISTING = "marry_d4380c0b3cf3"
AT = "2026-11-12T03:04:05.678Z"
LABEL = "admin:" + hashlib.sha256(b"user_capu_0001").hexdigest()[:8]
def E(vid, action, reason, **kw):
    d = {"vendor_id": vid, "action": action, "reason": reason, "reviewer_label": LABEL, "reviewed_at": AT, "by_capu": True}; d.update(kw); return d
entries = [E(f["id"], "accept_place", "Admin duyệt nhận khớp Google", place_id=t.candidate_place_id(f)) for f in ap]
entries += [E(nf[0]["id"], "remove", "Không có trên Maps"), E(nf[1]["id"], "temporarily_closed", "Maps ghi tạm đóng"),
            E(nf[2]["id"], "reject_match", "Sai nơi", place_id=t.candidate_place_id(nf[2])), E(EXISTING, "remove", "Không được đè mục có sẵn")]
entries.sort(key=lambda e: e["vendor_id"])
new_ids = [e["vendor_id"] for e in entries if e["vendor_id"] != EXISTING]

tmp = tempfile.mkdtemp(prefix="t129-")
bad = []
def run(args, cwd, env=None):
    return subprocess.run([sys.executable] + args, cwd=cwd, env=env or NONET, capture_output=True, text=True, timeout=300)
try:
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    shutil.copy(os.path.join(HERE, "..", "T-124", "lib", "nonet_sitecustomize.py"), os.path.join(nd, "sitecustomize.py"))
    NONET = dict(os.environ, PYTHONPATH=nd, GOOGLE_MAPS_API_KEY="")
    th = os.path.join(tmp, "tohong"); os.makedirs(th)
    shutil.copytree(os.path.join(root, "tools", "scraper"), os.path.join(th, "tools", "scraper"), ignore=shutil.ignore_patterns("__pycache__", "run-logs"))
    sc = os.path.join(th, "tools", "scraper")
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    old_bytes = open(mo, "rb").read(); old = json.loads(old_bytes)
    ex = os.path.join(tmp, "export.json"); json.dump({"count": len(entries), "entries": entries}, open(ex, "w"), ensure_ascii=False)
    hq = os.path.join(tmp, "hq"); os.makedirs(os.path.join(hq, "decisions")); os.makedirs(os.path.join(hq, "eval", "invariants", "planner", "vendor", "images"))
    for f in os.listdir(os.path.join(t.HQ, "decisions")):
        if f.startswith("2026-11-08-adr-048"): shutil.copy(os.path.join(t.HQ, "decisions", f), os.path.join(hq, "decisions", f))
    shutil.copy(os.path.join(HERE, "inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py"), os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py"))
    ladr = os.path.join(hq, "decisions", "2026-11-12-adr-998-nhan-capu.md")
    def write_labels(who="capu", labels=LABEL):
        open(ladr, "w", encoding="utf-8").write("---\ntype: decision\nid: ADR-998\ndecided_by: %s\ncapu_admin_labels: %s\n---\n# Nhãn Capu\n" % (who, labels))
    write_labels()
    base = ["apply_admin_reviews.py", "--state", "HCMC", "--reviews", ex, "--approved-on", "2026-11-12", "--output-dir", os.path.join(sc, "output"), "--hq", hq]
    def refused(name, args, code):
        before = open(mo, "rb").read()
        p = run(args, sc)
        out = p.stdout + p.stderr
        if p.returncode != 2 or ("APPLY_REFUSED " + code) not in out or open(mo, "rb").read() != before:
            bad.append("%s: mong thoát 2 + APPLY_REFUSED %s + file không đổi; thấy thoát %s, đổi=%s, %r" % (name, code, p.returncode, open(mo, "rb").read() != before, out[-120:]))
    def with_ex(mut, name="bad.json"):
        e2 = copy.deepcopy(entries); mut(e2); p2 = os.path.join(tmp, name); json.dump({"entries": e2}, open(p2, "w")); return base[:4] + [p2] + base[5:]
    pick_i = lambda e2: next(i for i, x in enumerate(e2) if x["vendor_id"] != EXISTING)
    refused("entry không by_capu", with_ex(lambda e: e[pick_i(e)].update(by_capu=False)), "not_capu")
    refused("entry thiếu by_capu", with_ex(lambda e: e[pick_i(e)].pop("by_capu")), "not_capu")
    refused("by_capu là chuỗi 'true'", with_ex(lambda e: e[pick_i(e)].update(by_capu="true")), "not_capu")
    refused("có reviewed_by thô", with_ex(lambda e: e[pick_i(e)].update(reviewed_by="user_capu_0001")), "bad_entry")
    refused("nhãn sai dạng (dài)", with_ex(lambda e: e[pick_i(e)].update(reviewer_label="admin:0123456789")), "bad_entry")
    refused("nhãn viết hoa", with_ex(lambda e: e[pick_i(e)].update(reviewer_label=LABEL.upper().replace("ADMIN", "admin"))), "bad_entry")
    refused("reviewed_at không phải UTC Z", with_ex(lambda e: e[pick_i(e)].update(reviewed_at="2026-11-12T10:04:05+07:00")), "bad_entry")
    refused("reviewed_at kèm ký tự lạ (tiêm vào decision)", with_ex(lambda e: e[pick_i(e)].update(reviewed_at="2026-11-12T03:04:05Z\n../x")), "bad_entry")
    refused("reviewed_at có xuống dòng ở cuối", with_ex(lambda e: e[pick_i(e)].update(reviewed_at=AT + "\n")), "bad_entry")
    refused("nhãn có xuống dòng ở cuối", with_ex(lambda e: e[pick_i(e)].update(reviewer_label=LABEL + "\n")), "bad_entry")
    refused("vendor lạ", with_ex(lambda e: e.append(E("marry_ffffffffffff", "remove", "x"))), "unknown_vendor")
    xtra = pick("name_similar", 2)[1]["id"]
    refused("accept_place thiếu đích", with_ex(lambda e: e.append(E(xtra, "accept_place", "x"))), "bad_entry")
    refused("remove mang place_id", with_ex(lambda e: [x.update(place_id="ChIJxxxxxxxxxxxxxxxxxxxx") for x in e if x["action"] == "remove" and x["vendor_id"] != EXISTING]), "bad_entry")
    write_labels(who="chief-of-staff"); refused("ADR nhãn không decided_by: capu", base, "label_not_capu")
    write_labels(labels="admin:00000000"); refused("nhãn của entry không thuộc danh sách Capu", base, "label_not_capu")
    write_labels()
    q = run(base[:-2] + ["--decision", "decisions/x.md"], sc)
    if q.returncode == 0 or open(mo, "rb").read() != old_bytes: bad.append("`--decision` không còn là tham số hợp lệ nhưng lệnh vẫn thành công hoặc đổi file")
    # export trống (không ai bấm): thoát 0, không đổi file, để workflow không mở PR
    em = os.path.join(tmp, "empty.json"); json.dump({"count": 0, "entries": []}, open(em, "w"))
    pe = run(base[:4] + [em] + base[5:], sc)
    if pe.returncode != 0 or "APPLY_OK added=0 skipped=0" not in pe.stdout or open(mo, "rb").read() != old_bytes: bad.append("export trống: mong thoát 0, APPLY_OK added=0 skipped=0, file không đổi; thấy thoát %s %r" % (pe.returncode, (pe.stdout + pe.stderr)[-100:]))
    # (a) chạy thật
    p = run(base, sc)
    if p.returncode != 0:
        bad.append("apply thoát %s: %s" % (p.returncode, (p.stdout + p.stderr).strip()[-200:]))
    else:
        out = p.stdout + p.stderr
        if "SKIP_EXISTING " + EXISTING not in out: bad.append("không in SKIP_EXISTING cho vendor đã có mục")
        if "APPLY_OK added=%d skipped=1" % len(new_ids) not in out: bad.append("không in APPLY_OK added=%d skipped=1: %r" % (len(new_ids), out[-120:]))
        for e in entries:
            if e["vendor_id"] != EXISTING and ("ADDED %s %s %s" % (e["vendor_id"], e["action"], LABEL)) not in out: bad.append("thiếu dòng ADDED cho %s" % e["vendor_id"]); break
        doc = json.load(open(mo, encoding="utf-8")); ov = doc["overrides"]
        if ov[:len(old["overrides"])] != old["overrides"]: bad.append("các mục cũ bị đổi")
        add = ov[len(old["overrides"]):]
        if [e["vendor_id"] for e in add] != new_ids: bad.append("mục mới %r, mong %r (đúng thứ tự vendor_id, bỏ vendor đã có)" % ([e["vendor_id"] for e in add], new_ids))
        src = {e["vendor_id"]: e for e in entries}
        allowed = {"vendor_id", "action", "maps_link", "place_id", "reason", "approved_by", "approved_on", "decision"}
        for e in add:
            s = src.get(e["vendor_id"], {})
            if set(e) - allowed: bad.append("%s có trường ngoài T-110: %s" % (e["vendor_id"], sorted(set(e) - allowed)))
            if e.get("approved_by") != "capu" or e.get("approved_on") != "2026-11-12": bad.append("%s: approved_by/approved_on sai" % e["vendor_id"])
            if e.get("decision") != "admin-review:%s@%s" % (LABEL, AT): bad.append("%s: decision %r, mong admin-review:%s@%s" % (e["vendor_id"], e.get("decision"), LABEL, AT))
            if e.get("action") != s.get("action") or e.get("place_id") != s.get("place_id"): bad.append("%s: action/place_id không theo export" % e["vendor_id"])
            if e.get("reason") != "%s [duyệt qua admin: %s, %s]" % (s.get("reason"), LABEL, AT): bad.append("%s: reason %r" % (e["vendor_id"], e.get("reason")))
        if "user_capu" in open(mo, encoding="utf-8").read(): bad.append("file chứa Clerk user id thô")
        # (b) load_overrides của chính pipeline
        q = run(["-c", "import sys,pathlib; sys.path.insert(0,'.'); from enrichment import overrides as o; d=o.load_overrides(pathlib.Path('output/HCMC')); print('OK',len(d['overrides']))"], sc, env=NONET)
        if q.returncode != 0 or "OK %d" % len(ov) not in q.stdout: bad.append("enrichment.overrides.load_overrides từ chối file: %s" % (q.stderr or q.stdout).strip()[-200:])
        # (c) INV-020 v2 (đề xuất)
        env2 = dict(NONET, TOHONG_REPO=th)
        inv = os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py")
        i1 = run([inv], hq, env=env2)
        if i1.returncode != 0 or not i1.stdout.startswith("PASS"): bad.append("INV-020 v2 đỏ trên kết quả: %s" % i1.stdout.strip()[:160])
        os.remove(ladr)
        i2 = run([inv], hq, env=env2)
        if i2.returncode == 0: bad.append("đối chứng: INV-020 v2 phải ĐỎ khi không có ADR khai nhãn Capu")
        write_labels()
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
