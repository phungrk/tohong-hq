#!/usr/bin/env python3
"""T-125 adv-02 (tầng 3, adversary 2026-11-11) · File review trên R2 hỏng không được im lặng.
Input phá: khoá `data/admin/vendor_enrich_reviews.json` chứa JSON hỏng (cụt giữa chừng / rác), chỉ một admin, không ai ghi đồng thời.
Hiện tại: `GET …/export` trả 200 `count:0` (Capu được đưa một lô "trống" trong khi R2 có thể còn review chờ), và MỌI `PUT …/review`
trả 412 `precondition failed` mãi mãi (đọc lỗi làm mất etag, ghi lại bằng If-None-Match:* trên khoá đã có nên không bao giờ qua),
trái chú thích của chính `lib/vendorEnrichReviews.js` ("lần ghi sau thay file") và trái spec T-124 Hành vi 4 (review ghi được, hai ghi
đồng thời không mất cái nào: ở đây một ghi đơn lẻ cũng mất).
Mong đợi (không ép một cách sửa): (a) export khi file đang hỏng KHÔNG được là 200 với danh sách rỗng, phải báo lỗi rõ (mã >= 500
hoặc 409, thân có `error`); (b) PUT của một admin không có người ghi đồng thời KHÔNG được trả 412; nếu PUT trả 200 thì export sau đó
phải chứa review vừa ghi; nếu PUT từ chối thì phải là lỗi rõ (>= 500 hoặc 409), không phải 412.
Chạy: python3 -I eval/T-125/adv-02-…py (TOHONG_BACK_REPO hoặc ../tohong-back). Thoát 0 = PASS."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
BACK = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back"))
             if p and os.path.isfile(os.path.join(p, "worker.js"))), None)
if not BACK or not os.path.isfile(os.path.join(BACK, "lib", "vendorEnrichReport.generated.js")):
    print("FAIL không thấy tohong-back có bảng enrich vendor (đặt TOHONG_BACK_REPO)"); sys.exit(1)
p = subprocess.run(["node", os.path.join(HERE, "lib", "adv_r2_corrupt.mjs")], cwd=BACK, capture_output=True, text=True, timeout=300,
                   env=dict(os.environ, TOHONG_BACK_REPO=BACK))
if p.returncode != 0:
    print("FAIL không chạy được API back: " + (p.stderr or p.stdout)[-300:]); sys.exit(1)
res = json.loads(p.stdout.strip().splitlines()[-1])
bad = []
for name, r in res.items():
    ex, put, ex2 = r["export"], r["put"], r["export2"]
    if ex["status"] == 200:
        bad.append(f"file {name}: export trả 200 count={ex['count']} như thể không có review nào (phải báo lỗi rõ)")
    if put["status"] == 412:
        bad.append(f"file {name}: PUT của một admin, không ai ghi đồng thời, trả 412 {put['error']}")
    elif put["status"] == 200 and not (ex2["status"] == 200 and ex2["has"]):
        bad.append(f"file {name}: PUT 200 nhưng export sau đó không có review vừa ghi ({ex2})")
    elif put["status"] not in (200, 409) and put["status"] < 500:
        bad.append(f"file {name}: PUT trả {put['status']} {put['error']} (mong 200, 409 hoặc >= 500)")
if bad:
    print(f"FAIL {bad[0]}" + (f" (+{len(bad)-1} lỗi nữa)" if len(bad) > 1 else "")); sys.exit(1)
print("PASS file review hỏng: export báo lỗi rõ, PUT không kẹt 412"); sys.exit(0)
