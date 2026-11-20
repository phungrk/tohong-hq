#!/usr/bin/env python3
"""T-217 tiêu chí 4: sau mô phỏng Sync (xem _sim.py), không bất biến pool nào xấu đi so với nền B (cùng dữ liệu, S đặt lại auto_scraped); đo tương đối vì vendor inv-001/002/004 đã đỏ/lỗi trên nền (Bình Quới 2 verified; node_modules). Chạy trên pool mới: planner/vendor/pool inv-002..007 và planner/vendor inv-001..004 chạy lại trên bản sao
(TOHONG_REPO, TOHONG_BACK_REPO trỏ tới bản sao tạm); pool/inv-001 hiện hành (v1) bị ADR-137 thay bằng v2 (eval/T-215/bat-bien-cho-merge/thay-inv-001-pool-khop-van-ban-nguon-v2.py), nên chạy v2 thay v1.
Điều kiện đầu như check_3 (S đã verified; chưa thì bất biến xanh là vô nghĩa). Chạy: python3 -I <file>."""
import glob, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t217 as T, _sim


def run():
    A, B, S, _ = _sim.simulate()
    try:
        files = [os.path.join(T.HQ, "eval/T-215/bat-bien-cho-merge/thay-inv-001-pool-khop-van-ban-nguon-v2.py")]
        files += sorted(glob.glob(os.path.join(T.HQ, "eval/invariants/planner/vendor/pool/inv-00[2-7]*.py")))
        files += sorted(glob.glob(os.path.join(T.HQ, "eval/invariants/planner/vendor/inv-00[1-4]*.py")))
        files = [f for f in files if os.path.isfile(f)]
        if len(files) < 11:
            raise T.Fail(f"chỉ thấy {len(files)} bất biến để chạy (cần v2 + pool inv-002..007 + vendor inv-001..004 dạng .py)")
        def run_all(fx):
            env = dict(fx.env, TOHONG_REPO=fx.tohong, TOHONG_BACK_REPO=fx.back)
            res = {}
            for f in files:
                p = subprocess.run([sys.executable, "-I", f], env=env, capture_output=True, text=True, timeout=600)
                txt = (p.stdout or p.stderr).strip().splitlines()
                res[os.path.basename(f)] = (p.returncode == 0, txt[-1][:160] if txt else str(p.returncode))
            return res
        ra, rb = run_all(A), run_all(B)
        bad = [f"{k}: {ra[k][1]}" for k in ra if not ra[k][0] and rb[k][0]]
        if bad:
            raise T.Fail(f"{len(bad)} bất biến chuyển từ đạt sang ĐỎ vì việc đánh dấu verified, vd {bad[0]}")
        keep = sum(1 for k in ra if ra[k][0])
        return f"không bất biến pool nào xấu đi so với nền chưa verified ({keep}/{len(ra)} đạt; phần còn lại đỏ sẵn trên nền, không do việc này)"
    finally:
        A.close(); B.close()


T.R.main_guard(run)
