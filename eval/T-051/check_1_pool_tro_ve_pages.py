#!/usr/bin/env python3
"""T-051 tiêu chí 1: sau mirror + rewrite, mọi ảnh trong pool trỏ tới domain Pages, trừ ảnh tải lỗi giữ link cũ; ngoài URL ra file không đổi byte nào.
Chạy: python3 eval/T-051/check_1_pool_tro_ve_pages.py --back /đường/dẫn/tohong-back [--real-pool file.js]
In PASS hoặc FAIL <lý do>; mã thoát 0/1."""
import os, sys, copy, json, shutil, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
from t051 import *

a = parse_args()
back = a.get("back") or fail("cần --back <tohong-back>")
w = Work()
try:
    orig_vendors, orig_text = read_pool(w.pool)
    p = w.mirror(back); s = need_summary(p, "mirror")
    # chưa rewrite: --check phải đỏ vì còn URL gốc của ảnh đã có bản trên Pages
    c = w.rewrite(back, ["--check"])
    if c.returncode == 0: fail("rewrite --check trả 0 khi pool còn URL gốc của ảnh đã mirror")
    if w.rewrite(back).returncode != 0: fail("rewrite lỗi: " + w.rewrite(back).stderr[-200:])
    vs, text = read_pool(w.pool)
    man = w.man()["entries"]
    n_ok_refs = n_kept = 0
    for (vid, new), (_, old) in zip(refs(vs), refs(orig_vendors)):
        e = man.get(old)
        if e is None: fail(f"URL {old} không có trong manifest")
        if e["status"] == "ok":
            exp = BASE_URL + "/" + e["file"]
            if new != exp: fail(f"{vid}: ảnh mirror thành công phải là {exp}, thấy {new}")
            n_ok_refs += 1
        else:
            if new != old: fail(f"{vid}: ảnh tải lỗi phải giữ link cũ {old}, thấy {new}")
            n_kept += 1
    if len(refs(vs)) != len(refs(orig_vendors)): fail("số lượt ảnh đổi sau rewrite")
    if n_ok_refs == 0 or n_kept == 0: fail("fixture không có cả ảnh ok lẫn ảnh lỗi")
    # mọi thứ khác không đổi: thay ngược URL mới -> URL gốc phải ra đúng byte file gốc
    rev = text
    for old, e in man.items():
        if e["status"] == "ok":
            rev = rev.replace(json.dumps(BASE_URL + "/" + e["file"], ensure_ascii=False)[1:-1], json.dumps(old, ensure_ascii=False)[1:-1])
    if rev != orig_text: fail("rewrite làm đổi byte ngoài các URL ảnh (định dạng file, tên vendor, thứ tự…)")
    # sau rewrite --check xanh; số đếm khớp
    c = w.rewrite(back, ["--check"])
    if c.returncode != 0: fail("rewrite --check đỏ sau khi rewrite: " + c.stdout[-200:])
    out = w.rewrite(back).stdout
    line = next((l for l in out.splitlines() if l.startswith("REWRITE ")), None)
    if not line: fail("rewrite không in dòng 'REWRITE refs=.. replaced=.. kept_original=..'")
    d = dict(kv.split("=") for kv in line.split()[1:])
    first = w.rewrite(back)  # lần hai: không đổi gì
    if open(w.pool, encoding="utf-8").read() != text: fail("rewrite lần hai làm đổi file (không idempotent)")
    if d.get("replaced") != "0": fail("rewrite lần hai phải báo replaced=0, thấy " + line)
    if d.get("kept_original") != str(n_kept): fail(f"kept_original phải = {n_kept} lượt ảnh, thấy {line}")
    # pool thật (tuỳ chọn, offline): giả lập manifest nói 90% ảnh ok
    real = a.get("real-pool") or os.path.join(back, "lib", "vendorPool.generated.js")
    if os.path.isfile(real):
        rv, rt = read_pool(real)
        if any("pages.dev" in u for _, u in refs(rv)):
            print("NOTE pool thật đã được rewrite, bỏ qua phần pool thật")
        else:
            urls = sorted({u for _, u in refs(rv)})
            ents = {}
            for i, u in enumerate(urls):
                vid = min(v for v, x in refs(rv) if x == u)
                ents[u] = {"status": "ok", "file": f"v/{vid}-{sha12(u)}.webp", "width": 800, "height": 600, "bytes": 1000} if i % 10 else {"status": "failed", "reason": "http-404", "attempts": 1}
            tmp_pool = os.path.join(w.tmp, "real.js"); shutil.copy(real, tmp_pool)
            tmp_man = os.path.join(w.tmp, "real-manifest.json")
            json.dump({"version": 1, "baseUrl": BASE_URL, "entries": ents}, open(tmp_man, "w"))
            r = run(cli(back) + ["rewrite", "--pool", tmp_pool, "--manifest", tmp_man])
            if r.returncode != 0: fail("rewrite pool thật lỗi: " + r.stderr[-200:])
            r = subprocess.run(["node", "-e", f"import('file://{tmp_pool}').then(m=>{{const p=m.GENERATED_VENDOR_POOL;console.log(JSON.stringify([p.length,p.reduce((n,v)=>n+v.photos.length,0)]))}})"], capture_output=True, text=True)
            if r.returncode != 0: fail("pool thật sau rewrite không import được: " + r.stderr[-200:])
            if json.loads(r.stdout) != [len(rv), len(refs(rv))]: fail("pool thật: số vendor/số lượt ảnh đổi sau rewrite")
            nv, _ = read_pool(tmp_pool)
            for (vid, new), (_, old) in zip(refs(nv), refs(rv)):
                st = ents[old]["status"]
                if st == "ok" and not new.startswith(BASE_URL + "/v/" + vid.split("marry_")[0]) and not new.startswith(BASE_URL + "/v/"): fail("pool thật: ảnh ok chưa trỏ Pages: " + new)
                if st == "ok" and "marry.vn" in new: fail("pool thật: còn marry.vn ở ảnh ok")
                if st == "failed" and new != old: fail("pool thật: ảnh lỗi không giữ link cũ")
    ok(f"{n_ok_refs} lượt ảnh trỏ Pages, {n_kept} lượt giữ link cũ, file không đổi ngoài URL, rewrite idempotent")
finally:
    w.stop()
