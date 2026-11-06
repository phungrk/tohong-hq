#!/usr/bin/env python3
"""T-075 tầng 3 (adversary, v2). .gitignore mới phải chặn ĐÚNG file trung gian tools/scraper/output/pool-vendors.json, không chặn dữ liệu
  scrape đã commit (tools/scraper/output/<TP>/<loại>/vendors.json, nguồn của pool theo ADR-025) hay code của lệnh; nếu chặn rộng, lần regen sau
  đổi style_tags mà git không thấy, pool lệch nguồn âm thầm.
Kiểm: git check-ignore trên repo thật (chỉ đọc): pool-vendors.json bị bỏ qua; mọi vendors.json đang được theo dõi, regen-pool-styles.sh,
  generate-vendor-pool.js, extractor/enrichment KHÔNG bị bỏ qua; và một vendors.json mới (vùng giả) cũng không bị bỏ qua.
Chạy: python3 -I eval/T-075/adv-07-gitignore-chi-chan-pool-trung-gian.py. Repo: TOHONG_REPO."""
import os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "T-073"))
import _common as c
t = c.tohong()
def ignored(p): return subprocess.run(["git", "-C", t, "check-ignore", "-q", "--no-index", p]).returncode == 0
fails = []
if not ignored("tools/scraper/output/pool-vendors.json"): fails.append("pool-vendors.json không bị bỏ qua")
tracked = subprocess.run(["git", "-C", t, "ls-files", "tools/scraper/output"], capture_output=True, text=True).stdout.split()
src = [p for p in tracked if p.endswith("/vendors.json")]
if not src: fails.append("không thấy vendors.json nào được theo dõi")
must_keep = src + ["tools/regen-pool-styles.sh", "tools/generate-vendor-pool.js", "tools/scraper/extractors/style_tags.py",
                   "tools/scraper/enrichment/pipeline.py", "tools/scraper/output/HN/venue/vendors.json", "tools/scraper/output/pool-vendors.json.bak"]
bad = [p for p in must_keep if ignored(p)]
if bad: fails.append("bị bỏ qua nhầm: %s" % bad[:5])
if fails: print("FAIL " + "; ".join(fails)); sys.exit(1)
print("PASS (%d vendors.json nguồn vẫn được theo dõi)" % len(src))
