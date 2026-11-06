#!/usr/bin/env python3
"""T-081 tiêu chí 1 (phần xuất, D-I1..D-I4): `capu_queue[].links` của scripts/export_dashboard.py chứa link `Issue #<n>` khi và chỉ khi board của việc có `issue` là số nguyên dương
viết thường (^[1-9][0-9]*$); thứ tự link: Decision Request, Issue, PR; link đúng ba khoá label/url/pr_state; bản --public và bản thường cho cùng capu_queue;
bản công khai không thêm trường `issue` vào tasks[] và không lộ gì ngoài con số trong URL. Không token, không mạng.
Chạy: cd /home/user/tohong-hq && python3 eval/T-081/check_1_export_link_issue.py     (PASS / FAIL <lý do>, mã thoát 0/1)
"""
import sys, tempfile, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _lib as X
GH, I, DRB, DIR = X.GH, X.ISSUE, X.DRB, X.DIR
C = X.Checker()
lk = lambda label, url, st="": {"label": label, "url": url, "pr_state": st}
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    esc = lambda: dict(state="escalated", owner="product", tier="B", updated="2026-11-06T09:00", holder="chief-of-staff")
    done = lambda tier="B": dict(state="done", owner="engineering", tier=tier, updated="2026-11-05T10:00", holder="-")
    tasks = {"T-901": esc(), "T-902": esc(), "T-903": esc(), "T-904": done(), "T-905": done("C"),
             "T-906": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
             "T-907": esc(), "T-908": esc(), "T-909": esc(), "T-910": done(), "T-911": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),
             "T-912": dict(state="done", owner="engineering", tier="B", updated="2026-11-06T10:00", holder="-"), "T-913": esc(), "T-914": esc()}
    issues = {"T-901": "12", "T-902": '"13"', "T-903": '""', "T-904": "14", "T-905": "15", "T-906": "16", "T-907": "abc", "T-908": "0", "T-909": "007",
              "T-910": "20", "T-911": "21", "T-912": "22", "T-913": "-5", "T-914": "12.5"}
    E, H = X.ev, X.handoff_event
    evs = [H(1, "T-904", GH + "tohong-front/pull/70"), H(2, "T-905", GH + "tohong-back/pull/71"),
           E(3, "T-906", "blocked", "Chờ Capu: cần anh đặt secret", "", "2026-11-04T10:00"),
           H(4, "T-910", GH + "tohong-front/pull/72"), E(5, "T-910", "merged", "merged: x", GH + "tohong-front/pull/72")]
    inbox = {"T-901-quyet.md": "2026-11-10", "T-905-dr.md": "2026-11-12"}
    fake = X.build(tmp, tasks, evs, inbox, {})
    for t, raw in issues.items(): X.set_issue(fake, t, raw)
    d, err = X.export(fake, tmp / "pub", public=True)
    d2, err2 = X.export(fake, tmp / "full", public=False)
    if d is None or d2 is None: print("FAIL exporter không chạy: " + str(err or err2)); sys.exit(1)
    q = d.get("capu_queue"); m = X.by_task(q)
    C.chk(set(m) == {"T-901", "T-902", "T-903", "T-904", "T-905", "T-906", "T-907", "T-908", "T-909", "T-912", "T-913", "T-914"}, "tập việc trong capu_queue sai (issue không đổi tập): " + str(sorted(m)))
    g = lambda t: m.get(t, {}).get("links")
    C.chk(g("T-901") == [lk("Decision Request", DRB + "T-901-quyet.md"), lk("Issue #12", I + "12")], "T-901 escalated có DR + issue 12: [DR, Issue #12]; thấy " + str(g("T-901")))
    C.chk(g("T-902") == [lk("Decision Request", DIR), lk("Issue #13", I + "13")], 'T-902 escalated không file DR, issue viết "13" có nháy: [thư mục, Issue #13]; thấy ' + str(g("T-902")))
    C.chk(g("T-903") == [lk("Decision Request", DIR)], 'T-903 issue "" : không link issue; thấy ' + str(g("T-903")))
    C.chk(g("T-904") == [lk("Issue #14", I + "14"), lk("PR tohong-front#70", GH + "tohong-front/pull/70", "open")], "T-904 diff-b không DR: [Issue #14, PR] (issue đứng trước PR); thấy " + str(g("T-904")))
    C.chk(g("T-905") == [lk("Decision Request", DRB + "T-905-dr.md"), lk("Issue #15", I + "15"), lk("PR tohong-back#71", GH + "tohong-back/pull/71", "open")], "T-905 DR + issue + PR theo thứ tự DR, Issue, PR; thấy " + str(g("T-905")))
    C.chk(g("T-906") == [lk("Decision Request", DIR), lk("Issue #16", I + "16")], "T-906 blocked chờ Capu: [thư mục, Issue #16]; thấy " + str(g("T-906")))
    for t, why in (("T-907", "issue chữ"), ("T-908", "issue 0"), ("T-909", "issue 007 (số 0 đứng đầu)"), ("T-913", "issue âm"), ("T-914", "issue số thập phân")):
        C.chk(all("Issue" not in l["label"] and "/issues/" not in l["url"] for l in g(t) or []), f"{t}: không link issue ({why}); thấy " + str(g(t)))
    C.chk(g("T-912") == [lk("Issue #22", I + "22")], "T-912 diff-b không có PR (luật 48 giờ): vẫn vào, links chỉ có Issue #22; thấy " + str(g("T-912")))
    C.chk("T-910" not in m and "T-911" not in m, "việc có issue nhưng PR đã merged (T-910) hoặc chưa xong (T-911) không vào queue chỉ vì có issue")
    for e in q:
        C.chk(set(e) == {"task", "kind", "decide_by", "links"} and all(set(l) == {"label", "url", "pr_state"} for l in e["links"]), f"{e['task']}: sai hình dạng phần tử")
        C.chk(sum(1 for l in e["links"] if "/issues/" in l["url"]) <= 1, f"{e['task']}: tối đa một link issue")
        for l in e["links"]:
            if "/issues/" in l["url"]: C.chk(l["pr_state"] == "" and l["label"] == "Issue #" + l["url"].rsplit("/", 1)[1], f"{e['task']}: link issue có pr_state rỗng và nhãn khớp số")
    C.chk(d2.get("capu_queue") == q, "bản --public và bản thường cho cùng capu_queue")
    C.chk(all("issue" not in t for t in d["tasks"]), "bản công khai không thêm trường `issue` vào tasks[] (số issue chỉ nằm trong URL của capu_queue)")
    raw = (tmp / "pub" / "dashboard.json").read_text(encoding="utf-8")
    C.chk(raw.count("/issues/") == sum(1 for e in q for l in e["links"] if "/issues/" in l["url"]), "URL issue chỉ xuất hiện trong links của capu_queue")
C.done()
