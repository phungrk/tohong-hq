#!/usr/bin/env python3
# Nguồn: T-215 (spec products/T-215-regen-giu-tag-co-bang-chung.md v2), rút bởi spec-critic tại Spec Gate 2026-11-20.
# Nằm ở eval/T-215/bat-bien-cho-merge/ tới khi PR tohong T-215 merge và bất biến xanh trên main (ADR-028); Chief đưa vào eval/invariants/planner/vendor/pool/ và đặt số.
"""Nguồn: T-215 (spec products/T-215-regen-giu-tag-co-bang-chung.md, tiêu chí 3). ĐỀ XUẤT bất biến, chờ Spec Gate rồi Chief of Staff đặt số trong eval/invariants/planner/vendor/pool/.
Bất biến (planner/vendor/pool): chạy tools/regen-pool-styles.sh KHÔNG làm bẩn cây git của tohong (git status --porcelain rỗng, không tính thư mục back `edge`; file ignore như output/pool-vendors.json không tính).
Mở rộng ý (2) của pool/inv-004 (regen làm bẩn cây) từ một file trung gian sang MỌI file được theo dõi: bước 'Kiểm báo cáo tươi' của sync-vendor-pool.yml (back) so báo cáo của tohong với báo cáo sinh lại từ dữ liệu SAU regen, nên regen đổi dữ liệu nguồn là Sync đỏ.
Tĩnh với mạng, không chạm repo thật (~2 giây). Dùng eval/lib/regen_fixture.py. Thiếu repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

def guarded(fn):
    try:
        msg = fn()
    except R.Fail as e:
        if str(e).startswith(("không thấy repo", "dữ liệu tohong không có vendor nào")):
            print("PASS chưa áp dụng (" + str(e) + ")"); sys.exit(0)
        print("FAIL " + str(e)); sys.exit(1)
    print("PASS " + msg); sys.exit(0)

def run():
    fx = R.build(back_rel="edge")   # back nằm trong cây như cấu hình thật (submodule edge); thư mục back bị loại khỏi phép kiểm
    try:
        fx.regen()
        st = fx.git_status()
        if st:
            raise R.Fail("regen làm bẩn cây tohong (%d file), vd: %s" % (len(st), "; ".join(st[:3])))
        return "cây git của tohong sạch sau regen"
    finally:
        fx.close()
guarded(run)
