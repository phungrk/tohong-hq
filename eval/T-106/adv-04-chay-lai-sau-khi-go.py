#!/usr/bin/env python3
"""T-106 eval đối kháng 04 (adversary, Code Gate T-108): chạy lại enrich venue SAU KHI nhà hàng đã bị gỡ vì CLOSED_PERMANENTLY.
Nguồn: ADR-044 mục 1 (gỡ, lưu removed_vendors.json, audit closed_permanently) + spec T-106 hành vi 8 (chạy lại sau lỗi được phép,
audit gộp theo vendor_id, review-needed.csv 1 dòng/vendor).
Input: lần 1 Text Search trả "Nha hang Hoa Sen" CLOSED_PERMANENTLY; lần 2 (cùng output) Text Search trả cùng place nhưng OPERATIONAL,
cùng vendor thứ hai bị luật từ chối (low_confidence) ở cả hai lần.
Mong đợi sau lần 2: vendor đã gỡ KHÔNG hồi sinh trong vendors.json, không bị Text Search lại (không tốn lượt), removed_vendors.json có đúng
1 bản ghi của nó (không nhân đôi), audit vẫn giữ dòng closed_permanently (không bị mất khi gộp), review-needed.csv không có dòng của nó;
vendor low_confidence vẫn đúng 1 dòng review. HTTP giả, KHÔNG gọi Google. Cần TOHONG_REPO."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

v = h.vendor("adv04", "Nha hang Hoa Sen", "12 Lê Lợi, Quận 1")
low = h.vendor("adv04l", "Tiec cuoi Phuong Dong", "99 Trần Hưng Đạo, Quận 5")
gaddr = "12 Lê Lợi, Phường Bến Thành, Hồ Chí Minh"
lowp = [h.place("pid_other", "Karaoke Tan Thoi", "7 Lý Thường Kiệt, Quận 10, Hồ Chí Minh")]
root = h.make_root({"venue": [v, low]})
h.run_enrich(root, {"Nha hang Hoa Sen": [h.place("pid_adv04", "Nha hang Hoa Sen", gaddr, "CLOSED_PERMANENTLY")],
                    "Tiec cuoi Phuong Dong": lowp})
if "adv04" in h.all_ids(root):
    c.fail("lần 1: vendor CLOSED_PERMANENTLY chưa bị gỡ (xem adv-01)")
rc, out, calls = h.run_enrich(root, {"Nha hang Hoa Sen": [h.place("pid_adv04", "Nha hang Hoa Sen", gaddr, "OPERATIONAL")],
                                     "Tiec cuoi Phuong Dong": lowp})
bad = []
if "adv04" in h.all_ids(root):
    bad.append("vendor đã gỡ hồi sinh trong vendors.json")
if any("Hoa Sen" in q for q in calls):
    bad.append("lần 2 Text Search lại vendor đã gỡ (%d lượt)" % sum("Hoa Sen" in q for q in calls))
n = sum(1 for _, i in h.removed(root) if i == "adv04")
if n != 1:
    bad.append("removed_vendors.json có %d bản ghi adv04 (mong 1)" % n)
a = h.audit(root).get("adv04") or {}
if a.get("status") != "closed_permanently" or a.get("place_id") != "pid_adv04":
    bad.append("audit sau gộp: adv04 status=%r place_id=%r" % (a.get("status"), a.get("place_id")))
rv = h.review_ids(root)
if "adv04" in rv:
    bad.append("review-needed.csv có dòng vendor đã gỡ")
if "adv04l" not in rv or "low_confidence_place" not in (rv["adv04l"].get("flags") or ""):
    bad.append("vendor low_confidence mất dòng review sau lần 2")
if bad:
    c.fail("; ".join(bad))
c.ok("chạy lại sau khi gỡ: không hồi sinh, không Text Search lại, removed 1 bản ghi, audit giữ closed_permanently, review đúng")
