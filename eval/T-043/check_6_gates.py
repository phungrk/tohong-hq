#!/usr/bin/env python3
"""Eval T-043 tiêu chí 6 (phần cổng của hai repo):
  - tohong-back: `npm test` xanh, và script "test" trong package.json thực sự chạy một file test có chứa route /api/admin/members-list
    (để bộ test của repo bảo vệ route này mãi, không chỉ eval ngoài repo);
  - tohong-front: `vite build` xanh (ra thư mục tạm, không ghi vào repo); lint không tăng error/warning so với base (ADR-006), file mới không có lỗi lint.
Chạy: python3 eval/T-043/check_6_gates.py --back /đường/dẫn/tohong-back --front /đường/dẫn/tohong-front [--base origin/main]
In PASS hoặc FAIL <lý do>; mã thoát 0/1. 'Mỗi repo một PR' và 'PR có ảnh' ở checklist.md / check_6_shots.py."""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('--back', required=True)
ap.add_argument('--front', required=True)
ap.add_argument('--base', default='origin/main')
a = ap.parse_args()
back, front = os.path.abspath(a.back), os.path.abspath(a.front)
fails = []

def run(cmd, cwd, env=None):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, env={**os.environ, **(env or {})})

# --- back ---
r = run('npm test 2>&1 | tail -15', back)
t = run('npm test >/dev/null 2>&1; echo $?', back).stdout.strip()
if t != '0':
    fails.append('back: npm test đỏ: ' + ' | '.join(r.stdout.strip().splitlines()[-4:])[:200])
try:
    pkg = json.load(open(os.path.join(back, 'package.json'), encoding='utf-8'))
    script = pkg.get('scripts', {}).get('test', '')
except Exception:
    script = ''
files = re.findall(r'(test/[\w./-]+\.js)', script)
covered = [f for f in files if os.path.exists(os.path.join(back, f)) and 'members-list' in open(os.path.join(back, f), encoding='utf-8').read()]
if not covered:
    fails.append('back: script "test" không chạy file test nào nhắc tới route members-list')

# --- front ---
out = tempfile.mkdtemp(prefix='t043-build-')
b = run(f'npx vite build --outDir {out} --emptyOutDir', front, {'VITE_CLERK_PUBLISHABLE_KEY': ''})
if b.returncode != 0:
    fails.append('front: build lỗi: ' + ((b.stderr or b.stdout).strip().splitlines() or ['?'])[-1][:160])
shutil.rmtree(out, ignore_errors=True)

def lint(cwd):
    r = run('npx eslint . -f json', cwd)
    try:
        return {os.path.relpath(f['filePath'], cwd): (f['errorCount'], f['warningCount']) for f in json.loads(r.stdout)}
    except Exception:
        return None

cur = lint(front)
tmp = tempfile.mkdtemp(prefix='t043-base-')
base = None
if run(f'git archive {a.base} | tar -x -C {tmp}', front).returncode == 0:
    os.symlink(os.path.join(front, 'node_modules'), os.path.join(tmp, 'node_modules'))
    base = lint(tmp)
shutil.rmtree(tmp, ignore_errors=True)
if cur is None or base is None:
    fails.append('front: không chạy được eslint ở nhánh hiện tại hoặc ở base ' + a.base)
else:
    ce, cw = sum(v[0] for v in cur.values()), sum(v[1] for v in cur.values())
    be, bw = sum(v[0] for v in base.values()), sum(v[1] for v in base.values())
    if ce > be or cw > bw:
        fails.append(f'front: lint tăng: error {be}->{ce}, warning {bw}->{cw}')
    for f, (e, w) in cur.items():
        if f not in base and (e or w):
            fails.append(f'front: file mới {f} có lỗi lint ({e} error, {w} warning)')
    print(f'lint front: base {be} error/{bw} warning; hiện tại {ce}/{cw}')

if fails:
    print('FAIL ' + '; '.join(fails)); sys.exit(1)
print('PASS'); sys.exit(0)
