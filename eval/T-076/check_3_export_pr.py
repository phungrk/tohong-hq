#!/usr/bin/env python3
"""T-076 tiêu chí 3: bước xuất dữ liệu (scripts/export_dashboard.py) chỉ đưa vào `capu_queue` những việc còn chờ Capu: PR đã merge hoặc đóng không vào; link Decision Request tìm đúng file.
Chạy: cd /home/user/tohong-hq && python3 eval/T-076/check_3_export_pr.py     (PASS / FAIL <lý do>, mã thoát 0/1)
Giao diện của exporter mà eval này dựa vào (spec mục 'Dữ liệu'): cờ `--pr-state-file F` (JSON {"phungrk/<repo>#<n>": "open|merged|closed|unknown"}, thiếu khoá = unknown), trường `capu_queue` trong dashboard.json.
"""
import sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _export_lib as X

GH = "https://github.com/phungrk/"
bad = []
def chk(c, m):
    if not c: bad.append(m)

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    done = lambda tier, upd="2026-11-05T10:00": dict(state="done", owner="engineering", tier=tier, updated=upd, holder="-")
    tasks = {
        "T-901": dict(state="escalated", owner="product", tier="B", updated="2026-11-06T09:00", holder="chief-of-staff"),   # có file Decision Request
        "T-902": dict(state="escalated", owner="product", tier="A", updated="2026-11-06T09:00", holder="chief-of-staff"),   # không có file
        "T-903": done("B"),   # PR mở -> vào
        "T-904": done("C"),   # PR merged -> ra
        "T-905": done("B"),   # PR closed (không merge) -> ra
        "T-906": done("B"),   # hai PR: một merged, một open -> vào, chỉ link PR mở
        "T-907": done("A"),   # bậc A -> ra dù PR mở
        "T-908": done("B"),   # PR unknown, mới (<48h) -> vào, pr_state unknown
        "T-909": done("B", "2026-11-01T10:00"),   # PR unknown, cũ (>48h) -> ra
        "T-910": done("B", "2026-11-06T10:00"),   # không có link PR, mới -> vào, links rỗng
        "T-911": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),   # chưa xong -> ra
        "T-912": done("C", "2026-10-20T10:00"),   # PR mở nhưng cũ 17 ngày -> vào (open xác nhận thì không có hạn 48h)
    }
    ev = [X.handoff_event(1, "T-903", GH + "tohong-front/pull/90"), X.handoff_event(2, "T-904", GH + "tohong-back/pull/91"), X.handoff_event(3, "T-905", GH + "tohong-front/pull/92"),
          X.handoff_event(4, "T-906", GH + "tohong-front/pull/93"), X.handoff_event(5, "T-906", GH + "tohong-back/pull/94", "2026-11-05T11:00"),
          X.handoff_event(6, "T-907", GH + "tohong-front/pull/95"), X.handoff_event(7, "T-908", GH + "tohong-front/pull/96"), X.handoff_event(8, "T-909", GH + "tohong-front/pull/97"),
          X.handoff_event(9, "T-910", "handoffs/T-910-v1.md"), X.handoff_event(10, "T-912", "handoffs/T-912-v1.md")]
    handoffs = {"T-912-v1.md": f"PR: {GH}tohong/pull/98\n"}   # link PR chỉ nằm trong file bàn giao, không ở sự kiện
    inbox = ["T-901-quyet-cai-nay.md", "T-901-cu.md", "T-999-khong-lien-quan.md"]
    fake = X.build(tmp, tasks, ev, inbox, handoffs)
    pr_state = {"phungrk/tohong-front#90": "open", "phungrk/tohong-back#91": "merged", "phungrk/tohong-front#92": "closed",
                "phungrk/tohong-front#93": "merged", "phungrk/tohong-back#94": "open", "phungrk/tohong-front#95": "open", "phungrk/tohong#98": "open"}
    d, err = X.export(fake, tmp / "out", pr_state)
    if d is None:
        print("FAIL exporter không chạy: " + str(err)); sys.exit(1)
    q = d.get("capu_queue")
    if not isinstance(q, list):
        print("FAIL dashboard.json thiếu mảng capu_queue"); sys.exit(1)
    m = X.by_task(q)
    chk(len(m) == len(q), "mỗi việc đúng một phần tử capu_queue")
    chk(set(m) == {"T-901", "T-902", "T-903", "T-906", "T-908", "T-910", "T-912"}, "tập việc trong capu_queue sai: " + ",".join(sorted(m)))
    chk(m.get("T-901", {}).get("kind") == "escalated" and m["T-901"]["links"][0]["url"] in (GH + "tohong-hq/blob/main/inbox/capu/T-901-quyet-cai-nay.md", GH + "tohong-hq/blob/main/inbox/capu/T-901-cu.md"), "T-901 phải trỏ một file inbox/capu/T-901-*.md có thật")
    chk(m.get("T-901", {}).get("links", [{}])[0].get("url", "").startswith(GH + "tohong-hq/blob/main/inbox/capu/T-901-"), "link Decision Request phải là github.com/phungrk/tohong-hq/blob/main/inbox/capu/<file>")
    chk(m.get("T-902", {}).get("links") == [{"label": "Decision Request", "url": GH + "tohong-hq/tree/main/inbox/capu", "pr_state": ""}], "leo thang không có file: link thư mục tree/main/inbox/capu, got " + str(m.get("T-902")))
    chk(m.get("T-903", {}).get("kind") == "diff-b" and [l["url"] for l in m["T-903"]["links"]] == [GH + "tohong-front/pull/90"] and m["T-903"]["links"][0]["pr_state"] == "open", "T-903: bậc B, một link PR mở")
    chk([l["url"] for l in m.get("T-906", {}).get("links", [])] == [GH + "tohong-back/pull/94"], "T-906: chỉ giữ PR còn mở (94), bỏ PR đã merge (93)")
    chk(m.get("T-908", {}).get("links", [{}])[0].get("pr_state") == "unknown", "T-908: PR không rõ trạng thái -> pr_state unknown, vẫn vào vì mới < 48h")
    chk(m.get("T-910", {}).get("links") == [] and m["T-910"]["kind"] == "diff-b", "T-910: không có link PR -> links rỗng, vẫn vào vì mới")
    chk(m.get("T-912", {}).get("kind") == "merge-c" and [l["url"] for l in m["T-912"]["links"]] == [GH + "tohong/pull/98"], "T-912: link PR lấy từ file handoffs/T-912-v*.md, PR mở nên vào dù cũ")
    for e in q:
        chk(set(e) == {"task", "kind", "links"} and e["kind"] in ("escalated", "diff-b", "merge-c") and all(set(l) == {"label", "url", "pr_state"} for l in e["links"]), f"{e.get('task')}: sai hình dạng phần tử")

    # Không có cờ, không có token: không sập, mọi PR unknown; việc cũ >48h không vào
    d2, err2 = X.export(fake, tmp / "out2", None)
    chk(d2 is not None and isinstance(d2.get("capu_queue"), list), "không có token/cờ: exporter vẫn chạy và vẫn có capu_queue (" + str(err2) + ")")
    if d2 and isinstance(d2.get("capu_queue"), list):
        m2 = X.by_task(d2["capu_queue"])
        chk("T-904" not in m2 or m2["T-904"]["links"][0]["pr_state"] == "unknown", "không token: PR không kiểm được phải ghi unknown, không giả open/merged")
        chk("T-909" not in m2 and "T-912" not in m2, "không token: việc xong > 48h với PR không kiểm được thì không đếm")
        chk({"T-901", "T-902"} <= set(m2), "không token: việc leo thang vẫn đủ")

if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
