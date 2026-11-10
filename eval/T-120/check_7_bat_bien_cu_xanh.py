#!/usr/bin/env python3
"""T-120 tiêu chí 7 (bất biến cũ giữ, bất biến đề xuất xanh). OFFLINE.
A. Dữ liệu thật (tohong): INV-012..019 của planner/vendor/images chạy `python3 -I`, không tham số: tất cả PASS (T-120 không đề nghị sửa INV nào).
B. Sau bước 0 + `enrich.py ... --recheck-name-match` trên bản sao repo (tools/scraper là bản sao code thật, dữ liệu của run 42635049304): INV-015, 016, 017, 018, 019 với TOHONG_REPO trỏ repo tạm
   đều PASS (không "chưa áp dụng"), kèm bản nháp bất biến đề xuất eval/T-120/inv-proposed-nhan-khop-theo-ten.py: PASS. Hệ quả cụ thể phải đúng: INV-018 (code bằng hàm chuẩn sáu cổng) nghĩa là
   hàm sáu cổng của code KHÔNG đổi hành vi (luật tên là đường nhận thứ hai), INV-015 (nhận khớp có cổng: confidence >= 0,6 và cờ address_match ghi = tính lại), INV-016 (cùng tỉnh), INV-019 (G6 xuyên category).
C. Hai lần chạy `--recheck-name-match` liên tiếp: sau lần 2 các bất biến trên vẫn xanh (lần 2 không hạ vendor nào về low_confidence: số vendor có place_id không giảm).
Không chạy INV-021/022 (đang đỏ vì PR pool tohong-back của run 42635049304 chưa merge, ADR-056; không liên quan T-120). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t120 as h
t, x = h.t, h.x
bad = []


def run_inv(path, env=None):
    e = dict(os.environ)
    e.update(env or {})
    p = subprocess.run([sys.executable, "-I", path], cwd=t.HQ, env=e, capture_output=True, text=True, timeout=900)
    return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip().splitlines()[-1:] or [""]


allinv = t.inv_scripts(12, 13, 14, 15, 16, 17, 18, 19)
if len(allinv) != 8:
    t.fail("không đủ 8 bất biến INV-012..019 (thấy %d)" % len(allinv))
for p in allinv:
    rc, last = run_inv(p)
    if rc != 0:
        bad.append("dữ liệu thật: %s: %s" % (os.path.basename(p), last[0][:140]))
root, rows, FX, dropped = h.prepare(parent="repo")
n_pid = lambda: sum(1 for r in rows if any(t.has_pid(v_) for _, v_, _ in h.records(root, r["id"])))
before = n_pid()
prop = os.path.join(h.HERE, "inv-proposed-nhan-khop-theo-ten.py")
for label in ("lần 1", "lần 2"):
    rc, out, calls = root.run(h.recheck_argv(rows), FX, timeout=900)
    if rc != 0:
        t.fail("enrich %s thoát %d (%s)" % (h.RECHECK_FLAG, rc, label))
    if label == "lần 1" and n_pid() != before + 49:
        bad.append("sau lần 1 mong thêm 49 vendor có place_id, thấy %d" % (n_pid() - before))
    if label == "lần 2" and n_pid() != before + 49:
        bad.append("sau lần 2 số vendor có place_id đổi (%d, mong %d): lần 2 hạ hoặc nhận thêm" % (n_pid(), before + 49))
    for p in t.inv_scripts(15, 16, 17, 18, 19) + [prop]:
        rc, last = run_inv(p, {"TOHONG_REPO": root.base})
        if rc != 0:
            bad.append("sau chạy %s: %s: %s" % (label, os.path.basename(p), last[0][:150]))
        elif "chưa áp dụng" in last[0]:
            bad.append("sau chạy %s: %s báo 'chưa áp dụng' (không đo được trên repo tạm)" % (label, os.path.basename(p)))
t.done(bad, "INV-012..019 xanh trên dữ liệu thật; INV-015..019 và bất biến đề xuất (nhận khớp theo tên) xanh sau khi chạy lại (hai lần), 49 vendor mới có place_id")
