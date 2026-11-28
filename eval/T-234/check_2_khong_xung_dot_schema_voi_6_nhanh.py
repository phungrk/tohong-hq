"""T-234 tiêu chí 2: gộp HEAD của TOHONG_REPO với từng nhánh PR dữ liệu (#120, #121, #123, #125, #126, #127) bằng `git merge-tree --write-tree`
không có file xung đột nào ngoài tools/scraper/output/ (báo cáo/dữ liệu sinh lại tự xung đột giữa các PR dữ liệu, giải bằng sinh lại), và schema.py gộp có đúng
một dòng BRANCH_LINE. Ref: origin/<nhánh>. Nhánh nào đã là tổ tiên của HEAD (đã merge) thì đạt. Nhánh không có ref thì bỏ qua (in tên);
đường lui: nếu KHÔNG nhánh nào có ref, đạt khi schema.py ở HEAD có đúng một dòng BRANCH_LINE (cùng chuỗi các nhánh khai báo)."""
import os as _o, sys as _s
_s.dont_write_bytecode = True
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import subprocess
from lib234 import Fail, run, R, BRANCH_LINE, BRANCHES


def main():
    t, _ = R.repos(need_back=False)
    g = lambda *a: subprocess.run(["git", "-C", t, *a], capture_output=True, text=True)
    decl = lambda tree: [l.strip() for l in g("show", f"{tree}:tools/scraper/schema.py").stdout.splitlines() if l.strip().startswith("ai_mode_result:")]
    ok, skip, bad = [], [], []
    for pr, br in BRANCHES.items():
        ref = "origin/" + br
        if g("rev-parse", "--verify", "-q", ref + "^{commit}").returncode != 0:
            skip.append(pr); continue
        if g("merge-base", "--is-ancestor", ref, "HEAD").returncode == 0:
            ok.append(pr); continue
        m = g("merge-tree", "--write-tree", "--name-only", "HEAD", ref)
        lines = m.stdout.splitlines()
        conf = []
        for l in lines[1:]:
            if not l.strip():
                break
            conf.append(l.strip())
        code = [f for f in conf if not f.startswith("tools/scraper/output/")]
        if m.returncode not in (0, 1) or code:
            bad.append(f"#{pr}: xung đột {code or m.stderr[-120:]}"); continue
        if decl(lines[0].split()[0]) != [BRANCH_LINE]:
            bad.append(f"#{pr}: schema gộp không có đúng một dòng của nhánh"); continue
        ok.append(pr)
    if bad:
        raise Fail("; ".join(bad))
    if not ok:
        if decl("HEAD") == [BRANCH_LINE]:
            return f"không có ref nhánh nào ({skip}); đường lui: schema.py ở HEAD đúng dòng của nhánh"
        raise Fail("không có ref nhánh nào và schema.py ở HEAD không đúng dòng của nhánh (git fetch origin <nhánh>)")
    return f"gộp sạch ngoài output với {['#%d' % p for p in ok]}" + (f"; bỏ qua (không có ref) {skip}" if skip else "")


run(main)
