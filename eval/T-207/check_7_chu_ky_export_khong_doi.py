#!/usr/bin/env python3
"""T-207 tiêu chí 7 (offline): chữ ký export vẫn kiểm được và màn admin không thể tự mang dữ liệu `resolved` vào mục. Chạy `apply_admin_reviews.py` như workflow trên bản sao tạm:
  (a) entry ký đúng bằng khoá Ed25519 sinh tạm, định nghĩa chuẩn eval/lib/capu_decision.py (không `resolved`): APPLY_OK, mục được thêm, KHÔNG có khối `resolved` trong mục;
  (b) cùng entry nhưng đổi `reason` sau khi ký: APPLY_REFUSED bad_signature, exit 2, file không đổi;
  (c) entry hợp lệ nhưng có thêm trường `resolved` (dù chữ ký đúng): APPLY_REFUSED bad_entry, exit 2, file không đổi:
      nguồn của `resolved` chỉ là báo cáo enrich trong repo tohong hoặc Google, không bao giờ là export.
Bất biến INV-004 (đường export thật của back) chạy riêng ở tầng 2; eval này không phụ thuộc nó. Rào hồi quy: xanh trên main hiện tại và phải giữ xanh. Không Google, không mạng."""
import base64, importlib.util, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

spec = importlib.util.spec_from_file_location("capu_decision", os.path.join(k.t.HQ, "eval", "lib", "capu_decision.py"))
sys.path.insert(0, os.path.join(k.t.HQ, "eval", "lib"))
bad = []
r = k.mk_root(["a"])
tmp = tempfile.mkdtemp(prefix="t207-apply-")
sk = Ed25519PrivateKey.generate()
pub = sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
keys = os.path.join(tmp, "keys.json")
json.dump({"schema_version": 1, "keys": {"kabc": base64.b64encode(pub).decode()}}, open(keys, "w"))
sys.path.insert(0, r.path)
import apply_admin_reviews as aar  # noqa: E402  (định nghĩa payload của chính tohong)
KID, LAB, AT, REASON = "kabc", "admin:0123abcd", "2026-11-18T10:00:00Z", "Capu nhận ứng viên"
def signed(reason=REASON, **extra):
    data = aar.payload(KID, "a", "accept_place", "PA", "", REASON, LAB, AT)
    sig = base64.urlsafe_b64encode(sk.sign(data)).decode().rstrip("=")
    e = {"vendor_id": "a", "action": "accept_place", "place_id": "PA", "by_capu": True, "key_id": KID, "reviewer_label": LAB, "reviewed_at": AT, "reason": reason, "sig": sig}
    e.update(extra)
    return e
def apply(entry):
    exp = os.path.join(tmp, "export.json")
    json.dump({"entries": [entry]}, open(exp, "w"))
    return r.run(["apply_admin_reviews.py", "--state", "HCMC", "--reviews", exp, "--keys", keys, "--output-dir", "output"], k.t.fixture({}, deny=True))
ov = r.p("manual_overrides.json")
r.set_overrides([])
snap = open(ov, "rb").read()
rc, out, _ = apply(signed("Capu nhận ứng viên (đã sửa sau khi ký)"))
if rc != 2 or "APPLY_REFUSED bad_signature" not in out or open(ov, "rb").read() != snap:
    bad.append("(b) đổi reason sau khi ký không bị từ chối bad_signature (exit %d, %r)" % (rc, out[-120:]))
rc, out, _ = apply(signed(resolved={"place_id": "PA", "name": "x", "formatted_address": k.ADDR, "business_status": "OPERATIONAL", "resolved_at": AT, "resolved_from": "admin"}))
if rc != 2 or "APPLY_REFUSED bad_entry" not in out or open(ov, "rb").read() != snap:
    bad.append("(c) entry có `resolved` không bị từ chối bad_entry (exit %d, %r)" % (rc, out[-120:]))
rc, out, _ = apply(signed())
e = k.by_vid(r).get("a", {})
if rc != 0 or "APPLY_OK" not in out or e.get("place_id") != "PA" or "resolved" in e:
    bad.append("(a) entry ký đúng không được nhận sạch (exit %d, %r, mục=%r)" % (rc, out[-120:], e))
k.done(bad, "chữ ký export vẫn kiểm được; export có `resolved` hoặc chữ ký sai bị từ chối, file không đổi")
