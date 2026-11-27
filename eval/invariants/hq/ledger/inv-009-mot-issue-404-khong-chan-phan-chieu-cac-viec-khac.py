#!/usr/bin/env python3
"""Bất biến hq/ledger INV-009 · nguồn: sự cố 2026-11-22..25 (insights/2026-11-27-feedback.md): workflow
"Phản chiếu sổ cái lên Issue" thất bại ít nhất 67 lượt liên tiếp (lượt thành công cuối 2026-11-20) vì board/T-219..T-222
mang `issue: 113`, mà #113 là issue của kho phungrk/tohong, không phải phungrk/tohong-hq → GitHub 404 → `gh()` gọi
SystemExit, cả lượt chết ở mốc đầu, thư mục state không được lưu, mọi lần đẩy sau lặp lại đúng lỗi đó.
Bất biến: một issue trả 404 (tham chiếu sai kho / issue đã xoá) KHÔNG được chặn việc khác.
  Dựng sổ cái tạm có hai việc, T-900 (issue 900 → 404) đứng trước T-901 (issue 901 → 201), cả hai có sự kiện `assigned` mới.
  (a) comment mốc ① của T-901 vẫn được gửi tới /issues/901/comments;
  (b) `mirrored.txt` trong state có khoá của sự kiện T-901, để lượt sau không phản chiếu lại và không lặp lỗi vô hạn.
Không ràng buộc mã thoát: được phép báo đỏ cho issue hỏng miễn việc khác vẫn đi qua.
Không gọi mạng thật: thay urllib.request.urlopen trong tiến trình con; chạy trên TOHONG_ROOT tạm."""
import json, os, pathlib, subprocess, sys, tempfile, textwrap

REPO = pathlib.Path(__file__).resolve().parents[4]
BOARD = textwrap.dedent("""\
    ---
    id: {tid}
    title: "Việc thử {tid}"
    state: doing
    holder: product
    owner: product
    reviewer: spec-critic
    rounds: 0
    version: 1
    deadline: ""
    budget: $1
    escalation: tu-lam
    tier: B
    area: hq/ledger
    eval: []
    spec_returns: 0
    evals_added: 0
    issue: {issue}
    created: "2026-11-27T00:00"
    updated: "2026-11-27T00:00"
    prev_state: ""
    cost: 0
    ---

    # {tid} · Việc thử
    """)
DRIVER = textwrap.dedent("""\
    import json, sys, urllib.error, urllib.request, io
    sys.path.insert(0, sys.argv[1] + "/scripts")
    import mirror_issue
    calls = []
    class R:
        def __init__(s, b): s.b = b
        def read(s): return s.b
        def __enter__(s): return s
        def __exit__(s, *a): return False
    def fake(req, timeout=0):
        path = req.full_url.split("api.github.com")[1]
        calls.append([req.get_method(), path])
        if "/issues/900" in path:
            raise urllib.error.HTTPError(req.full_url, 404, "Not Found", {}, io.BytesIO(b'{"message":"Not Found"}'))
        return R(b"{}")
    urllib.request.urlopen = fake
    sys.argv = ["mirror_issue.py", "--state", sys.argv[2]]
    try:
        mirror_issue.main()
    except SystemExit as e:
        print("EXIT", repr(e.code))
    print("CALLS", json.dumps(calls))
""")
fails = []
with tempfile.TemporaryDirectory(prefix="inv009-") as tmp:
    root = pathlib.Path(tmp) / "hq"
    (root / "ledger").mkdir(parents=True); (root / "board").mkdir()
    (root / "scripts").mkdir()
    for f in (REPO / "scripts").glob("*.py"):
        (root / "scripts" / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")
    for tid, issue in (("T-900", 900), ("T-901", 901)):
        (root / "board" / f"{tid}.md").write_text(BOARD.format(tid=tid, issue=issue), encoding="utf-8")
    evs = [{"id": f"E-{i}", "t": "2026-11-27T00:0%d" % i, "task": t, "title": "thử", "event": "assigned",
            "from": "chief-of-staff", "to": "product", "round": 0, "severity": "", "detail": "", "link": "", "cost": 0}
           for i, t in ((1, "T-900"), (2, "T-901"))]
    (root / "ledger" / "events.jsonl").write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in evs), encoding="utf-8")
    state = pathlib.Path(tmp) / "state"; state.mkdir()
    (state / "mirrored.txt").write_text("seed\n", encoding="utf-8")  # không phải lần đầu: có mốc cần phản chiếu
    drv = pathlib.Path(tmp) / "driver.py"; drv.write_text(DRIVER, encoding="utf-8")
    env = {"PATH": os.environ.get("PATH", ""), "TOHONG_ROOT": str(root), "GH_TOKEN": "x", "GITHUB_REPOSITORY": "phungrk/tohong-hq", "HOME": tmp}
    r = subprocess.run([sys.executable, "-I", str(drv), str(root), str(state)], cwd=tmp, env=env,
                       capture_output=True, text=True, timeout=60)
    out = r.stdout
    calls = []
    for line in out.splitlines():
        if line.startswith("CALLS "):
            calls = json.loads(line[6:])
    if not calls and "CALLS" not in out:
        fails.append("driver không chạy tới cùng: " + (r.stderr or out)[-300:])
    else:
        if not any(m == "POST" and p.endswith("/issues/901/comments") for m, p in calls):
            fails.append("(a) issue 900 trả 404 làm mất comment mốc ① của T-901 (lượt phản chiếu chết ở việc đầu)")
        seen = (state / "mirrored.txt").read_text(encoding="utf-8").split()
        if len(seen) <= 1:
            fails.append("(b) state không được ghi: lượt sau lặp lại đúng lỗi 404, không bao giờ tiến lên")
if fails:
    print("INV-009 ĐỎ:\n  " + "\n  ".join(fails)); sys.exit(1)
print("INV-009 đạt: issue 404 không chặn việc khác, state vẫn tiến"); sys.exit(0)
