#!/usr/bin/env python3
"""Phản chiếu sổ cái lên GitHub Issue (ADR-012: issue là mặt kính, sổ cái là sự thật).

Việc nào có trường `issue` trong board/T-xxx.md thì issue đó nhận đúng bốn mốc, mỗi mốc một comment:
  ① Đã nhận      sự kiện assigned           → comment, gán bot
  ② Qua Spec Gate sự kiện accepted của spec-critic
  ③ Qua Code Gate sự kiện accepted của adversary
  ④ Xong          state done (sau ③, hoặc sau ② với việc chỉ có spec) → comment rồi đóng issue
Ngoài ra: escalated, hoặc done bậc C chưa merge → gán Capu, comment "cần anh". Không có gì khác.

Issue KHÔNG BAO GIỜ đổi trạng thái việc. Script chỉ đọc ledger/events.jsonl + board/, không ghi sổ cái.
Chạy trong GitHub Actions (mirror-issue.yml) sau mỗi lần sổ cái vào main. Chống trùng hai lớp: trạng thái
"đã phản chiếu tới sự kiện nào" ở --state (nhánh mirror-state), và marker ẩn trong comment trên issue —
nên mất state hay chạy lại từ đầu cũng không ghi trùng.

  python3 scripts/mirror_issue.py --state /tmp/state --dry-run   # chỉ in
  GH_TOKEN=… python3 scripts/mirror_issue.py --state /tmp/state  # ghi thật

Biến môi trường: GH_TOKEN (hoặc GITHUB_TOKEN), GITHUB_REPOSITORY (mặc định phungrk/tohong-hq),
CAPU_LOGIN (mặc định phungrk), BOT_LOGIN (tùy chọn: assignee cho việc đang chạy).
"""
import argparse
import hashlib
import json
import os
import re
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
MARK_RE = re.compile(r"\A<!-- tohong-mirror:([A-Za-z0-9._-]+) -->")   # chỉ nhận đúng dạng ở ĐẦU thân comment
ISSUE_RE = re.compile(r"[1-9]\d*")   # bất biến hq/ledger/inv-001
ZWSP = "\u200b"


class GhError(Exception):
    pass


def safe(text, n=300):
    """Văn bản từ sổ cái đưa lên issue: cắt n ký tự, chèn ký tự rộng 0 sau '@' để không ping ai."""
    return str(text or "")[:n].replace("@", "@" + ZWSP)


def is_bot(user):
    user = user or {}
    login = user.get("login", "")
    mine = os.environ.get("MIRROR_AUTHOR", "")
    return user.get("type") == "Bot" or login.endswith("[bot]") or (bool(mine) and login == mine)


def list_markers(issue):
    """Khoá marker hợp lệ trên issue: comment của bot, bắt đầu đúng bằng marker. Phân trang 100/trang."""
    keys, page = set(), 1
    while page <= 100:
        cs = gh("GET", f"/repos/{REPO}/issues/{issue}/comments?per_page=100&page={page}")
        for c in cs if isinstance(cs, list) else []:
            m = MARK_RE.match(c.get("body") or "")
            if m and is_bot(c.get("user")):
                keys.add(m.group(1))
        if not isinstance(cs, list) or len(cs) < 100:
            break
        page += 1
    return keys


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
        raise GhError(f"GitHub {e.code} {method} {path}: {e.read().decode()[:300]}")


def apply_action(issue, action, dry, blind_ok=True):
    """Làm nốt hành động (gán bot / gán Capu / đóng) dựa trên trạng thái thật của issue; đã đúng thì không làm."""
    cur = {} if dry else gh("GET", f"/repos/{REPO}/issues/{issue}")
    if not isinstance(cur, dict):   # không đọc được trạng thái thật: chỉ làm khi biết chắc còn dở (blind_ok)
        if not blind_ok:
            return
        cur = {}
    logins = {(u or {}).get("login") for u in cur.get("assignees") or []}
    if action == "assign-bot":
        if BOT and BOT not in logins:
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"assignees": [BOT]}, dry)
    elif action == "assign-capu":
        if CAPU not in logins:
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"assignees": [CAPU]}, dry)
    elif action in ("close", "finish"):
        if cur.get("state") != "closed":
            gh("PATCH", f"/repos/{REPO}/issues/{issue}", {"state": "closed", "state_reason": "completed"}, dry)


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


def done_text(tid):
    return f"④ **Xong** · `{tid}` done · sổ cái: [{tid}]({blob(f'board/{tid}.md')}). Đóng issue từ sổ cái."


