#!/usr/bin/env python3
"""T-098 adv-07 (adversary). Nhánh mới của v2 (repo KHÔNG có vite.config.*: helper ghi file bọc __vite-cfg-*.mjs chỉ có cacheDir).
Hợp đồng helper "dọn file thử" (INV-001 planner, T-053) + spec T-077 Hành vi 4: file bọc và cache riêng phải biến mất ở mọi đường đi bắt được.
adv-01 chỉ đo cache, không đo file bọc trong repo; eval này đo file bọc.
Input biên (repo tối giản, node_modules riêng symlink từng gói của front):
 (a) không config, stop() bình thường; (b) không config, node nhận SIGTERM / SIGINT / SIGHUP lúc vite đang chạy;
 (c) vite.config.js là THƯ MỤC (không phải file): như vite trần, được phép ném lỗi, nhưng repo + TMPDIR phải sạch ngay khi lỗi tới tay người gọi.
Mong đợi: repo không còn mục mới nào, TMPDIR không còn mục nào (trừ node-compile-cache). Mã thoát 0 = đạt."""
import json, os, shutil, signal, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
if not os.path.isfile(os.path.join(a.FRONT, "node_modules", "vite", "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)

def mini(d, cfgdir=False):
    os.makedirs(d); open(os.path.join(d, "index.html"), "w").write("<!doctype html><html><body>adv07</body></html>\n")
    open(os.path.join(d, "package.json"), "w").write('{"name":"adv07","private":true,"type":"module"}\n')
    nm = os.path.join(d, "node_modules"); os.mkdir(nm)
    for n in os.listdir(os.path.join(a.FRONT, "node_modules")):
        if n != ".vite": os.symlink(os.path.join(a.FRONT, "node_modules", n), os.path.join(nm, n))
    if cfgdir: os.makedirs(os.path.join(d, "vite.config.js"))
    return d

DRV = r"""
const fs = require('fs'); const { startViteDev } = require(process.argv[2]); const repo = process.argv[3];
(async () => { let v; try { v = await startViteDev({ repo }); } catch (e) {
    const left = fs.readdirSync(repo).filter(n => n.startsWith('__')); const tmp = fs.readdirSync(require('os').tmpdir()).filter(n => n !== 'node-compile-cache');
    console.log(JSON.stringify({ err: e.message.slice(0, 120), during_front: left, during_tmp: tmp })); process.exit(0); }
  console.log(JSON.stringify({ ready: true, during_front: fs.readdirSync(repo).filter(n => n.startsWith('__')) }));
  if (process.argv[4] === 'stop') { await v.stop(); console.log('"STOPPED"'); process.exit(0); }
  setInterval(() => {}, 1000); })();
"""
errs = []; w = tempfile.mkdtemp(prefix="t098a7-")
try:
    drv = os.path.join(w, "drv.cjs"); open(drv, "w").write(DRV)
    for name, mode, cfgdir in (("(a) stop()", "stop", False), ("(b) SIGTERM", "SIGTERM", False), ("(b) SIGINT", "SIGINT", False),
                               ("(b) SIGHUP", "SIGHUP", False), ("(c) vite.config.js là thư mục", "stop", True)):
        repo = mini(os.path.join(w, "r" + str(len(errs)) + mode + str(cfgdir)), cfgdir); before = set(os.listdir(repo))
        t = os.path.join(w, "t-" + mode + str(cfgdir)); os.mkdir(t)
        env = dict(os.environ); env["TMPDIR"] = t
        p = subprocess.Popen(["node", drv, a.HELPER, repo, mode], env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True)
        e = []
        try:
            line = p.stdout.readline().strip()
            try: r = json.loads(line)
            except Exception: r = {"err": "driver: " + line[:150]}
            if cfgdir:
                if r.get("during_front"): e.append(f"khi ném lỗi repo còn {r['during_front'][:3]}")
                if r.get("during_tmp"): e.append(f"khi ném lỗi TMPDIR còn {r['during_tmp'][:3]}")
            else:
                if not r.get("ready"): e.append("không dựng được vite: " + str(r.get("err"))[:120])
                elif not any(n.startswith("__vite-cfg-") for n in r.get("during_front", [])): e.append("không thấy file bọc lúc chạy (eval không áp dụng)")
                if mode.startswith("SIG"): p.send_signal(getattr(signal, mode))
            p.wait(timeout=30)
        finally:
            if p.poll() is None:
                try: os.killpg(p.pid, signal.SIGKILL)
                except OSError: pass
                p.wait()
        time.sleep(1)
        lf = sorted(set(os.listdir(repo)) - before - {"node_modules"})
        lt = sorted(n for n in os.listdir(t) if n not in a.IGNORE_TMP)
        if lf: e.append(f"repo còn {lf[:3]}")
        if lt: e.append(f"TMPDIR còn {lt[:3]}")
        if e: errs.append(name + ": " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL nhánh không config / config là thư mục: " + " | ".join(errs)); sys.exit(1)
print("PASS nhánh không config: file bọc + cache riêng sạch sau stop()/SIGTERM/SIGINT/SIGHUP; vite.config.js là thư mục: lỗi nhưng sạch")
