#!/usr/bin/env python3
"""Nguồn: T-077 (spec products/T-077-cache-vite-rieng-moi-lan-chay.md v2, Hành vi 1, 2: MỌI lần startViteDev có cache riêng dưới os.tmpdir()),
T-098 adversary adv-01 (evalplus 2026-11-07, đỏ trên helper v1: chỉ bọc cacheDir khi tìm thấy vite.config); ADR-037 điểm 3.
Tách riêng, không gộp vào INV-002 (sửa bất biến có sẵn phải qua decision).
INV-004 (planner) · Repo KHÔNG có file vite.config.* nào: helper vite dev của eval (eval/_lib/vite_dev.cjs, startViteDev) vẫn dựng máy chủ với cache vite RIÊNG
dưới thư mục tạm hệ thống (os.tmpdir(), theo TMPDIR); vite không tạo/ghi node_modules/.vite của repo đó, không đổi cache chung node_modules/.vite của front (theo realpath);
sau stop() TMPDIR rỗng (trừ node-compile-cache do node tự ghi) và repo không còn file mới (file bọc __vite-cfg-*, nonce...).
Đo: repo tối giản trong thư mục tạm, không có vite.config.*: index.html + main.js import 'react' (để vite tối ưu deps), package.json type=module,
node_modules riêng gồm symlink từng gói của front trừ .vite (nên node_modules/.vite của repo là thư mục thật, vite mặc định sẽ ghi vào đó).
Một lần startViteDev với TMPDIR riêng, tải trang + main.js; trong lúc chạy PHẢI thấy deps/_metadata.json dưới TMPDIR; sau stop() kiểm phần còn lại.
Máy chủ chỉ dựng qua startViteDev (INV-001 planner).
Repo front: TOHONG_FRONT_REPO, FRONT, cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq; không thấy (hoặc chưa cài node_modules, thiếu react) -> "PASS chưa áp dụng".
Chạy: python3 eval/invariants/planner/inv-004-vite-dev-khong-config-van-cache-rieng.py (gate.py: python3 -I). ~3-20s. Mã thoát 0 = đạt."""
import os, shutil, signal, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
HELPER = os.path.abspath(os.path.join(HERE, "..", "..", "_lib", "vite_dev.cjs"))
IGNORE_TMP = {"node-compile-cache"}


def find_front():
    for c in (os.environ.get("TOHONG_FRONT_REPO"), os.environ.get("FRONT"), os.getcwd(), os.path.join(HQ, "..", "tohong-front")):
        if c and os.path.isfile(os.path.join(c, "package.json")) and os.path.isfile(os.path.join(c, "node_modules", "vite", "package.json")):
            return os.path.abspath(c)
    return None


def tree_state(root):
    s = {}
    for dp, dn, fn in os.walk(root):
        rel = os.path.relpath(dp, root)
        if rel == "vitest" or rel.startswith("vitest" + os.sep): dn[:] = []; continue
        for f in fn:
            try: st = os.stat(os.path.join(dp, f)); s[os.path.normpath(os.path.join(rel, f))] = (st.st_size, st.st_mtime_ns)
            except OSError: pass
    return s


def has_vite_cache(tmpdir):
    base = tmpdir.rstrip(os.sep).count(os.sep)
    for dp, dn, fn in os.walk(tmpdir):
        if dp.count(os.sep) - base > 4: dn[:] = []; continue
        if os.path.basename(dp) == "deps" and "_metadata.json" in fn: return os.path.relpath(dp, tmpdir)
    return None


DRIVER = r"""
const http = require('http');
const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { const q = http.get(u, { timeout: 20000 }, s => { let b = ''; s.setEncoding('utf8'); s.on('data', d => b += d); s.on('end', () => r(b)); }); q.on('error', () => r('')); q.on('timeout', () => { q.destroy(); r(''); }); });
(async () => {
  const v = await startViteDev({ repo: process.argv[3] });
  const html = await get(v.url + '/');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]).filter(s => s.startsWith('/'));
  for (const s of srcs) await get(v.url + s);
  process.stdout.write('READY\n');
  await new Promise(r => process.stdin.once('data', r));
  await v.stop();
  process.stdout.write('STOPPED\n');
  process.exit(0);
})().catch(e => { process.stdout.write('ERR ' + (e && e.message) + '\n'); process.exit(3); });
"""


