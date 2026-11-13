#!/usr/bin/env python3
"""Nguồn: T-147 (spec products/T-147-drawer-vendor-enrich.md, Hành vi 1 và "Bất biến đề xuất"); bản đề xuất của product, chờ Spec Gate (spec-critic) rồi Chief of Staff đưa vào eval/invariants/planner/admin/vendor-enrich/ và đặt số.
Nằm ở eval/T-147/bat-bien-cho-merge/ cho tới khi ba PR T-147 merge và bất biến xanh trên main (ADR-028).
INV-??? (planner/admin/vendor-enrich) · Danh mục thuộc tính nguồn của vendor pool (tools/scraper/pool-input-fields.json, repo tohong) KHỚP đúng với những gì các bước sinh pool thật sự đọc:
  mọi trường của vendors.json / enrichment-audit.json mà clean_style_tags.py, build_pool.py hoặc generate-vendor-pool.js (cả --styles-only --prune --photos-for) đọc đều có mục trong danh mục; không mục nào thừa;
  manual_overrides.json và enrich-report.json không được bước nào đọc (nếu đọc phải có mục với đúng `file` đó); danh mục không có mục `contact`.
Lý do: drawer của bảng enrich hiện đúng các mục trong danh mục; generator đọc thêm một trường (vd hình học, liên hệ) mà danh mục không biết thì Capu nhìn vào drawer sẽ thấy thiếu mà không ai hay;
  ngược lại danh mục ghi một trường không còn dùng thì drawer nói dối. Đo bằng thực nghiệm (đổi trường rồi so đầu ra), không đọc mã: eval/T-147/lib/pool_reads.py.
Tĩnh với mạng (bị chặn), chạy trên bản sao tạm, không ghi gì trong repo; ~1-2 phút. Repo: TOHONG_REPO hoặc ../tohong. Chưa có pool-input-fields.json: PASS 'chưa áp dụng'.
Chạy: python3 -I <file>. Thoát 0 = đạt, 1 = vi phạm."""
import json, os, sys
sys.dont_write_bytecode = True
d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
lib = next((p for p in (os.path.join(d, "eval", "lib"), os.path.join(d, "eval", "T-147", "lib")) if os.path.isfile(os.path.join(p, "pool_reads.py"))), None)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "enrich.py"))), None)
if not lib or not repo:
    print("PASS chưa áp dụng (không thấy tohong hoặc eval/T-147/lib)"); sys.exit(0)
cp = os.path.join(repo, "tools", "scraper", "pool-input-fields.json")
if not os.path.isfile(cp):
    print("PASS chưa áp dụng (chưa có pool-input-fields.json)"); sys.exit(0)
sys.path.insert(0, lib)
import pool_reads  # noqa: E402
fields = json.load(open(cp, encoding="utf-8")).get("fields") or []
reads = pool_reads.detect(repo)
measured = {"vendors.json": reads["style"] | reads["build"] | reads["gen"], "enrichment-audit.json": reads["audit"],
            "manual_overrides.json": reads["overrides"], "enrich-report.json": reads["report"]}


def related(a, b):
    anc = lambda x, y: y == x or y.startswith(x + ".") or y.startswith(x + "[].")  # noqa: E731
    return anc(a, b) or anc(b, a)


bad = []
for f in fields:
    if str(f.get("key", "")).split(".")[0].split("[")[0] == "contact":
        bad.append("danh mục có mục liên hệ: %s" % f.get("key"))
for fl, ps in measured.items():
    keys = [f["key"] for f in fields if f.get("file") == fl]
    bad += ["bước sinh pool đọc `%s` của %s mà danh mục không có" % (p, fl) for p in sorted(ps) if not any(related(k, p) for k in keys)]
    bad += ["danh mục có `%s` của %s mà không bước nào đọc" % (k, fl) for k in keys if not any(related(k, p) for p in ps)]
if bad:
    print("FAIL " + bad[0] + (" (+%d)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS")
