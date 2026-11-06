#!/usr/bin/env python3
"""T-075 tầng 3 (adversary). Spec T-073, đoạn "Thứ tự bên trong lệnh": thay đổi duy nhất trong tools/scraper/output/HCMC/*/vendors.json
  (và output/vendors.json mà clean_style_tags.py cũng ghi) là style_tags.
Kiểm: so từng file giữa merge-base(HEAD, main) và HEAD của repo tohong: cùng số vendor, cùng thứ tự id, mọi trường ngoài style_tags y hệt;
  style_tags mới chỉ chứa tag chuẩn; không vendor nào được THÊM minimalist.
Chạy: python3 -I eval/T-075/adv-03-scrape-chi-doi-style-tags.py. Repo: TOHONG_REPO."""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
t = c.tohong()
def git(*a):
    r = subprocess.run(["git", "-C", t] + list(a), capture_output=True, text=True); return r.returncode, r.stdout
CANON = {"korean", "luxury", "rustic", "natural", "editorial", "soft", "traditional", "modern", "minimalist", "simple"}
mb = None
for ref in ("main", "origin/main"):
    rc, out = git("merge-base", "HEAD", ref)
    if rc == 0: mb = out.strip(); break
if not mb: print("FAIL không tìm được merge-base với main"); sys.exit(1)
rc, out = git("ls-tree", "-r", "--name-only", "HEAD", "tools/scraper/output/")
files = [f for f in out.split() if f.endswith("vendors.json") and (f.startswith("tools/scraper/output/HCMC/") or f == "tools/scraper/output/vendors.json")]
bad, changed = [], 0
def vs(txt):
    d = json.loads(txt); return d["vendors"] if isinstance(d, dict) else d
for f in files:
    rc1, old = git("show", "%s:%s" % (mb, f)); rc2, new = git("show", "HEAD:" + f)
    if rc1 or rc2: bad.append("%s: không đọc được" % f); continue
    o, n = vs(old), vs(new)
    if [v.get("id") for v in o] != [v.get("id") for v in n]: bad.append("%s: tập id/thứ tự đổi" % f); continue
    for a, z in zip(o, n):
        a2 = {k: x for k, x in a.items() if k != "style_tags"}; z2 = {k: x for k, x in z.items() if k != "style_tags"}
        if a2 != z2: bad.append("%s %s: trường ngoài style_tags đổi: %s" % (f, a.get("id"), sorted(k for k in set(a2) | set(z2) if a2.get(k) != z2.get(k))))
        st = z.get("style_tags") or []
        if any(x not in CANON for x in st): bad.append("%s %s: style_tags có tag ngoài chuẩn %s" % (f, z.get("id"), st))
        if "minimalist" in st and "minimalist" not in (a.get("style_tags") or []): bad.append("%s %s: thêm minimalist" % (f, z.get("id")))
        if (a.get("style_tags") or []) != st: changed += 1
if bad: print("FAIL " + " | ".join(bad[:5]) + (" (+%d)" % (len(bad) - 5) if len(bad) > 5 else "")); sys.exit(1)
print("PASS (%d bản ghi đổi style_tags, không trường nào khác đổi)" % changed)
