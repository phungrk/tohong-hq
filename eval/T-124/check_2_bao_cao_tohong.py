#!/usr/bin/env python3
"""T-124 tiêu chí 2 (repo tohong): bước sinh báo cáo enrich từ dữ liệu có sẵn, không gọi Google, tất định, chỉ đọc.
Lệnh (hợp đồng): python3 tools/scraper/build_enrich_report.py --state HCMC --output-dir <thư mục chứa HCMC/> --out <file.json>
Báo cáo: {schema_version:1, state, data_as_of (= max `timestamp` của enrichment_log google_maps trong tập vendor, chuỗi nguyên văn), summary:{total,groups,chips,approvable},
          vendors:[{id,name,category,group,marry:{address,price_min_vnd,price_max_vnd,price_unit,source_url},
                    google:null|{matched,place_id,name,similarity,address,address_match,rating,review_count,photo_count,maps_url,reject_reason},
                    approvable,override:null|{action,approved_on}}]}
Đo trên bản sao dữ liệu thật của repo tohong (TOHONG_REPO hoặc ../tohong): (a) thoát 0 khi mạng bị chặn hoàn toàn (socket ném lỗi) và không đổi byte
nào trong thư mục dữ liệu; (b) summary bằng hàm chuẩn eval/T-124/_t124.py tính trên cùng dữ liệu (tổng 876 = id khác nhau ngoài other/wedding_planner);
(c) vendors đúng thứ tự (category nhà theo thứ tự pipeline, tên, id), mỗi dòng đúng nhóm, approvable, google.place_id (= ứng viên), matched, photo_count,
maps_url = https://www.google.com/maps/place/?q=place_id:<place_id>, marry.address = địa chỉ marry.vn; (d) chạy hai lần cho cùng byte; (e) data_as_of đúng; google.reject_reason = lý do từ chối của dòng audit (null khi đã nhận); (f) dòng có mục trong
manual_overrides.json thì override.action đúng mục đó, còn lại override=null. Thiếu repo tohong: PASS "chưa áp dụng". In PASS hoặc FAIL <lý do>; thoát 0/1."""
import hashlib, json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import _t124 as t

root = t.tohong_root()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
script = os.path.join(root, "tools", "scraper", "build_enrich_report.py")
if not os.path.isfile(script):
    print("FAIL thiếu tools/scraper/build_enrich_report.py trong repo tohong"); sys.exit(1)

def tree_hash(d):
    h = hashlib.sha256()
    for dp, dn, fn in sorted(os.walk(d)):
        dn.sort()
        for f in sorted(fn):
            p = os.path.join(dp, f); h.update(p.encode()); h.update(open(p, "rb").read())
    return h.hexdigest()

tmp = tempfile.mkdtemp(prefix="t124-")
try:
    out_dir = os.path.join(tmp, "output")
    shutil.copytree(os.path.join(root, "tools", "scraper", "output"), out_dir)
    before = tree_hash(out_dir)
    env = dict(os.environ, PYTHONPATH=os.path.join(HERE, "lib", "nonet_sitecustomize_dir"), GOOGLE_MAPS_API_KEY="", PYTHONHASHSEED="0")
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    shutil.copy(os.path.join(HERE, "lib", "nonet_sitecustomize.py"), os.path.join(nd, "sitecustomize.py"))
    env["PYTHONPATH"] = nd
    outs = []
    for i in (1, 2):
        o = os.path.join(tmp, "r%d.json" % i)
        p = subprocess.run([sys.executable, script, "--state", "HCMC", "--output-dir", out_dir, "--out", o], cwd=os.path.join(root, "tools", "scraper"),
                           env=env, capture_output=True, text=True, timeout=300)
        if p.returncode != 0 or not os.path.isfile(o):
            print("FAIL lần chạy %d thoát %s khi mạng bị chặn: %s" % (i, p.returncode, (p.stderr or p.stdout).strip().splitlines()[-1:] )); sys.exit(1)
        outs.append(open(o, "rb").read())
    bad = []
    if tree_hash(out_dir) != before:
        bad.append("thư mục dữ liệu bị đổi byte (bước sinh báo cáo phải chỉ đọc)")
    if outs[0] != outs[1]:
        bad.append("hai lần chạy cho hai file khác byte (phải tất định)")
    rep = json.loads(outs[0])
    facts = t.facts_from_repo(root)
    want = t.summarize(facts)
    if rep.get("schema_version") != 1 or rep.get("state") != "HCMC":
        bad.append("schema_version/state sai: %r %r" % (rep.get("schema_version"), rep.get("state")))
    if rep.get("summary") != want:
        bad.append("summary %r != hàm chuẩn %r" % (rep.get("summary"), want))
    rows = rep.get("vendors") or []
    if [r.get("id") for r in rows] != [f["id"] for f in facts]:
        bad.append("danh sách/thứ tự id khác hàm chuẩn (%d dòng, mong %d)" % (len(rows), len(facts)))
    uni = {f["id"] for f in facts}; stamps = []
    for c in t.ORDER:
        vf = os.path.join(root, "tools", "scraper", "output", "HCMC", c, "vendors.json")
        if os.path.exists(vf):
            for x in json.load(open(vf, encoding="utf-8"))["vendors"]:
                if x["id"] in uni:
                    stamps += [e["timestamp"] for e in (x.get("enrichment_log") or []) if e.get("source") == "google_maps" and e.get("timestamp")]
    if rep.get("data_as_of") != max(stamps):
        bad.append("data_as_of (gốc báo cáo) %r != thời điểm google_maps mới nhất %r" % (rep.get("data_as_of"), max(stamps)))
    ov = {}
    p_ov = os.path.join(root, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
    if os.path.isfile(p_ov):
        ov = {e["vendor_id"]: e for e in json.load(open(p_ov, encoding="utf-8"))["overrides"]}
    n_bad = 0
    for r, f in zip(rows, facts):
        g = t.classify(f)
        gg = r.get("google")
        ok = (r.get("group") == g and r.get("category") == f["category"] and r.get("approvable") is t.approvable(f)
              and (r.get("marry") or {}).get("address") == f["marry_address"]
              and (r.get("override") or {}).get("action") == (ov.get(f["id"]) or {}).get("action")
              and (not ov.get(f["id"]) or (r["override"].get("approved_on") == ov[f["id"]].get("approved_on")))
              and ((gg is None) == (not t.candidate_place_id(f)))
              and (gg is None or (gg.get("place_id") == t.candidate_place_id(f) and gg.get("matched") is bool(f["g"])
                                   and gg.get("photo_count") == f["photos"]
                                   and gg.get("reject_reason") == (None if f["g"] else (f["audit"] or {}).get("reject_reason"))
                                   and gg.get("maps_url") == "https://www.google.com/maps/place/?q=place_id:" + gg["place_id"])))
        if not ok:
            n_bad += 1
            if n_bad == 1:
                bad.append("dòng %s sai (nhóm/ứng viên/ảnh/override/địa chỉ marry): %s" % (f["id"], json.dumps(r, ensure_ascii=False)[:200]))
    if n_bad > 1:
        bad.append("tổng %d dòng sai" % n_bad)
    if not any(r.get("override") for r in rows) and ov:
        bad.append("manual_overrides.json có %d mục nhưng không dòng nào có override" % len(ov))
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS")
    sys.exit(1 if bad else 0)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
