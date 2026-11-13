#!/usr/bin/env python3
"""T-135 tiêu chí 11 (repo tohong): thân PR duyệt tay (apply-admin-reviews.yml) nói thật, trước cú merge #1, merge đó có TỰ gọi Google hay không và tốn tối đa bao nhiêu (cú merge #1 kèm thông tin này mới là quyết chi;
cú bấm Approve trên admin chỉ là quyết duyệt, ADR-065). Số liệu lấy CÙNG một bộ ước tính với cổng hạn mức của resolve-overrides.yml (một định nghĩa, không hai).
Chạy NGUYÊN VĂN bước tạo thân PR (bước ghi `pr-body.md`) trên bản sao git của repo thật, lô 15 mục accept_place chưa resolve, biến `vars.AUTO_RESOLVE_OVERRIDES` thay đổi lúc chạy:
  (A) công tắc 'true', lô trong hạn mức -> thân có "Merge PR này sẽ TỰ gọi Google: tối đa 38 request, ≈ $<số> net"; 38 = 30 (resolve: 15 mục place_id x 2) + 2 (enrich) + 6 (ảnh) = requests trong BATCH_ESTIMATE của cổng hạn mức resolve-overrides trên cùng dữ liệu;
  (B) công tắc 'true', lô vượt hạn mức (đã dùng 990 ảnh) -> "Lô này VƯỢT hạn mức tự động: merge PR này KHÔNG gọi Google, chỉ áp phần không cần Google (gỡ, đóng cửa); cần Capu duyệt chạy tay (tối đa 38 request, ước tính ≈ $<số> net)", không có câu "sẽ TỰ gọi";
  (C) công tắc vắng hoặc 'false' -> "Công tắc AUTO_RESOLVE_OVERRIDES đang TẮT: merge PR này KHÔNG gọi Google", không có câu "sẽ TỰ gọi";
  (D) trong cả ba: vẫn còn dòng "Export lúc: <exported_at>" và dòng ADDED của từng mục như T-129 (không mất thông tin cũ).
Không mạng, không Google. In PASS hoặc FAIL <lý do>; thoát 0/1."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _t135 as t
t.need_repos()
raw, wf = t.load_wf(t.TOHONG, "apply-admin-reviews.yml")
rraw, rwf = t.load_wf(t.TOHONG, "resolve-overrides.yml")
if wf is None or rwf is None:
    print("FAIL thiếu apply-admin-reviews.yml hoặc resolve-overrides.yml"); sys.exit(1)
job = next(iter(wf["jobs"])); bad = []
body_step = lambda s: "pr-body.md" in str(s.get("run", "")) and ">" in str(s.get("run", ""))
box = t.Box(t.TOHONG)
try:
    t.mutate_fixture_overrides(box, 2); t.add_unresolved(box, 15)
    def body(var, baseline_ph):
        box.reset(); t.set_baseline(box, 0, baseline_ph)
        open(os.path.join(box.rt, "export.json"), "w").write('{"exported_at": "2026-11-12T10:00:00.000Z", "entries": []}')
        open(os.path.join(box.rt, "apply.log"), "w").write("ADDED marry_x1 remove\nADDED marry_x2 temporarily_closed\n")
        c = t.gh_ctx(box, "workflow_dispatch", vars_={} if var is None else {"AUTO_RESOLVE_OVERRIDES": var})
        res = t.run_job(box, wf, job, c, uses={"actions/": lambda w, s: {}}, only=body_step)
        p = os.path.join(box.rt, "pr-body.md")
        return res, (open(p, encoding="utf-8").read() if os.path.isfile(p) else "")
    # số của cổng resolve-overrides trên cùng dữ liệu
    box.reset(); t.set_baseline(box, 0, 0)
    gc = t.gh_ctx(box, "pull_request", event=t.pr_event(), vars_={"AUTO_RESOLVE_OVERRIDES": "true"})
    gr = t.run_job(box, rwf, next(iter(rwf["jobs"])), gc, uses={"actions/": lambda w, s: {}}, only=lambda s: str(s.get("name", "")).startswith("Cổng: hạn mức"))
    m = re.search(r"BATCH_ESTIMATE\b[^\n]*requests=(\d+)", gr["log"]); N = m.group(1) if m else None
    if N != "38": bad.append("cổng hạn mức resolve-overrides không in BATCH_ESTIMATE requests=38 trên lô 15 mục place_id (30 + 2 + 6, tiêu chí 10): %r" % N)
    for label, var, ph in (("A", "true", 0), ("B", "true", 990), ("C1", None, 0), ("C2", "false", 0)):
        res, b = body(var, ph)
        if res["status"] != "success" or not b: bad.append("(%s) không dựng được thân PR: %s" % (label, res["log"][-250:])); continue
        if label == "A":
            if not re.search(r"Merge PR này sẽ TỰ gọi Google: tối đa 38 request, ≈ \$\d+(?:[.,]\d+)? net", b): bad.append("(A) thân PR thiếu 'Merge PR này sẽ TỰ gọi Google: tối đa 38 request, ≈ $x net'; thấy %r" % b[-260:])
        elif label == "B":
            if not re.search(r"VƯỢT hạn mức tự động: merge PR này KHÔNG gọi Google, chỉ áp phần không cần Google \(gỡ, đóng cửa\); cần Capu duyệt chạy tay \(tối đa 38 request, ước tính ≈ \$\d+(?:[.,]\d+)? net\)", b) or "sẽ TỰ gọi" in b:
                bad.append("(B) lô vượt hạn mức: thân PR sai (cần câu VƯỢT hạn mức… cần Capu duyệt chạy tay, không câu 'sẽ TỰ gọi'); thấy %r" % b[-260:])
        else:
            if "Công tắc AUTO_RESOLVE_OVERRIDES đang TẮT: merge PR này KHÔNG gọi Google" not in b or "sẽ TỰ gọi" in b: bad.append("(%s) công tắc tắt: thân PR phải nói 'Công tắc AUTO_RESOLVE_OVERRIDES đang TẮT: merge PR này KHÔNG gọi Google'" % label)
        if "Export lúc: 2026-11-12T10:00:00.000Z" not in b or "ADDED marry_x1 remove" not in b or "ADDED marry_x2 temporarily_closed" not in b: bad.append("(D/%s) mất 'Export lúc' hoặc dòng ADDED của T-129" % label)
finally:
    box.cleanup()
t.done(bad, "thân PR duyệt tay báo đúng trạng thái công tắc và số request/tiền tối đa (cùng ước tính với cổng hạn mức), vượt hạn mức thì nói cần Capu duyệt chạy tay, giữ nguyên dòng cũ của T-129")
