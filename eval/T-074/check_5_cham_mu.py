#!/usr/bin/env python3
"""T-074 tiêu chí 5: gói chấm mù. Người chấm không thấy điểm, hạng, style, tag, vai trò; mỗi ô có đúng 3 người; thứ tự đã trộn;
mỗi ô gồm tối đa 15 vendor top của máy + đúng 5 ngẫu nhiên; gói có HUONG_DAN.md với câu hỏi nguyên văn, luật giá, đơn vị giá địa điểm, ví dụ co/khong."""
import csv, json, os, re, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
def fail(m): print("FAIL " + m); sys.exit(1)
out = os.path.join(tempfile.mkdtemp(), "packets")
for n in (3, 4, 5):
    o = f"{out}{n}"
    r = subprocess.run(["node", "eval/T-074/packets.mjs", "make", "--graders", str(n), "--out", o], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0: fail(f"packets make --graders {n} lỗi: {(r.stdout + r.stderr)[-300:]}")
    key = json.load(open(os.path.join(o, "_private", "key.json"), encoding="utf-8"))
    if len(key["cells"]) != 120: fail(f"cần 120 ô (30 hồ sơ x 4 hạng mục), có {len(key['cells'])}")
    bad = [c["cell"] for c in key["cells"] if len(set(c["graders"])) != 3]
    if bad: fail(f"ô không có đúng 3 người chấm: {bad[:3]}")
    load = {f"G{i+1}": 0 for i in range(n)}
    for c in key["cells"]:
        for g in c["graders"]: load[g] += 1
    if max(load.values()) - min(load.values()) > 1: fail(f"tải chấm lệch giữa người chấm: {load}")
    n_early = 0
    for i in range(n):
        f = os.path.join(o, f"G{i+1}.csv")
        rows = list(csv.reader(open(f, encoding="utf-8")))
        head = rows[0]
        if re.search(r"diem|hang|rank|score|style|tag|role|vai_tro|phong_cach_vendor", "|".join(head), re.I): fail(f"{f}: tiêu đề cột lộ thông tin hệ thống: {head}")
        if head[-1] != "phu_hop": fail(f"{f}: cột cuối phải là phu_hop")
        if any(r[-1] for r in rows[1:]): fail(f"{f}: cột phu_hop phải trống khi phát")
        txt = open(f, encoding="utf-8").read()
        if "system" in txt.split("\n", 1)[0] or '"filler"' in txt or ",filler," in txt or ",system," in txt: fail(f"{f}: lộ vai trò system/filler")
    kc = {c["cell"]: c for c in key["cells"]}
    for c in key["cells"]:
        roles = [x["role"] for x in c["candidates"]]
        if roles.count("system") + roles.count("filler") != len(roles): fail("vai trò lạ trong key")
        if roles.count("filler") != 5: fail(f"ô {c['cell']} không có đúng 5 vendor ngẫu nhiên")
        if roles.count("system") > 15: fail(f"ô {c['cell']} có {roles.count('system')} vendor top của máy, tối đa 15")
        if roles[-5:] == ["filler"] * 5 and roles.count("system") > 0: n_early += 1
    if n_early > 3: fail(f"{n_early}/120 ô để 5 vendor ngẫu nhiên dồn cuối (trộn không đủ)")
    g = open(os.path.join(o, "HUONG_DAN.md"), encoding="utf-8").read() if os.path.exists(os.path.join(o, "HUONG_DAN.md")) else fail("thiếu HUONG_DAN.md trong gói chấm")
    for need in ("Với cặp đôi này, anh/chị có khuyên họ liên hệ vendor này không?", "giá thấp nhất", "mỗi bàn", "co", "khong", "Ví dụ"):
        if need not in g: fail(f"HUONG_DAN.md thiếu '{need}'")
    if g.count("Trả lời: co") < 1 or g.count("Trả lời: khong") < 1: fail("HUONG_DAN.md cần ví dụ có và ví dụ không")
    if re.search(r"priceMax|priceMin|tag|trọng số|điểm của hệ thống", g): fail("HUONG_DAN.md lộ thuật ngữ nội bộ")
    rows_v = [r for r in csv.reader(open(os.path.join(o, "G1.csv"), encoding="utf-8")) if r and r[0].endswith("-venue")]
    if rows_v and not all("triệu/bàn" in r[5] for r in rows_v): fail("thẻ địa điểm tiệc không ghi đơn vị triệu/bàn")
    if rows_v and "mỗi bàn" not in rows_v[0][1] and "mỗi bàn" not in rows_v[0][1].lower(): fail("mô tả cặp đôi không nói tiệc tính mỗi bàn")
    if not os.path.exists(os.path.join(o, "_private", "declarations.template.json")): fail("thiếu declarations.template.json")
    t = json.load(open(os.path.join(o, "_private", "declarations.template.json")))
    if any(v.get("is_external") is not None or v["saw_system_scores"] is not None or v["touched_matching_weights"] is not None for v in t.values()) or any("is_external" not in v for v in t.values()): fail("mẫu khai báo phải để null cho người thật điền")
# import phải từ chối khi chưa khai báo và khi còn ô trống
o = f"{out}3"
r = subprocess.run(["node", "eval/T-074/packets.mjs", "import", "--dir", o, "--out", os.path.join(o, "l.json")], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0: fail("import nhận khi chưa có declarations.json")
print("PASS gói chấm 3/4/5 người: không lộ điểm/hạng/style/tag/vai trò, 120 ô x đúng 3 người, mỗi ô <=15 top + 5 ngẫu nhiên, có hướng dẫn chấm (câu hỏi, luật giá, đơn vị, ví dụ), tải đều, trộn thứ tự, import chặn khi thiếu khai báo")
