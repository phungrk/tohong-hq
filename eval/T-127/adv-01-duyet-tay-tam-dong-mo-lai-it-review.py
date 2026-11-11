#!/usr/bin/env python3
"""T-127 adv-01 (adversary, tầng 3). Ca eval T-126 chưa chạm: vendor có duyệt tay `temporarily_closed` (như Pergola, ADR-048) mà lần thử lại Google trả
OPERATIONAL (mở lại), qua sáu cổng, nhưng chỉ có 0 đánh giá.
Spec T-126: Hành vi 0/1 "ứng viên < 2 đánh giá không được nhận"; ngoại lệ DUY NHẤT để giữ nhận khớp < 2 đánh giá là `accept_place` (Hành vi 2, và INV-029 nháp
của chính spec: "trừ bản ghi manual_override=true hoặc có mục accept_place"). Hành vi 1(b) "duyệt tay > few_reviews" là để GIỮ DẤU tạm đóng cửa (Pergola: retry + closed_state),
không phải miễn luật cho nơi đã mở lại: khi Google báo mở lại, T-110 coi mục temporarily_closed là "reopened" (không còn áp).
Mong: sau `enrich.py` thường, vendor r KHÔNG giữ place_id Google (few_reviews), và trạng thái dữ liệu thoả INV-029 nháp; `--apply-review-rule` sau đó không đổi gì
(hai chế độ cho cùng kết cục). Thấy (code PR #85, quyết định tự đặt (1) trong handoffs/T-127-v1.md): r được nhận với 0 đánh giá, INV-029 đỏ, rồi apply-review-rule lại hạ nó.
OFFLINE (Google giả eval/T-126/_fake). In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, subprocess, sys, tempfile
HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-126"))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
S = k.ADDR
V = [("a", "Lumen Alpha Makeup", "makeup", S % 11, 5, "OPERATIONAL"),
     ("r", "Nhà Hàng Pergola Rooftop", "venue", S % 25, 0, "OPERATIONAL")]
files, PL, rules = {}, {}, []
for vid, name, cat, addr, n, st in V:
    files.setdefault(cat, []).append(t.vendor("t127_" + vid, name, addr, (h.DIR_CATEGORY[cat],)))
    PL["P" + vid] = k.pl(name, addr, "P" + vid, n=n, status=st)
    rules.append((h.fold(name), ["P" + vid]))
rules.sort(key=lambda r: -len(r[0]))
root = t.Root(files)
x.usage_logs(root, ts=0, details=0, media=0)
# Pergola đã ở trạng thái chờ thử lại vì Capu duyệt tay tạm đóng cửa
root.write(os.path.join("venue", "enrichment-audit.json"), [{"vendor_id": "t127_r", "status": "temporarily_closed", "reason": "CLOSED_TEMPORARILY", "retry": True,
                                                              "closed_state": "temporarily_closed", "manual_override": "temporarily_closed", "candidate_place_id": "Pr"}])
root.set_overrides([t.entry("t127_r", "temporarily_closed", reason="Capu: Google ghi tạm thời đóng cửa (fixture adv-01 T-127)")])
FX = x.fx(PL, rules)
cats = [c for c in h.ORDER if c in files]
rc, out, calls = root.run(x.enrich_all(cats), FX)
if rc != 0:
    t.fail("enrich thường thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))
if x.count_for(calls, "pergola") == 0:
    t.fail("fixture hỏng: r (chờ thử lại) không được hỏi lại Google")
v = root.vendor("t127_r", "venue")
a = root.audit("venue").get("t127_r") or {}
if t.has_pid(v):
    bad.append("r (duyệt tay temporarily_closed, Google mở lại với 0 đánh giá) được NHẬN place_id %r: luật < 2 đánh giá chỉ miễn cho accept_place (Hành vi 2, INV-029)" % t.pid_of(v))
# INV-029 nháp của spec trên đúng dữ liệu này
fake = tempfile.mkdtemp(prefix="t127-adv01-")
os.makedirs(os.path.join(fake, "tools", "scraper"))
os.symlink(os.path.join(root.path, "output"), os.path.join(fake, "tools", "scraper", "output"))
inv = os.path.join(HQ, "eval", "T-126", "bat-bien-cho-merge", "inv-029-nhan-khop-google-du-danh-gia.py")
r = subprocess.run([sys.executable, "-I", inv], env={"TOHONG_REPO": fake, "PATH": os.environ.get("PATH", "")}, capture_output=True, text=True, timeout=120)
if r.returncode != 0:
    bad.append("INV-029 nháp đỏ sau enrich thường: %s" % r.stdout.strip()[:200])
before = {c: open(root.p(os.path.join(c, f)), "rb").read() for c in files for f in ("vendors.json", "enrichment-audit.json") if os.path.exists(root.p(os.path.join(c, f)))}
rc2, out2, calls2 = root.run(x.enrich_all("all", extra=[k.APPLY]), x.fx({}, [], deny=True), key=False)
after = {c: open(root.p(os.path.join(c, f)), "rb").read() for c in files for f in ("vendors.json", "enrichment-audit.json") if os.path.exists(root.p(os.path.join(c, f)))}
if rc2 != 0:
    bad.append("--apply-review-rule thoát %d" % rc2)
elif before != after:
    bad.append("--apply-review-rule ngay sau enrich thường lại đổi dữ liệu (hai chế độ cho hai kết cục khác nhau cho cùng vendor)")
t.done(bad, "duyệt tay temporarily_closed không miễn luật < 2 đánh giá khi Google báo mở lại; INV-029 xanh; apply-review-rule không đổi gì")
