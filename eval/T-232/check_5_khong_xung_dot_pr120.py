"""T-232 tiêu chí 5: thay đổi trên nhánh code gộp sạch với nhánh PR tohong#120 (feat/enrich-hcm-invitation-batch-01): `git merge-tree --write-tree HEAD <ref>`
không có file xung đột ngoài tools/scraper/output/ (dữ liệu và báo cáo sinh lại tự xung đột giữa các PR dữ liệu, giải bằng sinh lại; đã có trên main trước T-232) trong TOHONG_REPO. Ref mặc định origin/feat/enrich-hcm-invitation-batch-01, đổi bằng T232_PR120_REF.
Nếu ref đã là tổ tiên của HEAD (PR #120 đã merge vào nhánh) thì đạt. Không có ref thì FAIL kèm lệnh fetch."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import os, subprocess
from lib232 import Fail, run, R


def main():
    t, _ = R.repos(need_back=False)
    ref = os.environ.get("T232_PR120_REF", "origin/feat/enrich-hcm-invitation-batch-01")
    g = lambda *a: subprocess.run(["git", "-C", t, *a], capture_output=True, text=True)
    if g("rev-parse", "--verify", "-q", ref + "^{commit}").returncode != 0:
        raise Fail(f"TOHONG_REPO không có ref {ref} (chạy: git -C <tohong> fetch origin feat/enrich-hcm-invitation-batch-01)")
    if g("merge-base", "--is-ancestor", ref, "HEAD").returncode == 0:
        return f"{ref} đã nằm trong HEAD"
    m = g("merge-tree", "--write-tree", "--name-only", "HEAD", ref)
    lines = m.stdout.splitlines()
    files = []
    for l in lines[1:]:
        if not l.strip():
            break
        files.append(l.strip())
    code_conf = [f for f in files if not f.startswith("tools/scraper/output/")]
    if m.returncode not in (0, 1) or code_conf:
        raise Fail("xung đột khi gộp với PR #120 ngoài dữ liệu: " + ", ".join(code_conf)[:300])
    s = g("show", f"{m.stdout.split()[0]}:tools/scraper/schema.py")
    if s.returncode != 0 or s.stdout.count("ai_mode_result:") != 1:
        raise Fail("bản gộp với PR #120 không có đúng một khai báo ai_mode_result trong schema.py")
    return "gộp sạch với PR #120, schema.py có đúng một khai báo ai_mode_result"


run(main)
