#!/usr/bin/env python3
"""Adversary T-146 adv-02: bước cũ "Đẩy lên nhánh dashboard-data" (tohong-hq) còn nguyên và chuỗi thật Xuất -> bước cũ -> bước mới chạy đúng.
  a) thứ tự: Xuất dữ liệu < bước cũ < bước mới; bước cũ vẫn push github.repository nhánh dashboard-data bằng github.token, không nhắc DASHBOARD_DATA_TOKEN
  b) chạy cả chuỗi trên cùng RUNNER_TEMP (bước cũ để lại .git trong out/): cả hai repo đích nhận đúng dashboard.json, repo dashboard chỉ có dashboard.json
  c) workflow có concurrency cấp workflow (hai lần chạy không đẩy song song)
Biểu thức ${{ github.token }} / ${{ github.repository }} được thay bằng giá trị thử lúc chạy (giống runner). Chạy: python3 -I eval/T-146/adv-02.py"""
import os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-145"))
sys.dont_write_bytecode = True
import _wf

fails = []
def bad(m): fails.append(m)

sb = _wf.Sandbox()
try:
    steps = sb.steps; new = sb.push[0]
    names = [s.get("name", "") for s in steps]
    old = [s for s in steps if s.get("name") == "Đẩy lên nhánh dashboard-data"]
    if len(old) != 1: bad("a) không thấy đúng 1 bước cũ 'Đẩy lên nhánh dashboard-data'"); raise SystemExit
    old = old[0]; orun = old.get("run", "")
    if not (steps.index(sb.exp[0]) < steps.index(old) < steps.index(new)): bad(f"a) thứ tự bước sai: {names}")
    for need in ("${{ github.token }}", "${{ github.repository }}", "dashboard-data", "git push -f", 'cd "$RUNNER_TEMP/out"'):
        if need not in orun: bad(f"a) bước cũ mất '{need}'")
    if "DASHBOARD_DATA_TOKEN" in orun or old.get("env"): bad("a) bước cũ bị đổi env / nhắc token mới")
    wf_conc = sb.wf.get("concurrency")
    if not wf_conc: bad("c) workflow không có concurrency")

    # b) chuỗi thật
    tok2 = "gh" + "s_" + "OLDTOKEN" * 4
    hq = sb.tmp / "remote" / "hq.git"
    sb.git("init", "-q", "--bare", "-b", "main", str(hq))
    ref = sb.export().read_bytes()
    e = sb.env(_wf.TOKEN)
    k = int(e["GIT_CONFIG_COUNT"])
    e[f"GIT_CONFIG_KEY_{k}"] = f"url.{hq}.insteadOf"; e[f"GIT_CONFIG_VALUE_{k}"] = f"https://x-access-token:{tok2}@github.com/phungrk/tohong-hq.git"
    e["GIT_CONFIG_COUNT"] = str(k + 1)
    o = dict(old); o["run"] = orun.replace("${{ github.token }}", tok2).replace("${{ github.repository }}", "phungrk/tohong-hq")
    r1 = sb.run_step(o, e)
    if r1.returncode != 0: bad("b) bước cũ đỏ: " + r1.stderr.replace(tok2, "***")[-200:])
    r2 = sb.run_step(new, e)
    if r2.returncode != 0: bad("b) bước mới đỏ sau bước cũ: " + r2.stderr.replace(_wf.TOKEN, "***")[-200:])
    for t in (tok2, _wf.TOKEN):
        if any(t in x for x in (r1.stdout, r1.stderr, r2.stdout, r2.stderr)): bad("b) token lọt log")
    hq_files = sb.git("ls-tree", "-r", "--name-only", "refs/heads/dashboard-data", cwd=hq).splitlines()
    if "dashboard.json" not in hq_files: bad(f"b) nhánh dashboard-data của tohong-hq thiếu dashboard.json: {hq_files}")
    t = sb.target()
    if not t or t[0] != ["dashboard.json"] or t[1]["dashboard.json"] != ref or t[2] != 1: bad(f"b) repo dashboard sai sau chuỗi: {t and (t[0], t[2])}")
    if sb.refs().get("refs/heads/main") != sb.main_sha: bad("b) main repo dashboard đổi")
except SystemExit:
    pass
finally:
    sb.cleanup()
print("PASS" if not fails else "FAIL " + " | ".join(fails)); sys.exit(1 if fails else 0)
