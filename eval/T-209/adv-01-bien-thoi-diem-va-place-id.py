#!/usr/bin/env python3
"""T-209 adv-01 (tầng 3, offline, Google giả): biên mà check_1/check_4 chưa chạm, cho điều kiện "được phủ" (spec T-207, Quyết định 2):
  B30m  checked_at = 30 ngày TRỪ 5 phút trước          -> phủ (0 request, enrich_report)
  B30p  checked_at = 30 ngày CỘNG 5 phút trước          -> không phủ (Place Details)
  TZ7   checked_at "...+07:00" (không phải ...Z)        -> không phủ (sai dạng)
  LZ    checked_at "...z" chữ thường                    -> không phủ (sai dạng)
  MS    checked_at "...SS.123Z" (mili giây)             -> không phủ (sai dạng)
  WS    business_status = "   " (chỉ dấu cách)          -> không phủ (không phải chuỗi không rỗng thật)
  PWS   place_id của mục có dấu cách cuối, báo cáo không -> không được điền từ báo cáo (place_id phải ĐÚNG BẰNG)
  PCS   place_id khác hoa/thường với báo cáo              -> không được điền từ báo cáo
  UNM   ứng viên chưa nhận (matched=false), tươi        -> phủ
Mục phủ: 0 request nhắc place_id của nó, resolved_at = checked_at nguyên văn. Mục không phủ: KHÔNG có resolved_from=enrich_report."""
import os, sys
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-207"))
import _t207 as k

now = k.ago(0)
fresh_date = now[:10]
V = ["B30m", "B30p", "TZ7", "LZ", "MS", "WS", "PWS", "PCS", "UNM"]
r = k.mk_root(V)
ts = k.ago(2)
rows = [k.row("B30m", "P_B30m", checked_at=k.ago(30, minutes=-5)),
        k.row("B30p", "P_B30p", checked_at=k.ago(30, minutes=5)),
        k.row("TZ7", "P_TZ7", checked_at=ts[:-1] + "+07:00"),
        k.row("LZ", "P_LZ", checked_at=ts[:-1] + "z"),
        k.row("MS", "P_MS", checked_at=ts[:-1] + ".123Z"),
        k.row("WS", "P_WS", status="   "),
        k.row("PWS", "P_PWS"),
        k.row("PCS", "P_PCS"),
        k.row("UNM", "P_UNM", matched=False)]
k.write_report(r, rows)
pid_of = {v: "P_" + v for v in V}
pid_of["PWS"] = "P_PWS "
pid_of["PCS"] = "p_pcs"
r.set_overrides([k.acc(v, pid_of[v]) for v in V])
FX = k.t.fixture({p: k.op_place("Nhà hàng " + v, pid=p) for v, p in pid_of.items()})
rc, out, calls = r.run(k.t.RESOLVE, FX)
bad = []
COVER = {"B30m", "UNM"}
ents = k.by_vid(r)
rep = {x["id"]: x["google"] for x in rows}
for v in V:
    e = ents.get(v, {})
    rs = e.get("resolved") or {}
    if v in COVER:
        if rs.get("resolved_from") != "enrich_report" or rs.get("resolved_at") != rep[v]["checked_at"]:
            bad.append("%s: kỳ vọng phủ từ báo cáo (resolved_at=%r), thấy %r" % (v, rep[v]["checked_at"], rs))
        if any(pid_of[v] in c["url"] for c in calls):
            bad.append("%s: mục được phủ vẫn có request Google" % v)
    else:
        if rs.get("resolved_from") == "enrich_report":
            bad.append("%s: không đủ điều kiện phủ mà vẫn điền từ báo cáo: %r" % (v, rs))
for v in ("B30p", "TZ7", "LZ", "MS", "WS"):
    if not any(pid_of[v] in c["url"] for c in calls):
        bad.append("%s: không phủ nhưng không gọi Place Details" % v)
k.done(bad, "biên 30 ngày ±5 phút, dạng thời điểm lạ, trạng thái chỉ dấu cách, place_id lệch dấu cách/hoa-thường: đúng phủ/không phủ")
