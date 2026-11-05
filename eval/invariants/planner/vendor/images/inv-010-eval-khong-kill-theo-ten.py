#!/usr/bin/env python3
"""Nguồn: T-053 (spec products/T-053-sua-phep-do-vite.md v3, Hành vi 2 và Ràng buộc "Không dùng pkill -f vite; chỉ kill pid/nhóm do chính eval tạo"), qua Spec Gate 2026-11-05, spec-critic.
INV-010 · Không eval nào trong eval/ dừng tiến trình theo TÊN (pkill, killall, `pgrep ... | xargs kill`): kill theo tên giết nhầm vite/node của phiên
khác chạy cùng lúc và làm eval của phiên đó FAIL giả. Eval chỉ được kill pid hoặc nhóm tiến trình do chính nó tạo.
Đo: quét mã (bỏ comment dòng và docstring/chuỗi ba nháy của Python, comment # của shell, comment // và /* */ của JS) trong eval/**/*.{py,sh,cjs,js,mjs}.
Có selftest đối chứng trước khi quét. Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import io, os, re, sys, tokenize

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", ".."))
PAT = re.compile(r"\bpkill\b|\bkillall\b|\bpgrep\b[^\n]*\|\s*xargs\s+kill")

def py_code(src):
    out = []
    try:
        for t in tokenize.generate_tokens(io.StringIO(src).readline):
            if t.type == tokenize.COMMENT: continue
            if t.type == tokenize.STRING and re.match(r"^[rbuRBUfF]*('''|\"\"\")", t.string): continue
            out.append(t.string)
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    return " ".join(out)

def sh_code(src):
    return "\n".join(re.sub(r"(^|\s)#.*$", "", l) for l in src.splitlines())

def js_code(src):
    src = re.sub(r"(?m)^\s*/\*.*?\*/", " ", src, flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", l) for l in src.splitlines() if not l.lstrip().startswith(("//", "*", "/*")))

def offenders(path, src):
    ext = os.path.splitext(path)[1]
    c = py_code(src) if ext == ".py" else sh_code(src) if ext == ".sh" else js_code(src)
    return PAT.findall(c)

def selftest():
    bad = []
    for name, src in {"x.py": "subprocess.run(['pkill', '-f', 'vite'])\n", "x.sh": "pkill -f vite\n", "x.cjs": "cp.execSync('killall node');\n",
                      "y.sh": "pgrep -f vite | xargs kill -9\n"}.items():
        if not offenders(name, src): bad.append(f"bản sai {name} lọt")
    for name, src in {"a.py": '"""Không dùng pkill -f; chỉ kill pid."""\nimport os  # không pkill\nos.killpg(1, 9)\n', "a.sh": "# không pkill -f\nkill -- -$PID\n",
                      "a.cjs": "// không pkill -f vite\n/* killall cũng cấm */\nprocess.kill(-pid, 'SIGKILL');\n"}.items():
        if offenders(name, src): bad.append(f"bản đúng {name} bị báo đỏ oan")
    return bad

errs = selftest()
if errs: print("FAIL selftest INV-010: " + "; ".join(errs)); sys.exit(1)
hits = []
for root, dirs, files in os.walk(os.path.join(HQ, "eval")):
    dirs[:] = [d for d in dirs if d not in ("node_modules", "__pycache__", ".git")]
    for f in files:
        if os.path.splitext(f)[1] not in (".py", ".sh", ".cjs", ".js", ".mjs"): continue
        p = os.path.join(root, f)
        if os.path.abspath(p) == os.path.abspath(__file__): continue
        try: src = open(p, encoding="utf-8", errors="replace").read()
        except OSError: continue
        if offenders(p, src): hits.append(os.path.relpath(p, HQ))
if hits: print("FAIL eval dừng tiến trình theo tên (pkill/killall/pgrep|xargs kill): " + ", ".join(sorted(hits)[:10])); sys.exit(1)
print("PASS không eval nào kill tiến trình theo tên")
