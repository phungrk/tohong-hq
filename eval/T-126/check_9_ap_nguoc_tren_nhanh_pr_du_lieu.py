#!/usr/bin/env python3
"""T-126 tiêu chí 9 (áp ngược lên nhánh PR dữ liệu đang MỞ, vd tohong#83, mà KHÔNG ai commit tay): workflow offline `.github/workflows/apply-review-rule.yml` + `enrich.py --input` + `pr_body.py --low-review-csv`.
Người làm duy nhất = workflow (Capu hoặc Chief of Staff bấm Run workflow với `pr_branch`). KHÔNG mạng, KHÔNG Google. Mong:
  (a) workflow_dispatch có input `pr_branch` (required); file KHÔNG chứa `GOOGLE_MAPS_API_KEY` và không dùng `secrets.` nào ngoài GITHUB_TOKEN (chế độ offline, không khoá); permissions contents+pull-requests write
  (b) bước tên "Cổng: nhánh PR dữ liệu đang mở" (env PR_BRANCH, GH_TOKEN; chạy NGUYÊN VĂN với `gh` giả): thoát 0 khi nhánh có tiền tố enrich-vendors/, venue-enrich/, resolve-overrides/ hoặc refresh-photos/ VÀ `gh pr list` trả
      đúng một PR mở có headRefName bằng nhánh đó; thoát khác 0 với: `main`, tiền tố lạ (`feat/t126`), tiền tố đúng nhưng không có PR mở, chuỗi có ký tự shell (`enrich-vendors/x; echo hacked`), nhánh rỗng; đứng TRƯỚC mọi bước checkout/ghi
  (c) tĩnh: checkout `main` (code mới) và checkout nhánh PR (dữ liệu) tách riêng; lệnh `enrich.py ... --apply-review-rule --input <output của nhánh PR>`, KHÔNG có `--confirm-review-count`, không `GOOGLE`; bước commit chỉ `git push` lên "$PR_BRANCH"
      (không `main`); sinh lại body bằng `pr_body.py ... --low-review-csv` rồi `gh pr edit` (Capu đọc diff hành vi đúng)
  (d) `enrich.py --state HCMC --category all --apply-review-rule --input <thư mục output ở nơi khác>` chạy trong bản sao code: vendor đọc mới <2 đánh giá ở thư mục đó bị hạ, sổ low-review-demoted.csv nằm TRONG thư mục đó,
      thư mục `output/` của bản sao code KHÔNG được tạo/đổi, 0 request Google
  (e) `pr_body.py --log-dir <dir> --run-id 1 --out F --low-review-csv <csv>`: body gồm mọi dòng của body KHÔNG có cờ (không mất mục cũ) cộng mục `## Vendor bị hạ vì ít đánh giá Google (T-126)` liệt kê mỗi vendor
      (tên, số đánh giá, stage, maps_url) và dòng `Tổng: <n> vendor`; thiếu cờ thì body y nguyên
In PASS hoặc FAIL <lý do>; thoát 0/1."""
import csv, json, os, re, shutil, subprocess, sys, tempfile, yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t126 as k
h, x, t = k.h, k.x, k.t
bad = []
repo = t.c.tohong()
p = os.path.join(repo, ".github", "workflows", "apply-review-rule.yml")
if not os.path.isfile(p):
    t.fail("thiếu .github/workflows/apply-review-rule.yml (workflow áp ngược lên nhánh PR dữ liệu)")
text = open(p, encoding="utf-8").read()
wf = yaml.safe_load(text)
on = wf.get("on") or wf.get(True) or {}
ins = (on.get("workflow_dispatch") or {}).get("inputs") or {}
if not (ins.get("pr_branch") or {}).get("required"):
    bad.append("input pr_branch thiếu hoặc không required")
if "GOOGLE_MAPS_API_KEY" in text or [m for m in re.findall(r"secrets\.(\w+)", text) if m != "GITHUB_TOKEN"]:
    bad.append("workflow offline không được dùng khoá/secret Google")
perm = wf.get("permissions") or {}
if perm.get("contents") != "write" or perm.get("pull-requests") != "write":
    bad.append("permissions mong contents=write, pull-requests=write, thấy %r" % perm)
job = next(iter((wf.get("jobs") or {}).values()))
steps = job.get("steps") or []
gate = next((s for s in steps if s.get("name") == "Cổng: nhánh PR dữ liệu đang mở"), None)
if not gate or "run" not in gate:
    t.fail("thiếu bước 'Cổng: nhánh PR dữ liệu đang mở'")
