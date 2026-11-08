#!/usr/bin/env python3
"""T-106 eval đối kháng 05 (adversary, Code Gate T-108 vòng 3): purge_from_sibling_files với vendor CLOSED_PERMANENTLY ở 3 category,
một category đã có removed_vendors.json từ trước (gỡ 404 cũ), rồi chạy lại enrich venue (idempotent).
Nguồn: ADR-044 mục 1 (gỡ như 404, removed_vendors.json khôi phục được) + spec T-106 hành vi 8 (chạy lại được phép).
Input: adv05 ở venue + photography + wedding_attire; photography/removed_vendors.json có sẵn 1 bản ghi "old404";
photography còn adv05p (vendor khác). Lần 1 Text Search trả CLOSED_PERMANENTLY; lần 2 chạy lại cùng output.
Mong đợi: sau lần 1 và lần 2, adv05 không còn ở category nào; photography/removed giữ old404 + đúng 1 adv05;
wedding_attire/removed đúng 1 adv05; venue/removed đúng 1 adv05; adv05p còn nguyên; lần 2 không Text Search adv05.
HTTP giả, KHÔNG gọi Google. Cần TOHONG_REPO."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common as c
import _adv_harness as h

cats = ("venue", "photography", "wedding_attire")
mk = lambda: h.vendor("adv05", "Nha hang Kim Lien", "8 Pasteur, Quận 1", cats=cats)
keep = h.vendor("adv05p", "Studio Anh Duong", "3 Lý Tự Trọng, Quận 1", cats=("photography",))
root = h.make_root({"venue": [mk()], "photography": [mk(), keep], "wedding_attire": [mk()]})
pre = [{"removed_at": "2026-11-01T00:00:00Z", "reason": "google place 404", "vendor": {"id": "old404"}}]
(root / "output" / "HCMC" / "photography" / "removed_vendors.json").write_text(json.dumps(pre), encoding="utf-8")
places = {"Nha hang Kim Lien": [h.place("pid_adv05", "Nha hang Kim Lien", "8 Pasteur, Phường Bến Nghé, Hồ Chí Minh",
                                        "CLOSED_PERMANENTLY")]}


def check(tag):
    bad = []
    ids = h.all_ids(root)
    if "adv05" in ids:
        bad.append("%s: adv05 còn ở %s" % (tag, ids["adv05"]))
    if "adv05p" not in ids:
        bad.append("%s: vendor khác adv05p bị gỡ nhầm" % tag)
    rem = h.removed(root)
    for cat in cats:
        n = sum(1 for k, i in rem if k == cat and i == "adv05")
        if n != 1:
            bad.append("%s: %s/removed_vendors.json có %d bản ghi adv05 (mong 1)" % (tag, cat, n))
    if ("photography", "old404") not in rem:
        bad.append("%s: mất bản ghi removed cũ old404 (ghi đè thay vì append)" % tag)
    return bad


h.run_enrich(root, places)
bad = check("lần 1")
rc, out, calls = h.run_enrich(root, places)
bad += check("lần 2")
if any("Kim Lien" in q for q in calls):
    bad.append("lần 2 Text Search lại vendor đã gỡ")
if bad:
    c.fail("; ".join(bad))
c.ok("gỡ ở 3 category, giữ removed cũ, chạy lại không nhân đôi, không Text Search lại")
