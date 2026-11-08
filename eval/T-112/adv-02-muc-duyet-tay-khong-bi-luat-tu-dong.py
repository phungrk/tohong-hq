#!/usr/bin/env python3
"""T-112 adv-02 (adversary, tầng 3). Spec T-110:
  Hành vi 2 `reject_match`: "Vendor không bao giờ bị Text Search lại ... Capu muốn nhận place_id khác thì dùng accept_place"; Hành vi 3.1: Text Search cho vendor
    đủ điều kiện "(trừ vendor có mục accept_place đã áp, remove, reject_match ...)".
  Hành vi 2 `remove`: "Vendor có bất kỳ mục duyệt tay nào khác `remove` không bao giờ bị luật tự động gỡ ...; chỉ mục `remove` của Capu gỡ vendor có mục."
Input phá (OFFLINE, Google giả):
  (a) J có mục reject_match place_id=PJ nhưng CHƯA có dòng audit và chưa khớp (OVERRIDE_NOTE not_matched). Mong: enrich KHÔNG Text Search J và J không mang PJ.
      Hiện tại: J bị Text Search và nhận khớp tự động đúng PJ, nơi Capu vừa loại.
  (b) K có mục temporarily_closed (như Pergola, được thử lại mỗi lần enrich); Google báo ứng viên đúng CLOSED_PERMANENTLY. Mong: K còn trong vendors.json,
      không vào removed_vendors.json (chỉ mục remove của Capu gỡ vendor có mục). Hiện tại: K bị gỡ tự động.
  (c) A có mục accept_place đã áp (place PA); refresh_photos gặp Place Details 404. Mong: A không bị refresh gỡ khỏi vendors.json.
      Hiện tại: A bị gỡ ('google place_id no longer valid'), rồi lần enrich sau accept_place khôi phục lại: lật qua lật lại mỗi lần chạy.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-110"))
import _t110 as t

bad = []
NOAUD = lambda vid: {"vendor_id": vid, "status": "no_match", "matched_name": "", "confidence": 0.0, "place_id": None, "formatted_address": "", "address_match": None}

# (a) reject_match chưa khớp, chưa audit
r = t.Root({"venue": [t.vendor("t112_J", "Nhà hàng Juliet Adv", "2 Lê Lợi, Quận 1, Thành phố Hồ Chí Minh")], "honeymoon": []})
r.set_overrides([t.entry("t112_J", "reject_match", place_id="PJ")])
PL = {"PJ": t.place("Nhà hàng Juliet Adv", "2 Lê Lợi, Bến Thành, Hồ Chí Minh")}
rc, out, calls = r.run(t.ENRICH, t.fixture(PL, [("Juliet Adv", ["PJ"])]))
if any(x["kind"] == "search" and "Juliet" in x["q"] for x in calls):
    bad.append("(a) vendor có mục reject_match bị Text Search")
if t.pid_of(r.vendor("t112_J")) == "PJ":
    bad.append("(a) vendor có mục reject_match PJ lại được nhận khớp tự động đúng PJ")

# (b) temporarily_closed + Google CLOSED_PERMANENTLY
r = t.Root({"venue": [t.vendor("t112_K", "Nhà hàng Kilo Adv", "5 Pasteur, Quận 1, Thành phố Hồ Chí Minh")], "honeymoon": []})
r.write("venue/enrichment-audit.json", [NOAUD("t112_K")])
r.set_overrides([t.entry("t112_K", "temporarily_closed")])
PL = {"PK": t.place("Nhà hàng Kilo Adv", "5 Pasteur, Bến Nghé, Hồ Chí Minh", status="CLOSED_PERMANENTLY")}
rc, out, calls = r.run(t.ENRICH, t.fixture(PL, [("Kilo Adv", ["PK"])]))
if r.vendor("t112_K") is None or any((x.get("vendor") or {}).get("id") == "t112_K" for x in r.removed()):
    bad.append("(b) vendor có mục temporarily_closed bị luật tự động (CLOSED_PERMANENTLY) gỡ khỏi vendors.json")

# (c) accept_place đã áp + refresh 404
r = t.Root({"venue": [t.vendor("t112_A", "Nhà hàng Alpha Adv", "7 Pasteur, Quận 1, Thành phố Hồ Chí Minh")], "honeymoon": []})
r.write("venue/enrichment-audit.json", [NOAUD("t112_A")])
pa = t.place("Hội trường Zeta Adv", "7 Pasteur, Bến Nghé, Hồ Chí Minh")
r.set_overrides([t.accept_with_snapshot("t112_A", "PA", pa)])
r.run(t.ENRICH, t.fixture({"PA": pa}, []))
if t.pid_of(r.vendor("t112_A")) != "PA":
    bad.append("(c) tiền đề hỏng: accept_place không áp")
else:
    rc, out, calls = r.run(t.REFRESH, t.fixture({}, []))
    if r.vendor("t112_A") is None:
        bad.append("(c) vendor có mục accept_place bị refresh_photos gỡ (Place Details 404); chỉ mục remove của Capu được gỡ vendor có mục")
t.done(bad, "vendor có mục duyệt tay: reject_match không bị Text Search, temporarily_closed/accept_place không bị luật tự động gỡ")