gi = steps.index(gate)
if any("checkout" in str(s.get("uses", "")) or "git push" in str(s.get("run", "")) for s in steps[:gi]):
    bad.append("cổng phải đứng trước mọi bước checkout/ghi")
FAKE_GH = '#!/bin/sh\necho "$@" >> "$FAKE_GH_LOG"\nif [ "$1" = "pr" ] && [ "$2" = "list" ]; then printf "%s" "$FAKE_GH_JSON"; exit 0; fi\nexit 0\n'
OPEN = '[{"number":83,"headRefName":"%s"}]'
cases = [("enrich-vendors/run-43026321789", OPEN % "enrich-vendors/run-43026321789", True), ("refresh-photos/x1", OPEN % "refresh-photos/x1", True),
         ("main", OPEN % "main", False), ("feat/t126", OPEN % "feat/t126", False), ("enrich-vendors/run-1", "[]", False),
         ("enrich-vendors/x; echo hacked", "[]", False), ("enrich-vendors/y$(touch pwn)", OPEN % "enrich-vendors/other", False), ("", "[]", False)]
for br, js, want in cases:
    with tempfile.TemporaryDirectory() as ws:
        bind = os.path.join(ws, "bin")
        os.makedirs(bind)
        open(os.path.join(bind, "gh"), "w").write(FAKE_GH)
        os.chmod(os.path.join(bind, "gh"), 0o755)
        env = {"PATH": bind + os.pathsep + os.environ["PATH"], "HOME": ws, "GH_TOKEN": "fake", "PR_BRANCH": br, "FAKE_GH_JSON": js, "FAKE_GH_LOG": os.path.join(ws, "gh.log")}
        r = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", gate["run"]], cwd=ws, env=env, capture_output=True, text=True, timeout=30)
        if (r.returncode == 0) != want:
            bad.append("cổng với pr_branch=%r thoát %d, mong %s" % (br, r.returncode, "0" if want else "khác 0"))
        if os.path.exists(os.path.join(ws, "pwn")) or "hacked" in (r.stdout or ""):
            bad.append("cổng bị tiêm lệnh qua pr_branch=%r" % br)
uses = [str(s.get("uses", "")) for s in steps]
cks = [s for s in steps if "checkout" in str(s.get("uses", ""))]
refs = [str((s.get("with") or {}).get("ref", "")) for s in cks]
if len(cks) < 2 or "main" not in refs or not any("pr_branch" in r_ or "PR_BRANCH" in r_ for r_ in refs):
    bad.append("mong 2 checkout riêng: `main` (code) và nhánh PR (dữ liệu); thấy ref=%r" % refs)
runs = "\n".join(str(s.get("run", "")) for s in steps)
if "--apply-review-rule" not in runs or "--input" not in runs or "--confirm-review-count" in runs or "GOOGLE" in runs.upper().replace("GOOGLE-", ""):
    bad.append("lệnh enrich mong có --apply-review-rule và --input, không --confirm-review-count, không GOOGLE")
if "pr_body.py" not in runs or "--low-review-csv" not in runs or "gh pr edit" not in runs:
    bad.append("mong dựng lại body bằng pr_body.py --low-review-csv rồi `gh pr edit` (body PR là diff hành vi bậc C)")
pushes = [l for l in runs.splitlines() if "git push" in l]
if not pushes or any('"$PR_BRANCH"' not in l and "$PR_BRANCH" not in l or re.search(r"\bmain\b", l) for l in pushes):
    bad.append("mọi `git push` phải lên $PR_BRANCH và không nhắc main; thấy %r" % pushes)
