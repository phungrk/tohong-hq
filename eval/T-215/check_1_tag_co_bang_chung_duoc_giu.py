#!/usr/bin/env python3
"""T-215 tiêu chí 1: vendor có tag gán kèm bằng chứng (enrichment_log, Google AI Mode: tohong#108) giữ NGUYÊN style_tags sau regen.
Chạy regen-pool-styles.sh --back <bản sao back> --photos-for all trên bản sao tạm của tohong (cây làm việc của TOHONG_REPO, phải đã có dữ liệu #108; không ghim commit cũ).
Mọi vendor có bản ghi được bảo vệ và CÒN trong pool: pool.styles == pool.tags == style_tags của nguồn (đúng thứ tự). Chạy: python3 -I <file>. Không mạng, không chạm repo thật."""
import os, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
sys.path.insert(0, os.path.join(_d, "eval", "lib"))
import regen_fixture as R

def run():
    fx = R.build()
    try:
        exp = fx.expected_protected()   # đọc nguồn TRƯỚC regen
        fx.regen()
        pool = fx.pool()
        inpool = {i: t for i, t in exp.items() if i in pool}
        if not inpool:
            raise R.Fail("không có vendor được bảo vệ nào còn trong pool sau regen (fixture sai?)")
        bad = [i for i, t in inpool.items() if pool[i].get("styles") != t or pool[i].get("tags") != t]
        if bad:
            i = bad[0]
            raise R.Fail("%d/%d vendor có bằng chứng bị đổi tag sau regen, vd %s (%s): nguồn %s, pool styles %s tags %s"
                         % (len(bad), len(inpool), i, pool[i].get("name"), inpool[i], pool[i].get("styles"), pool[i].get("tags")))
        return "%d vendor có bằng chứng giữ đúng style_tags của nguồn trong pool" % len(inpool)
    finally:
        fx.close()
R.main_guard(run)
