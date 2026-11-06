#!/usr/bin/env python3
"""T-086 adv-01 (adversary, Code Gate v1, 2026-11-06). Spec T-081 D-I1 + Ràng buộc ("D-I1 dùng cùng định nghĩa" với hq/ledger INV-001).
Input: board có `issue` mang nháy kép LẺ (không bao ngoài): `"12` hoặc `12"` (board sửa tay, hoặc write_task json-dump chuỗi có nháy).
task.read_task chỉ bỏ nháy khi có cặp bao ngoài, nên giá trị đọc ra vẫn chứa nháy; hq/ledger INV-001 coi đó là rác.
Mong đợi: KHÔNG có link Issue (D-I1: "mọi giá trị khác ... không có link issue"). Đối chứng: `"12"`, `" 13 "` (cặp nháy bao ngoài,
khoảng trắng trong) và `<tab>14` có link; `'15'` (nháy đơn) không có link.
Chạy: cd /home/user/tohong-hq && python3 eval/T-086/adv-01-issue-nhay-le.py   (PASS / FAIL, mã thoát 0/1)
"""
import sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "eval" / "T-081"))
import _lib as X  # noqa: E402

C = X.Checker()
I = X.ISSUE
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    esc = lambda: dict(state="escalated", owner="product", tier="B", updated="2026-11-06T09:00", holder="chief-of-staff")
    issues = {"T-921": '"12', "T-922": '12"', "T-923": '"12"', "T-924": '" 13 "', "T-925": "\t14", "T-926": "'15'"}
    fake = X.build(tmp, {t: esc() for t in issues}, [], {}, {})
    for t, raw in issues.items():
        X.set_issue(fake, t, raw)
    d, err = X.export(fake, tmp / "pub", public=True)
    if d is None:
        print("FAIL exporter không chạy: " + str(err)); sys.exit(1)
    m = X.by_task(d.get("capu_queue") or [])
    iss = lambda t: [l for l in (m.get(t) or {}).get("links", []) if "/issues/" in l["url"] or l["label"].startswith("Issue")]
    C.chk(set(m) == set(issues), "mọi việc escalated đều vào queue: " + str(sorted(m)))
    C.chk(iss("T-921") == [], 'issue `"12` (nháy lẻ đầu, không bao ngoài) không phải số nguyên dương: không có link issue; thấy ' + str(iss("T-921")))
    C.chk(iss("T-922") == [], 'issue `12"` (nháy lẻ cuối) không phải số nguyên dương: không có link issue; thấy ' + str(iss("T-922")))
    C.chk([l["url"] for l in iss("T-923")] == [I + "12"], 'đối chứng `"12"` có link Issue #12; thấy ' + str(iss("T-923")))
    C.chk([l["url"] for l in iss("T-924")] == [I + "13"], 'đối chứng `" 13 "` có link Issue #13; thấy ' + str(iss("T-924")))
    C.chk([l["url"] for l in iss("T-925")] == [I + "14"], "đối chứng tab đầu `\\t14` có link Issue #14; thấy " + str(iss("T-925")))
    C.chk(iss("T-926") == [], "nháy đơn `'15'` không phải nháy kép: không có link issue; thấy " + str(iss("T-926")))
C.done()
