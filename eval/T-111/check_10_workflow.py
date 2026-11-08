#!/usr/bin/env python3
"""T-111 tiêu chí 4 (một workflow chạy được cho mọi category). Workflow không chạy offline được, nên đây là kiểm CẤU TRÚC file `.github/workflows/enrich-vendors.yml` của repo `tohong`
(lý do không làm eval hành vi: cần runner GitHub và khoá Google; hành vi của lệnh nó gọi đã được check_2 đến check_9 đo bằng Google giả). Kiểm bằng YAML:
  1. chỉ `workflow_dispatch`; inputs: dry_run (mặc định "true"), budget_usd (mặc định "30"), categories (mặc định chứa đủ 14 category theo thứ tự ưu tiên của spec, hoặc "all"), max_photos (mặc định "2"),
     cap_basis (mặc định "net"), include_non_pool (mặc định "false");
  2. có bước chặn khi budget_usd > 30 TRƯỚC khi gọi Google (chuỗi "30" và exit trong bước đó), và mọi lệnh gọi enrich.py truyền --budget-usd, --max-photos, --cap-basis, --usage-root;
  3. KHÔNG có `enrich.py --all`, KHÔNG có `main.py`, KHÔNG đụng scrape-vendors.yml (tệp đó còn nguyên: không có bước enrich);
  4. log chạy thật lưu vào tools/scraper/run-logs/T-111/ (tee), có bước kiểm log không lộ khoá (mẫu AIza), PR dữ liệu chỉ mở khi dry_run != true, concurrency group dùng chung `google-places` (một lần chạy Google một lúc);
  5. dry_run=true: bước enrich truyền --dry-run và không đặt GOOGLE_MAPS_API_KEY (khoá chỉ nằm trong env của bước chạy thật);
  6. bước tạo pool (regen-pool-styles.sh --photos-for all) KHÔNG nằm trong workflow này (pool là PR riêng ở tohong-back do Capu merge, bậc C) — workflow chỉ ghi chú lệnh trong body PR.
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t111 as x
t = x.t
repo = t.c.tohong()
p = os.path.join(repo, ".github", "workflows", "enrich-vendors.yml")
if not os.path.isfile(p):
    t.fail("thiếu .github/workflows/enrich-vendors.yml (workflow chung cho mọi category)")
import yaml
txt = open(p, encoding="utf-8").read()
d = yaml.safe_load(txt)
on = d.get(True, d.get("on")) or {}
bad = []
if set(on) != {"workflow_dispatch"}:
    bad.append("chỉ được workflow_dispatch, thấy %r" % sorted(on))
inp = (on.get("workflow_dispatch") or {}).get("inputs") or {}
want = {"dry_run": "true", "budget_usd": "30", "max_photos": "2", "cap_basis": "net", "include_non_pool": "false"}
for k, v in want.items():
    if str((inp.get(k) or {}).get("default", None)).strip().lower() != v:
        bad.append("input %s: mặc định phải là %r, thấy %r" % (k, v, (inp.get(k) or {}).get("default")))
cd = str((inp.get("categories") or {}).get("default", ""))
if cd.strip() != "all" and not all(c in cd for c in x.ORDER):
    bad.append("input categories: mặc định phải là 'all' hoặc đủ 14 category")
if re.search(r"enrich\.py[^\n]*--all|main\.py", txt):
    bad.append("workflow gọi `enrich.py --all` hoặc main.py")
runs = [s.get("run", "") for j in (d.get("jobs") or {}).values() for s in j.get("steps", []) if s.get("run")]
calls = [r for r in runs if "enrich.py" in r]
if not calls:
    bad.append("không có bước gọi enrich.py")
for r in calls:
    for flag in ("--budget-usd", "--max-photos", "--cap-basis", "--usage-root"):
        if flag not in r:
            bad.append("lệnh enrich.py thiếu %s" % flag)
            break
if not any("budget_usd" in r and "30" in r and "exit" in r for r in runs):
    bad.append("thiếu bước chặn budget_usd > 30 (exit) trước khi gọi Google")
if "run-logs/T-111" not in txt or "AIza" not in txt:
    bad.append("thiếu lưu log vào run-logs/T-111 hoặc bước kiểm log không lộ khoá (AIza)")
if "google-places" not in txt:
    bad.append("thiếu concurrency group google-places")
if not re.search(r"create-pull-request", txt) or not re.search(r"dry_run\s*!=\s*'true'", txt):
    bad.append("PR dữ liệu phải chỉ mở khi dry_run != 'true'")
if any("regen-pool-styles" in r and "echo" not in r for r in runs):
    bad.append("workflow không được tự tạo pool (PR tohong-back là việc riêng của Capu)")
for j in (d.get("jobs") or {}).values():
    for s in j.get("steps", []):
        if "--dry-run" in (s.get("run") or "") and "GOOGLE_MAPS_API_KEY" in (s.get("env") or {}):
            bad.append("bước dry-run không được nhận khoá Google")
sv = os.path.join(repo, ".github", "workflows", "scrape-vendors.yml")
if os.path.isfile(sv) and re.search(r"enrich\.py[^\n]*--budget-usd", open(sv, encoding="utf-8").read()):
    bad.append("scrape-vendors.yml bị sửa để chạy enrich mới")
t.done(bad, "enrich-vendors.yml: workflow_dispatch, dry_run mặc định true, budget_usd mặc định 30 và bị chặn nếu lớn hơn, categories/max_photos/cap_basis/include_non_pool, log T-111, không --all, không tự tạo pool")
