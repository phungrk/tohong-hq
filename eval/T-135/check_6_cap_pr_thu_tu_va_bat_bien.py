#!/usr/bin/env python3
"""T-135 tiêu chí 6 (cặp repo tohong + tohong-back): cặp PR dữ liệu + pool cho kết quả ĐÚNG và thứ tự merge được ghi rõ; cửa sổ đỏ giữa hai lần merge là CÓ CHỦ ĐÍCH và được đo, không bị che.
Dựng bản sao tohong có một vendor còn-trong-pool bị gỡ (như PR dữ liệu cuối đã làm) và bản sao back còn pool cũ, rồi:
  (1) CỬA SỔ: INV-022 (pool không vendor đã gỡ) ĐỎ khi tohong đã có dữ liệu mới mà back chưa merge pool (trạng thái giữa hai lần merge; không sửa bất biến cho khớp);
  (2) chạy sync-vendor-pool.yml nguyên văn từ SHA của PR dữ liệu, áp hai file của PR pool lên back -> INV-021, INV-022, INV-013, INV-014 (nguyên văn, bể) XANH trên cặp (tohong dữ liệu mới + back pool mới);
  (3) PR dữ liệu đổi sau khi pool đã dựng (apply-review-rule đẩy thêm commit -> SHA mới, thêm một vendor bị gỡ): chạy lại với SHA mới cho CÙNG nhánh `vendor-pool/…`, PR dựng lại từ đầu trên main của back
      (không cộng dồn), thân PR ghi SHA MỚI, pool bỏ cả hai vendor; không còn dấu vết SHA cũ trong thân PR;
  (4) thân PR pool trỏ ngược nhánh tohong và nói rõ: merge PR tohong TRƯỚC, PR back NGAY SAU.
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos(back=True)
raw, wf = t.load_wf(t.BACK, t.POOL_WF)
if wf is None:
    print("FAIL tohong-back chưa có .github/workflows/%s" % t.POOL_WF); sys.exit(1)
bad = []
S1, S2, BR = "b" * 40, "c" * 40, "resolve-overrides/run-4242"
troot, picked, ttmp = t.tohong_tree_with_removed(2)
bk = t.back_box()
try:
    (c1, v1), (c2, v2) = picked[0], picked[1]
    envs = lambda back_root: {"TOHONG_REPO": troot, "TOHONG_BACK_REPO": back_root}
    inv22 = os.path.join(t.INV_IMAGES, "inv-022-pool-khong-vendor-da-go.py")
    rc, msg = t.inv(inv22, envs(bk.ws))
    if rc == 0: bad.append("(1) INV-022 phải ĐỎ giữa hai lần merge (dữ liệu tohong đã gỡ vendor, pool back còn cũ); thấy xanh: không dựng được cửa sổ")
    # (2) PR dữ liệu = vendor 1 bị gỡ; dữ liệu của SHA1 chỉ gỡ v1 (tạm khôi phục v2 để mô tả SHA1)
    import json
    def restore_v2():
        rp = os.path.join(troot, "tools", "scraper", "output", "HCMC", c2, "removed_vendors.json")
        rem = json.load(open(rp, encoding="utf-8")); rec2 = next(x for x in rem if x["vendor"]["id"] == v2)
        json.dump([x for x in rem if x["vendor"]["id"] != v2], open(rp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        vp = os.path.join(troot, "tools", "scraper", "output", "HCMC", c2, "vendors.json"); d = json.load(open(vp, encoding="utf-8")); d["vendors"].append(rec2["vendor"])
        json.dump(d, open(vp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        return rec2
    saved = restore_v2()
    import subprocess
    def regen():
        sc = os.path.join(troot, "tools", "scraper")
        subprocess.run([sys.executable, os.path.join(sc, "build_enrich_report.py"), "--state", "HCMC", "--output-dir", os.path.join(sc, "output"), "--out", os.path.join(sc, "output", "HCMC", "enrich-report.json")],
                       cwd=ttmp, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"), capture_output=True)
    regen()
    res, rec, _ = t.run_back_sync(bk, wf, troot, S1, BR)
    made = [r for r in rec if r["operation"] == "created"]
    if res["status"] != "success" or len(made) != 1:
        bad.append("(2) sync lần 1 không cho đúng một PR: %s %s" % (res["status"], res["log"][-300:])); made = []
    if made:
        pr1 = made[0]
        pool_path = os.path.join(bk.ws, "lib", "vendorPool.generated.js")
        for f, txt in pr1["contents"].items(): open(os.path.join(bk.ws, f), "w", encoding="utf-8").write(txt)
        for n in ("inv-021-du-lieu-khop-file-duyet-tay.py", "inv-022-pool-khong-vendor-da-go.py", "inv-013-anh-google-co-ghi-cong.py", "inv-014-anh-google-truy-ve-place-id.py"):
            rc, msg = t.inv(os.path.join(t.INV_IMAGES, n), envs(bk.ws))
            if rc != 0: bad.append("(2) %s ĐỎ trên cặp sau khi áp PR pool: %s" % (n[:7].upper(), msg))
        body = pr1["body"]
        if not re.search(r"TRƯỚC", body) or not re.search(r"NGAY SAU", body) or BR not in body: bad.append("(4) thân PR pool phải trỏ ngược nhánh tohong và ghi 'TRƯỚC … NGAY SAU'")
        # (3) PR dữ liệu thêm commit: v2 cũng bị gỡ
        t.remove_vendor_in_tree(troot, c2, v2)
        regen()
        bk.reset()  # main của back = pool CŨ (PR 1 chưa merge)
        res2, rec2, _ = t.run_back_sync(bk, wf, troot, S2, BR, run_id="9002")  # run id khác: nhánh pool không được phụ thuộc run id
        m2 = [r for r in rec2 if r["operation"] == "created"]
        if res2["status"] != "success" or len(m2) != 1: bad.append("(3) sync lần 2 (SHA mới, cùng nhánh) không cho đúng một PR: %s" % res2["log"][-200:])
        else:
            pr2 = m2[0]
            if pr2["branch"] != pr1["branch"]: bad.append("(3) nhánh pool đổi giữa hai lần (%r vs %r): PR cũ sẽ mồ côi" % (pr1["branch"], pr2["branch"]))
            ids2 = t.pool_ids(pr2["contents"]["lib/vendorPool.generated.js"]) if "lib/vendorPool.generated.js" in pr2["contents"] else {v1, v2}
            if v1 in ids2 or v2 in ids2: bad.append("(3) pool từ SHA mới còn vendor đã gỡ")
            if "TOHONG_SOURCE_SHA=%s" % S2 not in pr2["body"] or S1 in pr2["body"]: bad.append("(3) thân PR dựng lại phải ghi SHA MỚI và không còn SHA cũ")
finally:
    bk.cleanup(); shutil.rmtree(ttmp, ignore_errors=True)
t.done(bad, "cửa sổ đỏ INV-022 có thật giữa hai lần merge; sau khi áp PR pool thì INV-021/022/013/014 xanh trên cặp; SHA mới dựng lại cùng nhánh pool, thân PR ghi thứ tự merge")
