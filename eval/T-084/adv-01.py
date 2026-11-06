"""T-084 adv-01 (Code Gate, adversary): biên M1/M2/M3 mà eval T-083 có thể chưa chạm.
A: PR handoff còn mở + PR ngoài handoff đã merged -> việc vẫn vào, links chỉ PR mở (M2b).
B: PR ngoài handoff có merged detail 'closed', <48h -> ra (đã xử lý = merged|closed).
C: merged với link không phải URL PR (commit), không PR handoff, <48h -> vẫn theo 48h (vào).
D: PR handoff của X được merged dưới task Y -> X ra (xử lý toàn cục).
E: decide từ chối doing / không tồn tại / done+--close / note rỗng, không ghi gì (ledger + board giữ byte).
F: decide done hai lần -> hai sự kiện decided from capu (không idempotent), board giữ byte.
G: 5 decide song song trên việc done -> 5 dòng JSON hợp lệ, id khác nhau.
"""
import json, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "T-083"))
from lib import build, handoff_event, ev, export, by_task, task_cmd, events, Checker, PR_A, PR_B, ROOT  # noqa

c = Checker()
RECENT = "2026-11-06T10:00"   # < 48h trước NOW
PR_C = "https://github.com/phungrk/tohong-hq/pull/99"

with tempfile.TemporaryDirectory() as tmp:
    tasks = {
        "T-901": dict(state="done", owner="engineering", tier="C", updated=RECENT),
        "T-902": dict(state="done", owner="engineering", tier="B", updated=RECENT),
        "T-903": dict(state="done", owner="engineering", tier="B", updated=RECENT),
        "T-904": dict(state="done", owner="engineering", tier="C", updated=RECENT),
        "T-905": dict(state="done", owner="engineering", tier="B", updated=RECENT),
    }
    evs = [
        handoff_event(1, "T-901", PR_A),
        ev(2, "T-901", "merged", "merged", PR_B),
        ev(3, "T-902", "merged", "closed", PR_C),
        ev(4, "T-903", "merged", "merged", "https://github.com/phungrk/tohong-hq/commit/abc123"),
        handoff_event(5, "T-904", "https://github.com/phungrk/tohong-front/pull/77"),
        ev(6, "T-905", "merged", "merged", "https://github.com/phungrk/tohong-front/pull/77"),
    ]
    fake = build(tmp + "/a", tasks, evs)
    d, err = export(fake, tmp + "/out")
    c.chk(err is None, f"export lỗi: {err}")
    q = by_task((d or {}).get("capu_queue", []))
    c.chk("T-901" in q and q["T-901"]["kind"] == "merge-c", f"A: T-901 phải merge-c, có {q.get('T-901')}")
    if "T-901" in q:
        urls = [l["url"] for l in q["T-901"]["links"]]
        c.chk(urls == [PR_A], f"A: links T-901 chỉ PR mở {PR_A}, có {urls}")
    c.chk("T-902" not in q, f"B: T-902 (PR closed) không được chờ, có {q.get('T-902')}")
    c.chk("T-903" in q and q["T-903"]["kind"] == "diff-b", f"C: T-903 (link merged không phải PR, <48h) phải diff-b, có {q.get('T-903')}")
    c.chk("T-904" not in q, f"D: T-904 (PR merged dưới việc khác) không được chờ, có {q.get('T-904')}")
    c.chk("T-905" not in q, f"D: T-905 không được chờ, có {q.get('T-905')}")

with tempfile.TemporaryDirectory() as tmp:
    tasks = {
        "T-911": dict(state="doing", owner="engineering", tier="B", updated=RECENT),
        "T-912": dict(state="done", owner="engineering", tier="B", updated=RECENT),
        "T-913": dict(state="blocked", owner="engineering", tier="B", updated=RECENT),
    }
    fake = build(tmp + "/e", tasks, [])
    led = Path(fake) / "ledger" / "events.jsonl"
    snap = lambda: (led.read_bytes(), {t: (Path(fake) / "board" / f"{t}.md").read_bytes() for t in tasks})
    s0 = snap()
    for args, why in [(["decide", "T-911", "--note", "x"], "doing"),
                      (["decide", "T-999", "--note", "x"], "không tồn tại"),
                      (["decide", "T-912", "--note", "x", "--close"], "done+--close"),
                      (["decide", "T-913", "--note", "x", "--close"], "blocked+--close"),
                      (["decide", "T-912", "--note", ""], "note rỗng"),
                      (["decide", "T-913"], "thiếu note")]:
        r = task_cmd(fake, *args)
        c.chk(r.returncode != 0, f"E: {why} phải thoát khác 0")
        c.chk(snap() == s0, f"E: {why} không được ghi gì")
    note = "Capu chọn B: dừng, chờ dữ liệu"
    for _ in range(2):
        r = task_cmd(fake, "decide", "T-912", "--note", note)
        c.chk(r.returncode == 0, f"F: decide done phải thành công: {r.stderr}")
    r = task_cmd(fake, "decide", "T-913", "--note", note, "--link", "https://github.com/phungrk/tohong-hq/issues/5#issuecomment-1")
    c.chk(r.returncode == 0, f"F: decide blocked phải thành công: {r.stderr}")
    s1 = snap()
    c.chk(s1[1] == s0[1], "F: board phải giữ nguyên byte sau decide done/blocked")
    dec = [e for e in events(fake) if e["event"] == "decided"]
    c.chk(len(dec) == 3, f"F: phải có 3 decided, có {len(dec)}")
    c.chk(all(e["from"] == "capu" and e["detail"] == note for e in dec), f"F: decided phải from capu, đúng note: {dec}")
    c.chk(all("state" not in e and "holder" not in e for e in dec), "F: decided done/blocked không mang state/holder")
    c.chk(dec[-1]["link"].endswith("#issuecomment-1") and dec[0]["link"] == "", "F: link đúng như truyền")
    # G: song song
    procs = [subprocess.Popen([sys.executable, str(ROOT / "scripts" / "task.py"), "decide", "T-912", "--note", f"n{i}"],
                              env=dict(__import__("os").environ, TOHONG_ROOT=str(fake), TOHONG_NOW="2026-11-06T12:00"),
                              stdout=subprocess.DEVNULL, stderr=subprocess.PIPE) for i in range(5)]
    rcs = [p.wait() for p in procs]
    c.chk(all(x == 0 for x in rcs), f"G: 5 decide song song phải thành công: {rcs}")
    try:
        allev = events(fake)
        ids = [e["id"] for e in allev]
        c.chk(len(ids) == len(set(ids)), f"G: id sự kiện trùng: {ids}")
        c.chk(sorted(e["detail"] for e in allev if e["detail"].startswith("n") and e["event"] == "decided") == [f"n{i}" for i in range(5)], "G: thiếu note song song")
    except json.JSONDecodeError as ex:
        c.chk(False, f"G: sổ cái hỏng JSON: {ex}")
    c.chk(snap()[1] == s0[1], "G: board phải giữ byte")
c.done()
