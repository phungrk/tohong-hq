#!/usr/bin/env python3
"""Báo Slack những gì vừa xảy ra trong sổ cái Tơ Hồng HQ.

So sánh nhật ký ledger/events.jsonl và thư mục reports/ với trạng thái đã báo lần
trước (lưu trong thư mục --state), rồi gửi phần mới lên Slack qua Incoming Webhook.

Biến môi trường:
  SLACK_WEBHOOK_URL        bắt buộc: kênh chính, nhận mọi cập nhật
  SLACK_WEBHOOK_DECISIONS  tùy chọn: kênh riêng cho việc cần Capu (quyết định,
                           PR sẵn sàng merge, bị chặn, vi phạm sổ cái)
  GITHUB_REPOSITORY        để dựng link, mặc định phungrk/tohong-hq
  DASHBOARD_URL            link dashboard, mặc định trang GitHub Pages

Lần chạy đầu chỉ ghi nhận trạng thái hiện có và gửi một tin chào, không gửi lại
lịch sử cũ. Trạng thái chỉ được cập nhật khi mọi tin đã gửi thành công.

  python3 scripts/notify_slack.py --state /tmp/state            # gửi thật
  python3 scripts/notify_slack.py --state /tmp/state --dry-run  # chỉ in ra
"""
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(os.environ.get("TOHONG_ROOT", Path(__file__).resolve().parent.parent))
REPO = os.environ.get("GITHUB_REPOSITORY", "phungrk/tohong-hq")
DASHBOARD = os.environ.get("DASHBOARD_URL", "https://phungrk.github.io/tohong-hq-dashboard/")
MAX_LINES = 25          # số dòng sự kiện tối đa trong một tin
MAX_REPORT_CHARS = 2800  # độ dài tối đa của một báo cáo gửi lên Slack

NOTIFY = {"assigned", "handoff", "accepted", "rejected", "evalplus", "blocked", "unblocked",
          "escalated", "decided", "board_edited_directly"}
PR_RE = re.compile(r"https://github\.com/[\w.-]+/[\w.-]+/pull/\d+")


