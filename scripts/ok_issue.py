#!/usr/bin/env python3
"""Capu quyết việc chờ quyết bằng bình luận `/ok <nội dung>` trên issue (T-079, ADR-027, T-082).

Đọc payload sự kiện `issue_comment` (file JSON, $GITHUB_EVENT_PATH), kiểm tác giả và cú pháp, rồi ghi sổ cái
đúng bằng `python3 scripts/task.py decide <T-xxx> --note=<nội dung> --link=<URL bình luận>`.
Script KHÔNG gọi mạng: việc đăng `reply` lên issue là bước riêng của workflow (ok-tren-issue.yml, GITHUB_TOKEN).
Nội dung bình luận chỉ là dữ liệu: không shell, không eval; gọi task.py bằng danh sách đối số, dạng `--note=<...>`
để nội dung như `--close` không bị hiểu là cờ.

  python3 scripts/ok_issue.py --event payload.json [--git]

Dòng cuối của stdout là JSON: {"verdict": "decided|rejected|duplicate|ignored", "task": "", "reason": "", "reply": ""}
Mã thoát 0 cho cả bốn verdict. Biến môi trường: TOHONG_ROOT (sổ cái), OK_LOGIN (mặc định phungrk).

--git: chạy trong kho (thư mục TOHONG_ROOT, remote origin, nhánh main): lấy origin/main mới nhất (reset cứng về đó, nên
chỉ chạy khi đang ở nhánh main và cây sạch, ngược lại từ chối và thoát khác 0), kiểm lại, ghi sổ cái, tạo MỘT commit `[T-xxx] ...` chỉ gồm board/T-xxx.md và
ledger/events.jsonl, đẩy bằng push thường. Bị chen ngang thì làm lại từ đầu trên main mới, tối đa 5 lần; hết lượt thì
thoát khác 0 (workflow đỏ, sổ cái không đổi). Không force, không rebase, không merge.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task as ledger  # noqa: E402

ROOT = ledger.ROOT
SCRIPTS = Path(__file__).resolve().parent
MAX_LEN = 2000
MAX_TRIES = 5
WS = " \t ﻿"          # khoảng trắng trong dòng lệnh: cách, tab, NBSP, BOM
CMD = re.compile(r"/ok(?=[ \t ﻿]|$)", re.I)
SPLIT = re.compile(r"[\s ﻿]+")
LOGIN = os.environ.get("OK_LOGIN", "phungrk")


class Out(Exception):
    def __init__(self, verdict, task="", reason="", reply=""):
        self.res = {"verdict": verdict, "task": task, "reason": reason, "reply": reply}


def marker(cid, what):
    return f"<!-- tohong-ok:{cid}:{what} -->"


def defang(text):
    """Vô hiệu @mention trong câu trả lời (sổ cái giữ nguyên chữ): chèn zero-width sau @."""
    return text.replace("@", "@​")


def parse_command(body):
    """-> nội dung đã chuẩn hoá (có thể rỗng), hoặc None nếu bình luận không phải lệnh /ok."""
    lines = (body or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    for i, line in enumerate(lines):
        first = line.lstrip(WS)
        if not first.strip(WS + " "):
            continue
        m = CMD.match(first)
        if not m:
            return None
        rest = " ".join([first[m.end():]] + lines[i + 1:])
        return SPLIT.sub(" ", rest).strip()
    return None


def author_ok(ev):
    """A2: đọc từ trường sự kiện, không từ nội dung bình luận."""
    if ev.get("action") not in ("created", "edited"):
        return False
    issue = ev.get("issue") or {}
    if "pull_request" in issue:
        return False
    c = ev.get("comment") or {}
    u = c.get("user") or {}
    s = ev.get("sender") or {}
    want = LOGIN
    if not (want.isascii() and isinstance(u.get("login"), str) and isinstance(s.get("login"), str)):
        return False
    # chỉ ASCII thuần mới đem so (str.lower() đổi KELVIN SIGN U+212A thành 'k'); so không phân biệt hoa/thường ASCII
    return (u["login"].isascii() and s["login"].isascii() and u.get("type") == "User"
            and u["login"].lower() == want.lower() and s["login"].lower() == want.lower())


def confirm(cid, tid, detail, holder, again=False):
    note = " (bình luận này đã được ghi từ trước; bản sửa không đổi sổ cái)" if again else ""
    return (marker(cid, "decided") + f"\n✅ **Đã ghi** quyết định cho `{tid}`{note}:\n\n> {defang(detail)}\n\n"
            f"Việc đang về `{holder}` làm tiếp. Sổ cái: `ledger/events.jsonl` (sự kiện decided, link tới bình luận này).")


def refuse(cid, code, why):
    return Out("rejected", reason=code, reply=marker(cid, f"rejected-{code}") + f"\n⚠️ **Chưa ghi gì vào sổ cái.** {why}")


def decide_once(ev, content):
    """Kiểm B2 + A1 trên sổ cái hiện tại; ghi nếu hợp lệ. Ném Out cho mọi kết quả không phải 'đã ghi mới'."""
    c = ev["comment"]
    cid, url, number = c.get("id"), c.get("html_url", ""), (ev.get("issue") or {}).get("number")
    if not isinstance(url, str) or not url.strip():      # B1: link = URL bình luận, thiếu thì không ghi
        raise refuse(cid, "no_url", "Payload thiếu đường dẫn bình luận (`html_url`), không ghi được link vào sổ cái.")
    for e in ledger.read_events():                       # B2: một bình luận quyết tối đa một lần
        if e.get("event") == "decided" and e.get("link") == url and url:
            raise Out("duplicate", e.get("task", ""), "duplicate",
                      confirm(cid, e.get("task", ""), e.get("detail", ""), e.get("to") or e.get("holder") or "", again=True))
    if not content:
        raise refuse(cid, "empty", "Lệnh `/ok` cần kèm nội dung quyết định, ví dụ `/ok chọn phương án A`.")
    if len(content) > MAX_LEN:
        raise refuse(cid, "too_long", f"Nội dung dài {len(content)} ký tự, tối đa {MAX_LEN}. Gửi lại bản ngắn hơn bằng bình luận mới.")
    mine = [t for t in ledger.all_tasks() if str(t.get("issue", "")).strip() == str(number)]
    if not mine:
        raise refuse(cid, "no_task", f"Issue #{number} không gắn với việc nào trong sổ cái.")
    esc = [t for t in mine if t.get("state") == "escalated"]
    if not esc:
        st = ", ".join(f"{t['id']}: {t.get('state')}" for t in mine)
        raise refuse(cid, "not_escalated", f"Việc của issue này không ở trạng thái chờ quyết ({st}). "
                     "`/ok` chỉ dùng cho việc đang leo thang; các việc khác quyết qua chat.")
    if len(esc) > 1:
        raise refuse(cid, "ambiguous", "Issue này gắn với nhiều việc đang chờ quyết (" + ", ".join(t["id"] for t in esc)
                     + "), không đoán. Quyết qua chat.")
    tid = esc[0]["id"]
    r = subprocess.run([sys.executable, str(SCRIPTS / "task.py"), "decide", tid, f"--note={content}", f"--link={url}"],
                       cwd=ROOT, env=dict(os.environ, TOHONG_ROOT=str(ROOT)), capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"task.py decide {tid} lỗi: {r.stderr.strip()[:300]}")
    meta, _ = ledger.read_task(tid)
    return tid, confirm(cid, tid, content, meta.get("holder") or esc[0].get("owner", ""))


def git(*args, check=True):
    r = subprocess.run(["git", "-c", "user.name=tohong-ledger-bot",
                        "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", *args],
                       cwd=ROOT, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:2])}: {r.stderr.strip()[:200]}")
    return r


def guard_checkout():
    """--git reset cứng, nên chỉ chạy trên checkout sạch của main; không bao giờ xoá việc đang làm của người gọi."""
    br = git("rev-parse", "--abbrev-ref", "HEAD", check=False).stdout.strip()
    if br != "main":
        raise SystemExit(f"--git chỉ chạy trên nhánh main (đang ở '{br}'); không đụng cây làm việc")
    st = git("status", "--porcelain", "--untracked-files=no", "--", ".", ":(exclude)*.pyc", check=False).stdout.strip()
    if st:
        raise SystemExit("--git từ chối: cây làm việc có thay đổi chưa commit; không đụng cây làm việc")


def run_git(ev, content):
    last = ""
    guard_checkout()
    for _ in range(MAX_TRIES):
        git("fetch", "-q", "origin", "main")
        git("reset", "-q", "--hard", "origin/main")
        try:
            tid, reply = decide_once(ev, content)
        except Out:
            raise                                        # trùng/từ chối: main không đổi
        git("add", "--", f"board/{tid}.md", "ledger/events.jsonl")
        n = (ev.get("issue") or {}).get("number")
        git("commit", "-q", "-m", f"[{tid}] Capu quyết qua issue #{n} bằng /ok", "--", f"board/{tid}.md", "ledger/events.jsonl")
        p = git("push", "-q", "origin", "HEAD:main", check=False)
        if p.returncode == 0:
            return tid, reply
        last = p.stderr.strip()[:200]                    # bị chen ngang: bỏ commit này, làm lại từ main mới
    raise SystemExit(f"Không đẩy được lên main sau {MAX_TRIES} lần: {last}")


def process(ev, use_git):
    if not author_ok(ev):
        raise Out("ignored", reason="not_capu_or_not_event")
    c = ev["comment"]
    content = parse_command(c.get("body"))
    if content is None:
        raise Out("ignored", reason="not_command")
    tid, reply = run_git(ev, content) if use_git else decide_once(ev, content)
    return Out("decided", tid, "", reply).res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--event", required=True)
    ap.add_argument("--git", action="store_true")
    a = ap.parse_args()
    try:
        ev = json.loads(Path(a.event).read_text(encoding="utf-8"))
        if not isinstance(ev, dict):
            raise ValueError("payload không phải đối tượng")
    except (OSError, ValueError) as e:
        raise SystemExit(f"Không đọc được payload: {e}")
    try:
        res = process(ev, a.git)
    except Out as o:
        res = o.res
    print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
