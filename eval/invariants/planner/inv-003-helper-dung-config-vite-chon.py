#!/usr/bin/env python3
"""Nguồn: T-077 (spec products/T-077-cache-vite-rieng-moi-lan-chay.md v2, Hành vi 5 "kết quả không đổi" + Ràng buộc "không sửa cấu hình vite của front"),
T-098 adversary: adv-06 (evalplus 2026-11-07, đỏ trên helper v2) và ca (b) của adv-08 (accept 2026-11-07); ADR-037 điểm 3.
INV-003 (planner) · Helper vite dev của eval (eval/_lib/vite_dev.cjs, startViteDev) bọc ĐÚNG file cấu hình mà chính vite đã cài trong repo tự chọn khi không có --config
(cùng danh sách đuôi, cùng thứ tự ưu tiên của bản vite đó). Helper luôn truyền --config file bọc, nên file vite tự chọn mà helper không nhận ra sẽ bị bỏ qua im lặng
(mất plugin/define) -> kết quả eval qua helper khác với vite thật.
Đo: mỗi ca là một repo tối giản trong thư mục tạm (index.html, package.json type=module, node_modules riêng symlink từng gói của front trừ .vite, nên không chạm cache chung).
Mỗi file vite.config.* thêm một plugin: lúc dev trả /__inv003-mark = tên file, lúc build ghi inv003-mark.txt = tên file.
Đáp án "vite tự chọn file nào" lấy bằng `vite build` của chính vite trong repo đó (INV-001 planner cho phép build); máy chủ dev CHỈ dựng qua startViteDev.
Các ca: (a) chỉ vite.config.cts; (b) vite.config.cjs + vite.config.mts; (c) vite.config.js + vite.config.ts (đối chứng);
(d) bản sao vite của front với danh sách DEFAULT_CONFIG_FILES đổi thứ tự (.cts lên đầu, như một phiên bản vite khác), repo có .js + .cts -> vite chọn .cts.
Ca (d) "chưa áp dụng" (không tính đỏ) nếu dist của vite đã cài không có `DEFAULT_CONFIG_FILES = [...]` để đổi thứ tự.
Mỗi ca cũng đòi: TMPDIR riêng của lần chạy rỗng và repo không còn file mới sau stop(). Các ca chạy song song.
Repo front: TOHONG_FRONT_REPO, FRONT, cwd nếu là repo front, rồi ../tohong-front cạnh tohong-hq; không thấy (hoặc chưa cài node_modules) -> "PASS chưa áp dụng".
Chạy: python3 eval/invariants/planner/inv-003-helper-dung-config-vite-chon.py (gate.py: python3 -I). ~10-30s. Mã thoát 0 = đạt."""
import json, os, re, shutil, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
HELPER = os.path.abspath(os.path.join(HERE, "..", "..", "_lib", "vite_dev.cjs"))
IGNORE_TMP = {"node-compile-cache"}


def find_front():
    for c in (os.environ.get("TOHONG_FRONT_REPO"), os.environ.get("FRONT"), os.getcwd(), os.path.join(HQ, "..", "tohong-front")):
        if c and os.path.isfile(os.path.join(c, "package.json")) and os.path.isfile(os.path.join(c, "node_modules", "vite", "package.json")):
            return os.path.abspath(c)
    return None


def cfg(name):
    plug = ("{ name: 'inv003', configureServer(s) { s.middlewares.use((q, r, n) => q.url === '/__inv003-mark' ? r.end(%s) : n()); }, "
            "generateBundle() { this.emitFile({ type: 'asset', fileName: 'inv003-mark.txt', source: %s }); } }" % (json.dumps(name), json.dumps(name)))
    if name.endswith(".cjs"): return "module.exports = { plugins: [%s] };\n" % plug
    return "export default { plugins: [%s] };\n" % plug


def reorder_cts_first(vroot):
    """Đổi thứ tự DEFAULT_CONFIG_FILES trong dist của bản sao vite: .cts lên đầu. Trả False nếu không có danh sách để đổi."""
    for dp, dn, fn in os.walk(os.path.join(vroot, "dist")):
        for f in fn:
            if not f.endswith((".js", ".mjs")): continue
            p = os.path.join(dp, f); s = open(p, encoding="utf-8").read()
            m = re.search(r"DEFAULT_CONFIG_FILES\s*=\s*\[([^\]]*)\]", s)
            if not m: continue
            names = re.findall(r"[\"']([^\"']+)[\"']", m.group(1))
            if "vite.config.cts" not in names or "vite.config.js" not in names: return False
            names.remove("vite.config.cts"); names.insert(0, "vite.config.cts")
            open(p, "w", encoding="utf-8").write(s[:m.start(1)] + "\n\t" + ",\n\t".join(json.dumps(x) for x in names) + "\n" + s[m.end(1):])
            return True
    return False