# ---------- tiện ích ----------
def esc(s):
    return str(s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def link(url, text):
    return f"<{url}|{esc(text)}>"


def gh(path):
    return f"https://github.com/{REPO}/blob/main/{path}"


def line_key(line):
    return hashlib.sha1(line.strip().encode("utf-8")).hexdigest()


def load_names():
    try:
        roles = json.loads((ROOT / "org" / "roster.json").read_text(encoding="utf-8"))["roles"]
        names = {r["id"]: r["name"] for r in roles}
    except Exception:
        names = {}
    names.update({"done": "Hoàn thành", "capu": "anh Capu"})
    return names


def task_tier(tid):
    """Bậc lưới lọc của việc, đọc từ frontmatter board/T-xxx.md; không có thì rỗng."""
    p = ROOT / "board" / f"{tid}.md"
    if not tid or not p.exists():
        return ""
    m = re.search(r"^tier:\s*\"?([ABC])\"?\s*$", p.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else ""


def task_title(tid, cache={}):
    if tid in cache:
        return cache[tid]
    title = ""
    p = ROOT / "board" / f"{tid}.md"
    if p.exists():
        m = re.search(r"^title:\s*(.+)$", p.read_text(encoding="utf-8"), re.M)
        if m:
            title = m.group(1).strip().strip('"')
    cache[tid] = title
    return title


def pr_for_task(tid, events):
    """Tìm link pull request trong file bàn giao mới nhất của việc."""
    for e in reversed(events):
        if e.get("task") != tid or e.get("event") != "handoff" or not e.get("link"):
            continue
        p = ROOT / e["link"]
        if p.exists():
            found = PR_RE.findall(p.read_text(encoding="utf-8"))
            if found:
                return found[-1]
    return ""


# ---------- dựng nội dung ----------
def describe(e, events, names):
    """Trả về (urgent, dòng tin) cho một sự kiện, hoặc None nếu không cần báo."""
    ev = e.get("event")
    if ev not in NOTIFY:
        return None
    tid = e.get("task") or ""
    title = e.get("title") or task_title(tid)
    who = names.get(e.get("from"), e.get("from") or "")
    to = names.get(e.get("to"), e.get("to") or "")
    detail = esc(e.get("detail", ""))
    head = link(gh(f"board/{tid}.md"), tid) if tid else "—"
    t = f"{head} {esc(title)}" if title else head
    tail = f" · {detail}" if detail else ""
    rnd = e.get("round") or 0

    if ev == "assigned":
        return False, f"🆕 {t}\n      Giao cho *{esc(to)}*{tail}"
    if ev == "handoff":
        pr = pr_for_task(tid, events)
        prs = f" · {link(pr, 'Pull request')}" if pr else ""
        return False, f"📥 {t}\n      *{esc(who)}* bàn giao cho *{esc(to)}*{prs}{tail}"
    if ev == "accepted":
        pr = pr_for_task(tid, events)
        tier = task_tier(tid)
        if pr and tier == "C":
            return True, f"✅ {t}\n      Qua Code Gate (bậc C). *Anh đọc diff hành vi trong bàn giao rồi merge:* {link(pr, pr.split('github.com/')[-1])}{tail}"
        if pr and tier == "B":
            return True, f"✅ {t}\n      Qua Code Gate (bậc B). *Anh đọc diff hành vi*; 48h không phản đối thì Chief of Staff merge {link(pr, pr.split('github.com/')[-1])}{tail}"
        if pr:
            return False, f"✅ {t}\n      Qua Code Gate (bậc A). Chief of Staff merge {link(pr, pr.split('github.com/')[-1])}{tail}"
        return False, f"✅ *Chief of Staff báo cáo:* Task [{esc(title or tid)}] đã hoàn thành\n      {head} · Reviewer chấp nhận{tail}"
    if ev == "rejected":
        sev = e.get("severity") or "blocker"
        if e.get("state") == "spec":
            return True, f"📝 {t}\n      *{esc(who)}* trả: *spec rework* — Spec Writer sửa spec + eval{tail}"
        return False, f"↩️ {t}\n      *{esc(who)}* trả: *code rework* lần {rnd}{tail}"
    if ev == "evalplus":
        return False, f"🧪 {t}\n      Adversary thêm eval tầng 3, *{esc(to)}* chạy lại{tail}"
    if ev == "blocked":
        return True, f"⛔ {t}\n      *{esc(who)}* báo bị chặn{tail}"
    if ev == "unblocked":
        return False, f"▶️ {t}\n      Đã gỡ chặn{tail}"
    if ev == "escalated":
        if e.get("to") == "capu":
            lk = e.get("link")
            ref = f" · {link(gh(lk), 'Decision Request')}" if lk else ""
            return True, f"🙋 {t}\n      *Cần anh quyết*{tail}{ref}"
        return False, f"⚠️ {t}\n      Leo thang, Chief of Staff đang xử lý{tail}"
    if ev == "decided":
        return False, f"🧭 {t}\n      Anh Capu đã quyết{tail}"
    if ev == "board_edited_directly":
        return True, f"🚨 Agent *{esc(who)}* sửa tay sổ cái{tail}"
    return None


def chunk_lines(lines, header):
    shown = lines[:MAX_LINES]
    more = len(lines) - len(shown)
    text = header + "\n\n" + "\n".join(shown)
    if more > 0:
        text += f"\n…và {more} cập nhật khác. Xem {link(DASHBOARD, 'dashboard')}."
    return text


def build(new_events, all_events, new_reports, names, split):
    """Trả về danh sách (kênh, text)."""
    main_lines, urgent_lines = [], []
    for e in new_events:
        d = describe(e, all_events, names)
        if not d:
            continue
        urgent, line = d
        (urgent_lines if urgent and split else main_lines).append(line)
        if urgent and split:
            main_lines.append(line)  # kênh chính vẫn có đủ dòng thời gian
    msgs = []
    dash = link(DASHBOARD, "Dashboard")
    if urgent_lines:
        msgs.append(("decisions", chunk_lines(urgent_lines, f"*Tơ Hồng HQ · cần anh* · {dash}")))
    if main_lines:
        msgs.append(("main", chunk_lines(main_lines, f"*Tơ Hồng HQ · {len(main_lines)} cập nhật* · {dash}")))
    for rel, body in new_reports:
        body = body.strip()
        if len(body) > MAX_REPORT_CHARS:
            body = body[:MAX_REPORT_CHARS].rstrip() + "\n…"
        msgs.append(("main", f"📋 *{esc(Path(rel).stem)}* · {link(gh(rel), 'mở file')}\n```{body}```"))
    return msgs


def post(url, text):
    req = urllib.request.Request(url, data=json.dumps({"text": text, "unfurl_links": False}).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        body = r.read().decode("utf-8", "replace")
        if r.status != 200 or body.strip() != "ok":
            raise RuntimeError(f"Slack trả về {r.status}: {body[:200]}")


# ---------- chạy ----------
def main():
    p = argparse.ArgumentParser(description="Báo Slack các cập nhật mới của sổ cái")
    p.add_argument("--state", required=True, help="Thư mục lưu trạng thái đã báo")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--test", action="store_true",
                   help="Gửi một tin thử vào từng kênh đã cấu hình, không đọc hay ghi trạng thái")
    a = p.parse_args()

    if a.test:
        sent = 0
        for name, var in (("kênh chính", "SLACK_WEBHOOK_URL"), ("kênh cần anh", "SLACK_WEBHOOK_DECISIONS")):
            url = os.environ.get(var, "").strip()
            if not url:
                print(f"::warning::Chưa có secret {var} ({name}).")
                continue
            post(url, f"🔔 Tin thử từ *Tơ Hồng HQ* gửi vào {name} (secret `{var}`). "
                      f"Thấy tin này là kết nối đã đúng. {link(DASHBOARD, 'Dashboard')}")
            print(f"Đã gửi tin thử vào {name} ({var}).")
            sent += 1
        if not sent:
            raise RuntimeError("Không có secret Slack nào, chưa gửi được tin thử.")
        return

    state = Path(a.state)
    state.mkdir(parents=True, exist_ok=True)
    seen_f, reports_f = state / "seen-events.txt", state / "seen-reports.txt"
    first_run = not seen_f.exists()

    ledger = ROOT / "ledger" / "events.jsonl"
    raw = [l for l in ledger.read_text(encoding="utf-8").splitlines() if l.strip()] if ledger.exists() else []
    events = []
    for l in raw:
        try:
            events.append(json.loads(l))
        except json.JSONDecodeError:
            events.append({})
    keys = [line_key(l) for l in raw]
    report_paths = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "reports").rglob("*.md")) \
        if (ROOT / "reports").exists() else []

    seen = set(seen_f.read_text().split()) if seen_f.exists() else set()
    seen_reports = set(reports_f.read_text().splitlines()) if reports_f.exists() else set()

    main_url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    dec_url = os.environ.get("SLACK_WEBHOOK_DECISIONS", "").strip()
    names = load_names()

    if first_run:
        msgs = [("main", f"👋 *Tơ Hồng HQ* đã kết nối Slack. Từ giờ em báo vào đây mỗi khi có bàn giao, "
                         f"trả về, bị chặn, PR sẵn sàng merge, hoặc việc cần anh quyết. {link(DASHBOARD, 'Dashboard')}")]
    else:
        new_events = [e for e, k in zip(events, keys) if k not in seen]
        new_reports = [(r, (ROOT / r).read_text(encoding="utf-8")) for r in report_paths if r not in seen_reports]
        msgs = build(new_events, events, new_reports, names, split=bool(dec_url))

    if a.dry_run:
        for ch, text in msgs:
            print(f"--- [{ch}]\n{text}\n")
        print(f"(dry-run: {len(msgs)} tin, không lưu trạng thái)")
        return

    if not main_url:
        print("::notice::Chưa có secret SLACK_WEBHOOK_URL, bỏ qua bước báo Slack.")
        return

    for ch, text in msgs:
        post(dec_url if ch == "decisions" and dec_url else main_url, text)

    seen_f.write_text("\n".join(sorted(set(keys) | seen)) + "\n")
    reports_f.write_text("\n".join(sorted(set(report_paths) | seen_reports)) + "\n")
    print(f"Đã gửi {len(msgs)} tin lên Slack{' (lần đầu, chỉ ghi nhận trạng thái)' if first_run else ''}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # lỗi gửi: không lưu trạng thái, lần sau gửi lại
        print(f"::error::Báo Slack thất bại: {e}", file=sys.stderr)
        sys.exit(1)
