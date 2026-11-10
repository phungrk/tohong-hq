#!/usr/bin/env python3
"""Nguồn: T-120 (spec products/T-120-nhan-khop-theo-ten.md v2, Hành vi 0-3, N1-N4; defect handoffs/T-120-D1.md M2), qua Spec Gate lần 2 2026-11-10 (spec-critic).
Bản nháp: eval/T-120/inv-proposed-nhan-khop-theo-ten.py (rút nguyên văn; xanh trên dữ liệu hiện tại tohong@a682fc3, 144 bản ghi nhận khớp).
INV-025 (planner/vendor/images) · Nhận khớp không khớp địa chỉ chỉ hợp lệ khi qua luật tên, và địa chỉ hiển thị luôn là địa chỉ Google.
TP.HCM = TP.HCM mới sau sáp nhập 7/2025 (hàm chuẩn _common.in_province; gồm Bình Dương, Bà Rịa-Vũng Tàu cũ: giới hạn đã chốt trong spec T-120 v2, N2).
Với mọi vendor ở tools/scraper/output/HCMC/*/vendors.json có enrichment_log[google_maps] có place_id, formatted_address và contact.address_source (trừ bản ghi manual_override=true: Capu duyệt tay thắng):
  (a) contact.address == formatted_address của bản ghi log mới nhất (địa chỉ hiển thị là địa chỉ Google, từng ký tự);
  (b) nếu address_match(address_source, formatted_address) là false (tính lại bằng hàm chuẩn eval/T-106/_common.py) thì phải có MỘT trong hai:
      (i)  đường sáu cổng: _common.reject_reason(address_source, formatted_address, confidence) là None (ca không so được địa chỉ mà confidence >= 0,95 của T-106); hoặc
      (ii) đường tên: bản ghi log có accepted_by == "name_near_exact" VÀ độ giống tên (SequenceMatcher trên tên đã chuẩn hoá, như pipeline) >= 0,95 VÀ địa chỉ Google thuộc TP.HCM (_common.in_province) VÀ
           dãy chữ số trong tên vendor và tên Google bằng nhau VÀ id vendor KHÔNG có bản ghi ở category file venue;
  (c) bản ghi accepted_by == "name_near_exact" có address_match=false (cờ ghi) và không có accepted_by lạ.
Phụ thuộc eval/T-106/_common.py. Thiếu repo tohong: PASS 'chưa áp dụng'. Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq, rồi ../tohong cạnh cwd. Không gọi Google.
Chạy không tham số (python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import glob, importlib.util, json, os, re, sys, unicodedata
from difflib import SequenceMatcher


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "eval", "T-106", "_common.py")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))


HQ = _hq()
cp = os.path.join(HQ, "eval", "T-106", "_common.py")
if not os.path.isfile(cp):
    print("FAIL thiếu eval/T-106/_common.py (hàm chuẩn address_match, reject_reason, in_province)"); sys.exit(1)
_s = importlib.util.spec_from_file_location("t106common", cp)
C = importlib.util.module_from_spec(_s); _s.loader.exec_module(C)
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"), os.path.join(os.getcwd(), "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    return re.sub(r"[^a-z0-9 ]", "", "".join(ch for ch in s if unicodedata.category(ch) != "Mn")).strip()


def sim(a, b):
    return round(SequenceMatcher(None, norm(a), norm(b)).ratio(), 3)   # pipeline ghi confidence đã làm tròn 3 chữ số


def digits(s):
    return re.findall(r"\d+", norm(s))


out = os.path.join(t, "tools", "scraper", "output", "HCMC")
venue_ids = set()
vp = os.path.join(out, "venue", "vendors.json")
if os.path.isfile(vp):
    raw = json.load(open(vp, encoding="utf-8")); venue_ids = {v.get("id") for v in (raw.get("vendors", []) if isinstance(raw, dict) else raw)}
bad, n, n_name = [], 0, 0
for f in sorted(glob.glob(os.path.join(out, "*", "vendors.json"))):
    raw = json.load(open(f, encoding="utf-8")); vs = raw.get("vendors", []) if isinstance(raw, dict) else raw
    for v in vs:
        logs = [e for e in v.get("enrichment_log") or [] if e.get("source") == "google_maps" and e.get("place_id")]
        if not logs:
            continue
        e = logs[-1]
        src, fa = (v.get("contact") or {}).get("address_source"), e.get("formatted_address")
        if e.get("manual_override") is True or not src or not fa:
            continue
        n += 1
        vid = v.get("id")
        if (v.get("contact") or {}).get("address") != fa:
            bad.append((vid, "contact.address khác formatted_address của Google")); continue
        ab = e.get("accepted_by")
        if ab not in (None, "name_near_exact"):
            bad.append((vid, "accepted_by lạ %r" % ab)); continue
        if C.address_match(src, fa):
            continue
        if ab == "name_near_exact":
            n_name += 1
            if e.get("address_match") is not False:
                bad.append((vid, "accepted_by=name_near_exact mà cờ address_match không phải false"))
            elif vid in venue_ids:
                bad.append((vid, "venue được nhận theo tên"))
            elif sim(v.get("name"), e.get("matched_name")) < 0.95 or not C.in_province(fa) or digits(v.get("name")) != digits(e.get("matched_name")):
                bad.append((vid, "nhận theo tên mà không đủ: độ giống %.3f, tỉnh %s, chữ số %r/%r" % (sim(v.get("name"), e.get("matched_name")), C.in_province(fa), digits(v.get("name")), digits(e.get("matched_name")))))
        elif C.reject_reason(src, fa, e.get("confidence")) is not None:
            bad.append((vid, "không khớp địa chỉ, không qua sáu cổng, không có accepted_by=name_near_exact (reject_reason=%s)" % C.reject_reason(src, fa, e.get("confidence"))))
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d bản ghi nhận khớp: địa chỉ hiển thị = địa chỉ Google; %d bản ghi nhận theo tên đều đủ tên >= 0,95, cùng TP.HCM, cùng chữ số, không venue" % (n, n_name)); sys.exit(0)
