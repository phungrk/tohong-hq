"""Thư viện dùng chung cho eval xuất dữ liệu T-076: dựng sổ cái giả, chạy scripts/export_dashboard.py với trạng thái PR giả, đọc dashboard.json."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOW = "2026-11-06T12:00"


def board_text(src, tid, **kv):
    body = re.sub(r"(?m)^id:.*$", f"id: {tid}", src, count=1)
    for k, v in kv.items():
        body = re.sub(rf"(?m)^{k}:.*$", f'{k}: "{v}"' if k in ("updated", "title", "area", "tier") else f"{k}: {v}", body, count=1)
    return body


def build(tmp, tasks, events=(), inbox=(), handoffs=None):
    """tasks: {id: dict(state, owner, tier, updated)}; events: list dict; inbox: tên file; handoffs: {tên: nội dung}."""
    fake = Path(tmp) / "ledger"
    (fake / "board").mkdir(parents=True); (fake / "org").mkdir(); (fake / "ledger").mkdir(); (fake / "inbox" / "capu").mkdir(parents=True); (fake / "handoffs").mkdir()
    shutil.copy(ROOT / "org" / "roster.json", fake / "org" / "roster.json")
    src = (ROOT / "board" / "T-041.md").read_text(encoding="utf-8")
    for tid, kv in tasks.items():
        (fake / "board" / f"{tid}.md").write_text(board_text(src, tid, **kv), encoding="utf-8")
    (fake / "ledger" / "events.jsonl").write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in events) + ("\n" if events else ""), encoding="utf-8")
    for n in inbox:
        (fake / "inbox" / "capu" / n).write_text("---\ntype: decision-request\n---\nx\n", encoding="utf-8")
    for n, c in (handoffs or {}).items():
        (fake / "handoffs" / n).write_text(c, encoding="utf-8")
    return fake


def handoff_event(i, tid, link, t="2026-11-05T10:00"):
    return {"id": f"E-{i:04d}", "t": t, "task": tid, "title": "x", "event": "handoff", "from": "engineering", "to": "adversary", "round": 0, "severity": "", "detail": "d", "link": link, "cost": 0.0, "state": "review", "holder": "adversary"}


def export(root, out, pr_state=None, public=True, extra_env=None):
    env = dict(os.environ, TOHONG_ROOT=str(root), TOHONG_NOW=NOW)
    env.pop("PR_READ_TOKEN", None)
    env.update(extra_env or {})
    cmd = [sys.executable, str(ROOT / "scripts" / "export_dashboard.py"), "--out", str(out)]
    if public: cmd.append("--public")
    if pr_state is not None:
        f = Path(out).parent / "pr_state.json"; f.write_text(json.dumps(pr_state), encoding="utf-8"); cmd += ["--pr-state-file", str(f)]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        return None, r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "thoát " + str(r.returncode)
    return json.loads((Path(out) / "dashboard.json").read_text(encoding="utf-8")), None


def by_task(q):
    return {e["task"]: e for e in q}