def milestone(e, meta):
    """Trả về (key, comment, hành động) cho một sự kiện, hoặc None.
    Hành động: assign-bot | assign-capu | close (đăng thêm ④ rồi đóng) | finish (comment này là ④, rồi đóng) | ''."""
    tid, ev, frm = e["task"], e.get("event"), e.get("from", "")
    tier = meta.get("tier") or "B"
    ends_done = e.get("state") == "done"
    if ev == "assigned":
        return (f"{tid}-1", f"① **Đã nhận** → `{tid}` · bậc **{tier}** · vùng `{meta.get('area') or '—'}` · "
                f"giữ: {e.get('to')}\n\nBrief: [{tid}]({blob(f'board/{tid}.md')})", "assign-bot")
    if ev == "accepted" and frm == "spec-critic":
        spec = next((p for p in sorted((ROOT / "products").glob(f"{tid}-*.md"))), None)
        txt = f"② **Qua Spec Gate** · {safe(e.get('detail'))}" + (f"\n\nSpec: [{spec.name}]({blob('products/' + spec.name)})" if spec else "")
        if ends_done and tier == "C":
            return (f"{tid}-2", txt + f"\n\n@{CAPU} bậc C: việc chỉ có spec, cần anh duyệt.", "assign-capu")
        return (f"{tid}-2", txt, "close" if ends_done else "")
    if ev == "accepted" and frm == "adversary":
        hand = sorted((ROOT / "handoffs").glob(f"{tid}-v*.md"))
        link = f"\n\nDiff hành vi: [{hand[-1].name}]({blob('handoffs/' + hand[-1].name)})" if hand else ""
        txt = f"③ **Qua Code Gate** · {gate_line(tid)} · {safe(e.get('detail'))}{link}"
        if tier == "C":
            return (f"{tid}-3", txt + f"\n\n@{CAPU} bậc C: cần anh đọc diff hành vi và tự merge.", "assign-capu")
        return (f"{tid}-3", txt, "close")
    if ev == "decided" and ends_done:
        return (f"{tid}-4", done_text(tid) + f"\n\nCapu quyết định đóng: {safe(e.get('detail'))}", "finish")
    if ev == "merged" and tier == "C":
        return (f"{tid}-4", done_text(tid) + f"\n\nPR đã merge: {safe(e.get('pr') or e.get('detail'), 200)}", "finish")
    if ev == "escalated":
        return (f"{tid}-esc-{e['id']}", f"⚠️ **Leo thang** · {safe(e.get('detail'))}\n\n@{CAPU} có Decision Request trong `inbox/capu/`.", "assign-capu")
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
    pend_f = state / "pending.txt"   # mốc đã comment nhưng hành động chưa chắc xong (lỗi GitHub giữa chừng)
    pending = set(pend_f.read_text().split()) if pend_f.exists() else set()
    # Chống trùng hai lớp: state file (nhanh) + marker đã có trên issue (chắc, kể cả lần chạy đầu hay mất state)
    markers = {}

    def has_marker(issue, mkey):
        if issue not in markers:
            markers[issue] = set() if a.dry_run else list_markers(issue)
        return mkey in markers[issue]

    boards = {}
    for p in sorted((ROOT / "board").glob("T-*.md")):
        try:
            meta, _ = ledger.read_task(p.stem)
        except ledger.LedgerError:
            continue
        raw = str(meta.get("issue") or "").strip()
        if not raw:
            continue
        if not ISSUE_RE.fullmatch(raw):
            print(f"CẢNH BÁO: {meta['id']} có issue không hợp lệ {raw!r}; bỏ qua việc này.", file=sys.stderr)
            continue
        boards[meta["id"]] = meta
    done_keys, n, failed = [], 0, set()
    pending_before = set(pending)
    for e in ledger.read_events():
        tid = e.get("task")
        if tid not in boards or tid in failed:
            continue
        key = hashlib.sha1(json.dumps(e, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if key in seen:
            done_keys.append(key)
            continue
        m = milestone(e, boards[tid])
        if m:
            mkey, text, action = m
            issue = boards[tid]["issue"]
            try:
                # Hai bước idempotent: (1) comment chỉ đăng khi chưa có marker; (2) hành động luôn kiểm
                # trên trạng thái thật của issue và làm nốt phần thiếu (kể cả khi marker đã có từ lần chạy hỏng giữa chừng)
                had = has_marker(issue, mkey)
                if had:
                    if not action:
                        done_keys.append(key)
                        continue
                else:
                    print(f"{tid} → issue #{issue}: {text.splitlines()[0][:80]} [{action or '-'}]")
                    gh("POST", f"/repos/{REPO}/issues/{issue}/comments", {"body": MARK.format(key=mkey) + "\n" + text}, a.dry_run)
                    markers[issue].add(mkey)
                if action == "close" and not has_marker(issue, f"{tid}-4"):
                    gh("POST", f"/repos/{REPO}/issues/{issue}/comments",
                       {"body": MARK.format(key=f"{tid}-4") + "\n" + done_text(tid)}, a.dry_run)
                    markers[issue].add(f"{tid}-4")
                if action:
                    pending.add(key)
                    apply_action(issue, action, a.dry_run, blind_ok=(not had) or key in pending_before)
                    pending.discard(key)
            except GhError as err:
                print(f"CẢNH BÁO: {tid} → issue #{issue}: {err}; bỏ qua phần còn lại của việc này.", file=sys.stderr)
                failed.add(tid)
                continue
            n += 1
        done_keys.append(key)
    if not a.dry_run:
        seen_f.write_text("\n".join(sorted(seen | set(done_keys))) + "\n")
        pend_f.write_text("\n".join(sorted(pending)) + "\n")
    print(f"Đã phản chiếu {n} mốc.")


if __name__ == "__main__":
    main()
