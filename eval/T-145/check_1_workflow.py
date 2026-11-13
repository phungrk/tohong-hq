#!/usr/bin/env python3
"""Eval T-145 tiêu chí 1: bước đẩy bản công khai sang repo dashboard. Chạy nguyên văn bước run: bằng git thật, URL đẩy chuyển vào bare repo cục bộ,
kiểm trên ref đích. In PASS hoặc FAIL <lý do>; thoát 0/1. Chạy từ gốc tohong-hq: python3 -I eval/T-145/check_1_workflow.py"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
import _wf

fails = []
def bad(m): fails.append(m)

sb = _wf.Sandbox()
try:
    if len(sb.push) != 1:
        print(f"FAIL cần đúng 1 bước có env lấy secrets.DASHBOARD_DATA_TOKEN, thấy {len(sb.push)}"); sys.exit(1)
    if not sb.exp:
        print("FAIL không thấy bước chạy export_dashboard.py"); sys.exit(1)
    step = sb.push[0]; run = step.get("run", "")
    # tĩnh
    if "${{" in run: bad("run: chứa ${{ }} (token phải vào qua env của bước, không nội suy vào lệnh)")
    if str(step.get("continue-on-error")).lower() == "true": bad("continue-on-error: true làm lỗi push thành xanh")
    if re.search(r"set\s+-[a-z]*x|printenv|^\s*env\s*$", run, re.M): bad("bước in môi trường / bật xtrace (lộ token)")
    for s in sb.steps:
        if s is not step and "secrets.DASHBOARD_DATA_TOKEN" in json.dumps(s): bad("secret DASHBOARD_DATA_TOKEN xuất hiện ở bước khác")
    stripped = re.sub(r"\"[^\"\n]*\"|'[^'\n]*'", "", run.replace("||", ""))
    if re.search(r"(?<!\|)\|(?!\|)", stripped):
        argv = _wf.shell_argv(sb.wf, sb.job, step, "x")
        if not (argv and "pipefail" in argv) and not re.search(r"set\s+-[a-z]*o\s+pipefail", run):
            bad("có ống | nhưng bước không chạy dưới pipefail (planner INV-006)")

    ref = sb.export().read_bytes()

    # A. thiếu secret (rỗng, không đặt): xanh, ::warning::, không push, bare repo không đổi
    for label, tok in (("secret rỗng", ""), ("không đặt secret", None)):
        sb.reset()
        r = sb.run_step(step, sb.env(tok))
        if r.returncode != 0: bad(f"{label}: bước phải xanh, thoát {r.returncode}: {r.stderr[-200:]}")
        if not re.search(r"^::warning::", r.stdout + "\n" + r.stderr, re.M): bad(f"{label}: thiếu dòng ::warning::")
        if any(c["sub"] == "push" for c in sb.calls()): bad(f"{label}: vẫn gọi git push")
        if sb.refs() != {"refs/heads/main": sb.main_sha}: bad(f"{label}: ref của repo đích đã đổi")

    # B. có secret: đo trên ref đích
    sb.reset()
    r = sb.run_step(step, sb.env(_wf.TOKEN))
    if r.returncode != 0: bad(f"có secret: bước phải xanh trên git thật, thoát {r.returncode}: {r.stderr.replace(_wf.TOKEN, '***')[-300:]}")
    if _wf.TOKEN in r.stdout or _wf.TOKEN in r.stderr: bad("token bị in ra log của bước")
    pushes = [c for c in sb.calls() if c["sub"] == "push"]
    if len(pushes) != 1: bad(f"cần đúng 1 lệnh git push, thấy {len(pushes)}")
    for c in pushes:
        if any(o in c["args"] for o in ("--all", "--mirror", "--tags", "--delete", "-d", "--prune")): bad(f"push dùng cờ rộng: {c['args']}")
    refs = sb.refs()
    if refs.get("refs/heads/main") != sb.main_sha: bad("main của repo đích đã đổi")
    extra = set(refs) - {"refs/heads/main", "refs/heads/dashboard-data"}
    if extra: bad(f"repo đích có ref lạ: {sorted(extra)}")
    t = sb.target()
    if t is None: bad("repo đích không có refs/heads/dashboard-data sau bước")
    else:
        names, blobs, ncommit = t
        if names != ["dashboard.json"]: bad(f"nhánh dashboard-data phải chỉ có dashboard.json, thấy {names}")
        elif blobs["dashboard.json"] != ref: bad("dashboard.json trên nhánh đích khác từng byte output --public của bước Xuất dữ liệu")
        if ncommit != 1: bad(f"nhánh dashboard-data phải có đúng 1 commit, thấy {ncommit}")

    # C. lỗi git khi có secret → đỏ, không lộ token
    for sub in ("push", "commit"):
        sb.reset()
        r = sb.run_step(step, sb.env(_wf.TOKEN, fail=sub))
        if r.returncode == 0: bad(f"git {sub} lỗi mà bước vẫn xanh")
        if _wf.TOKEN in r.stdout or _wf.TOKEN in r.stderr: bad(f"token bị in ra khi git {sub} lỗi")
finally:
    sb.cleanup()

print("PASS" if not fails else "FAIL " + " | ".join(fails))
sys.exit(1 if fails else 0)
