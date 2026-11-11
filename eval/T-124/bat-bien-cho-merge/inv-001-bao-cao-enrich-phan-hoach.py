#!/usr/bin/env python3
"""Nguồn: T-124 (spec products/T-124-bang-enrich-vendor.md v2, Hành vi 1-2; defect handoffs/T-124-D1.md B1; bản nháp eval/T-124/inv-proposed-bao-cao-enrich-phan-hoach.py),
qua Spec Gate lần 2 2026-11-11 (spec-critic). Siết thêm so với bản nháp: (c) loại ứng viên ngoài tỉnh (INV-016), (e) luật ba ô đếm, (f) tạm đóng không ở pool.
Nằm ở eval/T-124/bat-bien-cho-merge/ cho tới khi ba PR T-124 merge (ADR-028); Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/.
INV-001 (planner/admin/vendor-enrich) · Báo cáo enrich là một phân hoạch, và ô đếm Capu đọc khớp nhóm.
Trên tools/scraper/output/HCMC/enrich-report.json (repo tohong) và tohong-back/lib/vendorPool.generated.js:
  (a) mỗi id đúng một dòng; group thuộc 9 nhóm; summary.groups[g] = số dòng nhóm g; cộng lại = summary.total = số dòng;
  (b) mọi id của pool app có dòng trong báo cáo (cặp đôi thấy vendor nào thì admin soát được vendor đó);
  (c) approvable=true chỉ khi: nhóm thuộc {addr_diff_accepted, unverified, name_same_addr_diff, name_similar}, có google.place_id, override rỗng,
      và KHÔNG phải ứng viên chưa nhận (google.matched=false) có reject_reason="out_of_province" (INV-016: Approve như vậy không bao giờ áp được);
      summary.approvable = số dòng approvable;
  (d) nhóm full chỉ khi google.matched, address_match=true và photo_count >= 1;
  (e) chips.name_similar = số dòng nhóm name_similar; chips.addr_diff = số dòng nhóm addr_diff_accepted + name_same_addr_diff;
      chips.no_google_photo = số dòng không có google hoặc photo_count = 0. (Ô full KHÔNG khoá ở đây: còn chờ Capu chọn 98 hay 105.)
  (f) không dòng temp_closed nào có id trong pool (khớp INV-021 (f)).
Lý do: ô đếm là thứ Capu đọc để quyết việc enrich và duyệt tay tiếp theo; một vendor đếm hai lần, rơi mất, hay một nút Approve chắc chắn vô hiệu
làm Capu ra quyết định bậc C sai mà không ai thấy.
Thiếu báo cáo (chưa có T-124): PASS "chưa áp dụng". Thiếu tohong-back: bỏ (b), (f). Không gọi Google, không mạng.
Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq; TOHONG_BACK_REPO, rồi ../tohong-back. Chạy không tham số (python3 -I). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import json, os, sys


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "decisions")) and os.path.isdir(os.path.join(d, "eval")):
            return d
        d = os.path.dirname(d)
    return os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


HQ = _hq()
tohong = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
               if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
rp = tohong and os.path.join(tohong, "tools", "scraper", "output", "HCMC", "enrich-report.json")
if not rp or not os.path.isfile(rp):
    print("PASS chưa áp dụng (chưa có enrich-report.json)"); sys.exit(0)
G = ["full", "matched_no_photo", "addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar", "not_found", "temp_closed", "not_enriched"]
AP = {"addr_diff_accepted", "unverified", "name_same_addr_diff", "name_similar"}
try:
    rep = json.load(open(rp, encoding="utf-8"))
    rows = rep["vendors"]; s = rep["summary"]
except (ValueError, KeyError, TypeError) as e:
    print("FAIL báo cáo không đọc được: %r" % e); sys.exit(1)
bad = []
ids = [r.get("id") for r in rows]
if len(ids) != len(set(ids)) or not all(ids):
    bad.append("id thiếu hoặc trùng dòng")
cnt = {g: 0 for g in G}
for r in rows:
    if r.get("group") not in cnt:
        bad.append("%s: group %r ngoài 9 nhóm" % (r.get("id"), r.get("group"))); continue
    cnt[r["group"]] += 1
groups = s.get("groups") or {}
if any(groups.get(g, 0) != cnt[g] for g in G) or set(groups) - set(G):
    bad.append("summary.groups %s != đếm dòng %s" % (groups, cnt))
if not (sum(groups.values()) == s.get("total") == len(rows)):
    bad.append("tổng nhóm %s != total %s != số dòng %d" % (sum(groups.values()), s.get("total"), len(rows)))


def ok_approvable(r):
    g = r.get("google") or {}
    return (r.get("group") in AP and bool(g.get("place_id")) and not r.get("override")
            and not (g.get("matched") is False and g.get("reject_reason") == "out_of_province"))


n_ap = 0
for r in rows:
    g = r.get("google") or {}
    if r.get("approvable") is True:
        n_ap += 1
        if not ok_approvable(r):
            bad.append("%s: approvable sai (nhóm %s, reject_reason %r, override %r)" % (r.get("id"), r.get("group"), g.get("reject_reason"), r.get("override")))
    if r.get("group") == "full" and not (g.get("matched") is True and g.get("address_match") is True and (g.get("photo_count") or 0) >= 1):
        bad.append("%s: nhóm full mà không khớp địa chỉ hoặc không có ảnh" % r.get("id"))
if s.get("approvable") != n_ap:
    bad.append("summary.approvable %r != số dòng approvable %d" % (s.get("approvable"), n_ap))
ch = s.get("chips") or {}
want = {"name_similar": cnt["name_similar"], "addr_diff": cnt["addr_diff_accepted"] + cnt["name_same_addr_diff"],
        "no_google_photo": sum(1 for r in rows if not r.get("google") or not (r["google"].get("photo_count") or 0))}
for k, v in want.items():
    if ch.get(k) != v:
        bad.append("chips.%s=%r, mong %d" % (k, ch.get(k), v))
back = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back"))
             if x and os.path.isfile(os.path.join(x, "lib", "vendorPool.generated.js"))), None)
if back:
    txt = open(os.path.join(back, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    try:
        pool = {p.get("id") for p in json.loads(txt[txt.index("= [") + 2:txt.rindex("]") + 1])}
    except ValueError as e:
        print("FAIL không giải mã được pool: %s" % e); sys.exit(1)
    miss = sorted(pool - set(ids))
    if miss:
        bad.append("%d vendor của pool thiếu dòng, vd %s" % (len(miss), miss[0]))
    tc = sorted(r["id"] for r in rows if r.get("group") == "temp_closed" and r.get("id") in pool)
    if tc:
        bad.append("%d vendor tạm đóng còn trong pool, vd %s" % (len(tc), tc[0]))
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d dòng, 9 nhóm cộng đúng, %d approvable, ô đếm khớp nhóm" % (len(rows), n_ap)); sys.exit(0)
