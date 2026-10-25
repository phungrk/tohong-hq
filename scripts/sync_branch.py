#!/usr/bin/env python3
"""Đồng bộ một nhánh claude/... của phiên agent vào main.

Chạy trong một bản clone có đủ lịch sử, đã fetch origin/main và nhánh cần đồng bộ.

1. Phần sổ cái (board/, ledger/, handoffs/, decisions/, inbox/, reports/, products/)
   luôn được đưa thẳng vào main, kể cả khi nhánh có sửa file khác:
     - ledger/events.jsonl: chỉ ghi thêm những dòng main chưa có (không trùng, không mất)
     - file khác: lấy bản trên nhánh (hoặc xóa nếu nhánh đã xóa)
2. Phần ngoài sổ cái (CLAUDE.md, .claude/, scripts/, ...) được chép sang nhánh
   review/<tên nhánh> dựng trên main, để mở pull request chờ Capu duyệt.
   PR đó chỉ chứa phần cần duyệt, không bao giờ xung đột với sổ cái.

In ra (cho GitHub Actions) các dòng:
  ledger_synced=true|false
  review_branch=<tên nhánh review hoặc rỗng>
  outside_files=<danh sách file ngoài sổ cái, cách nhau dấu phẩy>

  python3 scripts/sync_branch.py --branch claude/abc [--remote origin] [--dry-run]
"""
import argparse
import os
import subprocess
import sys
import tempfile

LEDGER_DIRS = ("board/", "ledger/", "handoffs/", "decisions/", "inbox/", "reports/", "products/")
EVENTS = "ledger/events.jsonl"
BOT = ["-c", "user.name=tohong-ledger-bot",
       "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"]


def git(*args, cwd=None, check=True, raw=False):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout if raw else r.stdout.decode("utf-8", "replace").strip()


def changed_files(base, head):
    out = git("diff", "--name-status", "--no-renames", base, head)
    files = []
    for line in out.splitlines():
        status, path = line.split("\t", 1)
        files.append((status[0], path))
    return files


def apply_files(worktree, head, files):
    for status, path in files:
        dest = os.path.join(worktree, path)
        if status == "D":
            if os.path.exists(dest):
                git("rm", "-q", "--", path, cwd=worktree)
            continue
        os.makedirs(os.path.dirname(dest) or worktree, exist_ok=True)
        with open(dest, "wb") as f:
            f.write(git("show", f"{head}:{path}", raw=True))
        git("add", "--", path, cwd=worktree)


def merge_events(worktree, head):
    dest = os.path.join(worktree, EVENTS)
    main_text = open(dest, encoding="utf-8").read() if os.path.exists(dest) else ""
    main_lines = [l for l in main_text.splitlines() if l.strip()]
    present = set(main_lines)
    try:
        branch_lines = [l for l in git("show", f"{head}:{EVENTS}").splitlines() if l.strip()]
    except RuntimeError:
        return 0
    new = []
    for l in branch_lines:
        if l not in present:
            new.append(l)
            present.add(l)
    if new:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write("\n".join(main_lines + new) + "\n")
        git("add", "--", EVENTS, cwd=worktree)
    return len(new)


def has_staged(worktree):
    return subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=worktree).returncode != 0


def push_with_retry(fn, remote, ref, attempts=3, force=False):
    """Dựng commit trên main mới nhất rồi push; nếu main vừa đổi thì làm lại."""
    for i in range(attempts):
        git("fetch", "-q", remote, "main")
        result = fn()
        if result is None:
            return False
        worktree, cleanup = result
        try:
            spec = f"{'+' if force else ''}HEAD:{ref}"
            r = subprocess.run(["git", "push", "-q", remote, spec], cwd=worktree, capture_output=True)
            if r.returncode == 0:
                return True
            if i == attempts - 1:
                raise RuntimeError(r.stderr.decode(errors="replace"))
        finally:
            cleanup()
    return False


def worktree_on(remote_ref):
    d = tempfile.mkdtemp(prefix="sync-")
    git("worktree", "add", "-q", "--detach", d, remote_ref)

    def cleanup():
        git("worktree", "remove", "--force", d, check=False)
    return d, cleanup


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--branch", required=True)
    p.add_argument("--remote", default="origin")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    remote_main = f"{a.remote}/main"
    head = git("rev-parse", f"{a.remote}/{a.branch}")
    git("fetch", "-q", a.remote, "main")
    base = git("merge-base", remote_main, head)
    files = changed_files(base, head)
    ledger = [(s, p) for s, p in files if p.startswith(LEDGER_DIRS)]
    outside = [(s, p) for s, p in files if not p.startswith(LEDGER_DIRS)]

    if a.dry_run:
        print("ledger:", [p for _, p in ledger])
        print("outside:", [p for _, p in outside])
        return

    synced = False
    if ledger:
        short = a.branch.split("/")[-1]

        def build_ledger():
            wt, cleanup = worktree_on(remote_main)
            n_new = merge_events(wt, head)
            apply_files(wt, head, [(s, p) for s, p in ledger if p != EVENTS])
            if not has_staged(wt):
                cleanup()
                return None
            git(*BOT, "commit", "-q", "-m",
                f"[sync] Sổ cái từ {a.branch} ({n_new} sự kiện mới)\n\nNhánh nguồn: {a.branch}@{head[:7]}",
                cwd=wt)
            return wt, cleanup
        synced = push_with_retry(build_ledger, a.remote, "main")
        print(f"Sổ cái từ {short}: {'đã đưa vào main' if synced else 'main đã có đủ'}", file=sys.stderr)

    review = ""
    if outside:
        review = f"review/{a.branch.replace('/', '-')}"

        def build_review():
            wt, cleanup = worktree_on(remote_main)
            apply_files(wt, head, outside)
            if not has_staged(wt):
                cleanup()
                return None
            git(*BOT, "commit", "-q", "-m",
                f"Cần Capu duyệt: thay đổi ngoài sổ cái từ {a.branch}\n\nNhánh nguồn: {a.branch}@{head[:7]}",
                cwd=wt)
            return wt, cleanup
        # nhánh review luôn được dựng lại từ main mới nhất nên ghi đè
        if not push_with_retry(build_review, a.remote, f"refs/heads/{review}", force=True):
            review = ""  # main đã có đủ các thay đổi này

    out = os.environ.get("GITHUB_OUTPUT")
    lines = [f"ledger_synced={'true' if synced else 'false'}",
             f"review_branch={review}",
             f"outside_files={','.join(p for _, p in outside)}"]
    if out:
        with open(out, "a") as f:
            f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"::error::{e}", file=sys.stderr)
        sys.exit(1)
