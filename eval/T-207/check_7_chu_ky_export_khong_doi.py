#!/usr/bin/env python3
"""T-207 tiêu chí 7: chữ ký export vẫn kiểm được và khách hàng (màn admin) không thể tự mang dữ liệu `resolved` vào mục:
  (a) bất biến planner/admin/vendor-enrich INV-004 (cùng một định nghĩa chữ ký ở back, tohong và HQ; apply nhận export thật của back) vẫn PASS;
  (b) `apply_admin_reviews.py` từ chối (APPLY_REFUSED bad_entry, file không đổi, exit 2) entry export có trường `resolved`, kể cả khi mọi trường khác hợp lệ:
      nguồn của `resolved` chỉ là báo cáo enrich trong repo tohong hoặc Google, không bao giờ là export.
Eval này là rào hồi quy: xanh trên main hiện tại và phải giữ xanh. Không Google, không mạng."""
import base64, glob, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t207 as k

bad = []
inv = glob.glob(os.path.join(k.t.HQ, "eval", "invariants", "planner", "admin", "vendor-enrich", "inv-004-*.py"))
if not inv:
    k.fail("thiếu bất biến inv-004 của vùng planner/admin/vendor-enrich")
p = subprocess.run([sys.executable, "-I", inv[0]], capture_output=True, text=True, timeout=600)
if p.returncode != 0 or not p.stdout.strip().startswith("PASS"):
    bad.append("INV-004 không PASS: %s" % (p.stdout or p.stderr)[-200:])
r = k.mk_root(["a"])
tmp = tempfile.mkdtemp(prefix="t207-apply-")
keys = os.path.join(tmp, "keys.json")
json.dump({"schema_version": 1, "keys": {"kabc": base64.b64encode(bytes(range(32))).decode()}}, open(keys, "w"))
exp = os.path.join(tmp, "export.json")
ent = {"vendor_id": "a", "action": "accept_place", "place_id": "PA", "by_capu": True, "key_id": "kabc", "reviewer_label": "admin:0123abcd",
       "reviewed_at": "2026-11-18T10:00:00Z", "reason": "ok", "sig": "A" * 86,
       "resolved": {"place_id": "PA", "name": "x", "formatted_address": k.ADDR, "business_status": "OPERATIONAL", "resolved_at": "2026-11-18T10:00:00Z", "resolved_from": "admin"}}
json.dump({"entries": [ent]}, open(exp, "w"))
ov = r.p("manual_overrides.json")
r.set_overrides([])
snap = open(ov, "rb").read()
rc, out, _ = r.run(["apply_admin_reviews.py", "--state", "HCMC", "--reviews", exp, "--keys", keys, "--output-dir", "output"], k.t.fixture({}, deny=True))
if rc != 2 or "APPLY_REFUSED bad_entry" not in out or open(ov, "rb").read() != snap:
    bad.append("entry export có `resolved` không bị từ chối đúng (exit %d, %r)" % (rc, out[-150:]))
k.done(bad, "INV-004 xanh; export có `resolved` bị từ chối, file không đổi")
