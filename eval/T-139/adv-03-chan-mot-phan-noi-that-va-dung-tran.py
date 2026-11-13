#!/usr/bin/env python3
"""T-139 adv-03 (tầng 3, adversary): CHẶN MỘT PHẦN (resolve vừa hạn mức, enrich + ảnh vượt) thì trần từng bước đúng và mọi thân PR nói thật.

Eval 10/11 đo hai cực (cả lô qua / cả lô chặn); lỗi nhỏ (1) của Spec Gate là thân PR khi chặn một phần. Tình huống: baseline tháng ảnh = 935, Text Search = 0,
lô 15 mục place_id (resolve cần 15 Place Details + 15 Text Search): 935 + 15 + biên 50 = 1000 -> resolve vừa đủ; enrich (2) và ảnh (6) làm rổ ảnh vượt -> bị chặn.
Kỳ vọng:
  (1) chạy NGUYÊN VĂN job resolve-overrides (pull_request merged, công tắc bật, mạng bị chặn): resolve_overrides.py nhận --max-requests 30, --suggest nhận <= 30,
      enrich.py và refresh_photos.py nhận --max-requests 0; bước "Báo hạn mức" làm job đỏ;
  (2) thân PR dữ liệu (pr-body.md) nêu phần CHƯA chạy có enrich và ảnh, nêu phần ĐÃ chạy có resolve, KHÔNG có câu "Không có request Google nào đã chạy";
  (3) dòng báo chi trong thân PR duyệt tay (plan_batch --pr-line on, đúng lệnh của apply-admin-reviews) nói "MỘT PHẦN", nêu resolve tối đa 30 request,
      KHÔNG có câu "merge PR này KHÔNG gọi Google" (câu dành cho chặn cả lô).
In PASS / FAIL; thoát 0/1. Không mạng, không Google."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-135"))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None:
    print("FAIL thiếu resolve-overrides.yml"); sys.exit(1)
jname = next(iter(wf["jobs"]))
bad = []
box = t.Box(t.TOHONG)
try:
    t.set_baseline(box, text_search=0, photos=935)
    t.add_unresolved(box, 15, form="place_id")
    box.reset()
    c = t.gh_ctx(box, "pull_request", event=t.pr_event(), vars_={"AUTO_RESOLVE_OVERRIDES": "true"}, secrets={"GOOGLE_MAPS_API_KEY": "fake-key-not-real"})
    res = t.run_job(box, wf, jname, c, uses={"actions/": lambda w, s: {}, "peter-evans/": lambda w, s: {}})
    q = res["steps"].get("quota") or {}
    if (q.get("outputs") or {}).get("resolve_max") != "30":
        bad.append("(1) cổng: resolve_max phải 30 (vừa hạn mức), thấy %s" % {k: v for k, v in (q.get("outputs") or {}).items() if k.endswith("_max") or k == "blocked"})
    caps = {}
    for cwd, args in box.py_calls():
        m = re.search(r"--max-requests\s+(\d+)", args)
        for key, pat in (("suggest", r"resolve_overrides\.py.*--suggest"), ("resolve", r"resolve_overrides\.py(?!.*--(suggest|probe|dry-run))"), ("enrich", r"enrich\.py(?!.*--dry-run)"), ("refresh", r"refresh_photos\.py(?!.*--dry-run)")):
            if re.search(pat, args):
                caps.setdefault(key, []).append(int(m.group(1)) if m else None)
                break
    if caps.get("resolve") != [30]: bad.append("(1) resolve phải nhận --max-requests 30 đúng một lần, thấy %s" % caps.get("resolve"))
    if any(x is None or x > 30 for x in caps.get("suggest", [])): bad.append("(1) --suggest vượt phần trần còn lại: %s" % caps.get("suggest"))
    if caps.get("enrich") != [0]: bad.append("(1) enrich phải --max-requests 0, thấy %s" % caps.get("enrich"))
    if caps.get("refresh") != [0]: bad.append("(1) refresh phải --max-requests 0, thấy %s" % caps.get("refresh"))
    if res["status"] != "failure" or not any(n.startswith("Báo hạn mức") and o == "failure" for n, o in res["order"]):
        bad.append("(1) bước 'Báo hạn mức' phải làm job đỏ: %s" % [x for x in res["order"] if x[0].startswith("Báo")])
    p = os.path.join(box.rt, "pr-body.md")
    body = open(p, encoding="utf-8").read() if os.path.isfile(p) else ""
    first = body.split("\n\n")[0]
    if not body: bad.append("(2) không có pr-body.md")
    else:
        chua = next((l for l in body.splitlines() if "CHƯA CHẠY" in l), "")
        da = next((l for l in body.splitlines() if "đã chạy trong hạn mức" in l), "")
        if not ("enrich" in chua and "ảnh" in chua): bad.append("(2) thân PR dữ liệu phải nêu enrich + ảnh CHƯA chạy: %r" % chua[:160])
        if "resolve" not in da: bad.append("(2) thân PR dữ liệu phải nêu resolve ĐÃ chạy: %r" % first[:200])
        if "Không có request Google nào đã chạy" in body: bad.append("(2) thân PR dữ liệu nói sai 'Không có request Google nào đã chạy'")
    box.reset()   # sổ chi lúc mở PR duyệt tay: chưa có log của lần chạy trên
    env = dict(os.environ, PYTHONPATH=box.nonet, PYTHONDONTWRITEBYTECODE="1")
    env.pop("GITHUB_OUTPUT", None)
    pl = subprocess.run([sys.executable, "plan_batch.py", "--state", "HCMC", "--usage-root", "run-logs", "--pr-line", "on"], cwd=os.path.join(box.ws, "tools", "scraper"), env=env, capture_output=True, text=True)
    line = pl.stdout.strip()
    if pl.returncode != 0: bad.append("(3) plan_batch --pr-line lỗi: %s" % pl.stderr[-200:])
    if "MỘT PHẦN" not in line or "tối đa 30 request" not in line: bad.append("(3) dòng báo chi PR duyệt tay phải nói MỘT PHẦN + resolve tối đa 30 request: %r" % line[:200])
    if "merge PR này KHÔNG gọi Google" in line: bad.append("(3) dòng báo chi nói sai 'merge PR này KHÔNG gọi Google' khi resolve vẫn chạy")
finally:
    box.cleanup()
t.done(bad, "chặn một phần: resolve 30, enrich/ảnh 0, job đỏ ở 'Báo hạn mức'; thân PR dữ liệu và dòng báo chi PR duyệt tay nói đúng phần nào chạy")
