#!/usr/bin/env python3
"""T-098 adv-08 (adversary). Nhánh dễ gãy của v3: helper đọc DEFAULT_CONFIG_FILES từ dist của vite ĐÃ CÀI trong repo, có danh sách dự phòng.
Spec T-077 Hành vi 5 ("kết quả không đổi"): helper phải bọc đúng file mà CHÍNH vite đã cài trong repo đó chọn.
Input biên (repo tối giản; node_modules/vite là BẢN SAO của vite front đã sửa dist; các gói khác symlink; .bin/vite trỏ về bản sao):
 (a) dist không còn tên DEFAULT_CONFIG_FILES (đổi tên biến toàn dist, như bản minify/phiên bản khác) -> dự phòng; repo chỉ có .cts;
 (b) "phiên bản vite khác" đổi THỨ TỰ: .cts lên đầu; repo có .js và .cts -> vite chọn .cts, helper phải chọn .cts;
 (c) như (b) nhưng file chunk chứa danh sách bị đổi tên (logger.js -> zz-cfg.js, sửa import) -> helper vẫn tìm thấy;
 (d) dist có thêm file .js chứa `DEFAULT_CONFIG_FILES = []` rỗng trước file thật -> không được dùng danh sách rỗng.
Đáp án lấy bằng `vite build` của chính bản sao (INV-001 planner cho phép build); máy chủ dev chỉ dựng qua startViteDev. TMPDIR + repo sạch sau stop(). Mã thoát 0 = đạt."""
import json, os, re, shutil, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import advlib as a
VNAME = "vite"; VITE = os.path.join(a.FRONT, "node_modules", VNAME)
if not os.path.isfile(os.path.join(VITE, "package.json")): print("PASS chưa áp dụng (không có front)"); sys.exit(0)

def cfg(name):
    plug = ("{ name: 'adv08', configureServer(s) { s.middlewares.use((q, r, n) => q.url === '/__adv08-mark' ? r.end(%s) : n()); }, "
            "generateBundle() { this.emitFile({ type: 'asset', fileName: 'adv08-mark.txt', source: %s }); } }" % (json.dumps(name), json.dumps(name)))
    return "export default { plugins: [%s] };\n" % plug

def dist_files(root):
    for dp, dn, fn in os.walk(os.path.join(root, "dist")):
        for f in fn:
            if f.endswith((".js", ".mjs")): yield os.path.join(dp, f)

def sub_all(root, old, new):
    n = 0
    for p in dist_files(root):
        s = open(p, encoding="utf-8").read()
        if old in s: open(p, "w", encoding="utf-8").write(s.replace(old, new)); n += 1
    return n

def mutate(vroot, kind):
    if kind == "rename":
        if not sub_all(vroot, "DEFAULT_CONFIG_FILES", "DCF_ADV08"): raise SystemExit("ERROR không thấy DEFAULT_CONFIG_FILES trong dist")
        return
    hit = None
    for p in dist_files(vroot):
        s = open(p, encoding="utf-8").read()
        m = re.search(r"DEFAULT_CONFIG_FILES\s*=\s*\[([^\]]*)\]", s)
        if m:
            names = re.findall(r"[\"']([^\"']+)[\"']", m.group(1)); names.remove("vite.config.cts"); names.insert(0, "vite.config.cts")
            s = s[:m.start(1)] + "\n\t" + ",\n\t".join(json.dumps(x) for x in names) + "\n" + s[m.end(1):]
            open(p, "w", encoding="utf-8").write(s); hit = p; break
    if not hit: raise SystemExit("ERROR không thấy DEFAULT_CONFIG_FILES = [ ... ] trong dist")
    if kind == "reorder-rename":
        base = os.path.basename(hit); newp = os.path.join(os.path.dirname(hit), "zz-cfg.js"); os.rename(hit, newp)
        for pre in ("./", "./chunks/"): sub_all(vroot, pre + base, pre + "zz-cfg.js")
    if kind == "reorder-empty":
        open(os.path.join(vroot, "dist", "aaa-adv08-decoy.js"), "w").write("export const DEFAULT_CONFIG_FILES = [];\n")

