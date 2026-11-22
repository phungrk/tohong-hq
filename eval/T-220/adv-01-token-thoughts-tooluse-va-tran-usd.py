"""T-220 adv-01 (ADR-142 M2 + spec Hành vi 1/10): token Gemini phải đếm cả thoughtsTokenCount (ra) và toolUsePromptTokenCount (vào), ở dòng sổ, ở báo cáo,
và trong cổng `usd` (trần luỹ kế tháng): (A) GEMINI_RESPONSE/GEMINI_USAGE/report khớp token thật; (B) max_usd=0.50 với token thật lớn: chi thật (tính độc lập từ
số lượt fake nhận) không vượt 0.50; (C) tháng đã có 0.60 USD token của lần P0 trước, max_usd=1.00: chi luỹ kế không vượt 1.00 và có P0_STOP usd. Offline."""
import json, os, re, sys
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _adv import T, env  # noqa: E402

IN_M, OUT_M = 0.50, 3.00
EXTRA = {"thoughtsTokenCount": 3000, "toolUsePromptTokenCount": 5000}
TIN, TOUT = 10000 + 5000, 1000 + 3000      # fake: prompt 10000 + toolUse 5000; candidates 1000 + thoughts 3000
bad = []

# (A) đếm đủ
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(max_usd="10"), fx, env_extra=env(FAKE_ADV_USAGE=json.dumps(EXTRA)))
ng = T.n_kind(calls, "gemini")
resp = [l for l in out.splitlines() if l.startswith("GEMINI_RESPONSE")]
if rc != 0 or ng == 0:
    bad.append("A: rc=%s gemini=%d" % (rc, ng))
for l in resp:
    if "input_tokens=%d " % TIN not in l + " " or "output_tokens=%d" % TOUT not in l:
        bad.append("A: dòng sổ không đếm thoughts/toolUse: %s" % l)
        break
gu = [l for l in out.splitlines() if l.startswith("GEMINI_USAGE")]
if not gu or "input_tokens=%d" % (ng * TIN) not in gu[-1] or "output_tokens=%d" % (ng * TOUT) not in gu[-1]:
    bad.append("A: GEMINI_USAGE sai: %s (mong %d/%d)" % (gu[-1:] or None, ng * TIN, ng * TOUT))
rep = T.read_report(r) or {}
tk = (((rep.get("cost") or {}).get("by_sku") or {}).get("gemini_tokens") or {})
if tk.get("input") != ng * TIN or tk.get("output") != ng * TOUT:
    bad.append("A: report gemini_tokens=%s" % tk)

# (B) cổng usd dùng token thật (gồm thoughts) — chi thật không vượt trần
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
rc, out, calls = r.run(T.std_args(max_usd="0.50"), fx, env_extra=env(FAKE_ADV_USAGE=json.dumps(EXTRA)))
ng = T.n_kind(calls, "gemini")
real = ng * (TIN * IN_M + TOUT * OUT_M) / 1e6
if real > 0.50 + 1e-9:
    bad.append("B: %d lượt Gemini, chi token thật %.4f > max_usd 0.50" % (ng, real))
if "P0_STOP usd" not in out:
    bad.append("B: không có P0_STOP usd")

# (C) token của lần P0 trước trong tháng được cộng vào trần
files, removed, fx, meta = T.world()
r = T.Root(files, removed)
d = os.path.join(r.path, "run-logs", "T-219")
os.makedirs(d, exist_ok=True)
PI, PO = 480000, 120000      # 0.24 + 0.36 = 0.60 USD
open(os.path.join(d, "20261101-000000-run-555-discover.log"), "w", encoding="utf-8").write(
    "GOOGLE_REQUEST run=555 kind=gemini\nGEMINI_RESPONSE run=555 search_queries=0 input_tokens=%d output_tokens=%d\n"
    "GOOGLE_USAGE run=555 text_search=0 photo_details=0 photo_media=0 text_search_pro=0 details_count=0\n"
    "GEMINI_USAGE run=555 calls=1 search_queries=0 input_tokens=%d output_tokens=%d\n" % (PI, PO, PI, PO))
rc, out, calls = r.run(T.std_args(max_usd="1.00"), fx, env_extra=env())
ng = T.n_kind(calls, "gemini")
month = (PI * IN_M + PO * OUT_M) / 1e6 + ng * (10000 * IN_M + 1000 * OUT_M) / 1e6
if month > 1.00 + 1e-9:
    bad.append("C: chi luỹ kế tháng %.4f > 1.00 (%d lượt Gemini; token lần trước không được cộng?)" % (month, ng))
if "P0_STOP usd" not in out:
    bad.append("C: không có P0_STOP usd")
T.done(bad, "token đếm cả thoughts/toolUse; cổng usd giữ chi luỹ kế tháng dưới trần, kể cả token của lần trước")
