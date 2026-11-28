#!/usr/bin/env python3
# Nguồn: T-232 (spec products/T-232-co-ai-mode-4-gia-tri.md v1, Hành vi 5; spec 008 FR-001, FR-003, FR-005, SC-002, SC-004 US3 kịch bản 2; ADR-153 và phụ lục),
# rút bởi spec-critic tại Spec Gate 2026-11-28. Nằm ở eval/T-232/bat-bien-cho-merge/ tới khi PR tohong T-232 merge (ADR-028); Chief đưa vào eval/invariants/planner/vendor/ và đặt số.
"""Bất biến (planner/vendor): dữ liệu vendor trong TOHONG_REPO (cây làm việc, tools/scraper/output/*/*/vendors.json) có cờ ai_mode_result hợp lệ.
 (1) Công cụ của repo: `python3 ai_mode_flags.py check` (cwd tools/scraper, không --base) thoát 0 và in AI_MODE_FLAGS_OK.
 (2) Kiểm độc lập, không tin công cụ (công cụ lỏng không che được dữ liệu sai), trừ các mục miễn trừ có reason không rỗng trong tools/scraper/ai_mode_flags_exempt.json:
     - invalid_value: khoá ai_mode_result khác null và ngoài {found, not_found, address_mismatch, wrong_category};
     - no_log: cờ hợp lệ mà dòng enrichment_log source google_ai_mode CUỐI có khoá changes.ai_mode_result không mang cùng giá trị (hoặc không có dòng nào);
     - verified_not_found: verification_status "verified" mà cờ là not_found / address_mismatch / wrong_category.
Đã thử trước khi đề xuất (2026-11-28, phần (2) bằng cùng luật): main b9b7932 0 cờ; nhánh PR #120 (60 cờ), #121 (45), #124 feat/ai-mode-not-found-flags (76) đều 0 vi phạm,
nên bất biến không đỏ vì các PR dữ liệu đang mở. Luật status_changed cần --base nên không nằm ở đây (thuộc kiểm PR dữ liệu).
Không mạng, chỉ đọc. Thiếu repo: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. Thoát 0 = đạt."""
import glob, json, os, subprocess, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
HQ = _d
VALID = {"found", "not_found", "address_mismatch", "wrong_category"}
PROBLEM = VALID - {"found"}


def fail(msg):
    print("FAIL " + msg); sys.exit(1)


def find_tohong():
    for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")):
        if c and os.path.isdir(os.path.join(c, "tools", "scraper", "output")):
            return os.path.abspath(c)
    return None


t = find_tohong()
if not t:
    print("PASS chưa áp dụng (không thấy repo tohong; đặt TOHONG_REPO)"); sys.exit(0)
sc = os.path.join(t, "tools", "scraper")

# (1) công cụ của repo
if not os.path.isfile(os.path.join(sc, "ai_mode_flags.py")):
    fail("không có tools/scraper/ai_mode_flags.py (bất biến chỉ vào bể sau khi T-232 merge)")
env = {k: v for k, v in os.environ.items() if k not in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")}
p = subprocess.run([sys.executable, "ai_mode_flags.py", "check"], cwd=sc, env=env, capture_output=True, text=True, timeout=300)
if p.returncode != 0 or "AI_MODE_FLAGS_OK" not in p.stdout:
    bad = [l for l in p.stdout.splitlines() if l.startswith("AI_MODE_FLAG_VIOLATION")]
    fail(f"ai_mode_flags.py check thoát {p.returncode}; {len(bad)} vi phạm, vd {bad[:3]} {p.stderr[-200:]}")

# (2) kiểm độc lập
exempt = set()
ex = os.path.join(sc, "ai_mode_flags_exempt.json")
if os.path.isfile(ex):
    for e in json.load(open(ex, encoding="utf-8")).get("exempt", []):
        if str(e.get("reason") or "").strip():
            exempt.add((e.get("category"), e.get("id"), e.get("rule")))
viol, n = [], 0
for f in sorted(glob.glob(os.path.join(sc, "output", "*", "*", "vendors.json"))):
    cat = os.path.basename(os.path.dirname(f))
    d = json.load(open(f, encoding="utf-8"))
    for v in (d["vendors"] if isinstance(d, dict) else d):
        if v.get("ai_mode_result") is None:
            continue
        val, vid = v["ai_mode_result"], v.get("id")
        found = []
        if not isinstance(val, str) or val not in VALID:
            found.append("invalid_value")
        else:
            n += 1
            logs = [l for l in v.get("enrichment_log") or [] if l.get("source") == "google_ai_mode" and "ai_mode_result" in (l.get("changes") or {})]
            if not logs or logs[-1]["changes"]["ai_mode_result"] != val:
                found.append("no_log")
            if v.get("verification_status") == "verified" and val in PROBLEM:
                found.append("verified_not_found")
        viol += [(r, cat, vid) for r in found if (cat, vid, r) not in exempt]
if viol:
    fail(f"{len(viol)} vi phạm cờ ai_mode_result trên dữ liệu, vd {viol[:3]} (công cụ check lại thoát 0: công cụ lỏng hơn spec)")
print(f"PASS {n} bản ghi có cờ hợp lệ, có dòng log khớp, không verified mà cờ báo vấn đề; công cụ check thoát 0"); sys.exit(0)
