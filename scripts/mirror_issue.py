#!/usr/bin/env python3
"""Phản chiếu sổ cái lên GitHub Issue (ADR-012: issue là mặt kính, sổ cái là sự thật).

Việc nào có trường `issue` trong board/T-xxx.md thì issue đó nhận đúng bốn mốc, mỗi mốc một comment:
  ① Đã nhận      sự kiện assigned           → comment, gán bot
  ② Qua Spec Gate sự kiện accepted của spec-critic
  ③ Qua Code Gate sự kiện accepted của adversary
  ④ Xong          state done (sau ③, hoặc sau ② với việc chỉ có spec) → comment rồi đóng issue
Ngoài ra: escalated, hoặc done bậc C chưa merge → gán Capu, comment "cần anh". Không có gì khác.

Issue KHÔNG BAO GIỜ đổi trạng thái việc. Script chỉ đọc ledger/events.jsonl + board/, không ghi sổ cái.
Chạy trong GitHub Actions (mirror-issue.yml) sau mỗi lần sổ cái vào main; trạng thái "đã phản chiếu
tới sự kiện nào" lưu ở thư mục --state (nhánh mirror-state), như notify_slack.py.

  python3 scripts/mirror_issue.py --state /tmp/state --dry-run   # chỉ in
  GH_TOKEN=… python3 scripts/mirror_issue.py --state /tmp/state  # ghi thật

Biến môi trường: GH_TOKEN (hoặc GITHUB_TOKEN), GITHUB_REPOSITORY (mặc định phungrk/tohong-hq),
CAPU_LOGIN (mặc định phungrk), BOT_LOGIN (tùy chọn: assignee cho việc đang chạy).
"""
import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task as ledger  # noqa: E402

ROOT = ledger.ROOT
REPO = os.environ.get("GITHUB_REPOSITORY", "phungrk/tohong-hq")
CAPU = os.environ.get("CAPU_LOGIN", "phungrk")
BOT = os.environ.get("BOT_LOGIN", "")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
API = "https://api.github.com"
MARK = "<!-- tohong-mirror:{key} -->"   # chống ghi trùng khi chạy lại


def gh(method, path, body=None, dry=False):
    if dry:
        print(f"  [dry] {method} {path} {json.dumps(body, ensure_ascii=False)[:160] if body else ''}")
        return {}
    req = urllib.request.Request(f"{API}{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
                                          "Content-Type": "application/json", "User-Agent": "tohong-hq-mirror"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raise SystemExit(f"GitHub {e.code} {method} {path}: {e.read().decode()[:300]}")


def blob(path):
    return f"https://github.com/{REPO}/blob/main/{path}"


def gate_line(tid):
    p = ROOT / "eval" / tid / "gate-latest.json"
    if not p.exists():
        return ""
    try:
        g = json.loads(p.read_text(encoding="utf-8"))
        n = len(g.get("results", []))
        ok = sum(1 for r in g["results"] if r["status"] == "PASS")
        return f"gate {g.get('verdict')} {ok}/{n}"
    except Exception:
        return ""


def milestone(e, meta):
    """Trả về (key, comment, hành động) cho một sự kiện, hoặc None."""
    tid, ev, frm = e["task"], e.get("event"), e.get("from", "")
    tier = meta.get("tier") or "B"
    state = meta.get("state", "")
    if ev == "assigned":
        return (f"{tid}-1", f"① **Đã nhận** → `{tid}` · bậc **{tier}** · vùng `{meta.get('area') or '—'}` · "
                f"giữ: {e.get('to')}\n\nBrief: [{tid}]({blob(f'board/{tid}.md')})", "assign-bot")
    if ev == "accepted" and frm == "spec-critic":
        spec = next((p for p in (ROOT / "products").glob(f"{tid}-*.md")), None)
        inv = e.get("detail", "")
        return (f"{tid}-2", f"② **Qua Spec Gate** · {inv[:300]}" + (f"\n\nSpec: [{spec.name}]({blob('products/' + spec.name)})" if spec else ""),
                "close" if state == "done" and tier != "C" else "")
    if ev == "accepted" and frm == "adversary":
        hand = sorted((ROOT / "handoffs").glob(f"{tid}-v*.md"))
        link = f"\n\nDiff hành vi: [{hand[-1].name}]({blob('handoffs/' + hand[-1].name)})" if hand else ""
        txt = f"③ **Qua Code Gate** · {gate_line(tid)} · {e.get('detail', '')[:300]}{link}"
        if tier == "C":
            return (f"{tid}-3", txt + f"\n\n@{CAPU} bậc C: cần anh đọc diff hành vi và tự merge.", "assign-capu")
        return (f"{tid}-3", txt, "close")
    if ev == "escalated":
        return (f"{tid}-esc-{e['id']}", f"⚠️ **Leo thang** · {e.get('detail', '')[:300]}\n\n@{CAPU} có Decision Request trong `inbox/capu/`.", "assign-capu")
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if not TOKEN and not a.dry_run:
        raise SystemExit("Thiếu GH_TOKEN.")
    state = Path(a.state)
    state.mkdir(parents=True, exist_ok=True)
    seen_f = state / "mirrored.txt"
    seen = set(seen_f.read_text().split()) if seen_f.exists() else set()
    first = not seen_f.exists()

    boards = {}
    for p in sorted((ROOT / "board").glob("T-*.md")):
        try:
            meta, _ = ledger.read_task(p.stem)
        except ledger.LedgerError:
            continue
        if meta.get("issue"):
            boards[meta["id"]] = meta
    done_keys, n = [], 0
    for e in ledger.read_events():
        tid = e.get("task")
        if tid not in boards:
            continue
        key = hashlib.sha1(json.dumps(e, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        done_keys.append(key)
        if key in seen or first:
            continue
        m = milestone(e, boards[tid])
        if not m:
            continue
        mkey, text, action = m
        issue = boards[tid]["issue"]
        print(f"{tid} → issue #{issue}: {text.splitlines()[0][:80]} [{action or '-'}]")
        gh("POST", f"/repos/{REPO}/issues/{issue}/comments", {"body": MARK.format(key=mkey) + "\n" + text}, a.dry_run)
        if action == "assign-bot" and BOT:
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"assignees": [BOT]}, a.dry_run)
        elif action == "assign-capu":
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"assignees": [CAPU]}, a.dry_run)
        elif action == "close":
            gh("POST", f"/repos/{REPO}/issues/{issue}/comments",
               {"body": MARK.format(key=f"{tid}-4") + f"④ **Xong** · `{tid}` done · sổ cái: [{tid}]({blob(f'board/{tid}.md')}). Đóng issue từ sổ cái."}, a.dry_run)
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"state": "closed", "state_reason": "completed"}, a.dry_run)
        n += 1
    if first:
        print(f"Lần đầu: ghi nhận {len(done_keys)} sự kiện cũ, không phản chiếu lại lịch sử.")
    if not a.dry_run:
        seen_f.write_text("\n".join(sorted(seen | set(done_keys))) + "\n")
    print(f"Đã phản chiếu {n} mốc.")


if __name__ == "__main__":
    main()
