#!/usr/bin/env python3
"""Nguồn: T-076 (spec products/T-076-modal-viec-cho-capu.md v5, INV-P2 của Product), rút bởi adversary ở Code Gate T-078 v2 (2026-11-06).
Bất biến (hq/dashboard): `capu_queue` trong dashboard.json chỉ chứa việc Capu còn phải làm.
  (a) không có link PR nào trong `capu_queue` mà sổ cái đã có sự kiện `merged` (merged hoặc closed) với `link` đúng URL đó;
      nên việc B/C mà mọi PR đã xử lý không còn dòng `diff-b`/`merge-c`;
  (b) không có dòng `diff-b`/`merge-c` cho việc bậc A, hay việc không ở `state: done`;
  (c) không có dòng `decision` cho việc đã có sự kiện trả lời (`decided`/`unblocked`) đứng sau sự kiện hỏi Capu cuối cùng
      (`escalated`, hoặc `blocked` có detail mở bằng "Chờ Capu"); việc chưa từng hỏi thì không có dòng `decision` nếu đã có `decided`;
  (d) mọi việc `state: escalated` trên board đều có trong `capu_queue`; mỗi mã việc tối đa một phần tử.
Đo trên hai nguồn: sổ cái thật của repo này (xuất --public vào thư mục tạm, không ghi gì vào repo) và một sổ cái giả có đủ ca biên.
Áp dụng từ khi scripts/export_dashboard.py xuất `capu_queue` (T-076/T-078 vào); trước đó PASS "chưa áp dụng".
Chạy: python3 eval/invariants/hq/dashboard/inv-008-capu-queue-khong-chua-viec-da-xu-ly.py
"""
import json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EXPORT = ROOT / "scripts" / "export_dashboard.py"
ASK = re.compile(r"^\s*Chờ Capu\b", re.I)
GH = "https://github.com/phungrk/"
bad = []


def chk(c, m):
    print(("PASS " if c else "FAIL ") + m)
    if not c:
        bad.append(m)


def front(p):
    t = p.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---", t, re.S)
    out = {}
    for line in (m.group(1).splitlines() if m else []):
        k, _, v = line.partition(":")
        out[k.strip()] = v.strip().strip('"')
    return out


def events(root):
    p = root / "ledger" / "events.jsonl"
    seen, out = set(), []
    for line in (p.read_text(encoding="utf-8").splitlines() if p.exists() else []):
        if not line.strip() or line in seen:
            continue
        seen.add(line)
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def export(root, out, env_extra=None):
    env = dict(os.environ)
    env.pop("PR_READ_TOKEN", None)
    if root != ROOT:
        env["TOHONG_ROOT"] = str(root)
    env.update(env_extra or {})
    r = subprocess.run([sys.executable, str(EXPORT), "--out", str(out), "--public"], capture_output=True, text=True, env=env)
    if r.returncode != 0:
        return None, (r.stderr.strip().splitlines() or ["thoát %d" % r.returncode])[-1]
    return json.loads((Path(out) / "dashboard.json").read_text(encoding="utf-8")), None


def check(tag, root, q):
    board = {p.stem: front(p) for p in (root / "board").glob("T-*.md")}
    evs = events(root)
    merged = {e.get("link") for e in evs if e.get("event") == "merged" and e.get("link")}
    ids = [e.get("task") for e in q]
    chk(len(ids) == len(set(ids)), f"{tag}: mỗi mã việc tối đa một phần tử ({len(ids)} phần tử)")
    for e in q:
        tid, kind, b = e.get("task"), e.get("kind"), board.get(e.get("task"), {})
        stale = [l.get("url") for l in e.get("links", []) if l.get("url") in merged]
        chk(not stale, f"{tag}: {tid} không chứa PR đã có sự kiện merged/closed {stale}")
        if kind in ("diff-b", "merge-c"):
            chk(b.get("tier") in ("B", "C") and b.get("state") == "done", f"{tag}: {tid} loại {kind} chỉ cho việc B/C đã done (tier {b.get('tier')}, state {b.get('state')})")
        if kind == "decision":
            mine = [x for x in evs if x.get("task") == tid]
            asks = [i for i, x in enumerate(mine) if x.get("event") == "escalated" or (x.get("event") == "blocked" and ASK.match(unicodedata.normalize("NFC", x.get("detail") or "")))]
            if asks:
                ans = [i for i, x in enumerate(mine) if i > asks[-1] and x.get("event") in ("decided", "unblocked")]
            else:
                ans = [i for i, x in enumerate(mine) if x.get("event") == "decided"]
            chk(not ans, f"{tag}: {tid} decision chưa được trả lời sau lần hỏi cuối (thấy trả lời ở vị trí {ans[:3]})")
    esc = sorted(t for t, b in board.items() if b.get("state") == "escalated")
    chk(all(t in ids for t in esc), f"{tag}: mọi việc escalated trên board có trong capu_queue: thiếu {[t for t in esc if t not in ids]}")


