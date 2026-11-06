#!/usr/bin/env python3
"""Bất biến hq/ledger · nguồn: T-082 adv-02 + adv-07 (Code Gate 2026-11-06). Gác theo ADR-028: chỉ xanh khi
scripts/mirror_issue.py có dr_path mới trên main; đưa vào eval/invariants/hq/ledger/ sau khi PR T-082 merge.
Phản chiếu sổ cái lên issue (scripts/mirror_issue.py) KHÔNG BAO GIỜ đăng nội dung file nằm ngoài kho hoặc trong .git
(của kho hay kho con, kể cả đi qua symlink), dù `link` của sự kiện escalated trỏ tới đâu; link hợp lệ trong kho vẫn đăng
thân DR. Mọi trường hợp: mirror thoát 0 và có đúng 1 bình luận leo thang. GitHub giả, không mạng."""
import os, pathlib, sys
ROOT = next(p for p in pathlib.Path(__file__).resolve().parents if (p / "scripts" / "task.py").is_file())
sys.path.insert(0, str(ROOT / "eval" / "T-063"))
def _hook(t, v, tb):
    print("FAIL " + " | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook = _hook
from _advlib import Ledger, posted  # noqa: E402
SECRET = "BI-MAT-GIA-ghp_inv004xxxxxxxxxxxxxxx"
GOOD = "DR-HOP-LE-inv004-phuong-an-A"
fails = []
outside = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / f"inv004-{os.getpid()}.md"
outside.write_text(f"Cần quyết: x\n{SECRET}\n", encoding="utf-8")
BAD = [str(outside), None, ".git/config", "/proc/self/environ", "sub/.git/config", "lnk/config", "g/config",
       "handoffs/ra-ngoai.md", "handoffs", "."]
OK = ["handoffs/T-002-dr.md", "./handoffs/../handoffs/T-002-dr.md", "inbox/capu/moi-nhat.md"]
try:
    for link in BAD + OK:
        L = Ledger()
        try:
            T = L.tmp
            if link is None: link = os.path.relpath(outside, T)            # ../ thoát khỏi kho
            L.env["INV004_SECRET"] = SECRET
            (T / ".git").mkdir(); (T / ".git" / "config").write_text(f"[http]\n\textraheader = AUTHORIZATION: basic {SECRET}\n")
            (T / "sub" / ".git").mkdir(parents=True); (T / "sub" / ".git" / "config").write_text(f"token = {SECRET}\n")
            os.symlink("sub/.git", T / "lnk"); os.symlink(".git", T / "g")
            os.symlink(str(outside), T / "handoffs" / "ra-ngoai.md")
            (T / "handoffs" / "T-002-dr.md").write_text(f"---\ntype: decision-request\n---\nCần quyết: {GOOD}\n", encoding="utf-8")
            os.symlink("../../handoffs/T-002-dr.md", T / "inbox" / "capu" / "moi-nhat.md")
            L.task("new", "--title", "mồi", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--criteria", "c", "--by", "chief-of-staff")
            rc, out, _ = L.mirror(); assert rc == 0, out
            L.task("new", "--title", "có issue", "--to", "product", "--tier", "C", "--area", "hq/ledger", "--issue", "7", "--criteria", "c", "--by", "chief-of-staff")
            r = L.task("escalate", "T-002", "--by", "chief-of-staff", "--note", "A hay B?", "--link", link, ok=False)
            if r.returncode != 0:
                if link in OK: fails.append(f"link={link!r}: task.py escalate từ chối link hợp lệ")
                continue
            rc, out, calls = L.mirror()
            bs = [b for b in posted(calls, "7") if "tohong-mirror:T-002-esc-" in b]
            if rc != 0: fails.append(f"link={link!r}: mirror thoát {rc}"); continue
            if len(bs) != 1: fails.append(f"link={link!r}: phải đúng 1 bình luận leo thang, có {len(bs)}"); continue
            if SECRET in bs[0]: fails.append(f"link={link!r}: nội dung .git/ngoài kho bị đăng lên issue")
            if link in OK and GOOD not in bs[0]: fails.append(f"link={link!r}: link hợp lệ nhưng thân DR không được đăng")
        finally:
            L.close()
finally:
    outside.unlink(missing_ok=True)
assert not fails, "\n".join(fails)
print("PASS phản chiếu không đăng file ngoài kho/.git (kể cả kho con, symlink); link hợp lệ trong kho vẫn đăng")
