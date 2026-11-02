#!/usr/bin/env python3
"""Eval T-045 tiêu chí 7 (cổng hai repo): back `npm test` xanh; front `npm run test:journey` xanh, `vite build` xanh (thư mục tạm),
lint không tăng error/warning so với base (ADR-006).
Chạy: python3 eval/T-045/check_7_gates.py --back /đường/dẫn/tohong-back --front /đường/dẫn/tohong-front [--base origin/main]
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import argparse, json, os, re, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument('--back', required=True); ap.add_argument('--front', required=True); ap.add_argument('--base', default='origin/main')
a = ap.parse_args()
back, front = os.path.abspath(a.back), os.path.abspath(a.front)
fails = []

def run(cmd, cwd, env=None):
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, env={**os.environ, **(env or {})})

r = run('npm test 2>&1', back)
if r.returncode != 0:
    fails.append('back: npm test đỏ: ' + ' | '.join(r.stdout.strip().splitlines()[-3:])[:200])
r = run('npm run test:journey 2>&1', front)
if r.returncode != 0:
    fails.append('front: npm run test:journey đỏ: ' + ' | '.join(r.stdout.strip().splitlines()[-3:])[:200])
out = tempfile.mkdtemp(prefix='t045-build-')
b = run(f'npx vite build --outDir {out} --emptyOutDir', front, {'VITE_CLERK_PUBLISHABLE_KEY': ''})
if b.returncode != 0:
    fails.append('front: build lỗi: ' + ((b.stderr or b.stdout).strip().splitlines() or ['?'])[-1][:160])

def lint_counts(cwd):
    p = run('npx eslint . -f json', cwd)
    try:
        data = json.loads(p.stdout)
    except Exception:
        return None
    return sum(f['errorCount'] for f in data), sum(f['warningCount'] for f in data)

now = lint_counts(front)
if now is None:
    fails.append('front: eslint không chạy được')
else:
    wt = tempfile.mkdtemp(prefix='t045-base-')
    w = run(f'git worktree add --detach {wt} {a.base} 2>&1', front)
    if w.returncode != 0:
        fails.append('front: không dựng được bản base để so lint: ' + w.stdout.strip()[-120:])
    else:
        try:
            os.symlink(os.path.join(front, 'node_modules'), os.path.join(wt, 'node_modules'))
            base = lint_counts(wt)
            if base is None:
                fails.append('front: eslint trên base không chạy được')
            elif now[0] > base[0] or now[1] > base[1]:
                fails.append(f'front: lint tăng: lỗi {base[0]}->{now[0]}, cảnh báo {base[1]}->{now[1]}')
        finally:
            run(f'git worktree remove --force {wt}', front)
print('PASS' if not fails else 'FAIL ' + fails[0] + (f' (+{len(fails)-1} lỗi nữa)' if len(fails) > 1 else ''))
sys.exit(0 if not fails else 1)
