#!/usr/bin/env python3
"""T-111 tiêu chí 1 (INV-012..019 xanh). OFFLINE.
A. Dữ liệu thật (tohong, tohong-back cạnh tohong-hq): chạy từng eval/invariants/planner/vendor/images/inv-012..019 (python3 -I, không tham số): tất cả PASS.
B. Sau khi chạy kịch bản cơ bản (8 vendor, đủ nhánh ADR-049) trên repo `tohong` tạm có tools/scraper là bản sao code thật: INV-015, 016, 017, 018, 019 với TOHONG_REPO trỏ repo tạm đều PASS
   (và không "chưa áp dụng"): vendor nhận khớp qua sáu cổng, vendor low_confidence/tạm đóng/bị gỡ không làm hỏng nhận khớp có cổng, không ứng viên ngoài tỉnh, một place_id một địa chỉ gốc.
   Chạy cả lần 2 (s_temp mở lại) rồi đo lại. Spec không sửa bất biến. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
bad = []


def run_inv(path, env=None):
    e = dict(os.environ)
    e.update(env or {})
    p = subprocess.run([sys.executable, "-I", path], cwd=t.HQ, env=e, capture_output=True, text=True, timeout=600)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip().splitlines()[-1:] or [""]


allinv = t.inv_scripts(12, 13, 14, 15, 16, 17, 18, 19)
if len(allinv) != 8:
    t.fail("không đủ 8 bất biến INV-012..019 (thấy %d)" % len(allinv))
for p in allinv:
    rc, last = run_inv(p)
    if rc != 0:
        bad.append("dữ liệu thật: %s: %s" % (os.path.basename(p), last[0][:140]))
r, FX, PL, RULES = x.scenario_basic(parent="repo")
rc, out, calls = x.run_basic(r, FX)
if rc != 0 or not t.has_pid(r.vendor("s_keep")):
    t.fail("kịch bản cơ bản không chạy được (rc=%d); chưa đo được bất biến trên trạng thái sau chạy" % rc)
for label in ("lần 1", "lần 2"):
    for p in t.inv_scripts(15, 16, 17, 18, 19):
        rc, last = run_inv(p, {"TOHONG_REPO": r.base})
        if rc != 0:
            bad.append("sau chạy %s: %s: %s" % (label, os.path.basename(p), last[0][:150]))
        elif "chưa áp dụng" in last[0]:
            bad.append("sau chạy %s: %s báo 'chưa áp dụng' (không đo được trên repo tạm)" % (label, os.path.basename(p)))
    if label == "lần 1":
        PL2 = dict(PL)
        PL2["PC"] = t.place("Nhà hàng Charlie Temp", x.GADDR % 3, nphotos=3)
        x.run_basic(r, x.fx(PL2, RULES))
t.done(bad, "INV-012..019 xanh trên dữ liệu thật; INV-015..019 xanh trên trạng thái fixture sau khi chạy luật ADR-049 (hai lần)")