def T(fake, tid, state, owner, tier, updated="2026-11-06T09:00"):
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    body = re.sub(r"(?m)^id:.*$", f"id: {tid}", src, count=1)
    for k, v in (("state", state), ("owner", owner), ("tier", f'"{tier}"'), ("updated", f'"{updated}"'), ("holder", "-")):
        body = re.sub(rf"(?m)^{k}:.*$", f"{k}: {v}", body, count=1)
    (fake / "board" / f"{tid}.md").write_text(body, encoding="utf-8")


def E(i, tid, event, detail="", link="", frm="chief-of-staff"):
    return {"id": f"E-{i:04d}", "t": "2026-11-05T10:00", "task": tid, "title": "x", "event": event, "from": frm, "to": "adversary", "round": 0,
            "severity": "", "detail": detail, "link": link, "cost": 0.0, "state": "", "holder": ""}


if not EXPORT.exists():
    print("PASS chưa áp dụng: chưa có scripts/export_dashboard.py"); sys.exit(0)
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    d, err = export(ROOT, tmp / "real")
    if d is None:
        print("FAIL exporter không chạy trên sổ cái thật: " + str(err)); sys.exit(1)
    if "capu_queue" not in d:
        print("PASS chưa áp dụng: dashboard.json chưa có capu_queue (T-076)"); sys.exit(0)
    check("sổ cái thật", ROOT, d["capu_queue"])
    # Sổ cái giả: PR merged, PR closed, bậc A, decided sau hỏi, unblocked sau hỏi, hỏi lại sau decided, escalated
    fake = tmp / "ledger"
    for s in ("board", "org", "ledger", "inbox/capu", "handoffs"):
        (fake / s).mkdir(parents=True)
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    T(fake, "T-951", "done", "engineering", "B"); T(fake, "T-952", "done", "engineering", "C"); T(fake, "T-953", "done", "engineering", "A", "2026-11-06T11:00")
    T(fake, "T-954", "done", "engineering", "B"); T(fake, "T-955", "doing", "product", "B"); T(fake, "T-956", "doing", "product", "B")
    T(fake, "T-957", "escalated", "product", "A"); T(fake, "T-958", "done", "engineering", "B")
    ev = [E(1, "T-951", "handoff", "d", GH + "tohong-front/pull/91", "engineering"), E(2, "T-951", "merged", "merged", GH + "tohong-front/pull/91"),
          E(3, "T-952", "handoff", "d", GH + "tohong-back/pull/92", "engineering"), E(4, "T-952", "merged", "closed", GH + "tohong-back/pull/92"),
          E(5, "T-953", "handoff", "d", GH + "tohong-front/pull/93", "engineering"),
          E(6, "T-954", "handoff", "d " + GH + "tohong-front/pull/94 " + GH + "tohong-back/pull/95", GH + "tohong-front/pull/94", "engineering"), E(7, "T-954", "merged", "merged", GH + "tohong-front/pull/94"),
          E(8, "T-955", "escalated", "x"), E(9, "T-955", "decided", "x"),
          E(10, "T-956", "blocked", "Cho\u031b\u0300 Capu: NFD"), E(11, "T-956", "unblocked", "x"),
          E(12, "T-957", "escalated", "x"),
          E(13, "T-958", "decided", "x"), E(14, "T-958", "escalated", "hỏi lại"), E(15, "T-958", "decided", "x"), E(16, "T-958", "handoff", "d", GH + "tohong-front/pull/98", "engineering"), E(17, "T-958", "merged", "merged", GH + "tohong-front/pull/98")]
    (fake / "ledger" / "events.jsonl").write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in ev) + "\n", encoding="utf-8")
    for n in ("T-955-a.md", "T-956-b.md", "T-957-c.md", "T-958-d.md"):
        (fake / "inbox" / "capu" / n).write_text(f"---\ntype: decision-request\ntask: {n[:5]}\ndecide-by: 2026-11-10\n---\nx\n", encoding="utf-8")
    d2, err = export(fake, tmp / "fake", {"TOHONG_NOW": "2026-11-06T12:00"})
    if d2 is None:
        print("FAIL exporter không chạy trên sổ cái giả: " + str(err)); sys.exit(1)
    q2 = d2.get("capu_queue", [])
    check("sổ cái giả", fake, q2)
    got = {e["task"]: e["kind"] for e in q2}
    chk(got == {"T-954": "diff-b", "T-957": "escalated"}, f"sổ cái giả: capu_queue đúng {{T-954: diff-b (PR #95 còn mở), T-957: escalated}}, thấy {got}")
print("FAIL %d ý" % len(bad) if bad else "PASS")
sys.exit(1 if bad else 0)
