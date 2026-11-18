#!/usr/bin/env python3
"""Nguồn: T-201 (spec products/T-201-deploy-giu-bien-dashboard.md v1; spec-critic rút khi spec qua Spec Gate). Gác ở eval/T-201/bat-bien-cho-merge/
theo ADR-028 (đỏ trên tohong-back main cho tới khi PR của T-201 merge); Chief of Staff đưa vào eval/invariants/planner/admin/ sau merge.
Bất biến: `wrangler deploy` của tohong-back KHÔNG BAO GIỜ ghi đè hay xoá cờ ADMIN_OPEN mà Capu đặt trên Cloudflare dashboard (ADR-116/117: cờ do Capu
tự bật/tắt, kiểu Text). Cụ thể, trong tohong-back:
  (a) wrangler.toml có keep_vars = true (boolean) ở cấp gốc, và không [env.*] nào đặt keep_vars khác true;
  (b) ADMIN_OPEN không là khoá trong [vars] hay [env.*.vars] với BẤT KỲ giá trị nào (keep_vars không cứu biến trùng tên: giá trị toml thắng;
      inv-004 chỉ cấm giá trị "1", bất biến này cấm cả "0"/"" vì chúng cũng xoá lựa chọn của Capu khi deploy);
  (c) không workflow (.github/workflows/*) hay package.json truyền `--var ADMIN_OPEN` cho wrangler, và không workflow nào liệt kê ADMIN_OPEN
      trong khối `vars:` của wrangler-action.
Hệ quả đã biết (ghi để không ai ngạc nhiên): với keep_vars, xoá một khoá khỏi [vars] KHÔNG xoá nó trên Cloudflare; phải xoá tay trên dashboard.
Tự chứa, không mạng: chỉ đọc file. Có selftest đối chứng trên bản sao tạm trước khi quét. Gốc HQ tìm bằng dò ngược tới scripts/gate.py (ADR-057/070),
không đếm cấp. Repo: TOHONG_BACK_REPO (mặc định /home/user/tohong-back). Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm, 2 = không chạy được."""
import os, re, shutil, sys, tempfile, tomllib


def hq_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        p = os.path.dirname(d)
        if p == d:
            return None
        d = p


VAR_FLAG = re.compile(r"--var(?:s)?[= ]+[^\n]*\bADMIN_OPEN\b")


def check(repo):
    """Trả danh sách vi phạm (rỗng = đạt)."""
    hits = []
    toml_path = os.path.join(repo, "wrangler.toml")
    if not os.path.isfile(toml_path):
        return ["không thấy wrangler.toml"]
    try:
        cfg = tomllib.load(open(toml_path, "rb"))
    except Exception as e:
        return ["wrangler.toml không parse được: %s" % e]
    if cfg.get("keep_vars") is not True:
        hits.append("keep_vars cấp gốc là %r, cần true" % (cfg.get("keep_vars"),))
    if "ADMIN_OPEN" in (cfg.get("vars") or {}):
        hits.append("[vars] có ADMIN_OPEN")
    for name, env in (cfg.get("env") or {}).items():
        if not isinstance(env, dict):
            continue
        if "keep_vars" in env and env["keep_vars"] is not True:
            hits.append("[env.%s] đặt keep_vars = %r" % (name, env["keep_vars"]))
        if "ADMIN_OPEN" in (env.get("vars") or {}):
            hits.append("[env.%s.vars] có ADMIN_OPEN" % name)
    files = [os.path.join(repo, "package.json")]
    wf = os.path.join(repo, ".github", "workflows")
    if os.path.isdir(wf):
        files += [os.path.join(wf, f) for f in sorted(os.listdir(wf)) if f.endswith((".yml", ".yaml"))]
    for f in files:
        if not os.path.isfile(f):
            continue
        t = open(f, encoding="utf-8", errors="replace").read()
        rel = os.path.relpath(f, repo)
        if VAR_FLAG.search(t):
            hits.append("%s truyền --var ADMIN_OPEN" % rel)
        # khối `vars:` của wrangler-action: các dòng thụt sâu hơn ngay sau `vars: |`
        lines = t.splitlines()
        for i, line in enumerate(lines):
            m = re.match(r"^(\s*)vars:\s*[|>]?\s*$", line)
            if not m:
                continue
            ind = len(m.group(1))
            for nxt in lines[i + 1:]:
                if nxt.strip() == "":
                    continue
                if len(nxt) - len(nxt.lstrip()) <= ind:
                    break
                if re.search(r"\bADMIN_OPEN\b", nxt):
                    hits.append("%s liệt kê ADMIN_OPEN trong vars: của wrangler-action" % rel)
                    break
    return hits


BASE = 'name = "w"\nmain = "worker.js"\ncompatibility_date = "2026-05-01"\n'
WF_OK = "jobs:\n  d:\n    steps:\n      - uses: cloudflare/wrangler-action@v3\n        with:\n          secrets: |\n            RELAY_SECRET\n"


def selftest():
    cases = [
        ("đúng", BASE + 'keep_vars = true\n[vars]\nA = "1"\n', WF_OK, True),
        ("thiếu keep_vars", BASE + '[vars]\nA = "1"\n', WF_OK, False),
        ("keep_vars chuỗi", BASE + 'keep_vars = "true"\n[vars]\nA = "1"\n', WF_OK, False),
        ("keep_vars trong [vars]", BASE + '[vars]\nkeep_vars = true\n', WF_OK, False),
        ("ADMIN_OPEN=0 trong [vars]", BASE + 'keep_vars = true\n[vars]\nADMIN_OPEN = "0"\n', WF_OK, False),
        ("env tắt keep_vars", BASE + 'keep_vars = true\n[env.p]\nkeep_vars = false\n', WF_OK, False),
        ("env.vars có ADMIN_OPEN", BASE + 'keep_vars = true\n[env.p.vars]\nADMIN_OPEN = ""\n', WF_OK, False),
        ("workflow --var", BASE + 'keep_vars = true\n', WF_OK + "          command: deploy --var ADMIN_OPEN:1\n", False),
        ("workflow vars:", BASE + 'keep_vars = true\n', WF_OK + "          vars: |\n            ADMIN_OPEN\n", False),
        ("đọc env.ADMIN_OPEN trong secrets khác tên vẫn đạt", BASE + 'keep_vars = true\n', WF_OK + "            ADMIN_OPEN_NOTE\n", True),
    ]
    for name, toml, wf, ok in cases:
        d = tempfile.mkdtemp()
        try:
            open(os.path.join(d, "wrangler.toml"), "w").write(toml)
            os.makedirs(os.path.join(d, ".github", "workflows"))
            open(os.path.join(d, ".github", "workflows", "deploy.yml"), "w").write(wf)
            got = not check(d)
        finally:
            shutil.rmtree(d, ignore_errors=True)
        if got != ok:
            print("ERROR selftest '%s': mong %s, được %s" % (name, ok, got)); sys.exit(2)


if hq_root() is None:
    print("ERROR không tìm được gốc tohong-hq (scripts/gate.py) phía trên " + os.path.abspath(__file__)); sys.exit(2)
selftest()
BACK = os.environ.get("TOHONG_BACK_REPO", "/home/user/tohong-back")
if not os.path.isdir(BACK):
    print("FAIL không thấy repo " + BACK); sys.exit(1)
h = check(BACK)
if h:
    print("FAIL " + " | ".join(h)); sys.exit(1)
print("PASS")
