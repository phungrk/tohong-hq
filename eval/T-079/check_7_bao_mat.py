#!/usr/bin/env python3
import sys
def _h(t,v,tb):
    print("FAIL "+" | ".join(str(v).splitlines()[:12])); sys.exit(1)
sys.excepthook=_h
"""T-079 tiêu chí 7: bảo mật. (a) workflow chỉ có quyền contents+issues write, không secret nào ngoài GITHUB_TOKEN, không đưa
nội dung sự kiện vào lệnh shell (${{ github.event… }} trong run), không chạy code PR/fork, không force-push, chỉ action của `actions/`.
(b) script không dùng shell/eval/exec với nội dung bình luận. Đây là kiểm tra cấu hình (không mô phỏng được Actions offline)."""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
W = ROOT / ".github/workflows/ok-tren-issue.yml"
S = ROOT / "scripts/ok_issue.py"
fails = []
if not W.exists(): print("FAIL thiếu .github/workflows/ok-tren-issue.yml"); sys.exit(1)
if not S.exists(): print("FAIL thiếu scripts/ok_issue.py"); sys.exit(1)
t = W.read_text(encoding="utf-8")
body = re.sub(r"(?m)^\s*#.*$", "", t)           # bỏ dòng chú thích
if not re.search(r"(?m)^name:\s*Quyết trên issue bằng /ok\s*$", body): fails.append("name workflow phải đúng 'Quyết trên issue bằng /ok' (workflow khác bám vào tên này)")
m = re.search(r"(?m)^on:\s*\n((?:[ \t]+.*\n|\n)+)", body)
on = m.group(1) if m else ""
if not re.search(r"issue_comment:", on) or not re.search(r"types:\s*\[\s*created\s*,\s*edited\s*\]|types:\s*\[\s*edited\s*,\s*created\s*\]", on):
    fails.append("trigger phải là issue_comment với types đúng [created, edited]")
if re.search(r"pull_request_target|pull_request:|workflow_run|workflow_dispatch|schedule:|\bpush:", on): fails.append("trigger thừa (pull_request_target/pull_request/workflow_run/dispatch/schedule/push)")
pm = re.search(r"(?m)^permissions:\s*\n((?:[ \t]+\S.*\n)+)", body)
perms = dict(re.findall(r"^\s+([\w-]+):\s*(\w+)", pm.group(1), re.M)) if pm else None
if perms != {"contents": "write", "issues": "write"}: fails.append(f"permissions cấp workflow phải đúng {{contents: write, issues: write}}, nhận {perms}")
if re.search(r"(?m)^\s{2,}permissions:", body) and not re.search(r"(?m)^permissions:", body): fails.append("permissions ở cấp job thay vì cấp workflow")
if re.search(r"write-all|pull-requests:\s*write|actions:\s*write|id-token|packages:|workflows:\s*write", body): fails.append("quyền thừa")
for sec in re.findall(r"secrets\.([A-Za-z0-9_]+)", body):
    if sec != "GITHUB_TOKEN": fails.append(f"secret thừa: secrets.{sec}")
runs = re.findall(r"(?ms)^\s*run:\s*[|>][-+]?\s*\n((?:[ \t]+.*\n?)+)|^\s*run:\s*(.+)$", body)
runtext = "\n".join(a or b for a, b in runs)
if re.search(r"\$\{\{[^}]*github\.event", runtext) or re.search(r"\$\{\{[^}]*github\.head_ref", runtext) or re.search(r"\$\{\{[^}]*(comment|issue)\.", runtext):
    fails.append("run: chứa ${{ … github.event/comment/issue … }} -> tiêm lệnh qua nội dung bình luận. Đưa qua file payload hoặc env, không nội suy")
if re.search(r"git\s+push[^\n]*(--force|-f\b|\+HEAD|--force-with-lease|--mirror)", runtext + S.read_text(encoding="utf-8")): fails.append("có force-push")
for u in re.findall(r"(?m)^\s*-?\s*uses:\s*(\S+)", body):
    if not u.startswith("actions/"): fails.append(f"action ngoài actions/*: {u}")
for ref in re.findall(r"(?m)^\s*ref:\s*(.+)$", body):
    if "github." in ref: fails.append(f"checkout ref lấy từ ngữ cảnh sự kiện: {ref}")
if "pull_request" in " ".join(re.findall(r"(?m)^\s*ref:.*$", body)): fails.append("checkout nhánh PR")
if not re.search(r"(?m)^\s*ref:\s*main\s*$", body): fails.append("checkout phải ref: main")
if "phungrk" not in body: fails.append("workflow không lọc sớm theo tài khoản phungrk (script vẫn phải tự kiểm; đây chỉ để khỏi chạy với bình luận người lạ)")
st = S.read_text(encoding="utf-8")
if re.search(r"shell\s*=\s*True|os\.system|os\.popen|\beval\(|\bexec\(|__import__|pickle|yaml\.load\(", st): fails.append("script dùng shell=True/os.system/eval/exec")
if re.search(r"\bsubprocess\.\w+\(\s*f?[\"']", st): fails.append("subprocess gọi bằng chuỗi (shell) thay vì danh sách đối số")
if re.search(r"\brequests\b|urllib|http\.client|socket", st): fails.append("script tự gọi mạng (việc đăng bình luận do workflow làm bằng GITHUB_TOKEN; script chỉ ghi sổ cái)")
assert not fails, "\n".join(fails)
print("PASS workflow quyền tối thiểu, không secret mới, không nội suy nội dung vào shell; script không shell/mạng")
