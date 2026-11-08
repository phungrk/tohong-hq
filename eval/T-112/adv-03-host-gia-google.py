#!/usr/bin/env python3
"""T-112 adv-03 (adversary, tầng 3). Spec T-110 Hành vi 5: `link_unreachable` khi "host của URL đích không thuộc `google.*`"; lỗi thì mục không đổi một byte, không đoán.
Input phá (OFFLINE, Google giả): link share.google chuyển tới host KHÔNG phải của Google nhưng có nhãn "google" ở giữa, mà bộ lọc
`(^|\\.)google\\.[a-z]{2,3}(\\.[a-z]{2})?$` trong resolve_overrides.is_google_host nhận nhầm:
  - https://maps.google.zzz.io/maps/place/<tên>/@lat,lng   (ai sở hữu zzz.io đều tạo được subdomain google.zzz.io)
  - https://google.abc.de/maps?query_place_id=ChIJ...        (dạng place_id_param)
  - consent.google.com?continue=https://www.google.xyz.co/maps/place/<tên>  (bóc `continue` ra host giả)
Mong: mỗi mục ra `RESOLVE_ERROR <id> link_unreachable`, 0 lượt Places, mục không đổi. Đối chứng: www.google.com.vn và google.co.uk vẫn được nhận là Google.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-110"))
import _t110 as t

NAME = "Nh%C3%A0+h%C3%A0ng+Gi%E1%BA%A3"
LINKS = {
    "https://share.google/adv03a": {"status": 200, "to": "https://maps.google.zzz.io/maps/place/%s/@10.78,106.70,17z" % NAME},
    "https://share.google/adv03b": {"status": 200, "to": "https://google.abc.de/maps?query_place_id=ChIJ_fake_adv03"},
    "https://share.google/adv03c": {"status": 200, "to": "https://consent.google.com/ml?continue=https%3A%2F%2Fwww.google.xyz.co%2Fmaps%2Fplace%2F" + NAME + "%2F%4010.78%2C106.70&gl=VN"},
    "https://share.google/adv03ok": {"status": 200, "to": "https://www.google.com.vn/maps/place/Nh%C3%A0+h%C3%A0ng+Th%E1%BA%ADt/@10.78,106.70,17z"},
}
PL = {"ChIJ_fake_adv03": t.place("Nhà hàng Giả", "1 Lê Lợi, Bến Thành, Hồ Chí Minh"),
      "ChIJ_real_adv03": t.place("Nhà hàng Thật", "2 Lê Lợi, Bến Thành, Hồ Chí Minh")}
SEARCH = [("Nhà hàng Giả", ["ChIJ_fake_adv03"]), ("Nhà hàng Thật", ["ChIJ_real_adv03"])]
ids = {"https://share.google/adv03a": "t112_ha", "https://share.google/adv03b": "t112_hb", "https://share.google/adv03c": "t112_hc", "https://share.google/adv03ok": "t112_ok"}
vs = [t.vendor(i, "Nhà hàng " + i, "1 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh") for i in ids.values()]
ENT = [t.entry(i, "accept_place", maps_link=l) for l, i in ids.items()]
r = t.Root({"venue": vs, "honeymoon": []})
r.set_overrides(ENT)
rc, out, calls = r.run(t.RESOLVE, t.fixture(PL, SEARCH, LINKS))
bad = []
errs = {l.split()[1]: l.split()[2].rstrip(":") for l in out.splitlines() if l.startswith("RESOLVE_ERROR ")}
ov = {e["vendor_id"]: e for e in r.overrides().get("overrides", [])}
before = {e["vendor_id"]: e for e in copy.deepcopy(ENT)}
for vid in ("t112_ha", "t112_hb", "t112_hc"):
    if errs.get(vid) != "link_unreachable":
        bad.append("%s: host giả google.* mong RESOLVE_ERROR link_unreachable, thấy %r (place_id=%r)" % (vid, errs.get(vid), (ov.get(vid) or {}).get("place_id")))
    if ov.get(vid) != before[vid]:
        bad.append("%s: mục lỗi bị đổi (đã ghi place_id=%r)" % (vid, (ov.get(vid) or {}).get("place_id")))
fake_q = [x for x in calls if x["kind"] in ("search", "details") and ("Giả" in x.get("q", "") or "fake_adv03" in x["url"])]
if fake_q:
    bad.append("gọi Places %d lượt cho tên/place_id lấy từ host giả" % len(fake_q))
if (ov.get("t112_ok") or {}).get("place_id") != "ChIJ_real_adv03":
    bad.append("đối chứng: www.google.com.vn phải được nhận là Google và resolve ra ChIJ_real_adv03; thấy %r" % (ov.get("t112_ok") or {}).get("place_id"))
t.done(bad, "host chứa nhãn 'google' nhưng không thuộc Google bị link_unreachable, không gọi Places; google.com.vn vẫn nhận")
