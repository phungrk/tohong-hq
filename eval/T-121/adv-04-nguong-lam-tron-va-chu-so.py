#!/usr/bin/env python3
"""T-121 eval đối kháng 04 (adversary). Spec T-120 Hành vi 1 (N1 trên `confidence` của pipeline = độ giống làm tròn 3 chữ số; N3 dãy nhóm chữ số
sau chuẩn hoá của phép đo tên) và 4a (chọn ngoại tuyến bằng ứng viên đã lưu) phải KHỚP với lúc xét online: không vendor nào tốn Text Search mà chắc chắn
bị từ chối, không vendor nào đủ luật mà bị bỏ. OFFLINE (Google giả, đúng lệnh CLI). Tên Google = tên vendor cắt bớt đuôi:
  U  73 ký tự, cắt 7 -> ratio 0,94964 -> confidence 0,950 -> NHẬN (1 lượt)
  Q  21 ký tự, cắt 2 -> ratio 0,9500 đúng -> NHẬN (1 lượt)
  D  52 ký tự, cắt 5 -> ratio 0,94949 -> confidence 0,949 -> không hỏi lại (0 lượt), y nguyên
  G  "Hoa 1 2 ..." so "Hoa 12 ..." (chữ số tách/gộp)  -> N3 sai -> 0 lượt
  Z  "Studio 07 ..." so "Studio 7 ..." (số 0 đầu)       -> N3 sai -> 0 lượt
  K  "Đức Khang 24h Bridal" so "Duc Khang 24H Bridal!"  -> chuẩn hoá (bỏ dấu, đ bị bỏ, ký tự lạ) -> confidence xét như pipeline; cùng chữ số -> nhận nếu >= 0,95
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-120"))
import _t120 as h  # noqa: E402
t, x = h.t, h.x
bad = []
S = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"


def letters(n, seed):
    base = "".join(chr(97 + (i * 7 + seed) % 26) for i in range(n))
    return base


u = "Umbra " + letters(67, 1)          # 73 ký tự
q = "Quill " + letters(15, 3)          # 21
d = "Delta " + letters(46, 5)          # 52
V = [("u", u, u[:-7]), ("q", q, q[:-2]), ("d", d, d[:-5]),
     ("g", "Hoa 1 2 Garden Bridal Studio", "Hoa 12 Garden Bridal Studio"),
     ("z", "Studio 07 Zephyr Bridal House", "Studio 7 Zephyr Bridal House"),
     ("k", "Đức Khang 24h Bridal", "Duc Khang 24H Bridal!")]
files, PL, rules = {"makeup": []}, {}, []
for k, (vid, n, gn) in enumerate(V):
    files["makeup"].append(t.vendor("adv121_" + vid, n, S % (11 + k), (h.DIR_CATEGORY["makeup"],)))
    PL["P" + vid] = t.place(gn, "%d Pasteur, Bến Nghé, Hồ Chí Minh" % (21 + k), pid="P" + vid, nphotos=3)
    rules.append((h.fold(n), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
FX = x.fx(PL, rules)
root.run(x.enrich_all(["makeup"]), FX)
au0 = root.audit("makeup")
conf = {vid: (au0.get("adv121_" + vid) or {}).get("confidence") for vid, *_ in V}
want = {vid for vid, n, gn in V if h.name_rule(n, gn, PL["P" + vid]["address"], conf[vid])}
if conf["u"] != 0.95 or conf["q"] != 0.95 or conf["d"] != 0.949:
    t.fail("fixture: confidence mong U=0,95 Q=0,95 D=0,949, thấy %r" % conf)
if not {"u", "q"} <= want or want & {"d", "g", "z"}:
    t.fail("fixture: hàm chuẩn N1-N3 cho tập %r" % sorted(want))
before = {vid: (copy.deepcopy(root.vendor("adv121_" + vid, "makeup")), copy.deepcopy(au0.get("adv121_" + vid))) for vid, *_ in V}
rc, out, calls = root.run(x.enrich_all(["makeup"], extra=[h.RECHECK_FLAG, "--dry-run"]), FX)
sc = x.kv(out, "RECHECK_SCOPE")
if rc or calls or len(sc) != 1 or int(sc[0].get("eligible", -1)) != len(want):
    bad.append("dry-run: mong eligible=%d, 0 lượt; thấy rc=%d %r, %d lượt" % (len(want), rc, sc, len(calls)))
rc, out, calls = root.run(x.enrich_all(["makeup"], extra=[h.RECHECK_FLAG]), FX)
if rc:
    t.fail("recheck thoát %d" % rc)
asked = {vid for vid, n, gn in V if x.count_for(calls, h.fold(n)[:12]) > 0}
if asked != want:
    bad.append("Text Search cho %r, mong đúng %r (chọn ngoại tuyến phải khớp luật online)" % (sorted(asked), sorted(want)))
for vid, *_ in V:
    v = root.vendor("adv121_" + vid, "makeup")
    a = root.audit("makeup").get("adv121_" + vid) or {}
    if vid in want:
        if t.pid_of(v) != "P" + vid or a.get("accepted_by") != "name_near_exact":
            bad.append("%s: đủ N1-N3 mà không được nhận theo tên (pid=%r, audit=%r)" % (vid.upper(), t.pid_of(v), (a.get("status"), a.get("reject_reason"))))
    elif (v, a) != before[vid]:
        bad.append("%s: không đủ điều kiện mà bản ghi/audit đổi" % vid.upper())
t.done(bad, "ngưỡng 0,95 trên confidence làm tròn (0,94964 nhận, 0,94949 không) và N3 chữ số tách/gộp/số 0 đầu: chọn ngoại tuyến khớp xét online")
