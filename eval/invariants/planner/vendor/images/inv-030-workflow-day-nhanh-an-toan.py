#!/usr/bin/env python3
"""Nguồn: T-126 (spec products/T-126-bo-qua-nhan-khop-it-review.md v2, Hành vi 6 mục 1 và 3: workflow offline apply-review-rule.yml ghi lên nhánh PR dữ liệu;
"giá trị pr_branch đi qua biến môi trường, không nội suy vào shell"; "git push chỉ lên chính nhánh PR đó"; "commit chỉ các add-paths dữ liệu").
Rút ở Spec Gate T-126 v2, spec-critic, 2026-11-11. Xanh hôm nay trên tohong 62ee2f8 (chưa workflow nào nhận tên nhánh từ input hay `git push` trong run:).
INV-030 (planner/vendor/images) · Workflow ghi lên nhánh do người bấm chọn thì không tiêm lệnh được, không viết lại lịch sử, không đụng nhánh mặc định.
Với mọi file .github/workflows/*.yml|yaml của repo tohong:
  (a) input workflow_dispatch có tên mà một đoạn (tách bằng `_`) là "branch" hoặc "ref" (vd pr_branch, head_ref; không tính refresh_max_requests) KHÔNG được nội suy `${{ ... inputs.<tên> ... }}` vào `run:` của bất kỳ bước nào
      (chỉ được qua `env:` hoặc `with:`). Lý do: tên nhánh git hợp lệ vẫn có thể chứa `$( )`, `;`, dấu backtick.
  (b) mọi dòng `git push` trong `run:` không có `--force`, `-f`, `--force-with-lease`, `--mirror`, `--delete`, refspec bắt đầu bằng `+`, và không nhắc `main`/`master`
      (như một từ riêng).
  (c) workflow có `git push` trong `run:` thì mọi lệnh `git add` của nó không dùng `-A`, `--all`, `.` (cả cây), và không có `git commit -a`/`--all`
      (chỉ thêm đường dẫn dữ liệu được nêu rõ).
Không mạng, không Google. Repo: TOHONG_REPO, rồi ../tohong cạnh tohong-hq. Không thấy .github/workflows: PASS "chưa áp dụng".
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import os, re, shlex, sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("FAIL thiếu PyYAML (bất biến cần đọc workflow)"); sys.exit(1)

HQ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), *[".."] * 5))
repo = os.environ.get("TOHONG_REPO") or os.path.join(HQ, "..", "tohong")
wfdir = os.path.join(repo, ".github", "workflows")
if not os.path.isdir(wfdir):
    print("PASS chưa áp dụng (không tìm thấy .github/workflows của repo tohong)"); sys.exit(0)

FORCE = {"--force", "-f", "--force-with-lease", "--mirror", "--delete", "-d"}
bad, nwf, npush = [], 0, 0


def logical_lines(script):
    """Gộp dòng nối bằng `\\` cuối dòng, tách theo `&&`, `||`, `;`, `|` để mỗi lệnh git đứng riêng."""
    joined = re.sub(r"\\\n", " ", script or "")
    for line in joined.splitlines():
        for part in re.split(r"&&|\|\||;|\|", line):
            if part.strip():
                yield part.strip()


def git_args(cmd, sub):
    """Tham số sau `git <sub>` nếu lệnh là git <sub> (bỏ qua tuỳ chọn -C/-c đứng trước sub)."""
    try:
        toks = shlex.split(cmd, comments=True)
    except ValueError:
        toks = cmd.split()
    if "git" not in toks:
        return None
    i = toks.index("git") + 1
    while i < len(toks) and toks[i] in ("-C", "-c"):
        i += 2
    if i < len(toks) and toks[i] == sub:
        return toks[i + 1:]
    return None


for fn in sorted(os.listdir(wfdir)):
    if not fn.endswith((".yml", ".yaml")):
        continue
    try:
        wf = yaml.safe_load(open(os.path.join(wfdir, fn), encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as ex:
        bad.append("%s: không đọc được (%s)" % (fn, str(ex)[:60])); continue
    nwf += 1
    on = wf.get("on") or wf.get(True) or {}
    ins = ((on.get("workflow_dispatch") or {}) if isinstance(on, dict) else {}).get("inputs") or {}
    branch_inputs = [n for n in ins if re.search(r"(^|_)(branch|ref)(_|$)", str(n), re.I)]
    runs = []
    for jn, job in (wf.get("jobs") or {}).items():
        for s in (job or {}).get("steps") or []:
            if isinstance(s, dict) and s.get("run"):
                runs.append((s.get("name") or "?", str(s["run"])))
    # (a)
    for nm in branch_inputs:
        pat = re.compile(r"\$\{\{[^}]*\binputs\.%s\b[^}]*\}\}" % re.escape(nm))
        for sn, sc in runs:
            if pat.search(sc):
                bad.append("%s / bước %r: nội suy input %s vào run: (phải qua env)" % (fn, sn, nm))
    # (b)
    pushes = [c for _, sc in runs for c in logical_lines(sc) if git_args(c, "push") is not None]
    npush += len(pushes)
    for c in pushes:
        args = git_args(c, "push")
        if any(a in FORCE or a.startswith("--force") or (not a.startswith("-") and a.startswith("+")) or ":+" in a for a in args):
            bad.append("%s: `git push` viết lại/xoá lịch sử: %s" % (fn, c[:100]))
        if any(re.search(r"(^|[:/])(main|master)$", a) or a in ("main", "master") for a in args):
            bad.append("%s: `git push` nhắc nhánh mặc định: %s" % (fn, c[:100]))
    # (c)
    if pushes:
        for _, sc in runs:
            for c in logical_lines(sc):
                a = git_args(c, "add")
                if a is not None and any(x in ("-A", "--all", ".", ":/", "*") for x in a):
                    bad.append("%s: `git add` cả cây trong workflow có git push: %s" % (fn, c[:100]))
                cm = git_args(c, "commit")
                if cm is not None and any(x in ("-a", "--all") or (re.fullmatch(r"-[a-zA-Z]+", x) and "a" in x[1:] and "m" in x[1:]) for x in cm):
                    bad.append("%s: `git commit -a` trong workflow có git push: %s" % (fn, c[:100]))

if bad:
    print("FAIL %d vi phạm, vd: %s" % (len(bad), " | ".join(bad[:3]))); sys.exit(1)
print("PASS %d workflow, %d lệnh git push trong run: đều an toàn (không nội suy input nhánh, không force, không main, không add cả cây)" % (nwf, npush))
