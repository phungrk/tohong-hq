#!/usr/bin/env python3
"""T-082 adv-05 (tầng 3, spec A1/A2/B1/B2). Payload thiếu trường hoặc sai kiểu (comment null/chuỗi, user chuỗi,
issue thiếu/number null/chuỗi lạ, html_url thiếu/rỗng, body số/mảng/null, JSON là mảng, file không phải JSON).
Mong đợi: sổ cái và board không đổi byte nào, không có `decided` không link (B1 link = comment.html_url, B2 cần link
để chống quyết hai lần). Mã thoát khác 0 được chấp nhận cho payload hỏng (hỏng thật), nhưng không được ghi gì."""
import sys, pathlib, json, subprocess, copy
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "T-079"))
from _lib import Box, payload
fails = []
base = payload("/ok chọn A")
def mut(f):
    p = copy.deepcopy(base); f(p); return p
CASES = {
    "comment null": mut(lambda p: p.__setitem__("comment", None)),
    "comment chuỗi": mut(lambda p: p.__setitem__("comment", "x")),
    "user chuỗi": mut(lambda p: p["comment"].__setitem__("user", "phungrk")),
    "sender null": mut(lambda p: p.__setitem__("sender", None)),
    "issue thiếu": mut(lambda p: p.pop("issue")),
    "issue.number null": mut(lambda p: p["issue"].__setitem__("number", None)),
    "issue.number '7 '": mut(lambda p: p["issue"].__setitem__("number", "7 ")),
    "issue.number 7.0": mut(lambda p: p["issue"].__setitem__("number", 7.0)),
    "html_url thiếu": mut(lambda p: p["comment"].pop("html_url")),
    "html_url rỗng": mut(lambda p: p["comment"].__setitem__("html_url", "")),
    "body số": mut(lambda p: p["comment"].__setitem__("body", 5)),
    "body mảng": mut(lambda p: p["comment"].__setitem__("body", ["/ok chọn A"])),
    "action thiếu": mut(lambda p: p.pop("action")),
    "JSON mảng": [base],
    "không phải JSON": None,
}
for name, p in CASES.items():
    B = Box()
    try:
        B.new(issue=7); snap = B.snapshot()
        f = B.tmp / "payload.json"
        f.write_text("{không phải json" if p is None else json.dumps(p, ensure_ascii=False), encoding="utf-8")
        r = subprocess.run([sys.executable, "-I", "scripts/ok_issue.py", "--event", str(f)], cwd=B.tmp, env=B.env,
                           capture_output=True, text=True, timeout=60)
        if B.snapshot() != snap:
            dec = [e for e in B.events() if e.get("event") == "decided"]
            fails.append(f"[{name}] sổ cái đổi (decided link={[e.get('link') for e in dec]})")
    finally:
        B.close()
assert not fails, "\n".join(fails)
print(f"PASS {len(CASES)} payload hỏng không ghi gì vào sổ cái")
