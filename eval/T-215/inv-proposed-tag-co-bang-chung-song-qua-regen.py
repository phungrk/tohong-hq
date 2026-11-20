#!/usr/bin/env python3
"""Nguồn: T-215 (spec products/T-215-regen-giu-tag-co-bang-chung.md, tiêu chí 1). ĐỀ XUẤT bất biến, chờ Spec Gate rồi Chief of Staff đặt số trong eval/invariants/planner/vendor/pool/.
Bất biến (planner/vendor/pool): tag gán kèm bằng chứng (enrichment_log, Google AI Mode, hình dạng ở spec T-215 mục Định nghĩa) SỐNG QUA regen: sau
`bash tools/regen-pool-styles.sh --back <back> --photos-for all` trên bản sao tạm của tohong hiện hành, mọi vendor được bảo vệ còn trong pool có styles == tags == style_tags của nguồn.
Lý do: không có bất biến này, mỗi lần Sync vendor pool sẽ lặng lẽ ghi đè tag đã gán có bằng chứng bằng tag tính từ văn bản (sự cố tohong#108, sync run 44756600169).
Tĩnh với mạng, không chạm repo thật (~2 giây). Dùng eval/lib/regen_fixture.py. Repo: TOHONG_REPO, TOHONG_BACK_REPO. Thiếu repo hoặc dữ liệu chưa có bằng chứng: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
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
    fx = R.build()
    try:
        exp = fx.expected_protected()
        fx.regen()
        pool = fx.pool()
        inpool = {i: t for i, t in exp.items() if i in pool}
        bad = [i for i, t in inpool.items() if pool[i].get("styles") != t or pool[i].get("tags") != t]
        if bad:
            raise R.Fail("%d/%d vendor có bằng chứng bị đổi tag sau regen, vd %s: nguồn %s, pool %s" % (len(bad), len(inpool), bad[0], inpool[bad[0]], pool[bad[0]].get("styles")))
        return "%d vendor có bằng chứng giữ đúng style_tags qua regen" % len(inpool)
    finally:
        fx.close()
guarded(run)
