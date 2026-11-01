#!/usr/bin/env python3
"""Eval T-027 tiêu chí 7: BotMarkdown + khối .md giữ nguyên; build xanh; lint không tăng lỗi so với base (ADR-006).
Chạy: python3 eval/T-027/check_5_guard.py --repo /đường/dẫn/tohong-front [--base origin/main]
In PASS hoặc FAIL <lý do>; mã thoát 0/1. Phần "BotMarkdown render bảng" kiểm bằng hành vi ở check_width.cjs (bước chat AI)."""
import argparse, json, os, re, subprocess, sys, tempfile, shutil

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--base', default='origin/main')
a = ap.parse_args()
repo = os.path.abspath(a.repo)
fails = []

def run(cmd, cwd, env=None):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, env={**os.environ, **(env or {})})

def read(p):
    try:
        return open(os.path.join(repo, p), encoding='utf-8').read()
    except OSError:
        return ''

# 1) thành phần được bảo vệ (constitution V của tohong): chúng còn đó
chat = read('src/screens/chat/AppChat.jsx')
for needle, label in [(r'function\s+BotMarkdown|const\s+BotMarkdown', 'BotMarkdown'),
                      (r"import\s+Markdown\s+from\s+['\"]react-markdown['\"]", "import Markdown from 'react-markdown'"),
                      (r"import\s+remarkGfm\s+from\s+['\"]remark-gfm['\"]", "import remarkGfm from 'remark-gfm'")]:
    if not re.search(needle, chat):
        fails.append(f'mất {label} trong AppChat.jsx')
md_rules = lambda t: len(re.findall(r'(?m)^\.md[\s>.:,{]', t))
base_css = run(f'git show {a.base}:src/index.css', repo).stdout
if md_rules(read('src/index.css')) < max(1, md_rules(base_css)):
    fails.append(f'khối .md trong index.css bị mất quy tắc ({md_rules(read("src/index.css"))} < {md_rules(base_css)} ở {a.base})')
pkg = json.loads(read('package.json') or '{}')
for d in ('react-markdown', 'remark-gfm'):
    if d not in pkg.get('dependencies', {}):
        fails.append(f'mất dependency {d}')

# 2) build xanh (ra thư mục tạm, không ghi vào repo)
out = tempfile.mkdtemp(prefix='t027-build-')
r = run(f'npx vite build --outDir {out} --emptyOutDir', repo, {'VITE_CLERK_PUBLISHABLE_KEY': ''})
if r.returncode != 0:
    fails.append('build lỗi: ' + (r.stderr or r.stdout).strip().splitlines()[-1][:160])
shutil.rmtree(out, ignore_errors=True)

# 3) lint không tăng so với base
def lint(cwd):
    r = run('npx eslint . -f json', cwd)
    try:
        data = json.loads(r.stdout)
    except Exception:
        return None
    return {os.path.relpath(f['filePath'], cwd): (f['errorCount'], f['warningCount']) for f in data}

cur = lint(repo)
tmp = tempfile.mkdtemp(prefix='t027-base-')
ar = run(f'git archive {a.base} | tar -x -C {tmp}', repo)
base = None
if ar.returncode == 0:
    os.symlink(os.path.join(repo, 'node_modules'), os.path.join(tmp, 'node_modules'))
    base = lint(tmp)
shutil.rmtree(tmp, ignore_errors=True)
if cur is None or base is None:
    fails.append('không chạy được eslint ở nhánh hiện tại hoặc ở base ' + a.base)
else:
    ce, cw = sum(v[0] for v in cur.values()), sum(v[1] for v in cur.values())
    be, bw = sum(v[0] for v in base.values()), sum(v[1] for v in base.values())
    if ce > be or cw > bw:
        fails.append(f'lint tăng: error {be}->{ce}, warning {bw}->{cw}')
    for f, (e, w) in cur.items():
        if f not in base and (e or w):
            fails.append(f'file mới {f} có lỗi lint ({e} error, {w} warning)')
    print(f'lint: base {be} error/{bw} warning; hiện tại {ce}/{cw}')

if fails:
    print('FAIL ' + '; '.join(fails)); sys.exit(1)
print('PASS'); sys.exit(0)
