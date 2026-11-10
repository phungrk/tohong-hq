#!/usr/bin/env python3
"""T-120 tiêu chí 4 (các lưới chặn còn nguyên khi nới luật). OFFLINE (Google giả; chạy ĐÚNG lệnh CLI). Kịch bản 14 vendor, bước 0 = luật hiện hành (mọi vendor bị từ chối vì tên đường mâu thuẫn),
rồi (J: Capu ghi reject_match) `enrich.py ... --recheck-name-match` với Google đổi ý ở một số vendor. Mong:
  A  tên trùng tuyệt đối, cùng TP.HCM                              -> NHẬN (đối chứng), L "Wings Decor"/"Wing Decor" 0,952 -> NHẬN
  B  tên giống >= 0,95 nhưng khác chữ số ("... 2" và "... 3")       -> không nhận, 0 lượt Google cho B (loại ngoại tuyến)
  C  "Mơ Bridal" / "M.O.T Bridal" 0,947                            -> không nhận, 0 lượt
  D  tên trùng tuyệt đối nhưng ở Đà Nẵng                           -> không nhận (G2), 0 lượt
  E  venue, tên trùng tuyệt đối, khác đường                        -> không nhận, 0 lượt (venue giữ sáu cổng)
  F  cùng id ở category file venue VÀ honeymoon, tên trùng         -> không nhận ở CẢ HAI file, 0 lượt (có bản ghi venue thì là venue)
  G  tên trùng, lần hỏi lại Google báo CLOSED_PERMANENTLY          -> gỡ khỏi mọi category file, vào removed_vendors.json, có REMOVED_VENDOR (ADR-044), không place_id/ảnh
  H  tên trùng, lần hỏi lại báo CLOSED_TEMPORARILY                 -> ẩn: không place_id/ảnh, audit closed_state=temporarily_closed + retry=true (định nghĩa T-110), không remove
  I  tên trùng, lần hỏi lại Google không trả gì                    -> giữ nguyên low_confidence cũ (không remove, không đổi bản ghi), đúng 1 lượt cho I
  J  Capu đã duyệt tay reject_match                                -> không nhận, 0 lượt
  K  tên trùng, lần hỏi lại Google trả ĐỊA ĐIỂM KHÁC (tên khác hẳn) -> không nhận, không remove, vẫn trong review
Số lượt: đúng 6 Text Search (A, L, G, H, I, K), ảnh đúng 4 (A và L, 2 ảnh mỗi vendor). Vendor không nhận: không place_id, không google_photos, contact.address = địa chỉ gốc.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
bad = []
G = "55 Hai Bà Trưng, Bến Nghé, Hồ Chí Minh"
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
V = [  # id, tên, địa chỉ gốc, tên Google, địa chỉ Google, các category file
    ("a", "Lumen Alpha Makeup", S % 11, "Lumen Alpha Makeup", "21 Pasteur, Bến Nghé, Hồ Chí Minh", ("makeup",)),
    ("l", "Wings Decor", S % 12, "Wing Decor", "22 Pasteur, Bến Nghé, Hồ Chí Minh", ("flower",)),
    ("b", "Cherry Boutique Saigon Bridal Studio 2", S % 13, "Cherry Boutique Saigon Bridal Studio 3", "23 Pasteur, Bến Nghé, Hồ Chí Minh", ("makeup",)),
    ("c", "Mơ Bridal", S % 14, "M.O.T Bridal", "24 Pasteur, Bến Nghé, Hồ Chí Minh", ("makeup",)),
    ("d", "Kem Tươi Echo Gelato", S % 15, "Kem Tươi Echo Gelato", "25 Phan Châu Trinh, Hải Châu, Đà Nẵng 550000", ("flower",)),
    ("e", "Nhà Hàng Foxtrot Garden", S % 16, "Nhà Hàng Foxtrot Garden", "26 Pasteur, Bến Nghé, Hồ Chí Minh", ("venue",)),
    ("f", "Golf Hotel Multi Resort", S % 17, "Golf Hotel Multi Resort", "27 Pasteur, Bến Nghé, Hồ Chí Minh", ("venue", "honeymoon")),
    ("g", "Hoa Gamma Closed Shop", S % 18, "Hoa Gamma Closed Shop", "28 Pasteur, Bến Nghé, Hồ Chí Minh", ("flower",)),
    ("h", "Hoa Hotel Temp Studio", S % 19, "Hoa Hotel Temp Studio", "29 Pasteur, Bến Nghé, Hồ Chí Minh", ("flower",)),
    ("i", "Tiệm Indigo Vanish", S % 20, "Tiệm Indigo Vanish", "30 Pasteur, Bến Nghé, Hồ Chí Minh", ("flower",)),
    ("j", "Juliet Reject Atelier", S % 21, "Juliet Reject Atelier", "31 Pasteur, Bến Nghé, Hồ Chí Minh", ("makeup",)),
    ("k", "Kilo Switch Atelier", S % 22, "Kilo Switch Atelier", "32 Pasteur, Bến Nghé, Hồ Chí Minh", ("makeup",)),
]
files, PL, rules = {}, {}, []
for vid, n, a, gn, ga, cats in V:
    for cat in cats:
        v = t.vendor("t120_" + vid, n, a, (h.DIR_CATEGORY[cat],))
        files.setdefault(cat, []).append(v)
    PL["P" + vid] = t.place(gn, ga, pid="P" + vid, nphotos=3)
    rules.append((h.fold(n), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
FX0 = x.fx(PL, rules)
cats = [c for c in h.ORDER if c in files]
rc0, out0, calls0 = root.run(x.enrich_all(cats), FX0)
au0 = {a: v for (c_, a), v in h.all_audit(root).items()}
for vid, *_ in V:
    st = (au0.get("t120_" + vid) or {})
    if st.get("status") != "low_confidence" or not st.get("reject_reason"):
        t.fail("fixture hỏng (đối chứng): t120_%s mong low_confidence, thấy %r" % (vid, (st.get("status"), st.get("reject_reason"))))
root.set_overrides([t.entry("t120_j", "reject_match", place_id="Pj", reason="Capu: Google nhận nhầm nơi (fixture eval T-120)")])
before = {}
for vid, *_ in V:
    for cat in files:
        v = root.vendor("t120_" + vid, cat)
        if v:
            before[("t120_" + vid, cat)] = (copy.deepcopy(v), copy.deepcopy(root.audit(cat).get("t120_" + vid)))
PL2 = copy.deepcopy(PL)
PL2["Pg"]["status"] = "CLOSED_PERMANENTLY"
PL2["Ph"]["status"] = "CLOSED_TEMPORARILY"
PL2["Pk2"] = t.place("Hoàn Toàn Khác Biệt Địa Điểm", "99 Trần Hưng Đạo, Cô Giang, Hồ Chí Minh", pid="Pk2", nphotos=3)
rules2 = [r for r in rules if r[0] != h.fold("Tiệm Indigo Vanish")]
rules2 = [(m, ["Pk2"]) if m == h.fold("Kilo Switch Atelier") else (m, ids) for m, ids in rules2]
FX1 = x.fx(PL2, rules2)
rc, out, calls = root.run(h.recheck_argv([{"cat": c_} for c_ in files]), FX1)
if rc != 0:
    t.fail("enrich %s thoát %d: %s" % (h.RECHECK_FLAG, rc, (out.strip().splitlines() or [""])[-1][:160]))


def get(vid):
    return {cat: root.vendor("t120_" + vid, cat) for cat in files if root.vendor("t120_" + vid, cat)}


for vid in ("a", "l"):
    v = get(vid)[V[[x_[0] for x_ in V].index(vid)][5][0]]
    gp = v.get("google_photos") or []
    if t.pid_of(v) != "P" + vid or len(gp) != 2:
        bad.append("%s: mong được nhận (place_id P%s, 2 ảnh), thấy pid=%r ảnh=%d" % (vid.upper(), vid, t.pid_of(v), len(gp)))
for vid in ("b", "c", "d", "e", "f", "j", "k", "i"):
    for cat, v in get(vid).items():
        if t.has_pid(v) or v.get("google_photos"):
            bad.append("%s (%s): không được nhận mà có place_id/ảnh" % (vid.upper(), cat))
        elif v["contact"].get("address") != v["contact"].get("address_source"):
            bad.append("%s (%s): vendor không nhận mà contact.address đã đổi" % (vid.upper(), cat))
    if not get(vid):
        bad.append("%s bị gỡ khỏi vendors.json (chỉ G và đóng cửa vĩnh viễn được gỡ)" % vid.upper())
    for key, (v0, a0) in before.items():
        if key[0] == "t120_" + vid and (root.vendor(*key) != v0 or root.audit(key[1]).get(key[0]) != a0) and vid in ("b", "c", "d", "e", "f", "j", "i"):
            bad.append("%s (%s): vendor không được hỏi lại mà bản ghi/audit đã đổi" % (vid.upper(), key[1]))
if get("g") or not [e for e in root.removed("flower") if (e.get("vendor") or {}).get("id") == "t120_g"] or "REMOVED_VENDOR" not in out and "CLOSED_PERMANENTLY" not in "".join(
        str(e.get("reason")) for e in root.removed("flower")):
    bad.append("G (CLOSED_PERMANENTLY): mong gỡ khỏi vendors.json và vào removed_vendors.json lý do CLOSED_PERMANENTLY, thấy còn=%r" % list(get("g")))
hv = get("h").get("flower")
ha = root.audit("flower").get("t120_h") or {}
if not hv or t.has_pid(hv) or hv.get("google_photos") or not x.is_temp_closed(ha) or [e for e in root.removed("flower") if (e.get("vendor") or {}).get("id") == "t120_h"]:
    bad.append("H (CLOSED_TEMPORARILY): mong ẩn (closed_state + retry), không place_id/ảnh, không remove; thấy audit=%r" % {k: ha.get(k) for k in ("status", "closed_state", "retry")})
for vid in ("e", "f"):
    a_ = [root.audit(cat).get("t120_" + vid) for cat in files if root.vendor("t120_" + vid, cat)]
    if any((a or {}).get("status") != "low_confidence" for a in a_):
        bad.append("%s: audit venue mong vẫn low_confidence" % vid.upper())
qs = x.queries(calls)
exp = {"lumen alpha": 1, "wings decor": 1, "hoa gamma": 1, "hoa hotel": 1, "indigo vanish": 1, "kilo switch": 1}
got = {k: x.count_for(calls, k) for k in list(exp) + ["cherry boutique", "mo bridal", "echo gelato", "foxtrot garden", "golf hotel", "juliet reject"]}
for k, n in got.items():
    if n != exp.get(k, 0):
        bad.append("lượt Text Search cho %r: mong %d, thấy %d" % (k, exp.get(k, 0), n))
if len(qs) != 6 or t.n_kind(calls, "media") != 4 or t.n_kind(calls, "details", "share", "geocode", "maps"):
    bad.append("mong đúng 6 Text Search, 4 media, 0 Details; thấy %d, %d, %d" % (len(qs), t.n_kind(calls, "media"), t.n_kind(calls, "details", "share", "geocode", "maps")))
t.done(bad, "các lưới chặn còn nguyên: lệch chữ số, dưới ngưỡng, ngoài TP.HCM, venue (kể cả vendor có bản ghi venue), duyệt tay, đóng cửa vĩnh viễn/tạm thời, Google không trả, trả nơi khác; đúng 6 lượt Text Search")
