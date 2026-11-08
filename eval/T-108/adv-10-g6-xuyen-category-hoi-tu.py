#!/usr/bin/env python3
"""T-108 adv-10 (adversary, Code Gate v8, 2026-11-08). Mock, KHÔNG gọi Google (mọi HTTP bị chặn, không khoá API).
v8 chọn: vendor ở category khác chỉ THAM GIA nhóm G6, bị hạ ở lần chạy của chính category đó. Spec T-106 v4.1 G6: "mọi vendor trong nhóm đó bị từ chối",
"không phụ thuộc thứ tự". Eval chặn hệ quả: sau khi mỗi category đã chạy lệnh enrich (offline, 0 lượt) MỘT lần, kết quả cuối phải như nhau dù chạy
venue trước hay photography trước, và cả hai vendor của nhóm đều bị hạ shared_place_id (không ai còn place_id/ảnh Google), mỗi bên có audit
low_confidence + reject_reason=shared_place_id trong file audit của category mình. Chạy thêm lượt nữa: không đổi.
Ca: venue V (gốc 100 Lê Lợi, conf 0,9) + photography X (id khác, gốc 'Khu đô thị Sala, Thủ Đức' không rút được, conf 0,97), chung place_id.
In PASS hoặc FAIL <lý do>; thoát 0/1. Cần TOHONG_REPO."""
import contextlib, io, json, os, sys
from unittest import mock
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-106"))
import _common as c  # noqa: E402
import _adv_harness as h  # noqa: E402

P = "ChIJ_adv10_shared"
GA = "100 Lê Lợi, Bến Thành, Hồ Chí Minh"


def rec(i, name, src, conf, cat):
    r = h.vendor(i, name, GA, (cat,))
    r["contact"]["address_source"] = src
    r["google_photos"] = [{"uri": "https://lh3.googleusercontent.com/adv10-" + i, "attribution": "tác giả"}]
    r["geo_confidence"] = "exact"
    r["enrichment_log"] = [{"source": "google_maps", "timestamp": "2026-11-08T04:03:36", "matched_name": "Nơi Lê Lợi", "confidence": conf,
                            "place_id": P, "formatted_address": GA, "address_match": c.address_match(src, GA), "changes": {"address": GA}}]
    return r


def setup():
    root = h.make_root({"venue": [rec("adv10_V", "Nhà hàng Lê Lợi", "100 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh", 0.9, "venue")],
                        "photography": [rec("adv10_X", "Studio Lê Lợi", "Khu đô thị Sala, Thủ Đức, Thành phố Hồ Chí Minh", 0.97, "photography")]})
    for cat, i, conf in (("venue", "adv10_V", 0.9), ("photography", "adv10_X", 0.97)):
        (root / "output" / "HCMC" / cat / "enrichment-audit.json").write_text(json.dumps([{"vendor_id": i, "status": "enriched", "matched_name": "Nơi Lê Lợi",
                                                                                          "confidence": conf, "place_id": P, "formatted_address": GA}]), encoding="utf-8")
    return root


def run(root, cat):
    def boom(*a, **k):
        raise AssertionError("eval cấm HTTP")
    env = {k: v for k, v in os.environ.items() if k != "GOOGLE_MAPS_API_KEY"}
    with mock.patch.object(h.enrich, "SCRIPT_DIR", root), mock.patch.object(h.enrich, "OUTPUT_DIR", root / "output"), \
            mock.patch("enrichment.google_maps.requests.post", side_effect=boom), mock.patch("requests.get", side_effect=boom), \
            mock.patch.object(sys, "argv", ["enrich.py", "--state", "HCMC", "--category", cat, "--budget", "5.0"]), \
            mock.patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()):
        try:
            h.enrich.main()
        except SystemExit:
            pass


def state(root):
    out = {}
    for cat, i in (("venue", "adv10_V"), ("photography", "adv10_X")):
        v = next(x for x in h.vendors_in(root, cat) if x["id"] == i)
        a = h.audit(root, cat).get(i) or {}
        out[i] = (bool(c.google_log(v)), bool(v.get("google_photos")), a.get("status"), a.get("reject_reason"))
    return out


bad, finals = [], {}
for order in (("venue", "photography"), ("photography", "venue")):
    root = setup()
    for cat in order:
        run(root, cat)
    s = state(root)
    finals[order] = s
    for i, (pid, ph, st, rr) in s.items():
        if pid or ph or st != "low_confidence" or rr != "shared_place_id":
            bad.append("thứ tự %s: %s place_id=%s ảnh=%s audit=%r/%r (mong hạ shared_place_id)" % ("→".join(order), i, pid, ph, st, rr))
    for cat in order:
        run(root, cat)
    if state(root) != s:
        bad.append("thứ tự %s: chạy thêm lượt làm đổi kết quả" % "→".join(order))
if len(set(map(str, finals.values()))) != 1:
    bad.append("kết quả cuối phụ thuộc thứ tự chạy category: %r" % finals)
if bad:
    c.fail("G6 xuyên category không hội tụ: " + "; ".join(bad))
c.ok("G6 xuyên category hội tụ: sau khi mỗi category chạy một lần (hai thứ tự), cả V và X bị hạ shared_place_id; chạy thêm không đổi")
