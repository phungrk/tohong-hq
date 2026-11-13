#!/usr/bin/env python3
"""Eval T-145 tiêu chí 3: dashboard.json đẩy sang repo công khai không lộ thêm gì so với bản --public hiện tại.
Chạy bước đẩy với git giả, so khoá (đệ quy, hợp mọi phần tử) của file đã đẩy với bản `export_dashboard.py --public` mới sinh."""
import json, pathlib, subprocess, sys, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import _wf

def shape(x, path=""):
    s = set()
    if isinstance(x, dict):
        for k, v in x.items():
            s.add(f"{path}/{k}"); s |= shape(v, f"{path}/{k}")
    elif isinstance(x, list):
        for v in x: s |= shape(v, path + "[]")
    return s

sb = _wf.Sandbox(); fails = []
try:
    if len(sb.push) != 1: print("FAIL chưa có bước đẩy dùng DASHBOARD_DATA_TOKEN"); sys.exit(1)
    sb.export()
    r = sb.run_step(sb.push[0], sb.env(_wf.TOKEN))
    t = sb.target()
    if r.returncode != 0 or t is None: print(f"FAIL bước đẩy không chạy xong trên git thật (thoát {r.returncode}): {r.stderr.replace(_wf.TOKEN, '***')[-200:]}"); sys.exit(1)
    names, blobs, _ = t
    if names != ["dashboard.json"]: print(f"FAIL nhánh dashboard-data có {names} (chỉ được dashboard.json)"); sys.exit(1)
    files = {"dashboard.json": blobs["dashboard.json"].decode("utf-8")}
    pushed = json.loads(files["dashboard.json"])
    d = pathlib.Path(tempfile.mkdtemp(prefix="t145pub-", dir=sb.tmp))
    subprocess.run([sys.executable, "scripts/export_dashboard.py", "--public", "--out", str(d)], cwd=_wf.ROOT, check=True, capture_output=True)
    ref = json.loads((d / "dashboard.json").read_text(encoding="utf-8"))
    extra = shape(pushed) - shape(ref)
    if extra: fails.append("khoá thừa so với --public: " + ", ".join(sorted(extra)[:8]))
    if pushed.get("public") is not True: fails.append("trường public phải là true")
    for e in pushed.get("events", []):
        if "detail" in e or "link" in e: fails.append("sự kiện còn detail/link (nội dung chi tiết)"); break
    # không có token/secret lọt vào file
    txt = files["dashboard.json"]
    for needle in ("x-access-token", "gh" + "p_", "github" + "_pat_", _wf.TOKEN):
        if needle in txt: fails.append(f"dashboard.json chứa '{needle}'")
finally:
    sb.cleanup()
print("PASS" if not fails else "FAIL " + " | ".join(fails)); sys.exit(1 if fails else 0)
