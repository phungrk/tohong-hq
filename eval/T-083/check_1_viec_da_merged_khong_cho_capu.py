#!/usr/bin/env python3
"""T-083 tiêu chí 1: việc B/C done có sự kiện `merged` cho mọi PR đã biết không vào capu_queue, kể cả khi PR không có trong handoff.
Chạy: cd /home/user/tohong-hq && python3 eval/T-083/check_1_viec_da_merged_khong_cho_capu.py"""
import tempfile
from pathlib import Path
from lib import *
c = Checker()
D = lambda tier="C": dict(state="done", owner="engineering", tier=tier, updated="2026-11-06T10:00")  # cập nhật 2 giờ trước NOW
def run(name, tasks, events_, handoffs=None):
    with tempfile.TemporaryDirectory() as tmp:
        fake = build(tmp, tasks, events_, handoffs=handoffs)
        q, err = export(fake, Path(tmp) / "out")
        if q is None: c.chk(False, f"{name}: export lỗi: {err}"); return {}
        return by_task(q["capu_queue"])
H = lambda i, t, link: handoff_event(i, t, link)
# 1. ca thật T-082: handoff chỉ trỏ handoffs/..md không có URL PR, PR do workflow mở, có merged -> ra (cập nhật 2 giờ trước, trong 48 giờ)
for tier in ("B", "C"):
    q = run(f"ca T-082 bậc {tier}", {"T-901": D(tier)}, [H(1, "T-901", "handoffs/T-901-v1.md"), ev(2, "T-901", "merged", "merged", PR_A, frm="chief-of-staff")])
    c.chk("T-901" not in q, f"bậc {tier}, PR không có trong handoff nhưng có sự kiện merged, cập nhật < 48h: phải ra khỏi capu_queue; thấy {q.get('T-901')}")
# 2. không có handoff nào, chỉ có merged
q = run("chỉ merged", {"T-902": D("B")}, [ev(1, "T-902", "merged", "merged", PR_A)])
c.chk("T-902" not in q, "không có handoff, có merged: phải ra")
# 3. `closed` cũng là đã xử lý
q = run("closed", {"T-903": D("B")}, [ev(1, "T-903", "merged", "closed: đóng không merge", PR_A)])
c.chk("T-903" not in q, "sự kiện merged với detail 'closed' cũng xử lý PR: phải ra")
# 4. hồi quy: PR có trong handoff và đã merged -> ra; hai PR, mới merged một -> còn, chỉ link PR chưa xử lý
q = run("hồi quy", {"T-904": D("B"), "T-905": D("C")},
        [H(1, "T-904", PR_B), ev(2, "T-904", "merged", "merged", PR_B), H(3, "T-905", PR_B), H(4, "T-905", "https://github.com/phungrk/tohong-back/pull/7"), ev(5, "T-905", "merged", "merged", PR_B)])
c.chk("T-904" not in q, "PR trong handoff đã merged: phải ra")
c.chk("T-905" in q and [l["url"] for l in q["T-905"]["links"]] == ["https://github.com/phungrk/tohong-back/pull/7"], f"hai PR mới merged một: còn, link chỉ PR chưa xử lý; thấy {q.get('T-905')}")
# 5. PR do workflow mở (đã merged) KHÔNG che PR khác còn mở của cùng việc
q = run("PR khác còn mở", {"T-906": D("B")}, [H(1, "T-906", PR_B), ev(2, "T-906", "merged", "merged", PR_A)])
c.chk("T-906" in q and [l["url"] for l in q["T-906"]["links"]] == [PR_B], f"PR_A merged (ngoài handoff), PR_B còn mở: còn, link chỉ PR_B; thấy {q.get('T-906')}")
# 6. luật 48h còn nguyên cho việc không PR nào và không merged
q = run("48h", {"T-907": dict(D("B"), updated="2026-11-05T12:00"), "T-908": dict(D("B"), updated="2026-11-04T10:00")}, [])
c.chk("T-907" in q and q["T-907"]["links"] == [], "không PR, không merged, cập nhật 24h: còn, links rỗng (D4)")
c.chk("T-908" not in q, "không PR, không merged, cập nhật 50h: ra (D4)")
# 7. sự kiện merged có link không phải URL PR của phungrk bị bỏ qua (không nuốt việc)
q = run("link lạ", {"T-909": D("B")}, [ev(1, "T-909", "merged", "merged", "https://example.com/pull/1"), ev(2, "T-909", "merged", "merged", "")])
c.chk("T-909" in q, "merged có link không phải PR của github.com/phungrk: không tính là đã xử lý, việc vẫn còn (48h)")
# 8. merged của việc khác không che việc này
q = run("việc khác", {"T-910": D("B"), "T-911": D("B")}, [H(1, "T-910", PR_B), ev(2, "T-911", "merged", "merged", PR_A)])
c.chk("T-910" in q and "T-911" not in q, f"merged của T-911 không che T-910; thấy {sorted(q)}")
# 9. bậc A không bao giờ vào
q = run("bậc A", {"T-912": D("A")}, [H(1, "T-912", PR_B)])
c.chk("T-912" not in q, "bậc A không vào (hồi quy)")
c.done()
