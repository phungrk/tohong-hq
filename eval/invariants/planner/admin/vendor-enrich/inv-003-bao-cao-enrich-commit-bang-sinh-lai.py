#!/usr/bin/env python3
"""Bất biến chờ merge (vùng planner/admin/vendor-enrich) · nguồn: ADR-068 mục 3, adversary 2026-11-12 (Code Gate T-132; sự cố: tohong#84 merge
với enrich-report.json dựng trước #83/#86, main báo 876/370 trong khi dữ liệu là 870/373, không cổng nào chặn).
INV-??? · Trong repo tohong, `tools/scraper/output/<state>/enrich-report.json` đã commit BẰNG ĐÚNG BYTE báo cáo sinh lại bằng
`tools/scraper/build_enrich_report.py` từ chính dữ liệu `output/` của cùng commit đó (mọi state có báo cáo).
Lý do: bảng admin và các ô đếm Capu đọc để quyết lấy từ file này (nhúng vào back); PR dữ liệu nào đổi vendors.json / audit / overrides
mà không sinh lại báo cáo thì số trên bảng sai mà không ai thấy. inv-001 (phân hoạch) không bắt được vì báo cáo cũ vẫn là một phân hoạch.
Sinh lại vào thư mục tạm, mạng bị chặn (sitecustomize), không ghi gì trong repo (không .pyc). Chưa áp dụng (PASS) khi repo chưa có
build_enrich_report.py. Repo: TOHONG_REPO hoặc ../tohong. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import glob, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "decisions")) and os.path.isdir(os.path.join(d, "eval")):
            return d
        d = os.path.dirname(d)
HQ = hq_root(HERE) or os.getcwd()
T = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if p and os.path.isfile(os.path.join(p, "tools", "scraper", "enrich.py"))), None)
if not T:
    print("FAIL không thấy repo tohong (đặt TOHONG_REPO)"); sys.exit(1)
sc = os.path.join(T, "tools", "scraper")
script = os.path.join(sc, "build_enrich_report.py")
if not os.path.isfile(script):
    print("PASS chưa áp dụng (tohong chưa có build_enrich_report.py)"); sys.exit(0)
out_dir = os.path.join(sc, "output")
reports = sorted(glob.glob(os.path.join(out_dir, "*", "enrich-report.json")))
if not reports:
    print("FAIL có build_enrich_report.py nhưng không có output/<state>/enrich-report.json nào được commit"); sys.exit(1)

NONET = r'''
import socket
def _blocked(*a, **k):
    raise OSError("bất biến enrich-report: mạng bị chặn")
socket.socket.connect = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _blocked
'''
tmp = tempfile.mkdtemp(prefix="inv-enrich-report-")
bad = []
try:
    nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
    open(os.path.join(nd, "sitecustomize.py"), "w").write(NONET)
    env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="")
    for rp in reports:
        state = os.path.basename(os.path.dirname(rp))
        fresh = os.path.join(tmp, f"{state}.json")
        p = subprocess.run([sys.executable, script, "--state", state, "--output-dir", out_dir, "--out", fresh],
                           cwd=tmp, env=env, capture_output=True, text=True, timeout=600)
        if p.returncode != 0 or not os.path.isfile(fresh):
            bad.append(f"{state}: build_enrich_report.py thoát {p.returncode}: {(p.stderr or p.stdout)[-200:]}"); continue
        if open(fresh, "rb").read() != open(rp, "rb").read():
            bad.append(f"{state}: enrich-report.json đã commit khác báo cáo sinh lại từ dữ liệu cùng commit (báo cáo cũ; chạy lại build_enrich_report.py trong PR dữ liệu)")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if bad:
    print(f"FAIL {bad[0]}" + (f" (+{len(bad)-1})" if len(bad) > 1 else "")); sys.exit(1)
print(f"PASS {len(reports)} báo cáo enrich đã commit bằng đúng byte báo cáo sinh lại"); sys.exit(0)
