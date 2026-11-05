#!/usr/bin/env python3
"""T-053 tiêu chí 6 (hành vi của helper eval/_lib/vite_dev.cjs, không đọc cách cài): nonce là kiểm thật, và stop()/lỗi dọn sạch.
Dựng hai "repo" giả trong $EVAL_TMPDIR, mỗi cái có node_modules/.bin/vite là một script node nhận `--port N` (cwd = repo):
 (A) "vite lạ": trả 200 + 'vite-la' cho MỌI đường dẫn (kể cả /__nonce-*). Helper PHẢI từ chối (startViteDev reject) trong 150s; nếu báo sẵn sàng = nonce không kiểm thật (comment, 200 hay bất kỳ cổng nào đều không qua được).
 (B) "vite thật": phục vụ file trong cwd. Helper PHẢI báo sẵn sàng, GET /<file thử> trả đúng nội dung `files`, sau `await stop()` không còn tiến trình mang dấu T053_RUN và không còn file `__*` (nonce, file thử) trong repo.
 Với (A) cũng không được còn tiến trình hay file sau khi reject. Đo trước khi eval dọn.
Giao ước helper (spec): startViteDev({repo, files}) -> Promise<{port, url, stop}>; files = {tên-file-tương-đối: nội-dung}; spawn `<repo>/node_modules/.bin/vite --port N --strictPort --host 127.0.0.1` với cwd=repo; reject bằng Error khi hết hạn/nonce sai.
Chạy: python3 check_6_helper_nonce.py [--helper FILE]. In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import sys, os, subprocess, signal, shutil, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import h
helper = sys.argv[sys.argv.index("--helper") + 1] if "--helper" in sys.argv else os.path.join(h.HQ, "eval/_lib/vite_dev.cjs")
if not os.path.isfile(helper): print(f"FAIL chưa có {os.path.relpath(helper, h.HQ)}"); sys.exit(1)
FAKE = {"la": "const h=require('http'),p=process.argv[process.argv.indexOf('--port')+1];h.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end('<html>vite-la</html>')}).listen(+p,'127.0.0.1');\n",
        "that": "const h=require('http'),fs=require('fs'),path=require('path'),p=process.argv[process.argv.indexOf('--port')+1],root=process.cwd();h.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no')}r.writeHead(200,{'content-type':'text/plain'});r.end(fs.readFileSync(f))}).listen(+p,'127.0.0.1');\n"}
DRIVER = """const {startViteDev}=require(process.argv[2]);const repo=process.argv[3];
(async()=>{let s;try{s=await startViteDev({repo,files:{'__t053probe.txt':'noi-dung-thu'}});}catch(e){console.log('REJECT '+String(e.message).split('\\n')[0]);return;}
try{const t=await (await fetch(s.url+'/__t053probe.txt')).text();console.log('READY '+(t==='noi-dung-thu'?'dung':'sai:'+t.slice(0,30)));}catch(e){console.log('READY loi-fetch '+e.message)}
await s.stop();console.log('STOPPED');})();
"""
tmp = h.scratch(); errs = []
try:
    open(os.path.join(tmp, "driver.cjs"), "w").write(DRIVER)
    for kind in ("la", "that"):
        repo = os.path.join(tmp, "repo-" + kind); os.makedirs(os.path.join(repo, "node_modules/.bin"))
        b = os.path.join(repo, "node_modules/.bin/vite"); open(b, "w").write("#!/usr/bin/env node\n" + FAKE[kind]); os.chmod(b, 0o755)
        open(os.path.join(repo, "package.json"), "w").write("{}")
        before = h.snapshot(repo)
        p = subprocess.Popen(["node", os.path.join(tmp, "driver.cjs"), helper, repo], env=h.env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
        try: out, _ = p.communicate(timeout=150)
        except subprocess.TimeoutExpired:
            try: os.killpg(p.pid, signal.SIGKILL)
            except OSError: pass
            out, _ = p.communicate(); out += "\nTIMEOUT"
        time.sleep(1.5); left = h.marked(); files = h.snapshot(repo) - before   # đo trước khi dọn
        tag = "vite lạ" if kind == "la" else "vite thật"
        if kind == "la" and "REJECT" not in out: errs.append(f"({tag}) helper đáng ra reject, thấy: {out.strip()[-120:]!r}")
        if kind == "that" and ("READY dung" not in out or "STOPPED" not in out): errs.append(f"({tag}) helper đáng ra sẵn sàng + phục vụ file thử + stop, thấy: {out.strip()[-120:]!r}")
        if left: errs.append(f"({tag}) còn {len(left)} tiến trình do eval tạo sau khi helper kết thúc ({next(iter(left.values()))[:60]})")
        if files: errs.append(f"({tag}) để lại {sorted(files)[:3]} trong repo")
        h.kill_pids(left)
finally:
    h.kill_pids(h.marked()); shutil.rmtree(tmp, ignore_errors=True)
if errs: print("FAIL " + " | ".join(errs)); sys.exit(1)
print("PASS helper từ chối vite lạ (nonce thật), phục vụ vite thật, dọn sạch tiến trình và file")
