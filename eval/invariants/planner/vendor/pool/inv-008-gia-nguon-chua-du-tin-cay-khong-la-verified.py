#!/usr/bin/env python3
"""Nguồn: T-217 (spec products/T-217-venue-ai-mode-verified.md v2, Hành vi 1b "Tín hiệu giá chưa đủ tin cậy"; ADR-139 phân xử D1 mục 2).
Rút vào bể bởi spec-critic khi T-217 v2 qua Spec Gate 2026-11-20. Xanh trên tohong main d74ede9 (chỉ Bình Quới 2 có giá verified, không mang tín hiệu), nên vào bể ngay, không gác theo ADR-028.
INV-008 (pool) · Nhãn "Giá đã xác minh" không bao giờ gắn cho một giá mà chính nguồn tự nhận chưa đủ tin cậy:
  trong mọi tools/scraper/output/<tỉnh>/<hạng mục>/vendors.json, bản ghi có price_range.price_source == "verified" KHÔNG được mang tín hiệu "giá chưa đủ tin cậy".
  Tín hiệu: gom (i) price_range.note, (ii) verification_notes của bản ghi, (iii) changes.verification_notes của MỌI dòng enrichment_log có source == "google_ai_mode"
  (không phụ thuộc thứ tự dòng); chuỗi nào, sau chuẩn hoá NFC và đổi chữ thường, chứa (chuỗi con, không bỏ dấu) "chưa đủ tin cậy" hoặc "không đủ tin cậy" là có tín hiệu.
  Lý do: generator đưa price_source "verified" thẳng vào pool, back gắn nhãn "Giá đã xác minh" cho cặp đôi (ADR-138/139).
Chỉ đọc. Repo: TOHONG_REPO hoặc ../tohong cạnh tohong-hq (dò ngược tới scripts/gate.py, ADR-070). Không thấy repo: PASS "chưa áp dụng". Chạy: python3 -I <file>."""
import glob, json, os, sys, unicodedata

d = os.path.dirname(os.path.realpath(__file__))
while d != os.path.dirname(d) and not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    d = os.path.dirname(d)
if not os.path.isfile(os.path.join(d, "scripts", "gate.py")):
    print("FAIL không dò được gốc tohong-hq (scripts/gate.py) từ vị trí file"); sys.exit(1)
HQ = d
T = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if p and os.path.isdir(os.path.join(p, "tools", "scraper", "output"))), None)
if not T:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
PHRASES = ("chưa đủ tin cậy", "không đủ tin cậy")
fold = lambda s: unicodedata.normalize("NFC", s).lower()
bad, n = [], 0
for f in sorted(glob.glob(os.path.join(T, "tools", "scraper", "output", "*", "*", "vendors.json"))):
    try:
        data = json.load(open(f, encoding="utf-8"))
    except (OSError, ValueError) as e:
        bad.append(f"{os.path.relpath(f, T)}: không đọc được ({e.__class__.__name__})"); continue
    vs = data.get("vendors", []) if isinstance(data, dict) else data
    for v in vs if isinstance(vs, list) else []:
        pr = v.get("price_range") if isinstance(v, dict) else None
        if not (isinstance(pr, dict) and pr.get("price_source") == "verified"):
            continue
        n += 1
        texts = [pr.get("note"), v.get("verification_notes")]
        for e in v.get("enrichment_log") or []:
            if isinstance(e, dict) and e.get("source") == "google_ai_mode" and isinstance(e.get("changes"), dict):
                texts.append(e["changes"].get("verification_notes"))
        if any(isinstance(t, str) and any(p in fold(t) for p in PHRASES) for t in texts):
            bad.append(f"{v.get('id')} ({os.path.relpath(f, T)}): price_source verified mà nguồn tự nhận giá chưa đủ tin cậy")
if bad:
    print("FAIL " + bad[0] + (f" (+{len(bad) - 1} lỗi nữa)" if len(bad) > 1 else "")); sys.exit(1)
print(f"PASS {n} bản ghi giá verified, không bản ghi nào mang tín hiệu chưa đủ tin cậy"); sys.exit(0)
