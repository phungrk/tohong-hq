#!/usr/bin/env python3
"""T-129 tiêu chí 3 (repo tohong): từ export có CHỮ KÝ Ed25519 của back tới manual_overrides.json, kiểm chữ ký bằng khoá công khai trong chính repo tohong (không cần tohong-hq); INV-015/021 và INV-020 v2 xanh.
Lệnh (hợp đồng, thay hợp đồng T-124 #7; `--decision`, `--approved-on`, `--hq` không còn):
  python3 tools/scraper/apply_admin_reviews.py --state HCMC --reviews <export.json> [--keys <admin_review_keys.json>] [--output-dir <thư mục chứa HCMC/>]
Khoá: tools/scraper/admin_review_keys.json = {"schema_version":1,"keys":{"<key_id>":"<base64 32 byte khoá công khai Ed25519>"}} (chép từ ADR do Capu duyệt; INV-020 v2 buộc khớp ADR). Repo thật phải có file này (JSON hợp lệ, keys là object).
Export (back sinh): {exported_at, count, waiting_capu, entries:[{vendor_id, action, [place_id|maps_link], reason, reviewer_label:"admin:<8 hex>", reviewed_at:"<ISO UTC Z>", by_capu:true, key_id, sig}]}; sig xem eval/T-129/capu_decision.py.
Mỗi entry thêm một mục T-110 (không trường lạ), theo thứ tự vendor_id SAU các mục sẵn có:
  {vendor_id, action, [maps_link|place_id], reason="<reason> [duyệt qua admin: <label>, <reviewed_at>]", approved_by:"capu", approved_on=<ngày UTC của reviewed_at> (KHÔNG phải ngày chạy), decision:"admin-review:<key_id>:<label>@<reviewed_at>:<sig>"}.
Vendor đã có mục: giữ nguyên byte, in "SKIP_EXISTING <id>". Thành công in "ADDED <vendor_id> <action> <label>" cho mỗi mục thêm và "APPLY_OK added=N skipped=M". Export trống: APPLY_OK added=0 skipped=0, file không đổi.
Từ chối cả lượt (thoát 2, file không đổi byte, "APPLY_REFUSED <mã> [<id>]"): not_capu (by_capu không phải boolean true); bad_entry (có reviewed_by, nhãn/giờ/sig sai dạng — khớp TOÀN chuỗi, không xuống dòng thừa —, reason chứa Clerk id thô, trường lạ trong T-110, vendor trùng);
  unknown_key (key_id không có trong file khoá); bad_signature (sửa bất kỳ trường đã ký, chữ ký của khoá khác, chữ ký rác — kiểm cả với vendor đã có mục); unknown_vendor; bad_overrides_file; bad_keys_file.
Chạy lại cùng đầu vào: file giữ nguyên byte. Không mạng. enrichment.overrides.load_overrides đọc được; dạng decisions/<tên>.md vẫn hợp lệ.
Đo trên bản sao dữ liệu thật: (a) 8 entry ký đúng (3 Approve, remove, temporarily_closed, reject_match, 1 vendor đã có mục ADR-048) với reviewed_at KHÁC NGÀY nhau -> 6 mục mới, 1 bỏ qua, mục cũ giữ byte, approved_on từng mục = ngày bấm;
(b) load_overrides; (c) INV-020 v2 PASS trong HQ giả có ADR khai khoá và ĐỎ khi ADR không khai; (d) từ chối đúng các ca xấu, file không đổi; (e) chạy lại không đổi byte; (f) resolve_overrides.py --dry-run đếm đúng; mạng bị chặn;
(h) resolve_overrides.py THẬT (ghi file; Google giả, không mạng) trên mục accept_place có maps_link đã ký: INV-020 v2 vẫn xanh; place_id lệch resolved.place_id thì đỏ; (g) INV-015 (v1 nguyên văn và v2) xanh sau khi áp; INV-021 nguyên văn xanh trước khi áp và sau khi áp chỉ đỏ vì chính các vendor vừa thêm (file duyệt tay đi trước dữ liệu tới lần resolve/enrich kế).
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import base64, copy, importlib.util, json, os, re, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-124"))
import _t124 as t
_sp = importlib.util.spec_from_file_location("cd", os.path.join(HERE, "capu_decision.py")); CD = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(CD)
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

root = t.tohong_root()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
if not os.path.isfile(os.path.join(root, "tools", "scraper", "apply_admin_reviews.py")):
    print("FAIL thiếu tools/scraper/apply_admin_reviews.py trong repo tohong (đợi PR T-125 merge)"); sys.exit(1)

b64 = lambda b: base64.b64encode(b).decode()
b64u = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
K1 = Ed25519PrivateKey.generate(); P1 = b64(K1.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))
KX = Ed25519PrivateKey.generate(); PX = b64(KX.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))
LABEL = "admin:" + "2be188f6"
kf = os.path.join(root, "tools", "scraper", "admin_review_keys.json")
try:
    assert isinstance(json.load(open(kf, encoding="utf-8")).get("keys"), dict)
except (OSError, ValueError, AssertionError, AttributeError):
    print("FAIL repo tohong thiếu tools/scraper/admin_review_keys.json hợp lệ ({schema_version:1, keys:{…}})"); sys.exit(1)

snap = t.facts_from_repo(root)
def pick(group, n=1):
    return [f for f in snap if t.classify(f) == group and t.candidate_place_id(f)][:n]
ap = pick("name_similar") + pick("name_same_addr_diff") + pick("unverified")
nf = pick("not_found", 3)
EXISTING = "marry_d4380c0b3cf3"
DAYS = ["2026-11-10", "2026-11-11", "2026-11-12"]
def E(vid, action, reason, i, key=K1, kid="k1", **kw):
    at = "%sT0%d:04:05.678Z" % (DAYS[i % 3], i % 9)
    d = {"vendor_id": vid, "action": action, "reason": reason, "reviewer_label": LABEL, "reviewed_at": at, "by_capu": True, "key_id": kid}
    d.update(kw)
    d["sig"] = b64u(key.sign(CD.payload(kid, vid, action, d.get("place_id"), d.get("maps_link"), reason, LABEL, at)))
    return d
raw = [(f["id"], "accept_place", "Admin duyệt nhận khớp Google", {"place_id": t.candidate_place_id(f)}) for f in ap]
raw += [(nf[0]["id"], "remove", "Không có trên Maps", {}), (nf[1]["id"], "temporarily_closed", "Maps ghi tạm đóng", {}),
        (nf[2]["id"], "reject_match", "Sai nơi", {"place_id": t.candidate_place_id(nf[2])}), (EXISTING, "remove", "Không được đè mục có sẵn", {})]
raw.sort(key=lambda x: x[0])
entries = [E(v, a, r, i, **kw) for i, (v, a, r, kw) in enumerate(raw)]
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
    keys_path = os.path.join(sc, "admin_review_keys.json")
    json.dump({"schema_version": 1, "keys": {"k1": P1}}, open(keys_path, "w"))
    mo = os.path.join(sc, "output", "HCMC", "manual_overrides.json")
    old_bytes = open(mo, "rb").read(); old = json.loads(old_bytes)
    ex = os.path.join(tmp, "export.json")
    def write_ex(es, path=ex): json.dump({"exported_at": "2026-11-12T10:00:00.000Z", "count": len(es), "waiting_capu": 0, "entries": es}, open(path, "w"), ensure_ascii=False); return path
    write_ex(entries)
    base = ["apply_admin_reviews.py", "--state", "HCMC", "--reviews", ex, "--output-dir", os.path.join(sc, "output")]
    def refused(name, args, code):
        before = open(mo, "rb").read()
        p = run(args, sc)
        out = p.stdout + p.stderr
        if p.returncode != 2 or ("APPLY_REFUSED " + code) not in out or open(mo, "rb").read() != before:
            bad.append("%s: mong thoát 2 + APPLY_REFUSED %s + file không đổi; thấy thoát %s, đổi=%s, %r" % (name, code, p.returncode, open(mo, "rb").read() != before, out[-120:]))
    def with_ex(mut):
        e2 = copy.deepcopy(entries); mut(e2); return base[:4] + [write_ex(e2, os.path.join(tmp, "bad.json"))] + base[5:]
    pi = lambda e2: next(i for i, x in enumerate(e2) if x["vendor_id"] != EXISTING)
    ai = lambda e2: next(i for i, x in enumerate(e2) if x["action"] == "accept_place")
    refused("entry không by_capu", with_ex(lambda e: e[pi(e)].update(by_capu=False)), "not_capu")
    refused("thiếu by_capu", with_ex(lambda e: e[pi(e)].pop("by_capu")), "not_capu")
    refused("by_capu là chuỗi 'true'", with_ex(lambda e: e[pi(e)].update(by_capu="true")), "not_capu")
    refused("có reviewed_by thô", with_ex(lambda e: e[pi(e)].update(reviewed_by="user_capu_0001")), "bad_entry")
    refused("reason chứa Clerk id thô (dù ký đúng)", with_ex(lambda e: e.__setitem__(pi(e), E(e[pi(e)]["vendor_id"], e[pi(e)]["action"], "x user_2abcDEFghiJKL", 0, **({"place_id": e[pi(e)]["place_id"]} if "place_id" in e[pi(e)] else {})))), "bad_entry")
    refused("nhãn sai dạng", with_ex(lambda e: e[pi(e)].update(reviewer_label="admin:0123456789")), "bad_entry")
    refused("reviewed_at không phải UTC Z", with_ex(lambda e: e[pi(e)].update(reviewed_at="2026-11-12T10:04:05+07:00")), "bad_entry")
    refused("reviewed_at có xuống dòng ở cuối", with_ex(lambda e: e[pi(e)].update(reviewed_at=e[pi(e)]["reviewed_at"] + "\n")), "bad_entry")
    refused("nhãn có xuống dòng ở cuối", with_ex(lambda e: e[pi(e)].update(reviewer_label=LABEL + "\n")), "bad_entry")
    refused("sig sai độ dài", with_ex(lambda e: e[pi(e)].update(sig="abc")), "bad_entry")
    refused("thiếu sig", with_ex(lambda e: e[pi(e)].pop("sig")), "bad_entry")
    refused("key_id không có trong file khoá", with_ex(lambda e: e.__setitem__(pi(e), E(e[pi(e)]["vendor_id"], e[pi(e)]["action"], e[pi(e)]["reason"], 0, kid="k9", **({"place_id": e[pi(e)]["place_id"]} if "place_id" in e[pi(e)] else {})))), "unknown_key")
    refused("ký bằng khoá kẻ tấn công (key_id k1)", with_ex(lambda e: e.__setitem__(pi(e), E(e[pi(e)]["vendor_id"], e[pi(e)]["action"], e[pi(e)]["reason"], 0, key=KX, **({"place_id": e[pi(e)]["place_id"]} if "place_id" in e[pi(e)] else {})))), "bad_signature")
    refused("chữ ký rác 86 ký tự", with_ex(lambda e: e[pi(e)].update(sig="A" * 86)), "bad_signature")
    refused("sửa reason sau khi ký", with_ex(lambda e: e[pi(e)].update(reason=e[pi(e)]["reason"] + " đã sửa")), "bad_signature")
    refused("sửa action sau khi ký", with_ex(lambda e: e[pi(e)].update(action="temporarily_closed") if e[pi(e)]["action"] == "remove" else e[pi(e)].update(action="remove", place_id=None) or e[pi(e)].pop("place_id")), "bad_signature")
    refused("sửa place_id sau khi ký", with_ex(lambda e: e[ai(e)].update(place_id="ChIJxxxxxxxxxxxxxxxxxxxxxxxxx")), "bad_signature")
    refused("sửa reviewed_at (đổi ngày) sau khi ký", with_ex(lambda e: e[pi(e)].update(reviewed_at="2026-11-01T01:01:01Z")), "bad_signature")
    refused("sửa nhãn sau khi ký", with_ex(lambda e: e[pi(e)].update(reviewer_label="admin:00000000")), "bad_signature")
    refused("hoán chữ ký giữa hai entry", with_ex(lambda e: (lambda a, b: (e[a].update(sig=e[b]["sig"]), e[b].update(sig=e[a]["sig"])))(*[i for i, x in enumerate(e) if x["vendor_id"] != EXISTING][:2])), "bad_signature")
    refused("chữ ký sai ở vendor đã có mục (vẫn từ chối cả lượt)", with_ex(lambda e: next(x for x in e if x["vendor_id"] == EXISTING).update(sig="A" * 86)), "bad_signature")
    refused("vendor lạ (ký đúng)", with_ex(lambda e: e.append(E("marry_ffffffffffff", "remove", "x", 0))), "unknown_vendor")
    refused("vendor trùng trong export", with_ex(lambda e: e.append(copy.deepcopy(e[pi(e)]))), "bad_entry")
    xtra = pick("name_similar", 2)[1]["id"]
    refused("accept_place thiếu đích (ký đúng)", with_ex(lambda e: e.append(E(xtra, "accept_place", "x", 0))), "bad_entry")
    shutil.copy(keys_path, keys_path + ".ok"); open(keys_path, "w").write("không phải json")
    refused("file khoá hỏng", base, "bad_keys_file"); shutil.move(keys_path + ".ok", keys_path)
    q = run(base + ["--decision", "decisions/x.md"], sc)
    if q.returncode == 0 or open(mo, "rb").read() != old_bytes: bad.append("`--decision` không còn là tham số hợp lệ nhưng lệnh vẫn thành công hoặc đổi file")
    q = run(base + ["--approved-on", "2026-11-12"], sc)
    if q.returncode == 0 or open(mo, "rb").read() != old_bytes: bad.append("`--approved-on` không còn là tham số hợp lệ (ngày lấy từ reviewed_at) nhưng lệnh vẫn thành công hoặc đổi file")
    # export trống
    em = write_ex([], os.path.join(tmp, "empty.json"))
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
            if e.get("approved_by") != "capu" or e.get("approved_on") != s["reviewed_at"][:10]: bad.append("%s: approved_by/approved_on sai (mong ngày bấm %s, thấy %r)" % (e["vendor_id"], s["reviewed_at"][:10], e.get("approved_on")))
            if e.get("decision") != "admin-review:k1:%s@%s:%s" % (LABEL, s["reviewed_at"], s["sig"]): bad.append("%s: decision %r" % (e["vendor_id"], e.get("decision")))
            if e.get("action") != s.get("action") or e.get("place_id") != s.get("place_id"): bad.append("%s: action/place_id không theo export" % e["vendor_id"])
            if e.get("reason") != "%s [duyệt qua admin: %s, %s]" % (s.get("reason"), LABEL, s["reviewed_at"]): bad.append("%s: reason %r" % (e["vendor_id"], e.get("reason")))
        if len({e["approved_on"] for e in add}) < 2: bad.append("eval lỗi: approved_on không đa dạng")
        if "user_capu" in open(mo, encoding="utf-8").read(): bad.append("file chứa Clerk user id thô")
        # (b) load_overrides của chính pipeline
        q = run(["-c", "import sys,pathlib; sys.path.insert(0,'.'); from enrichment import overrides as o; d=o.load_overrides(pathlib.Path('output/HCMC')); print('OK',len(d['overrides']))"], sc, env=NONET)
        if q.returncode != 0 or "OK %d" % len(ov) not in q.stdout: bad.append("enrichment.overrides.load_overrides từ chối file: %s" % (q.stderr or q.stdout).strip()[-200:])
        # (c) INV-020 v2 (đề xuất) trong HQ giả có ADR khai khoá
        env2 = dict(NONET, TOHONG_REPO=th)
        hq = os.path.join(tmp, "hq"); os.makedirs(os.path.join(hq, "decisions")); os.makedirs(os.path.join(hq, "eval", "invariants", "planner", "vendor", "images")); os.makedirs(os.path.join(hq, "eval", "lib"))
        shutil.copy(os.path.join(HERE, "capu_decision.py"), os.path.join(hq, "eval", "lib", "capu_decision.py"))
        for f in os.listdir(os.path.join(t.HQ, "decisions")):
            if f.startswith("2026-11-08-adr-048"): shutil.copy(os.path.join(t.HQ, "decisions", f), os.path.join(hq, "decisions", f))
        adr = os.path.join(hq, "decisions", "2026-11-12-adr-998-khoa.md")
        open(adr, "w", encoding="utf-8").write("---\ntype: decision\nid: ADR-998\ndecided_by: capu\ncapu_signing_keys: k1=%s\n---\n" % P1)
        inv = os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv-020.py")
        shutil.copy(os.path.join(HERE, "inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py"), inv)
        i1 = run([inv], hq, env=env2)
        if i1.returncode != 0 or not i1.stdout.startswith("PASS"): bad.append("INV-020 v2 đỏ trên kết quả: %s" % i1.stdout.strip()[:160])
        os.remove(adr)
        if run([inv], hq, env=env2).returncode == 0: bad.append("đối chứng: INV-020 v2 phải ĐỎ khi không có ADR khai khoá")
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
        # (g) INV-015 (v1, v2) nguyên văn xanh sau khi áp; INV-021 nguyên văn xanh TRƯỚC khi áp và, sau khi áp, chỉ đỏ vì chính các vendor vừa thêm
        #     (đặc tính sẵn có của T-110: file duyệt tay đi trước dữ liệu cho tới lần resolve/enrich kế; spec ghi rõ khoảng đỏ này)
        ib = os.path.join(t.HQ, "eval", "invariants", "planner", "vendor", "images")
        for path in (os.path.join(ib, "inv-015-nhan-khop-google-co-cong.py"), os.path.join(HERE, "inv-proposed-inv-015-v2-mien-theo-quyet-dinh-capu.py")):
            x = run([path], t.HQ, env=env2)
            if x.returncode != 0: bad.append("%s đỏ trên dữ liệu sau khi áp: %s" % (os.path.basename(path)[:7], x.stdout.strip()[:140]))
        i21 = os.path.join(ib, "inv-021-du-lieu-khop-file-duyet-tay.py")
        open(mo, "wb").write(old_bytes)
        x = run([i21], t.HQ, env=env2)
        if x.returncode != 0: bad.append("INV-021 đỏ trên dữ liệu trước khi áp (lệch sẵn có, không phải do T-129): %s" % x.stdout.strip()[:140])
        open(mo, "wb").write(b1)
        x = run([i21], t.HQ, env=env2)
        mm = re.search(r"vd (marry_[0-9a-f]+)", x.stdout)
        if x.returncode == 0 or not mm or mm.group(1) not in new_ids: bad.append("INV-021 sau khi áp: mong đỏ chỉ vì vendor vừa thêm, thấy %r" % x.stdout.strip()[:140])
        # (h) resolve THẬT (ghi file; Google giả, không mạng) trên mục accept_place có maps_link đã ký: INV-020 v2 vẫn xanh; giả mạo place_id lệch resolved bị bắt
        fg = os.path.join(tmp, "fg"); os.makedirs(fg); shutil.copy(os.path.join(HERE, "lib", "fake_google_sitecustomize.py"), os.path.join(fg, "sitecustomize.py"))
        FG = dict(os.environ, PYTHONPATH=fg, GOOGLE_MAPS_API_KEY="fake-key-khong-goi-mang")
        open(mo, "wb").write(old_bytes)
        lv = pick("name_similar", 3)[2]["id"]
        le = E(lv, "accept_place", "Gắn đúng nơi", 1, maps_link="https://share.google/abcFAKE")
        lex = write_ex([le], os.path.join(tmp, "link.json"))
        pa = run(base[:4] + [lex] + base[5:], sc)
        if pa.returncode != 0 or "APPLY_OK added=1" not in pa.stdout: bad.append("(h) apply mục link thất bại: %r" % (pa.stdout + pa.stderr)[-150:])
        else:
            before = json.load(open(mo, encoding="utf-8"))["overrides"]
            pr_ = run(["resolve_overrides.py", "--state", "HCMC"], sc, env=FG)
            if pr_.returncode != 0 or "RESOLVED %s ChIJFAKE" % lv not in pr_.stdout: bad.append("(h) resolve_overrides.py (Google giả) không resolve mục link: thoát %s %r" % (pr_.returncode, (pr_.stdout + pr_.stderr)[-200:]))
            else:
                after = json.load(open(mo, encoding="utf-8"))["overrides"]
                mine = next(x for x in after if x["vendor_id"] == lv)
                if not mine.get("place_id") or (mine.get("resolved") or {}).get("place_id") != mine["place_id"] or mine.get("maps_link") != "https://share.google/abcFAKE": bad.append("(h) mục sau resolve không có place_id/resolved/maps_link như mong đợi: %r" % mine)
                if [x for x in after if x["vendor_id"] != lv] != [x for x in before if x["vendor_id"] != lv]: bad.append("(h) resolve đổi mục khác")
                adr2 = os.path.join(hq, "decisions", "2026-11-12-adr-998-khoa.md")
                open(adr2, "w", encoding="utf-8").write("---\ntype: decision\nid: ADR-998\ndecided_by: capu\ncapu_signing_keys: k1=%s\n---\n" % P1)
                i2 = run([inv], hq, env=env2)
                if i2.returncode != 0 or not i2.stdout.startswith("PASS"): bad.append("(h) INV-020 v2 đỏ SAU resolve thật trên mục link đã ký: %s" % i2.stdout.strip()[:160])
                forged = json.load(open(mo, encoding="utf-8")); fm_ = next(x for x in forged["overrides"] if x["vendor_id"] == lv); fm_["place_id"] = "ChIJFORGEDxxxxxxxxxxxx"
                json.dump(forged, open(mo, "w"), ensure_ascii=False)
                i3 = run([inv], hq, env=env2)
                if i3.returncode == 0: bad.append("(h) đối chứng: place_id lệch resolved.place_id phải làm INV-020 v2 ĐỎ")
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
    sys.exit(1 if bad else 0)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
