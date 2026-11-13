#!/usr/bin/env python3
"""Adversary T-146 adv-01: bước "Đẩy bản công khai sang repo dashboard" trong các tình huống eval T-145 chưa chạm.
  a) lần chạy thứ hai: repo đích ĐÃ có nhánh dashboard-data (lịch sử khác, có thêm file) -> sau bước vẫn đúng 1 commit, chỉ dashboard.json mới, main không đổi
  b) $RUNNER_TEMP/dashboard-public còn rác từ lần trước (tasks.json) -> không lọt lên nhánh
  c) $RUNNER_TEMP có dấu cách -> vẫn chạy đúng
  d) thiếu $RUNNER_TEMP/out/dashboard.json -> bước đỏ, không push
  e) token lạ (có dấu cách / xuống dòng) mà push hỏng -> đỏ, token không vào log
Chạy từ gốc tohong-hq: python3 -I eval/T-146/adv-01.py"""
import pathlib, shutil, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-145"))
sys.dont_write_bytecode = True
import _wf

fails = []
def bad(m): fails.append(m)
def clean(s, tok): return s.replace(tok, "***")

sb = _wf.Sandbox()
try:
    step = sb.push[0]
    ref = sb.export().read_bytes()

    # a) nhánh dashboard-data đã tồn tại ở đích với lịch sử 2 commit và file lạ
    sb.reset()
    w = sb.tmp / "old"; w.mkdir()
    sb.git("init", "-q", "-b", "dashboard-data", cwd=w)
    (w / "dashboard.json").write_text('{"cu": 1}\n'); (w / "tasks.json").write_text("[]\n")
    sb.git("add", "-A", cwd=w); sb.git("commit", "-q", "-m", "c1", cwd=w, env=_wf.SEED_ENV)
    (w / "dashboard.json").write_text('{"cu": 2}\n')
    sb.git("commit", "-qam", "c2", cwd=w, env=_wf.SEED_ENV)
    sb.git("push", "-q", str(sb.bare), "dashboard-data", cwd=w)
    r = sb.run_step(step, sb.env(_wf.TOKEN))
    if r.returncode != 0: bad(f"a) lần chạy thứ hai đỏ: {clean(r.stderr, _wf.TOKEN)[-200:]}")
    t = sb.target()
    if not t or t[0] != ["dashboard.json"] or t[1]["dashboard.json"] != ref or t[2] != 1:
        bad(f"a) nhánh đích sau lần chạy thứ hai sai: {t and (t[0], t[2])}")
    if sb.refs().get("refs/heads/main") != sb.main_sha: bad("a) main đích đổi")

    # b) thư mục tạm còn rác
    sb.reset()
    junk = sb.tmp / "runner" / "dashboard-public"; junk.mkdir(exist_ok=True)
    (junk / "tasks.json").write_text("[]\n")
    r = sb.run_step(step, sb.env(_wf.TOKEN))
    t = sb.target()
    if r.returncode != 0 or not t or t[0] != ["dashboard.json"]: bad(f"b) rác trong thư mục tạm lọt lên nhánh hoặc bước đỏ: {t and t[0]}")

    # c) RUNNER_TEMP có dấu cách
    sb.reset()
    sp = sb.tmp / "run ner"; (sp / "out").mkdir(parents=True)
    shutil.copy(sb.tmp / "runner" / "out" / "dashboard.json", sp / "out" / "dashboard.json")
    e = sb.env(_wf.TOKEN); e["RUNNER_TEMP"] = str(sp)
    r = sb.run_step(step, e)
    t = sb.target()
    if r.returncode != 0 or not t or t[1].get("dashboard.json") != ref: bad(f"c) RUNNER_TEMP có dấu cách hỏng: {clean(r.stderr, _wf.TOKEN)[-200:]}")

    # d) thiếu dashboard.json
    sb.reset()
    emp = sb.tmp / "empty"; (emp / "out").mkdir(parents=True)
    e = sb.env(_wf.TOKEN); e["RUNNER_TEMP"] = str(emp)
    r = sb.run_step(step, e)
    if r.returncode == 0: bad("d) thiếu dashboard.json mà bước xanh")
    if any(c["sub"] == "push" for c in sb.calls()): bad("d) thiếu dashboard.json mà vẫn push")

    # e) token lạ, push hỏng (URL không chuyển hướng được -> chỗ không tồn tại)
    for label, tok in (("dấu cách", "gh" + "p_" + "WEIRD" * 6 + " x"), ("xuống dòng", "gh" + "p_" + "WEIRD" * 6 + "\n")):
        sb.reset()
        r = sb.run_step(step, sb.env(tok))
        core = tok.strip().split()[0]
        if r.returncode == 0: bad(f"e) token {label}: push không thể thành công mà bước xanh")
        if core in r.stdout or core in r.stderr: bad(f"e) token {label}: lọt vào log")
finally:
    sb.cleanup()
print("PASS" if not fails else "FAIL " + " | ".join(fails)); sys.exit(1 if fails else 0)