def mini(d, cfgs, kind):
    os.makedirs(d); open(os.path.join(d, "index.html"), "w").write("<!doctype html><html><body>adv08</body></html>\n")
    open(os.path.join(d, "package.json"), "w").write('{"name":"adv08","private":true,"type":"module"}\n')
    nm = os.path.join(d, "node_modules"); os.mkdir(nm)
    for n in os.listdir(os.path.join(a.FRONT, "node_modules")):
        if n not in (".vite", "vite", ".bin"): os.symlink(os.path.join(a.FRONT, "node_modules", n), os.path.join(nm, n))
    shutil.copytree(os.path.realpath(VITE), os.path.join(nm, "vite"), symlinks=True)
    bindir = os.path.join(nm, ".bin"); os.mkdir(bindir)
    os.symlink(os.path.join("..", "vite", "bin", "vite.js"), os.path.join(bindir, VNAME))  # .bin của bản sao trỏ về vite bản sao
    mutate(os.path.join(nm, "vite"), kind)
    for fn in cfgs: open(os.path.join(d, fn), "w").write(cfg(fn))
    return d

def oracle(repo, tmp, out):
    env = dict(os.environ); env["TMPDIR"] = tmp
    vbin = os.path.join(repo, "node_modules", ".bin", "vite")
    subprocess.run([vbin, "build", "--outDir", out, "--emptyOutDir", "--logLevel", "silent"], cwd=repo, env=env,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90, start_new_session=True)
    try: return open(os.path.join(out, "adv08-mark.txt")).read()
    except OSError: return "ERR:build không ra adv08-mark.txt"

DRV = r"""
const http = require('http'); const { startViteDev } = require(process.argv[2]);
const get = (u) => new Promise(r => { http.get(u, s => { let b=''; s.on('data', d => b += d); s.on('end', () => r(b)); }).on('error', e => r('ERR:' + e.code)); });
(async () => { let v; try { v = await startViteDev({ repo: process.argv[3] }); } catch (e) { console.log(JSON.stringify({ err: e.message })); return; }
  const m = await get(v.url + '/__adv08-mark'); await v.stop(); console.log(JSON.stringify({ mark: m })); })();
"""
CASES = [("(a) dist không có DEFAULT_CONFIG_FILES, chỉ .cts", "rename", ["vite.config.cts"]),
         ("(b) vite khác thứ tự (.cts đầu), có .js + .cts", "reorder", ["vite.config.js", "vite.config.cts"]),
         ("(c) như (b), chunk đổi tên", "reorder-rename", ["vite.config.js", "vite.config.cts"]),
         ("(d) như (b), thêm file mồi danh sách rỗng", "reorder-empty", ["vite.config.js", "vite.config.cts"])]
errs = []; w = tempfile.mkdtemp(prefix="t098a8-")
try:
    drv = os.path.join(w, "drv.cjs"); open(drv, "w").write(DRV)
    for i, (name, kind, cfgs) in enumerate(CASES):
        repo = mini(os.path.join(w, f"r{i}"), cfgs, kind)
        tb = os.path.join(w, f"tb{i}"); os.mkdir(tb)
        want = oracle(repo, tb, os.path.join(w, f"dist{i}"))
        before = set(os.listdir(repo))
        th = os.path.join(w, f"th{i}"); os.mkdir(th)
        env = dict(os.environ); env["TMPDIR"] = th
        p = subprocess.run(["node", drv, a.HELPER, repo], env=env, capture_output=True, text=True, timeout=90)
        try: got = json.loads(p.stdout.strip().splitlines()[-1])
        except Exception: got = {"err": "driver: " + (p.stdout + p.stderr)[-200:]}
        time.sleep(0.5)
        e = []
        if want.startswith("ERR"): e.append(f"vite build không cho đáp án ({want})")
        elif got.get("mark") != want: e.append(f"vite build dùng {want!r}, qua helper được {str(got.get('mark') or got.get('err'))[:80]!r}")
        lt = sorted(n for n in os.listdir(th) if n not in a.IGNORE_TMP)
        lf = sorted(set(os.listdir(repo)) - before)
        if lt: e.append(f"TMPDIR còn {lt[:3]}")
        if lf: e.append(f"repo còn {lf[:3]}")
        if e: errs.append(name + ": " + "; ".join(e))
finally: shutil.rmtree(w, ignore_errors=True)
if errs: print("FAIL helper đọc config của vite đã cài: " + " | ".join(errs)); sys.exit(1)
print("PASS helper theo đúng vite đã cài: dự phòng khi dist không có tên, thứ tự khác, chunk đổi tên, mồi rỗng; TMPDIR và repo sạch")
