#!/usr/bin/env python3
"""T-127 adv-04 (adversary, tầng 3): bước "Cổng: nhánh PR dữ liệu đang mở" của apply-review-rule.yml với input lạ mà check_9 chưa chạm (chạy NGUYÊN VĂN run: bằng bash, gh giả;
cwd là một repo git có remote để gh giả không phụ thuộc lỗi chọn repo của adv-02):
  nhiều dòng ("enrich-vendors/ok\\nmain": regex grep chạy THEO DÒNG nên dòng đầu lọt regex, phải bị jq so khớp đúng chặn); PR từ fork (isCrossRepository=true);
  hai PR mở cùng headRefName; headRefName khác hoa/thường; dấu cách cuối; ('..', '.lock' không thử: GitHub không có PR với tên ref git không hợp lệ); tiền tố lồng ("enrich-vendors/../main"); mong thoát khác 0. Đối chứng: nhánh hợp lệ có đúng một PR cùng repo -> 0. In PASS/FAIL."""
import os, subprocess, sys, tempfile, yaml
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-126"))
import _t126 as k
t = k.t
repo = t.c.tohong()
wf = yaml.safe_load(open(os.path.join(repo, ".github", "workflows", "apply-review-rule.yml"), encoding="utf-8"))
steps = next(iter(wf["jobs"].values()))["steps"]
gate = next(s for s in steps if s.get("name") == "Cổng: nhánh PR dữ liệu đang mở")
FAKE = '#!/bin/sh\nif [ "$1" = "pr" ] && [ "$2" = "list" ]; then printf "%s" "$FAKE_GH_JSON"; exit 0; fi\nexit 0\n'
one = lambda b, fork=False: '[{"number":83,"headRefName":"%s","isCrossRepository":%s}]' % (b, "true" if fork else "false")  # noqa: E731
cases = [("enrich-vendors/run-43026321789", one("enrich-vendors/run-43026321789"), True),
         ("enrich-vendors/ok\nmain", one("enrich-vendors/ok"), False),
         ("enrich-vendors/fork1", one("enrich-vendors/fork1", fork=True), False),
         ("enrich-vendors/dup", '[{"number":1,"headRefName":"enrich-vendors/dup","isCrossRepository":false},{"number":2,"headRefName":"enrich-vendors/dup","isCrossRepository":false}]', False),
         ("enrich-vendors/Run-1", one("enrich-vendors/run-1"), False),
         ("enrich-vendors/../main", one("enrich-vendors/../main"), False),
         ("enrich-vendors/x ", one("enrich-vendors/x "), False)]
bad = []
for br, js, want in cases:
    with tempfile.TemporaryDirectory() as ws:
        subprocess.run(["git", "init", "-q", ws]); subprocess.run(["git", "-C", ws, "remote", "add", "origin", "https://github.com/o/r.git"])
        bind = os.path.join(ws, ".bin"); os.makedirs(bind)
        open(os.path.join(bind, "gh"), "w").write(FAKE); os.chmod(os.path.join(bind, "gh"), 0o755)
        env = {"PATH": bind + os.pathsep + os.environ["PATH"], "HOME": ws, "GH_TOKEN": "x", "PR_BRANCH": br, "FAKE_GH_JSON": js, "RUNNER_TEMP": ws}
        r = subprocess.run(["bash", "--noprofile", "--norc", "-e", "-c", gate["run"]], cwd=ws, env=env, capture_output=True, text=True, timeout=30)
        if (r.returncode == 0) != want:
            bad.append("pr_branch=%r thoát %d, mong %s" % (br, r.returncode, "0" if want else "khác 0"))
t.done(bad, "cổng chặn nhánh nhiều dòng, fork, hai PR, khác hoa/thường, '../main', dấu cách; nhận nhánh hợp lệ")
