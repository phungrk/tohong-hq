#!/usr/bin/env python3
"""Bất biến ĐỀ XUẤT từ T-124 (vùng planner/admin/vendor-enrich; Spec critic rút vào bể khi spec qua cổng).
INV-? · Báo cáo enrich là một phân hoạch: mỗi vendor trong app đúng một nhóm, tổng nhóm bằng tổng, và không vendor nào của pool thiếu dòng.
Trên tools/scraper/output/HCMC/enrich-report.json (repo tohong) và tohong-back/lib/vendorPool.generated.js:
  (a) mỗi id đúng một dòng; group thuộc 9 nhóm; summary.groups cộng lại bằng summary.total bằng số dòng;
  (b) mọi id của pool app có dòng trong báo cáo (cặp đôi thấy vendor nào thì admin soát được vendor đó);
  (c) approvable=true chỉ ở nhóm {addr_diff_accepted, unverified, name_same_addr_diff, name_similar} và có google.place_id; dòng có override thì approvable=false;
  (d) nhóm full chỉ khi google.matched, address_match=true và photo_count >= 1.
Lý do: ô đếm Capu đọc để quyết định việc enrich tiếp theo; nếu một vendor đếm hai lần hay không đếm lần nào thì mọi con số sai mà không ai thấy.
Thiếu báo cáo (chưa có T-124): PASS "chưa áp dụng". Không gọi Google. Chạy không tham số (python3 -I). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, re, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
tohong = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
rp = tohong and os.path.join(tohong, "tools", "scraper", "output", "HCMC", "enrich-report.json")
if not rp or not os.path.isfile(rp):
    print("PASS chưa áp dụng (chưa có enrich-report.json)"); sys.exit(0)
G = {"full", "matched_no_photo", "addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar", "not_found", "temp_closed", "not_enriched"}
AP = {"addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar"}
rep = json.load(open(rp, encoding="utf-8")); rows = rep.get("vendors", []); bad = []
ids = [r["id"] for r in rows]
if len(ids) != len(set(ids)): bad.append("id trùng dòng")
if any(r.get("group") not in G for r in rows): bad.append("có group ngoài 9 nhóm")
s = rep.get("summary", {})
if not (sum(s.get("groups", {}).values()) == s.get("total") == len(rows)): bad.append("tổng nhóm %s != total %s != số dòng %d" % (sum(s.get("groups", {}).values()), s.get("total"), len(rows)))
back = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if x and os.path.isfile(os.path.join(x, "lib", "vendorPool.generated.js"))), None)
if back:
    pool = set(re.findall(r'"id":"(marry_[0-9a-f]+)"', open(os.path.join(back, "lib", "vendorPool.generated.js"), encoding="utf-8").read()))
    if pool - set(ids): bad.append("%d vendor pool thiếu dòng, vd %s" % (len(pool - set(ids)), sorted(pool - set(ids))[0]))
for r in rows:
    g = r.get("google") or {}
    if r.get("approvable") and not (r["group"] in AP and g.get("place_id") and not r.get("override")): bad.append("%s approvable sai" % r["id"]); break
    if r["group"] == "full" and not (g.get("matched") and g.get("address_match") is True and (g.get("photo_count") or 0) >= 1): bad.append("%s full sai" % r["id"]); break
print("FAIL " + bad[0] + (" (+%d)" % (len(bad) - 1) if len(bad) > 1 else "") if bad else "PASS"); sys.exit(1 if bad else 0)
