#!/usr/bin/env python3
"""Eval T-145 tiêu chí 1: bước đẩy bản công khai sang repo dashboard (chạy nguyên văn bước run: với git giả).
In PASS hoặc FAIL <lý do>; thoát 0/1. Chạy từ gốc tohong-hq: python3 -I eval/T-145/check_1_workflow.py"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import _wf

OWN = "phungrk/tohong-hq-dashboard"
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
        if not (argv and "pipefail" in argv) and not re.search(r"set\s+-[a-z]*o\s+pipefail|set\s+-eo\s+pipefail", run):
            bad("có ống | nhưng bước không chạy dưới pipefail (inv-006)")

    out_json = sb.export()
    ref = out_json.read_bytes()

    # A. thiếu secret (rỗng và không đặt): xanh, ::warning::, không push
    for label, tok in (("secret rỗng", ""), ("không đặt secret", None)):
        sb.reset_log()
        r = sb.run_step(step, sb.env(tok))
        if r.returncode != 0: bad(f"{label}: bước phải xanh, thoát {r.returncode}: {r.stderr[-200:]}")
        if not re.search(r"^::warning::", r.stdout + "\n" + r.stderr, re.M): bad(f"{label}: thiếu dòng ::warning::")
        if any(c["sub"] == "push" for c in sb.calls()): bad(f"{label}: vẫn gọi git push")

    # B. có secret: đẩy đúng chỗ, đúng dữ liệu
    sb.reset_log()
    r = sb.run_step(step, sb.env(_wf.TOKEN))
    if r.returncode != 0: bad(f"có secret: bước phải xanh, thoát {r.returncode}: {r.stderr[-200:]}")
    if _wf.TOKEN in r.stdout or _wf.TOKEN in r.stderr: bad("token bị in ra log của bước")
    calls = sb.calls(); pushes = [c for c in calls if c["sub"] == "push"]
    if len(pushes) != 1: bad(f"cần đúng 1 lệnh git push, thấy {len(pushes)}")
    else:
        p = pushes[0]; a = p["args"]
        remotes = {}
        for c in calls:
            if c["sub"] == "remote" and "add" in c["args"]:
                x = c["args"]; k = x.index("add"); remotes[x[k + 1]] = x[k + 2]
        pa = a[a.index("push") + 1:]
        if any(o in pa for o in ("--all", "--mirror", "--tags", "--delete", "-d", "--prune")): bad(f"push dùng cờ rộng: {pa}")
        pos = [x for x in pa if not x.startswith("-")]
        url = None; refs = []
        for x in pos:
            if "github.com" in x: url = x
            elif x in remotes: url = remotes[x]
            else: refs.append(x)
        if url is None: bad(f"push không có URL github.com (hoặc remote đã khai): {pa}")
        else:
            m = re.fullmatch(r"https://[^/@\s]+@github\.com/([^/\s]+/[^/\s]+?)(\.git)?", url)
            if not m or m.group(1) != OWN: bad(f"URL push phải trỏ {OWN}, thấy {re.sub(r'//[^@]*@', '//***@', url)}")
            elif _wf.TOKEN not in url: bad("URL push không dùng DASHBOARD_DATA_TOKEN")
        if len(refs) != 1: bad(f"cần đúng 1 refspec, thấy {refs}")
        else:
            dst = refs[0].split(":")[-1].removeprefix("+").removeprefix("refs/heads/")
            if dst != "dashboard-data": bad(f"nhánh đích phải là dashboard-data, thấy {refs[0]}")
        if "main" in " ".join(pa).replace("dashboard-data", ""): bad(f"push nhắc tới main: {pa}")
        if set(p["files"]) != {"dashboard.json"}: bad(f"thư mục lúc push phải chỉ có dashboard.json, thấy {sorted(p['files'])}")
        elif p["files"]["dashboard.json"].encode() != ref: bad("dashboard.json đẩy đi khác output --public của bước Xuất dữ liệu")
    # mọi git gọi trong bước không được nhắc main của repo dashboard
    for c in calls:
        if c["sub"] in ("checkout", "switch", "fetch", "pull", "merge", "rebase") : bad(f"không cần git {c['sub']} (tránh chạm main): {c['args']}")

    # C. lỗi git ở push / commit khi có secret → đỏ
    for sub in ("push", "commit"):
        sb.reset_log()
        r = sb.run_step(step, sb.env(_wf.TOKEN, fail=sub))
        if r.returncode == 0: bad(f"git {sub} lỗi mà bước vẫn xanh")
        if _wf.TOKEN in r.stdout or _wf.TOKEN in r.stderr: bad(f"token bị in ra khi git {sub} lỗi")
finally:
    sb.cleanup()

print("PASS" if not fails else "FAIL " + " | ".join(fails))
sys.exit(1 if fails else 0)
