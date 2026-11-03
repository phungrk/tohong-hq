#!/usr/bin/env python3
"""T-052 adv-01 (adversary, tầng 3). Spec T-051 mục 19 + INV-001 (ii).
Input: pool hợp lệ một dòng nhưng JSON có dấu cách sau ':' và ',' (json.dumps mặc định), ví dụ `"url": "https://..."`.
Mong đợi: sau `mirror`, `rewrite --check` thoát 1 (còn ảnh ok chưa rewrite); `rewrite` thay MỌI lượt ảnh ok thành Pages URL,
REWRITE refs = số lượt ảnh, và không đổi byte nào khác ngoài URL.
Hiện tại: regex chỉ khớp `"url":"` liền nhau → refs=0, --check thoát 0 (báo xanh giả), pool vẫn trỏ URL gốc.
Chạy không tham số (gate.py: python3 -I, cwd tohong-hq). Repo back: TOHONG_BACK_REPO, rồi ../tohong-back, rồi /home/user/tohong-back."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "T-051", "lib"))
from t051 import Work, BASE_URL, cli, run, read_pool, refs, vendor, fail, ok  # noqa: E402

back = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(os.getcwd(), "..", "tohong-back"), "/home/user/tohong-back")
             if c and os.path.isfile(os.path.join(c, "lib", "vendorPool.generated.js"))), None)
if not back:
    fail("không tìm thấy repo tohong-back")

w = Work(lambda fm: [vendor("v1", [fm.url("/ok/small.png"), fm.url("/ok/big.jpg"), fm.url("/bad/404.jpg")]),
                     vendor("v2", [fm.url("/ok/Logo-công-nghệ-cưới.jpg")])])
try:
    p = w.mirror(back)
    if p.returncode != 0:
        fail(f"mirror thoát {p.returncode}: {p.stderr[-200:]}")
    vs, _ = read_pool(w.pool)
    text = "export const GENERATED_VENDOR_POOL = " + json.dumps(vs, ensure_ascii=False) + ";\n"
    open(w.pool, "w", encoding="utf-8").write(text)
    ents = w.man()["entries"]
    n_refs = len(refs(vs))
    c = w.rewrite(back, ["--check"])
    if c.returncode != 1:
        fail(f"`rewrite --check` thoát {c.returncode} dù còn {sum(1 for _, u in refs(vs) if ents.get(u, {}).get('status') == 'ok')} lượt ảnh ok chưa rewrite (pool có dấu cách sau ':'); stdout: {c.stdout.strip()}")
    r = w.rewrite(back)
    if r.returncode != 0:
        fail(f"rewrite thoát {r.returncode}")
    if f"refs={n_refs}" not in r.stdout:
        fail(f"REWRITE refs phải = {n_refs} lượt ảnh; stdout: {r.stdout.strip()}")
    after, atext = read_pool(w.pool)
    left = [u for _, u in refs(after) if ents.get(u, {}).get("status") == "ok"]
    if left:
        fail(f"{len(left)} lượt ảnh ok vẫn trỏ URL gốc sau rewrite, vd {left[0]}")
    # không đổi byte nào khác ngoài URL: thay ngược Pages URL → URL gốc phải ra đúng văn bản cũ
    back_map = {BASE_URL + "/" + e["file"]: u for u, e in ents.items() if e.get("status") == "ok"}
    restored = atext
    for pu, u in back_map.items():
        restored = restored.replace(json.dumps(pu, ensure_ascii=False), json.dumps(u, ensure_ascii=False))
    if restored != text:
        fail("rewrite đổi byte ngoài URL ảnh")
    ok(f"pool có dấu cách: --check thoát 1, rewrite thay đủ {len(back_map)} URL ok, refs={n_refs}")
finally:
    w.stop()
