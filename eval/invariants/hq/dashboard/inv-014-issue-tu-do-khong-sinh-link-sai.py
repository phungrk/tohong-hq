#!/usr/bin/env python3
"""Nguồn: ống hồi tuần 2026-11-06 (insight). Hai lần liên tiếp adversary tìm ra cùng một gốc: trường `issue` trong board/ là chữ tự do
mà nhiều bên đọc theo cách riêng: T-063/adv-03 (2026-11-04, `issue` rác làm cả lần phản chiếu dừng) và T-086/adv-01 (2026-11-06, nháy kép lẻ
vẫn ra link Issue). inv-013 chỉ kiểm trên board thật nên không bắt được giá trị độc hại chưa từng xuất hiện trong board thật.
Bất biến (hq/dashboard): với board mang giá trị `issue` tuỳ ý, `capu_queue` công khai chỉ có link Issue khi giá trị (sau khi bỏ khoảng trắng đầu/cuối
và MỘT cặp nháy kép bao ngoài) là số nguyên dương viết bằng chữ số ASCII 1-9/0 không số 0 đứng đầu; link đúng dạng
https://github.com/phungrk/tohong-hq/issues/<n>. Mọi giá trị khác (nháy lẻ, nháy đơn, 0, 012, #12, +12, -3, 12abc, 1e3, 1.0, '12 13',
chữ số Ả Rập/toàn chữ rộng, URL, '12/../../x', ký tự rộng-không-độ-rộng) không sinh link, và exporter không dừng.
Cố ý KHÔNG kiểm khoảng trắng không ngắt (U+00A0) cuối giá trị: spec T-081 nói "bỏ khoảng trắng" không rõ có gồm U+00A0 (exporter hiện bỏ, inv-013 không bỏ).
Không token, không mạng, chạy trên sổ cái giả trong thư mục tạm (TOHONG_ROOT), không đụng sổ cái thật.
Chạy: cd /home/user/tohong-hq && python3 -I eval/invariants/hq/dashboard/inv-014-issue-tu-do-khong-sinh-link-sai.py   (PASS / FAIL <lý do>)
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EXP = ROOT / "scripts" / "export_dashboard.py"
URL = "https://github.com/phungrk/tohong-hq/issues/"
if not EXP.exists():
    print("PASS chưa áp dụng: chưa có scripts/export_dashboard.py"); sys.exit(0)

# giá trị board -> số issue mong đợi trong link ("" = không có link)
CASES = {
    "12": "12", '"12"': "12", '" 13 "': "13", "\t14": "14", "7": "7",
    '"12': "", '12"': "", "'15'": "", "0": "", "012": "", "#12": "", "+12": "", "-3": "", "12abc": "", "1e3": "", "1.0": "",
    "12 13": "", "١٢": "", "１２": "", "1٢": "", URL + "12": "", "12/../../x": "", "12​": "", '""': "", '"': "",
}

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp); fake = tmp / "fake"
    for sub in ("board", "org", "ledger", "inbox/capu", "handoffs"):
        (fake / sub).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    base = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    ids = {}
    for i, (raw, want) in enumerate(CASES.items()):
        tid = f"T-{900 + i}"; ids[tid] = (raw, want)
        s = re.sub(r"(?m)^id:.*$", "id: " + tid, base, count=1)
        s = re.sub(r"(?m)^state:.*$", "state: escalated", s, count=1)
        s = re.sub(r"(?m)^issue:.*\n", "", s)
        s = re.sub(r"(?m)^(tier:.*)$", lambda m: m.group(1) + "\nissue: " + raw, s, count=1)
        (fake / "board" / f"{tid}.md").write_text(s, encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("", encoding="utf-8")
    env = {k: v for k, v in os.environ.items() if k not in ("PR_READ_TOKEN", "TOHONG_ROOT")}
    env["TOHONG_ROOT"] = str(fake)
    r = subprocess.run([sys.executable, str(EXP), "--public", "--out", str(tmp / "out")], capture_output=True, text=True, env=env)
    if r.returncode:
        print("FAIL exporter dừng với giá trị issue tuỳ ý: " + (r.stderr.strip().splitlines() or ["thoát " + str(r.returncode)])[-1]); sys.exit(1)
    d = json.loads((tmp / "out" / "dashboard.json").read_text(encoding="utf-8"))
    if "capu_queue" not in d:
        print("PASS chưa áp dụng: chưa có capu_queue"); sys.exit(0)
    m = {e.get("task"): e for e in d["capu_queue"]}
    bad = []
    for tid, (raw, want) in ids.items():
        if tid not in m:
            bad.append(f"{tid} (issue={raw!r}) mất khỏi capu_queue"); continue
        links = [l for l in m[tid].get("links", []) if "/issues/" in l.get("url", "")]
        got = [l["url"] for l in links]
        exp = [URL + want] if want else []
        if got != exp:
            bad.append(f"issue={raw!r}: mong {exp}, thấy {got}")
        elif want and links[0].get("label") != "Issue #" + want:
            bad.append(f"issue={raw!r}: nhãn {links[0].get('label')!r} không phải 'Issue #{want}'")
    for x in bad: print("FAIL " + x)
    print("FAIL" if bad else "PASS", f"{len(ids)} giá trị issue thử")
    sys.exit(1 if bad else 0)
