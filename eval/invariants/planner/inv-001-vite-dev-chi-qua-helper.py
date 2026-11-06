#!/usr/bin/env python3
"""Nguồn: T-053 (spec products/T-053-sua-phep-do-vite.md v3, ADR-024, "Sản phẩm của việc": helper dựng vite dev dùng chung), T-071 adversary accept 2026-11-06.
INV-001 (planner) · Mọi eval của sản phẩm planner dựng MÁY CHỦ vite (dev/preview) đều đi qua eval/_lib/vite_dev.cjs (startViteDev): nhóm tiến trình riêng,
cổng listen(0) + --strictPort, thăm dò nonce, dọn file thử. Không eval nào ngoài helper tự chạy vite thành máy chủ:
  cấm `npx vite` / `npm exec vite` / spawn `node_modules/.bin/vite` / `vite/bin/vite.js` / spawn('vite') mà KHÔNG phải `build`,
  cấm `npm|pnpm|yarn run dev|preview`, cấm require/import('vite') rồi createServer/preview (API máy chủ của vite) ngoài helper.
`vite build` (chạy xong thoát) vẫn được phép: lệnh có chữ `build` trong 300 ký tự ngay sau tên vite thì không tính.
Lý do: dựng vite tự chế từng gây FAIL giả (cổng bị vite lạ giữ, thăm dò 200 từ máy chủ khác) và vite mồ côi (T-052, T-053).
Đo: quét mã đã bỏ comment (Python: comment + docstring ba nháy; shell: #; JS: // và /* */) trong eval/**/*.{py,sh,cjs,js,mjs}.
Ngoại lệ có tên: chính helper, file này, và hai eval kiểm CHÍNH helper (T-053 check_4 đối chứng tĩnh, check_6 vite giả) vì chúng phải chứa mẫu sai làm dữ liệu thử.
Có selftest đối chứng trước khi quét. Chạy không tham số (gate.py: python3 -I). Mã thoát 0 = đạt."""
import io, os, re, sys, tokenize

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
EXEMPT = {"eval/_lib/vite_dev.cjs", "eval/T-053/check_4_cho_theo_dieu_kien.py", "eval/T-053/check_6_helper_nonce.py"}

# Tên lệnh vite; sau nó 300 ký tự không có 'build' -> máy chủ.
BIN = re.compile(r"""\bnpx\W{1,8}(?:-y\W{1,8}|--yes\W{1,8})?vite\b|\bnpm\W{1,8}exec\W{1,8}(?:--\W{1,8})?vite\b|\.bin/vite\b|\.bin['"`]\s*,\s*['"`]vite['"`]|\bvite/bin/vite(?:\.js)?\b|"""
                 r"""\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork|Popen|run|call|check_call|check_output)\s*\(\s*\[?\s*['"`]vite\b""")
SCRIPT = re.compile(r"""\b(?:npm|pnpm|yarn)\W{1,8}(?:run\W{1,8})?(?:dev|preview|serve)\b""")
VITE_MOD = re.compile(r"""require\(\s*['"`]vite['"`]\s*\)|import\(\s*['"`]vite['"`]\s*\)|from\s+['"`]vite['"`]""")
VITE_SERVER_API = re.compile(r"""\bcreateServer\s*\(|\bpreview\s*\(""")
HTTP_SERVER = re.compile(r"""\b(?:http|https|net)\.createServer\s*\(""")

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
    src = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", l) for l in src.splitlines())

def offenders(path, src):
    ext = os.path.splitext(path)[1]
    c = py_code(src) if ext == ".py" else sh_code(src) if ext == ".sh" else js_code(src)
    why = []
    for m in BIN.finditer(c):
        if not re.search(r"\bbuild\b", c[m.end():m.end() + 300]): why.append("chạy vite không phải build: " + m.group(0)[:40])
    for m in SCRIPT.finditer(c): why.append("chạy script máy chủ: " + m.group(0)[:40])
    if VITE_MOD.search(c) and VITE_SERVER_API.search(HTTP_SERVER.sub(" ", c)): why.append("dùng API máy chủ của vite (createServer/preview) ngoài helper")
    return why

