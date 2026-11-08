#!/usr/bin/env python3
"""T-106 eval đối kháng 01 (adversary, Code Gate T-108): ứng viên được luật nhận nhưng Google báo nhà hàng ĐÓNG CỬA.
Input: vendor venue "Nha hang Hoa Sen", địa chỉ marry.vn "12 Lê Lợi, Quận 1"; Text Search trả 1 place cùng tên (confidence 1,0),
formattedAddress "12 Lê Lợi, Phường Bến Thành, Hồ Chí Minh", businessStatus CLOSED_PERMANENTLY (hoặc CLOSED_TEMPORARILY).
Spec hành vi 2: "Ứng viên được luật nhận thì phải có place_id (và status ok/enriched)"; hành vi 3: formatted_address có ở dòng audit của
mọi vendor được thử; hành vi 1: không vendor nào biến mất trừ place_id trả 404. check_5 đỏ với status khác {ok, enriched} khi luật nhận.
Mong đợi: audit status ∈ {ok, enriched}, có place_id, có formatted_address; vendors.json có enrichment_log google_maps có place_id.
Đỏ hôm nay: code trả status=business_closed, không place_id, không formatted_address -> sau lần chạy trả phí, mọi venue đóng cửa trên
Google làm check_5 đỏ và không đếm vào check_1. HTTP giả, KHÔNG gọi Google. Cần TOHONG_REPO (mặc định ../tohong)."""
import json, os, sys
from unittest import mock
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c

S = os.path.join(c.tohong(), "tools", "scraper")
sys.path.insert(0, S)
from enrichment.pipeline import EnrichmentPipeline  # noqa: E402


class R:
    status_code = 200

    def __init__(self, b):
        self.b, self.text = b, json.dumps(b)

    def json(self):
        return self.b


bad = []
for status in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"):
    v = {"id": "adv01", "name": "Nha hang Hoa Sen", "categories": ["venue"], "city": "HCMC",
         "contact": {"address": "12 Lê Lợi, Quận 1"}, "enrichment_log": [], "reviews": []}
    ans = {"places": [{"id": "pid_adv01", "displayName": {"text": "Nha hang Hoa Sen"},
                       "formattedAddress": "12 Lê Lợi, Phường Bến Thành, Hồ Chí Minh", "businessStatus": status}]}
    with mock.patch("enrichment.google_maps.requests.post", return_value=R(ans)):
        pipe = EnrichmentPipeline(gmaps_api_key="fake-not-a-key", max_budget_usd=5.0, dry_run=False)
        pipe.geocoder = mock.Mock(enrich=lambda x: None, estimated_cost_usd=0.0)
        pipe.run([v])
    a = pipe.results[0].to_dict()
    if not c.accept_match(a.get("confidence"), c.address_match("12 Lê Lợi, Quận 1", ans["places"][0]["formattedAddress"])):
        c.fail("fixture hỏng: luật lẽ ra phải nhận ứng viên này")
    has_pid = any(e.get("source") == "google_maps" and e.get("place_id") for e in v.get("enrichment_log") or [])
    if a.get("status") not in ("ok", "enriched") or not a.get("place_id") or not a.get("formatted_address") or not has_pid:
        bad.append("%s: status=%r place_id=%r formatted_address=%r enrichment_log có place_id=%s"
                   % (status, a.get("status"), a.get("place_id"), a.get("formatted_address"), has_pid))
if bad:
    c.fail("ứng viên được luật nhận nhưng Google báo đóng cửa không có place_id/status ok: " + "; ".join(bad))
c.ok("ứng viên được luật nhận vẫn có place_id + status ok/enriched + formatted_address khi Google báo đóng cửa")