# (d) --input
A = k.ADDR
files = {"makeup": [k.matched("t126_i0", "Input Zero Makeup", A % 90, "makeup", "Pi0", k.NEW_TS, None), k.matched("t126_i5", "Input Five Makeup", A % 91, "makeup", "Pi5", k.NEW_TS, 5)]}
root = k.seed(files)
data = tempfile.mkdtemp(prefix="t126-data-")
shutil.move(os.path.join(root.path, "output"), os.path.join(data, "output"))
rc, out, calls = root.run(x.enrich_all("all", extra=[k.APPLY, "--input", os.path.join(data, "output")]), x.fx({}, [], deny=True), key=False)
if rc != 0:
    bad.append("enrich --apply-review-rule --input thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:140]))
else:
    def vend(vid):
        d = json.load(open(os.path.join(data, "output", "HCMC", "makeup", "vendors.json"), encoding="utf-8"))
        return next(v for v in (d.get("vendors", d) if isinstance(d, dict) else d) if v["id"] == vid)
    if t.has_pid(vend("t126_i0")) or not t.has_pid(vend("t126_i5")):
        bad.append("--input: mong i0 (0 đánh giá) bị hạ, i5 giữ, trong thư mục dữ liệu")
    if not os.path.isfile(os.path.join(data, "output", "HCMC", "makeup", k.REPORT)):
        bad.append("--input: sổ %s phải nằm trong thư mục dữ liệu" % k.REPORT)
    if os.path.exists(os.path.join(root.path, "output")):
        bad.append("--input: bản sao code không được tạo/đổi thư mục output/ của nó")
if calls:
    bad.append("--input: gọi Google %d lượt" % len(calls))
# (e) pr_body.py
sc = os.path.join(repo, "tools", "scraper")
if not os.path.isfile(os.path.join(sc, "pr_body.py")):
    t.fail("thiếu tools/scraper/pr_body.py")
with tempfile.TemporaryDirectory() as ws:
    ld = os.path.join(ws, "logs")
    os.makedirs(ld)
    open(os.path.join(ld, "20261111-130804-run-1-enrich.log"), "w", encoding="utf-8").write(
        'GOOGLE_USAGE run=r1 text_search=3 photo_details=0 photo_media=0\nBUDGET_STOP basis=net cap_usd=30.00 est_usd=1.00 next_category=venue processed=1 remaining=2\n')
    cp = os.path.join(ws, k.REPORT)
    cols = ["id", "name", "category", "google_name", "google_address", "place_id", "maps_url", "review_count", "stage", "was_matched"]
    rows = [("marry_78a5641a379c", "Thiệp cưới thơm", "invitation", "THIỆP CƯỚI THƠM", "73/2/8 Duy Tân", "ChIJMah3G9QodTERGCmJNNuiQ2Y", "0", "stored", "true"),
            ("marry_64d17055f76e", "La Petite Epicerie Saigon", "wedding_gift", "La Petite Epicerie", "Sài Gòn", "ChIJm2jnlUbfdDER-LxA02bOZWc", "0", "stored", "true"),
            ("marry_2cabc0e5d44f", "Nội Thất One", "wedding_interior", "Nội Thất One", "Q1", "ChIJaYCLDSotdTERCldbRXY3UJw", "1", "stored", "true")]
    with open(cp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r_ in rows:
            w.writerow([r_[0], r_[1], r_[2], r_[3], r_[4], r_[5], "https://www.google.com/maps/place/?q=place_id:" + r_[5], r_[6], r_[7], r_[8]])
    def body(extra):
        o = os.path.join(ws, "body%d.md" % len(extra))
        r = subprocess.run([sys.executable, os.path.join(sc, "pr_body.py"), "--log-dir", ld, "--run-id", "1", "--out", o] + extra, cwd=ws, capture_output=True, text=True, timeout=60)
        return r.returncode, (open(o, encoding="utf-8").read() if os.path.exists(o) else ""), (r.stderr or "")[-160:]
    rc0, b0, e0 = body([])
    rc1, b1, e1 = body(["--low-review-csv", cp])
    if rc0 != 0 or not b0:
        bad.append("pr_body.py không cờ hỏng (rc=%d): %s" % (rc0, e0))
    elif rc1 != 0:
        bad.append("pr_body.py --low-review-csv thoát %d: %s" % (rc1, e1))
    else:
        lost = [l for l in b0.splitlines() if l.strip() and l not in b1.splitlines()]
        if lost:
            bad.append("body có cờ làm mất %d dòng của body cũ, vd %r" % (len(lost), lost[0][:80]))
        if "## Vendor bị hạ vì ít đánh giá Google (T-126)" not in b1 or "Tổng: 3 vendor" not in b1:
            bad.append("body thiếu mục '## Vendor bị hạ vì ít đánh giá Google (T-126)' hoặc dòng 'Tổng: 3 vendor'")
        for r_ in rows:
            if r_[1] not in b1 or "place_id:" + r_[5] not in b1:
                bad.append("body thiếu vendor %r (tên + maps_url)" % r_[1])
t.done(bad, "workflow offline áp ngược lên nhánh PR dữ liệu đang mở (cổng chặn main/tiền tố lạ/không PR mở/tiêm lệnh, 2 checkout, chỉ push lên nhánh PR, dựng lại body), enrich --input chỉ ghi vào thư mục dữ liệu, pr_body.py thêm mục vendor bị hạ mà không mất mục cũ")