def selftest():
    bad = []
    wrong = {"a.cjs": "const v = cp.spawn('npx', ['vite', '--port', String(p)], { detached: true });\n",
             "b.cjs": "cp.spawn(path.join(REPO, 'node_modules/.bin/vite'), ['--port', '5173', '--strictPort']);\n",
             "c.cjs": "cp.spawn(path.join(REPO, 'node_modules', '.bin', 'vite'), ['--host']);\n",
             "d.cjs": "cp.spawn(process.execPath, [path.join(REPO, 'node_modules/vite/bin/vite.js'), '--port', '5555']);\n",
             "e.cjs": "const { createServer } = require('vite');\n(async () => { const s = await createServer({ root: REPO }); await s.listen(); })();\n",
             "f.mjs": "import { createServer } from 'vite';\nconst s = await createServer({});\n",
             "g.py": "import subprocess\nsubprocess.Popen(['npx', 'vite', '--port', '5100'], cwd=front)\n",
             "h.sh": "cd \"$FRONT\" && npx vite --port 5300 &\n",
             "i.sh": "npm run dev -- --port 5400 &\n",
             "j.cjs": "cp.spawn('vite', ['--port', '5100'], { cwd: REPO });\n",
             "k.cjs": "const v = await import('vite'); const s = await v.preview({ root: REPO });\n"}
    for name, src in wrong.items():
        if not offenders(name, src): bad.append(f"bản sai {name} lọt")
    right = {"r1.cjs": "const { startViteDev } = require('../_lib/vite_dev.cjs');\nconst dev = await startViteDev({ repo: REPO, files });\n",
             "r2.cjs": "execSync(`npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { cwd: REPO });\nconst server = http.createServer((q, r) => {});\n",
             "r3.cjs": "const bin = path.join(repo, 'node_modules/.bin/vite');\nconst r = await runGroup(bin, ['build', '--outDir', dist, '--emptyOutDir'], { cwd: repo });\n",
             "r4.py": '"""Cấm npx vite --port; dùng helper."""\nb = run(f"npx vite build --outDir {out} --emptyOutDir", front)  # không npx vite dev\n',
             "r5.cjs": "// đừng spawn('npx', ['vite']) nữa\n/* cp.spawn(REPO + '/node_modules/.bin/vite', ['--port']) */\nconst s = http.createServer(() => {}); s.listen(0);\n",
             "r6.sh": "# npx vite --port 5100 là cách cũ\nnode eval/T-051/check_9_front_anh_mac_dinh.cjs \"$FRONT\"\n"}
    for name, src in right.items():
        if offenders(name, src): bad.append(f"bản đúng {name} bị báo đỏ oan: {offenders(name, src)}")
    return bad

errs = selftest()
if errs: print("FAIL selftest INV-001 (planner): " + "; ".join(errs)); sys.exit(1)
hits = []
for root, dirs, files in os.walk(os.path.join(HQ, "eval")):
    dirs[:] = [d for d in dirs if d not in ("node_modules", "__pycache__", ".git")]
    for f in files:
        if os.path.splitext(f)[1] not in (".py", ".sh", ".cjs", ".js", ".mjs"): continue
        p = os.path.join(root, f); rel = os.path.relpath(p, HQ)
        if rel in EXEMPT or os.path.abspath(p) == os.path.abspath(__file__): continue
        try: src = open(p, encoding="utf-8", errors="replace").read()
        except OSError: continue
        w = offenders(p, src)
        if w: hits.append(f"{rel} ({w[0]})")
if hits: print("FAIL eval dựng máy chủ vite ngoài eval/_lib/vite_dev.cjs: " + "; ".join(sorted(hits)[:8])); sys.exit(1)
print("PASS mọi eval dựng máy chủ vite đều qua eval/_lib/vite_dev.cjs (vite build vẫn được phép)")
