#!/usr/bin/env python3
"""Nguồn: T-108 / spec T-106 v4.1 (products/T-106-enrich-venue.md, Hành vi 2 cổng G6: "trong các vendor đã qua G1 đến G5 của cùng thành phố (MỌI category
file; cùng id ở nhiều category là MỘT vendor) ... mọi vendor trong nhóm đó bị từ chối"; "không phụ thuộc thứ tự"); rút từ eval đối kháng
eval/T-108/adv-08-g6-xuyen-category.py (đỏ trên tohong 618ae09, xanh trên ddc82d0) gộp adv-10-g6-xuyen-category-hoi-tu.py (adversary, Code Gate v7-v8,
2026-11-08), Chief of Staff đồng ý 2026-11-08.
CHỜ MERGE (ADR-028): chạy code enrich.py/settle.py của PR tohong#72 (chưa merge); chuyển vào eval/invariants/planner/vendor/images/ khi #72 merge.
INV-019 · G6 xét vendor của mọi category file cùng thành phố, và hội tụ không phụ thuộc thứ tự chạy category.
Dựng output tạm (không đụng dữ liệu thật): venue V (gốc '100 Lê Lợi, Quận 1', Google '100 Lê Lợi, Bến Thành, Hồ Chí Minh', conf 0,9: qua G1-G5) và photography X
(id khác, bản ghi mới có address_source 'Khu đô thị Sala, Thủ Đức' không rút được số nhà, conf 0,97 >= 0,95: qua G1-G5), CHUNG một place_id. Chạy đúng lệnh
enrich.py --state HCMC --category <cat> --budget 5.0 OFFLINE (mọi HTTP bị chặn, không đặt GOOGLE_MAPS_API_KEY).
  (1) Đối chứng: V một mình vẫn được nhận (còn place_id).
  (2) Chạy --category venue: V bị hạ shared_place_id (không place_id, không google_photos, audit venue low_confidence + reject_reason=shared_place_id,
      có dòng venue/review-needed.csv).
  (3) Hội tụ: chạy mỗi category một lần theo hai thứ tự (venue→photography, photography→venue): cả V và X bị hạ shared_place_id trong audit category của mình,
      kết quả cuối như nhau; chạy thêm một lượt không đổi gì.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Repo chưa có tools/scraper/enrichment/settle.py: PASS 'chưa áp dụng'. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import atexit, contextlib, csv, io, json, os, shutil, sys, tempfile
from pathlib import Path
from unittest import mock


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "eval", "invariants")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


HQ = _hq()
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t or not os.path.isfile(os.path.join(t, "tools", "scraper", "enrichment", "settle.py")):
    print("PASS chưa áp dụng (không thấy repo tohong có tools/scraper/enrichment/settle.py)"); sys.exit(0)
S = os.path.join(t, "tools", "scraper")
sys.path.insert(0, S)
_cwd = os.getcwd()
os.chdir(S)
try:
    import enrich  # noqa: E402
finally:
    os.chdir(_cwd)

P = "ChIJ_inv019_shared"
GA = "100 Lê Lợi, Bến Thành, Hồ Chí Minh"
V = ("inv019_V", "venue", "Nhà hàng Lê Lợi", "100 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", 0.9)
X = ("inv019_X", "photography", "Studio Lê Lợi", "Khu đô thị Sala, Thủ Đức, Thành phố Hồ Chí Minh", 0.97)


def rec(vid, cat, name, src, conf):
    return {"id": vid, "name": name, "categories": [cat], "city": "HCMC", "latitude": 10.77, "longitude": 106.7, "geo_confidence": "exact",
            "contact": {"address": GA, "address_source": src}, "reviews": [],
            "google_photos": [{"uri": "https://lh3.googleusercontent.com/inv019-" + vid, "attribution": "tác giả"}],
            "enrichment_log": [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": "Nơi Lê Lợi", "confidence": conf,
                                "place_id": P, "formatted_address": GA, "changes": {"address": GA}}]}


def setup(members):
    root = Path(tempfile.mkdtemp(prefix="inv019-"))
    atexit.register(shutil.rmtree, root, True)
    for vid, cat, name, src, conf in members:
        d = root / "output" / "HCMC" / cat
        d.mkdir(parents=True)
        (d / "vendors.json").write_text(json.dumps({"vendors": [rec(vid, cat, name, src, conf)]}, ensure_ascii=False), encoding="utf-8")
        (d / "enrichment-audit.json").write_text(json.dumps([{"vendor_id": vid, "status": "enriched", "matched_name": "Nơi Lê Lợi", "confidence": conf,
                                                              "place_id": P, "formatted_address": GA}], ensure_ascii=False), encoding="utf-8")
    return root


def run(root, cat):
    def boom(*a, **k):
        raise AssertionError("bất biến cấm HTTP")
    env = {k: v for k, v in os.environ.items() if k != "GOOGLE_MAPS_API_KEY"}
    with mock.patch.object(enrich, "SCRIPT_DIR", root), mock.patch.object(enrich, "OUTPUT_DIR", root / "output"), \
            mock.patch("enrichment.google_maps.requests.post", side_effect=boom), mock.patch("requests.get", side_effect=boom), \
            mock.patch.object(sys, "argv", ["enrich.py", "--state", "HCMC", "--category", cat, "--budget", "5.0"]), \
            mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        try:
            enrich.main()
        except SystemExit:
            pass


def state(root, members):
    out = {}
    for vid, cat, *_ in members:
        d = root / "output" / "HCMC" / cat
        raw = json.loads((d / "vendors.json").read_text(encoding="utf-8"))
        v = next(x for x in (raw.get("vendors", raw) if isinstance(raw, dict) else raw) if x["id"] == vid)
        has_pid = any(e.get("source") == "google_maps" and e.get("place_id") for e in v.get("enrichment_log") or [])
        ap = d / "enrichment-audit.json"
        a = {r.get("vendor_id"): r for r in json.loads(ap.read_text(encoding="utf-8"))}.get(vid, {}) if ap.exists() else {}
        rp = d / "review-needed.csv"
        rv = any((r.get("id") or "").strip() == vid for r in csv.DictReader(open(rp, encoding="utf-8-sig", newline=""))) if rp.exists() else False
        out[vid] = (has_pid, bool(v.get("google_photos")), a.get("status"), a.get("reject_reason"), rv)
    return out


DEMOTED = (False, False, "low_confidence", "shared_place_id", True)
bad = []
root = setup([V]); run(root, "venue")
if not state(root, [V])[V[0]][0]:
    bad.append("(1) đối chứng hỏng: V một mình lẽ ra được nhận nhưng mất place_id")
root = setup([V, X]); run(root, "venue")
s = state(root, [V, X])[V[0]]
if s != DEMOTED:
    bad.append("(2) chạy --category venue: V (place_id=%s, ảnh=%s, audit=%r/%r, review=%s), mong hạ shared_place_id vì photography X chung place_id "
               "với địa chỉ gốc khác (G6 phải xét mọi category file)" % s)
finals = {}
for order in (("venue", "photography"), ("photography", "venue")):
    root = setup([V, X])
    for cat in order:
        run(root, cat)
    s = state(root, [V, X]); finals[order] = s
    for vid, st in s.items():
        if st != DEMOTED:
            bad.append("(3) thứ tự %s: %s (place_id=%s, ảnh=%s, audit=%r/%r, review=%s), mong hạ shared_place_id" % (("→".join(order), vid) + st))
    for cat in order:
        run(root, cat)
    if state(root, [V, X]) != s:
        bad.append("(3) thứ tự %s: chạy thêm một lượt làm đổi kết quả" % "→".join(order))
if len({json.dumps(v, sort_keys=True) for v in finals.values()}) != 1:
    bad.append("(3) kết quả cuối phụ thuộc thứ tự chạy category")
if bad:
    print("FAIL G6 xuyên category:\n  " + "\n  ".join(bad)); sys.exit(1)
print("PASS G6 xét mọi category file: V bị hạ shared_place_id khi photography X chung place_id với địa chỉ gốc khác; hai thứ tự chạy category hội tụ, chạy thêm không đổi")
