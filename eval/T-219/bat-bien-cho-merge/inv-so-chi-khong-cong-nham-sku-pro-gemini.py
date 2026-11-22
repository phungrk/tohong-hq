#!/usr/bin/env python3
"""BẤT BIẾN (nguồn: T-219, Spec Gate 2026-11-22; vùng đích planner/vendor/, số do Chief đặt khi đưa vào bể; ADR-028: chờ merge vì main chưa có tsp/gc).
Sổ chi tháng của mọi workflow Google (tools/scraper/enrichment/usage.py `read_usage`) đếm mỗi SKU vào ĐÚNG bộ đếm của nó:
 - `kind=search_pro` (Text Search Pro, 0,032 USD, 5.000 miễn phí) vào `tsp`, KHÔNG vào `ts` (Text Search Enterprise, 0,040 USD);
 - `kind=gemini` vào `gc`, KHÔNG vào `ph` (ảnh/Details) hay `ts`;
 - `kind=details_count` vào `pd` như cũ;
 - log của tháng khác không tính.
Lý do: cộng nhầm SKU làm cổng hạn mức của workflow KHÁC dừng oan hoặc lọt trần (spec T-219 Hành vi 10, B6 của D1).
Cách đo: dựng thư mục run-logs tạm (tự xoá) theo đúng định dạng dòng sổ của spec T-219, gọi read_usage thật của repo tohong. Offline, không mạng.
Repo: $TOHONG_REPO hoặc ../tohong cạnh tohong-hq (dò ngược tới scripts/gate.py, ADR-057). Không thấy usage.py: PASS 'chưa áp dụng'. Chạy: python3 -I <file>."""
import os, subprocess, sys, tempfile

d = os.path.dirname(os.path.abspath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(d, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "enrichment", "usage.py"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy tools/scraper/enrichment/usage.py)"); sys.exit(0)
scraper = os.path.join(repo, "tools", "scraper")

N_PRO, N_GEM, N_PD = 7, 5, 3
with tempfile.TemporaryDirectory(prefix="inv-sku-") as tmp:
    root = os.path.join(tmp, "run-logs")
    os.makedirs(os.path.join(root, "T-219"))
    lines = (["GOOGLE_REQUEST run=r1 kind=search_pro"] * N_PRO + ["GOOGLE_REQUEST run=r1 kind=details_count"] * N_PD
             + sum((["GOOGLE_REQUEST run=r1 kind=gemini", "GEMINI_RESPONSE run=r1 search_queries=2 input_tokens=100 output_tokens=10"] for _ in range(N_GEM)), [])
             + ["GOOGLE_USAGE run=r1 text_search=0 photo_details=0 photo_media=0 text_search_pro=%d details_count=%d" % (N_PRO, N_PD),
                "GEMINI_USAGE run=r1 calls=%d search_queries=%d input_tokens=%d output_tokens=%d" % (N_GEM, 2 * N_GEM, 100 * N_GEM, 10 * N_GEM)])
    with open(os.path.join(root, "T-219", "20260315-101500-run-555-discover.log"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(root, "T-219", "20260415-101500-run-556-discover.log"), "w", encoding="utf-8") as f:
        f.write("GOOGLE_REQUEST run=r2 kind=search_pro\nGOOGLE_REQUEST run=r2 kind=gemini\n"
                "GOOGLE_USAGE run=r2 text_search=0 photo_details=0 photo_media=0 text_search_pro=1 details_count=0\n")
    code = ("import sys; sys.path.insert(0, '.'); from pathlib import Path; from enrichment.usage import read_usage\n"
            "u = read_usage(Path(sys.argv[1]), sys.argv[2])\n"
            "print(*[getattr(u, a, 'NA') for a in ('ts', 'ph', 'pd', 'tsp', 'gc')])")
    p = subprocess.run([sys.executable, "-I", "-c", code, root, "2026-03"], cwd=scraper, capture_output=True, text=True, timeout=60)
got = p.stdout.strip()
want = "0 0 %d %d %d" % (N_PD, N_PRO, N_GEM)
if p.returncode != 0 or got != want:
    print("FAIL read_usage(2026-03) ts ph pd tsp gc = %r, kỳ vọng %r (search_pro không vào ts, gemini không vào ph/ts, tháng khác không tính) %s"
          % (got, want, p.stderr.strip()[-160:])); sys.exit(1)
print("PASS sổ chi đếm search_pro/gemini/details_count vào đúng bộ đếm, không cộng nhầm SKU"); sys.exit(0)
