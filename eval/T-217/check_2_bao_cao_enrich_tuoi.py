#!/usr/bin/env python3
"""T-217 tiêu chí 2 (INV-003): sau khi đặt verified, tools/scraper/output/HCMC/enrich-report.json đã commit bằng ĐÚNG BYTE báo cáo sinh lại từ chính dữ liệu cùng cây.
Điều kiện đầu: tập S đã verified (nếu chưa thì chưa có gì để kiểm; ghi rõ: build_enrich_report.py hiện không đọc verification_status nên báo cáo thường không đổi byte, nhưng quy tắc handbook "sửa vendors.json tay thì sinh lại báo cáo" vẫn phải được chứng minh bằng phép so này).
Sinh lại trong thư mục tạm, mạng bị chặn, không ghi repo. Chạy: python3 -I <file>."""
import filecmp, os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t217 as T

NONET = "import socket\ndef _b(*a, **k):\n    raise OSError('T-217: mang bi chan')\nsocket.socket.connect = _b\nsocket.create_connection = _b\nsocket.getaddrinfo = _b\n"


def run():
    root = T.tohong()
    S, vs = T.target_ids(root)
    notv = [v["id"] for v in vs if v["id"] in set(S) and v.get("verification_status") != "verified"]
    if not S or notv:
        raise T.Fail(f"điều kiện đầu: {len(notv)}/{len(S)} vendor thuộc S chưa verified, chưa có gì để kiểm báo cáo")
    sc = os.path.join(root, "tools", "scraper")
    rep = os.path.join(sc, "output", "HCMC", "enrich-report.json")
    if not os.path.isfile(rep):
        raise T.Fail("thiếu output/HCMC/enrich-report.json")
    tmp = tempfile.mkdtemp(prefix="t217-rep-")
    try:
        nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
        open(os.path.join(nd, "sitecustomize.py"), "w").write(NONET)
        env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="")
        out = os.path.join(tmp, "fresh.json")
        p = subprocess.run([sys.executable, os.path.join(sc, "build_enrich_report.py"), "--state", "HCMC", "--output-dir", os.path.join(sc, "output"), "--out", out],
                           cwd=tmp, env=env, capture_output=True, text=True, timeout=600)
        if p.returncode != 0 or not os.path.isfile(out):
            raise T.Fail(f"build_enrich_report.py thoát {p.returncode}: {(p.stderr or p.stdout)[-200:]}")
        if not filecmp.cmp(out, rep, shallow=False):
            raise T.Fail("enrich-report.json đã commit khác báo cáo sinh lại từ dữ liệu cùng cây (INV-003): chạy lại build_enrich_report.py trong PR dữ liệu")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return "enrich-report.json đúng byte báo cáo sinh lại sau khi đặt verified"


T.R.main_guard(run)
