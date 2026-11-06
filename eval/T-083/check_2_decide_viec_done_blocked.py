#!/usr/bin/env python3
"""T-083 tiêu chí 2: `task.py decide` ghi quyết định Capu cho DR của việc done/blocked thành sự kiện `decided`, không đổi trạng thái; DR rời capu_queue.
Chạy: cd /home/user/tohong-hq && python3 eval/T-083/check_2_decide_viec_done_blocked.py"""
import tempfile
from pathlib import Path
from lib import *
c = Checker()
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "out"
    tasks = {"T-921": dict(state="done", owner="engineering", tier="B", updated="2026-11-06T10:00"),      # done, DR, không PR (như T-070 sau khi PR merged)
             "T-922": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T10:00"),    # blocked chờ Capu, DR
             "T-923": dict(state="escalated", owner="engineering", tier="B", updated="2026-11-06T10:00"),  # escalated, DR (hồi quy)
             "T-924": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T10:00"),
             "T-925": dict(state="done", owner="engineering", tier="C", updated="2026-11-06T10:00"),
             "T-926": dict(state="done", owner="engineering", tier="B", updated="2026-11-04T10:00")}   # done, không PR, cũ 50 giờ, có DR       # done, DR, PR còn mở
    evs = [ev(1, "T-922", "blocked", "Chờ Capu: chưa có dữ liệu thật", frm="product"), ev(2, "T-923", "escalated", "câu hỏi", frm="product"),
           handoff_event(3, "T-925", PR_B), ev(4, "T-921", "merged", "merged", PR_A)]
    fake = build(tmp, tasks, evs, inbox={"T-921-dr.md": "2026-11-10", "T-922-dr.md": "2026-11-10", "T-923-dr.md": "2026-11-10", "T-925-dr.md": "2026-11-10", "T-926-dr.md": "2026-11-10"})
    q0, err = export(fake, out)
    c.chk(q0 is not None, f"export lỗi: {err}")
    k0 = {t: e["kind"] for t, e in by_task(q0["capu_queue"]).items()} if q0 else {}
    c.chk(k0.get("T-921") == "decision" and k0.get("T-922") == "decision" and k0.get("T-923") == "escalated" and k0.get("T-925") == "decision",
          f"trước khi quyết: T-921/T-922/T-925 'decision', T-923 'escalated'; thấy {k0}")
    # ghi quyết định cho việc done
    before = front(fake, "T-921")
    r = task_cmd(fake, "decide", "T-921", "--note", "Chọn phương án A")
    c.chk(r.returncode == 0, "decide việc done có --note phải thoát 0: " + (r.stderr.strip().splitlines() or [""])[-1])
    d = [e for e in events(fake) if e["event"] == "decided" and e["task"] == "T-921"]
    c.chk(len(d) == 1 and d[0]["from"] == "capu" and d[0]["detail"] == "Chọn phương án A", f"đúng một sự kiện decided, from=capu, detail=note; thấy {d}")
    c.chk(front(fake, "T-921") == before, f"việc done không đổi state/holder/owner/tier/rounds/version/prev_state: {before} -> {front(fake, 'T-921')}")
    # board giống hệt từng byte (kể cả updated, lịch sử) và việc 50 giờ không vào lại hàng
    c.chk(k0.get("T-926") == "decision", f"trước khi quyết T-926 là 'decision'; thấy {k0.get('T-926')}")
    raw = (fake / "board" / "T-926.md").read_bytes(); raw21 = (fake / "board" / "T-921.md").read_bytes()
    r = task_cmd(fake, "decide", "T-926", "--note", "ok")
    c.chk(r.returncode == 0, "decide T-926 (done, không PR, 50 giờ) phải thoát 0")
    c.chk((fake / "board" / "T-926.md").read_bytes() == raw, "board/T-926.md không đổi từng byte (updated và lịch sử giữ nguyên)")
    c.chk(raw21 == (fake / "board" / "T-921.md").read_bytes(), "board/T-921.md không đổi từng byte sau decide")
    # blocked
    before = front(fake, "T-922")
    r = task_cmd(fake, "decide", "T-922", "--note", "Chờ thêm dữ liệu, chưa mở")
    c.chk(r.returncode == 0 and front(fake, "T-922") == before and front(fake, "T-922")["state"] == "blocked", "decide việc blocked: thoát 0, vẫn blocked (gỡ chặn là `unblock`, việc khác)")
    # --link được nhận (như /ok)
    link = "https://github.com/phungrk/tohong-hq/issues/5#issuecomment-1"
    r = task_cmd(fake, "decide", "T-925", "--note", "Xem diff rồi", "--link", link)
    c.chk(r.returncode == 0 and any(e["event"] == "decided" and e["task"] == "T-925" and e["link"] == link for e in events(fake)), "decide việc done nhận --link và ghi vào sự kiện")
    # thiếu --note, --close, trạng thái không cho phép: từ chối, không ghi
    n = len(events(fake))
    for args, why in ((["decide", "T-921"], "thiếu --note"), (["decide", "T-921", "--note", "x", "--close"], "--close trên việc done (không có gì để đóng)"),
                      (["decide", "T-924", "--note", "x"], "việc doing: không có DR chờ quyết"), (["decide", "T-999", "--note", "x"], "việc không tồn tại")):
        r = task_cmd(fake, *args)
        c.chk(r.returncode != 0, f"phải từ chối: {why}")
    c.chk(len(events(fake)) == n, "ca bị từ chối không ghi sự kiện nào")
    # escalated: hành vi cũ nguyên vẹn
    r = task_cmd(fake, "decide", "T-923", "--note", "làm tiếp")
    c.chk(r.returncode == 0 and front(fake, "T-923")["state"] == "doing", "escalated: decide vẫn chuyển sang doing (hồi quy)")
    # capu_queue sau khi quyết
    q1, err = export(fake, out)
    c.chk(q1 is not None, f"export lỗi sau quyết: {err}")
    b = by_task(q1["capu_queue"]) if q1 else {}
    c.chk("T-926" not in b, f"T-926 sau decide không vào capu_queue (không bật luật 48 giờ); thấy {b.get('T-926')}")
    c.chk("T-921" not in b, f"T-921 (done, DR đã quyết, PR đã merged) phải ra khỏi capu_queue; thấy {b.get('T-921')}")
    c.chk("T-922" not in b, f"T-922 (blocked chờ Capu, đã quyết): cả 'decision' lẫn 'blocked' đều hết; thấy {b.get('T-922')}")
    c.chk("T-923" not in b, "T-923 đã quyết, về doing: ra")
    c.chk(b.get("T-925", {}).get("kind") == "merge-c", f"T-925 đã quyết DR nhưng PR còn mở (bậc C): còn là 'merge-c', không còn 'decision'; thấy {b.get('T-925')}")
    c.chk("T-925" in b and [l["url"] for l in b["T-925"]["links"]] == [PR_B], "T-925 chỉ còn link PR, không còn link Decision Request")
    # hỏi lại sau khi đã quyết thì vào lại
    with open(fake / "ledger" / "events.jsonl", "a", encoding="utf-8") as f:
        import json; f.write(json.dumps(ev(90, "T-922", "blocked", "Chờ Capu: câu hỏi mới", frm="product")) + "\n")
    q2, _ = export(fake, out)
    c.chk(q2 is not None and "T-922" in by_task(q2["capu_queue"]), "T-922 bị hỏi Capu lần nữa sau quyết định: vào lại capu_queue")
c.done()
