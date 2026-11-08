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
  7. (B1) bước chặn chạy thật khi còn PR dữ liệu T-111 đang mở: một bước TRƯỚC bước gọi enrich.py chạy `gh pr list` với `--state open` và tiền tố nhánh `enrich-vendors/`, `exit 1` nếu có; nhánh PR là `enrich-vendors/…`;
     workflow checkout nhánh `main` (đọc log tích luỹ của đợt); không truyền `--geocode` (Geocoding tắt, B5);
  8. (B5) `concurrency.group == "google-places"` (so khoá YAML) ở enrich-vendors.yml VÀ ở MỌI workflow trong repo có dùng GOOGLE_MAPS_API_KEY (enrich-venue.yml, refresh-vendor-photos.yml,
     scrape-vendors.yml, resolve-overrides.yml nếu có, …); scrape-vendors.yml chỉ còn `workflow_dispatch` (không `schedule`);
  9. (M5) body PR có danh sách vendor bị gỡ vì no_match (từ dòng REMOVED_VENDOR) và lệnh `--restore`.
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
if "gh pr list" not in txt or "enrich-vendors/" not in txt or "--state open" not in txt:
    bad.append("thiếu bước chặn khi còn PR dữ liệu enrich-vendors/* đang mở (gh pr list --state open)")
else:
    steps = [s for j in (d.get("jobs") or {}).values() for s in j.get("steps", [])]
    gi = next((i for i, s in enumerate(steps) if "gh pr list" in (s.get("run") or "")), None)
    ei = next((i for i, s in enumerate(steps) if "enrich.py" in (s.get("run") or "") and "--dry-run" not in (s.get("run") or "")), None)
    if gi is None or ei is None or gi > ei or "exit 1" not in steps[gi].get("run", ""):
        bad.append("bước chặn PR mở phải đứng TRƯỚC bước enrich.py thật và có exit 1")
if "--geocode" in txt:
    bad.append("workflow truyền --geocode (Geocoding phải tắt trong đợt này)")
if "REMOVED_VENDOR" not in txt or "--restore" not in txt:
    bad.append("body PR phải liệt kê vendor bị gỡ (REMOVED_VENDOR) và nhắc lệnh --restore")
wdir = os.path.join(repo, ".github", "workflows")
for fn in sorted(os.listdir(wdir)):
    if not fn.endswith((".yml", ".yaml")):
        continue
    raw = open(os.path.join(wdir, fn), encoding="utf-8").read()
    if "GOOGLE_MAPS_API_KEY" not in raw and fn != "enrich-vendors.yml":
        continue
    dd = yaml.safe_load(raw)
    cg = dd.get("concurrency")
    grp = cg.get("group") if isinstance(cg, dict) else cg
    if grp != "google-places":
        bad.append("%s: concurrency.group phải là 'google-places' (thấy %r)" % (fn, grp))
    if fn == "scrape-vendors.yml":
        onx = dd.get(True, dd.get("on")) or {}
        if "schedule" in onx:
            bad.append("scrape-vendors.yml còn lịch (schedule): phải chỉ còn workflow_dispatch trong đợt này")
sv = os.path.join(repo, ".github", "workflows", "scrape-vendors.yml")
if os.path.isfile(sv) and re.search(r"enrich\.py[^\n]*--budget-usd", open(sv, encoding="utf-8").read()):
    bad.append("scrape-vendors.yml bị sửa để chạy enrich mới")
t.done(bad, "enrich-vendors.yml: workflow_dispatch, dry_run mặc định true, budget_usd mặc định 30 và bị chặn nếu lớn hơn, categories/max_photos/cap_basis/include_non_pool, log T-111, không --all, không tự tạo pool")