def main():
    front = find_front()
    if not front or not os.path.isfile(os.path.join(front, "node_modules", "react", "package.json")):
        print("PASS chưa áp dụng: không tìm thấy repo tohong-front có node_modules (vite + react)"); return 0
    work = tempfile.mkdtemp(prefix="inv004-")
    tmpdir = os.path.join(work, "t"); os.mkdir(tmpdir)
    repo = os.path.join(work, "repo"); os.mkdir(repo)
    open(os.path.join(repo, "index.html"), "w").write('<!doctype html><html><body><div id="r"></div><script type="module" src="/main.js"></script></body></html>\n')
    open(os.path.join(repo, "main.js"), "w").write("import React from 'react';\ndocument.getElementById('r').textContent = 'inv004 ' + React.version;\n")
    open(os.path.join(repo, "package.json"), "w").write('{"name":"inv004","private":true,"type":"module"}\n')
    nm = os.path.join(repo, "node_modules"); os.mkdir(nm)
    for n in os.listdir(os.path.join(front, "node_modules")):
        if n != ".vite": os.symlink(os.path.join(front, "node_modules", n), os.path.join(nm, n))
    drv = os.path.join(work, "driver.cjs"); open(drv, "w").write(DRIVER)
    env = dict(os.environ); env["TMPDIR"] = tmpdir
    errs = []; p = None; seen = None
    shared = os.path.realpath(os.path.join(front, "node_modules", ".vite"))
    try:
        before = tree_state(shared); files0 = set(os.listdir(repo))
        p = subprocess.Popen(["node", drv, HELPER, repo], env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                             text=True, start_new_session=True)
        line = p.stdout.readline().strip()
        if line != "READY":
            rest = p.stdout.read() if p.poll() is not None else ""
            print("FAIL không dựng được vite qua helper trên repo không có vite.config: " + (line + " " + rest)[:200]); return 1
        t0 = time.time()
        while time.time() - t0 < 30 and not seen:
            seen = has_vite_cache(tmpdir)
            if not seen: time.sleep(0.3)
        if not seen: errs.append("trong lúc vite chạy không thấy cache vite riêng (deps/_metadata.json) nào trong TMPDIR")
        own = os.path.join(nm, ".vite")
        if os.path.isdir(own) and os.listdir(own): errs.append(f"vite ghi vào node_modules/.vite của repo ({sorted(os.listdir(own))[:3]})")
        p.stdin.write("x\n"); p.stdin.flush()
        out = p.stdout.readline().strip()
        try: p.wait(timeout=30)
        except subprocess.TimeoutExpired: errs.append("helper không dừng trong 30s sau stop()")
        if out != "STOPPED": errs.append("stop() không xong: " + out[:80])
        time.sleep(0.5)
        left = sorted(n for n in os.listdir(tmpdir) if n not in IGNORE_TMP)
        if left: errs.append(f"sau stop() còn lại trong TMPDIR: {left[:3]}")
        extra = sorted(set(os.listdir(repo)) - files0)
        if extra: errs.append(f"sau stop() repo còn file mới: {extra[:3]}")
        after = tree_state(shared)
        ch = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
        if ch: errs.append(f"cache chung node_modules/.vite của front bị đổi ({len(ch)} mục, vd {ch[:3]})")
    finally:
        if p and p.poll() is None:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
        shutil.rmtree(work, ignore_errors=True)
    if errs: print("FAIL repo không có vite.config: " + " | ".join(errs)); return 1
    print(f"PASS repo không có vite.config: cache riêng trong TMPDIR ({seen}), node_modules/.vite của repo không bị ghi, TMPDIR và repo sạch sau stop()")
    return 0


if __name__ == "__main__":
    sys.exit(main())