def mini(front, d, cfgs, own_vite):
    os.makedirs(d)
    open(os.path.join(d, "index.html"), "w").write("<!doctype html><html><body>inv003</body></html>\n")
    open(os.path.join(d, "package.json"), "w").write('{"name":"inv003","private":true,"type":"module"}\n')
    nm = os.path.join(d, "node_modules"); os.mkdir(nm); src = os.path.join(front, "node_modules")
    skip = {".vite", "vite", ".bin"} if own_vite else {".vite"}
    for n in os.listdir(src):
        if n not in skip: os.symlink(os.path.join(src, n), os.path.join(nm, n))
    if own_vite:
        shutil.copytree(os.path.realpath(os.path.join(src, "vite")), os.path.join(nm, "vite"), symlinks=True)
        if not reorder_cts_first(os.path.join(nm, "vite")): return None
        os.mkdir(os.path.join(nm, ".bin"))
        os.symlink(os.path.join("..", "vite", "bin", "vite.js"), os.path.join(nm, ".bin", "vite"))
    for fn in cfgs: open(os.path.join(d, fn), "w").write(cfg(fn))
    return d


def oracle(repo, tmp, out):
    env = dict(os.environ); env["TMPDIR"] = tmp
    cmd = [os.path.join(repo, "node_modules", ".bin", "vite"), "build", "--outDir", out, "--emptyOutDir", "--logLevel", "silent"]
    try:
        subprocess.run(cmd, cwd=repo, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90, start_new_session=True)
    except subprocess.TimeoutExpired:
        return "ERR:vite build quá 90s"
    try: return open(os.path.join(out, "inv003-mark.txt")).read()
    except OSError: return "ERR:vite build không ra inv003-mark.txt"


DRV = r"""
const http = require('http'); const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { http.get(u, { timeout: 20000 }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => r(b)); }).on('error', e => r('ERR:' + e.code)); });
(async () => { let v; try { v = await startViteDev({ repo: process.argv[3] }); } catch (e) { console.log(JSON.stringify({ err: String(e && e.message) })); process.exit(0); }
  const m = await get(v.url + '/__inv003-mark'); await v.stop(); console.log(JSON.stringify({ mark: m })); process.exit(0); })();
"""

CASES = [("(a) chỉ .cts", ["vite.config.cts"], False),
         ("(b) .cjs + .mts", ["vite.config.cjs", "vite.config.mts"], False),
         ("(c) .js + .ts (đối chứng)", ["vite.config.js", "vite.config.ts"], False),
         ("(d) vite khác thứ tự (.cts đầu), .js + .cts", ["vite.config.js", "vite.config.cts"], True)]


def one(front, w, drv, i, case):
    name, cfgs, own_vite = case
    repo = mini(front, os.path.join(w, f"r{i}"), cfgs, own_vite)
    if repo is None: return name, None, "chưa áp dụng (dist vite không có DEFAULT_CONFIG_FILES đủ .js/.cts)"
    tb = os.path.join(w, f"tb{i}"); os.mkdir(tb)
    want = oracle(repo, tb, os.path.join(w, f"dist{i}"))
    if want.startswith("ERR"): return name, f"lỗi đo: {want}", None
    before = set(os.listdir(repo))
    th = os.path.join(w, f"th{i}"); os.mkdir(th)
    env = dict(os.environ); env["TMPDIR"] = th
    p = None
    try:
        p = subprocess.Popen(["node", drv, HELPER, repo], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        out, err = p.communicate(timeout=90)
    except subprocess.TimeoutExpired:
        try: os.killpg(p.pid, 9)
        except OSError: pass
        return name, "helper quá 90s", None
    try: got = json.loads(out.strip().splitlines()[-1])
    except Exception: got = {"err": "driver: " + (out + err)[-200:]}
    time.sleep(0.5)
    e = []
    if got.get("mark") != want: e.append(f"vite build chọn {want!r}, qua helper được {str(got.get('mark') or got.get('err'))[:100]!r}")
    lt = sorted(n for n in os.listdir(th) if n not in IGNORE_TMP)
    lf = sorted(set(os.listdir(repo)) - before)
    if lt: e.append(f"TMPDIR còn {lt[:3]}")
    if lf: e.append(f"repo còn {lf[:3]}")
    return name, ("; ".join(e) or None), f"vite chọn {want}"


def main():
    front = find_front()
    if not front:
        print("PASS chưa áp dụng: không tìm thấy repo tohong-front có node_modules"); return 0
    w = tempfile.mkdtemp(prefix="inv003-")
    try:
        drv = os.path.join(w, "drv.cjs"); open(drv, "w").write(DRV)
        with ThreadPoolExecutor(len(CASES)) as ex:
            res = list(ex.map(lambda ic: one(front, w, drv, *ic), enumerate(CASES)))
    finally:
        shutil.rmtree(w, ignore_errors=True)
    errs = [f"{n}: {e}" for n, e, _ in res if e]
    if errs: print("FAIL helper không bọc đúng file cấu hình vite tự chọn: " + " | ".join(errs)); return 1
    print("PASS helper bọc đúng file cấu hình vite tự chọn: " + "; ".join(f"{n} -> {note}" for n, _, note in res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
