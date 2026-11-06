#!/usr/bin/env python3
"""T-076 tiêu chí 3: bước xuất (scripts/export_dashboard.py) đưa vào `capu_queue` đúng tập "cái gì anh phải làm" (spec D2): Decision Request chưa quyết, việc escalated, việc blocked chờ Capu,
việc engineering bậc B/C đã done còn PR chưa merged/closed (nguồn: sự kiện sổ cái `merged`); gộp trùng theo mã việc. Không token, không mạng.
Chạy: cd /home/user/tohong-hq && python3 eval/T-076/check_3_export_pr.py     (PASS / FAIL <lý do>, mã thoát 0/1)
"""
import sys, tempfile, unicodedata, shutil, json, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import _export_lib as X

GH = "https://github.com/phungrk/"
DRB = GH + "tohong-hq/blob/main/inbox/capu/"
DIR = GH + "tohong-hq/tree/main/inbox/capu"
bad = []
def chk(c, m):
    if not c: bad.append(m)

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    done = lambda tier, upd="2026-11-05T10:00": dict(state="done", owner="engineering", tier=tier, updated=upd, holder="-")
    tasks = {
        "T-901": dict(state="escalated", owner="product", tier="B", updated="2026-11-06T09:00", holder="chief-of-staff"),
        "T-902": dict(state="escalated", owner="product", tier="A", updated="2026-11-06T09:00", holder="chief-of-staff"),
        "T-903": done("B"), "T-904": done("C"), "T-905": done("B"), "T-906": done("B"), "T-907": done("A"),
        "T-908": done("B", "2026-10-20T10:00"),
        "T-909": done("B", "2026-11-01T10:00"), "T-910": done("B", "2026-11-06T10:00"),
        "T-911": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),
        "T-912": done("C", "2026-10-20T10:00"),
        "T-913": done("B"), "T-914": done("B"),
        "T-915": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),
        "T-916": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
        "T-917": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
        "T-918": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),
        "T-920": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
        "T-921": dict(state="doing", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="engineering"),
        "T-922": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
        "T-923": dict(state="done", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="-"),
        "T-924": dict(state="blocked", owner="engineering", tier="B", updated="2026-11-06T08:00", holder="chief-of-staff"),
    }
    E = X.ev; H = X.handoff_event
    ev = [H(1, "T-903", GH + "tohong-front/pull/90"), H(2, "T-904", GH + "tohong-back/pull/91"), E(3, "T-904", "merged", "merged: Capu tự merge", GH + "tohong-back/pull/91"),
          H(4, "T-905", GH + "tohong-front/pull/92"), E(5, "T-905", "merged", "closed: đóng, không merge", GH + "tohong-front/pull/92"),
          H(6, "T-906", GH + "tohong-front/pull/93"), H(7, "T-906", GH + "tohong-back/pull/94", "2026-11-05T11:00"), E(8, "T-906", "merged", "merged: x", GH + "tohong-front/pull/93"),
          H(9, "T-907", GH + "tohong-front/pull/95"), H(10, "T-908", GH + "tohong-front/pull/96"),
          H(11, "T-909", "handoffs/T-909-v1.md"), H(12, "T-910", "handoffs/T-910-v1.md"), H(13, "T-912", "handoffs/T-912-v1.md"),
          H(14, "T-913", GH + "tohong-back/pull/97"), E(15, "T-913", "merged", "merged: x", GH + "tohong-back/pull/97"), H(16, "T-914", GH + "tohong-back/pull/98"),
          E(17, "T-915", "escalated", "hỏi", "", "2026-11-02T10:00", to="capu"), E(18, "T-915", "decided", "ok", "", "2026-11-03T10:00", frm="capu"),
          E(19, "T-916", "decided", "cũ", "", "2026-10-29T10:00", frm="capu"), E(20, "T-916", "blocked", "Chờ Capu: chưa có dữ liệu thật", "", "2026-10-30T10:00"),
          E(21, "T-917", "blocked", "Capu dừng (2026-10-31): 'cancel! chờ mô hình mới'", "", "2026-10-31T10:00"),
          E(22, "T-918", "blocked", "Chờ Capu: x", "", "2026-11-01T10:00"), E(23, "T-918", "unblocked", "", "", "2026-11-02T10:00"),
          E(24, "T-920", "blocked", "Chờ Capu: x", "", "2026-11-01T10:00"), E(25, "T-920", "blocked", "Chờ Engineering sửa cổng", "", "2026-11-02T10:00"),
          # cùng phút, thứ tự dòng quyết định: hỏi rồi trả lời -> đã trả lời
          E(26, "T-921", "escalated", "hỏi", "", "2026-11-03T10:00", to="capu"), E(27, "T-921", "decided", "ok", "", "2026-11-03T10:00", frm="capu"),
          # Chờ Capu viết NFD (gõ từ macOS) vẫn là chờ Capu; không có DR -> blocked
          E(28, "T-922", "blocked", unicodedata.normalize("NFD", "Chờ Capu: cần anh đặt secret"), "", "2026-11-04T10:00"),
          # done, DR chưa quyết, không có sự kiện hỏi nào -> decision (T-070 hôm nay)
          E(29, "T-923", "accepted", "ok", "", "2026-11-05T10:00", frm="adversary", to="done", state="done"),
          # blocked "Chờ Capu" + DR, rồi chặn lại bằng lý do khác (Capu huỷ) -> DR không tính
          E(30, "T-924", "blocked", "Chờ Capu: x", "", "2026-11-01T10:00"), E(31, "T-924", "blocked", "Capu dừng: cancel", "", "2026-11-02T10:00")]
    handoffs = {"T-912-v1.md": f"PR: {GH}tohong/pull/99\n"}
    inbox = {"T-901-quyet-cai-nay.md": "2026-11-10", "T-901-cu.md": "2026-11-01", "T-913-dr.md": "2026-11-12", "T-914-dr.md": "2026-11-13", "T-915-dr.md": "2026-11-04",
             "T-916-dr.md": "2026-10-31", "T-917-dr.md": "2026-11-01", "T-999-mo-coi.md": "2026-11-01",
             "T-918-dr.md": "2026-11-05", "T-920-dr.md": "2026-11-05", "T-921-dr.md": "2026-11-05", "T-923-dr.md": "2026-11-10", "T-924-dr.md": "2026-11-05"}
    fake = X.build(tmp, tasks, ev, inbox, handoffs)
    if os.environ.get("T076_DUMP_DIR"):
        dd = Path(os.environ["T076_DUMP_DIR"]); shutil.copytree(fake, dd / "check_3_ledger")
        (dd / "check_3.json").write_text(json.dumps({"now": X.NOW, "ledger": "check_3_ledger", "expect": {"queue": sorted(want_set := {"T-901", "T-902", "T-903", "T-906", "T-908", "T-910", "T-912", "T-913", "T-914", "T-916", "T-922", "T-923"}),
            "kinds": {"T-901": "escalated", "T-902": "escalated", "T-903": "diff-b", "T-906": "diff-b", "T-908": "diff-b", "T-910": "diff-b", "T-912": "merge-c", "T-913": "decision", "T-914": "decision", "T-916": "decision", "T-922": "blocked", "T-923": "decision"},
            "links": {"T-901": [DRB + "T-901-quyet-cai-nay.md"], "T-902": [DIR], "T-903": [GH + "tohong-front/pull/90"], "T-906": [GH + "tohong-back/pull/94"], "T-908": [GH + "tohong-front/pull/96"], "T-910": [], "T-912": [GH + "tohong/pull/99"],
                      "T-913": [DRB + "T-913-dr.md"], "T-914": [DRB + "T-914-dr.md", GH + "tohong-back/pull/98"], "T-916": [DRB + "T-916-dr.md"], "T-922": [DIR], "T-923": [DRB + "T-923-dr.md"]},
            "decide_by": {"T-901": "2026-11-10", "T-913": "2026-11-12", "T-914": "2026-11-13", "T-916": "2026-10-31", "T-923": "2026-11-10"}}}), encoding="utf-8")
        sys.exit(0)
    d, err = X.export(fake, tmp / "out")
    if d is None:
        print("FAIL exporter không chạy: " + str(err)); sys.exit(1)
    q = d.get("capu_queue")
    if not isinstance(q, list):
        print("FAIL dashboard.json thiếu mảng capu_queue"); sys.exit(1)
    m = X.by_task(q)
    chk(len(m) == len(q), "mỗi việc đúng một phần tử capu_queue (gộp trùng theo mã việc)")
    want = {"T-901", "T-902", "T-903", "T-906", "T-908", "T-910", "T-912", "T-913", "T-914", "T-916", "T-922", "T-923"}
    chk(set(m) == want, f"tập việc sai: thừa {sorted(set(m) - want)}, thiếu {sorted(want - set(m))}")
    chk([e["task"] for e in q] == sorted(e["task"] for e in q), "capu_queue sắp theo mã việc tăng dần")
    g = lambda t: m.get(t, {"kind": None, "links": [], "decide_by": None})
    L = lambda t: [l["url"] for l in g(t)["links"]]
    chk(g("T-901")["kind"] == "escalated" and L("T-901") == [DRB + "T-901-quyet-cai-nay.md"] and g("T-901")["decide_by"] == "2026-11-10", "T-901: escalated, file DR đứng cuối theo chữ cái, decide_by 2026-11-10")
    chk(g("T-902")["links"] == [{"label": "Decision Request", "url": DIR, "pr_state": ""}] and g("T-902")["decide_by"] == "", "T-902: escalated không có file: link thư mục, decide_by rỗng")
    chk(g("T-903")["kind"] == "diff-b" and L("T-903") == [GH + "tohong-front/pull/90"] and g("T-903")["links"][0]["pr_state"] == "open" and g("T-903")["decide_by"] == "", "T-903: bậc B, PR chưa có sự kiện merged -> vào, một link PR open")
    chk(L("T-906") == [GH + "tohong-back/pull/94"], "T-906: chỉ giữ PR chưa merged (94), bỏ PR có sự kiện merged (93); thấy " + str(L("T-906")))
    chk(g("T-908")["kind"] == "diff-b", "T-908: PR chưa merged vào dù cập nhật 17 ngày trước (không có luật 48 giờ khi đã có link PR)")
    chk(g("T-910")["links"] == [] and g("T-910")["kind"] == "diff-b", "T-910: không tìm thấy link PR, cập nhật < 48h -> vào, links rỗng")
    chk(g("T-912")["kind"] == "merge-c" and L("T-912") == [GH + "tohong/pull/99"], "T-912: PR lấy từ file handoffs/T-912-v*.md")
    chk(g("T-913")["kind"] == "decision" and L("T-913") == [DRB + "T-913-dr.md"] and g("T-913")["decide_by"] == "2026-11-12", "T-913: việc done có DR chưa quyết, PR đã merged -> một dòng decision, chỉ link DR")
    chk(g("T-914")["kind"] == "decision" and L("T-914") == [DRB + "T-914-dr.md", GH + "tohong-back/pull/98"], "T-914: DR chưa quyết + PR mở -> một dòng decision, link DR rồi PR")
    chk(g("T-916")["kind"] == "decision" and L("T-916") == [DRB + "T-916-dr.md"] and g("T-916")["decide_by"] == "2026-10-31", "T-916: vừa DR chưa trả lời vừa blocked 'Chờ Capu' (quyết cũ đứng trước) -> loại decision (decision thắng blocked), link DR")
    chk(g("T-922")["kind"] == "blocked" and g("T-922")["links"] == [{"label": "Decision Request", "url": DIR, "pr_state": ""}], "T-922: 'Chờ Capu' dạng NFD vẫn khớp; không có DR -> blocked, link thư mục")
    chk(g("T-923")["kind"] == "decision" and L("T-923") == [DRB + "T-923-dr.md"] and g("T-923")["decide_by"] == "2026-11-10", "T-923: việc done có DR chưa trả lời, không có sự kiện hỏi -> decision (như T-070)")
    for t, why in (("T-904", "PR merged"), ("T-905", "PR closed"), ("T-907", "bậc A"), ("T-909", "không link PR, > 48h"), ("T-911", "chưa xong"), ("T-915", "DR đã decided sau lần hỏi"),
                   ("T-917", "blocked, sự kiện chặn gần nhất không 'Chờ Capu' (Capu huỷ), dù có DR và không có decided"), ("T-918", "đã gỡ chặn (unblocked sau lần hỏi) dù có DR"), ("T-920", "sự kiện chặn gần nhất không chờ Capu, có DR"),
                   ("T-921", "hỏi và trả lời cùng phút, trả lời đứng sau theo thứ tự dòng"), ("T-924", "chặn gần nhất là Capu huỷ, có DR"), ("T-999", "file DR mồ côi")):
        chk(t not in m, f"{t} không được vào ({why})")
    for e in q:
        chk(set(e) == {"task", "kind", "decide_by", "links"} and e["kind"] in ("escalated", "decision", "blocked", "diff-b", "merge-c") and all(set(l) == {"label", "url", "pr_state"} and l["pr_state"] in ("", "open") for l in e["links"]), f"{e.get('task')}: sai hình dạng phần tử")

    # Không dùng token/mạng: có PR_READ_TOKEN rác cũng ra đúng kết quả cũ
    d2, err2 = X.export(fake, tmp / "out2", extra_env={"PR_READ_TOKEN": "khong-dung", "HTTPS_PROXY": "http://127.0.0.1:9", "HTTP_PROXY": "http://127.0.0.1:9"})
    chk(d2 is not None and d2.get("capu_queue") == q, "kết quả không phụ thuộc token/mạng (" + str(err2) + ")")

if bad:
    for b in bad: print("FAIL " + b)
    sys.exit(1)
print("PASS")
