#!/usr/bin/env python3
"""T-113 adv-02 (tầng 3): `run-name` REAL/DRY phải khớp việc workflow CÓ gọi Google thật hay không, với MỌI giá trị input người bấm có thể gõ.
Sổ đăng ký (check_runs.py) chỉ đòi log cho lần chạy có displayTitle bắt đầu "REAL ": một lần gọi Google thật mà mang tên "DRY" lọt khỏi sổ,
log của nó không bị đòi -> chi của nó không vào trần $30 nếu PR dữ liệu không được merge (spec T-111 Hành vi 4: "có input dry_run: REAL khi dry_run != 'true'").

Bẫy: biểu thức GitHub (`run-name`, `if:`) so chuỗi KHÔNG phân biệt hoa thường, còn bash `[ "$x" = "true" ]` thì CÓ; và workflow_dispatch nhận chuỗi tự do.
Với mỗi workflow có GOOGLE_MAPS_API_KEY và mỗi giá trị input trong VALS: tính tiền tố run-name (ngữ nghĩa GitHub) và xem có bước mang khoá nào gọi Google thật
(bước chạy theo `if:`; trong bash, nhánh `if [ "${{ github.event.inputs.X }}" = "true" ]` là dry-run). Gọi thật mà tên không bắt đầu "REAL " -> FAIL."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _gh as g

VALS = ["true", "false", "TRUE", "True", "False", "FALSE", "no", "0", ""]
wfdir = os.path.join(g.repo(), ".github", "workflows")
bad, checked = [], 0
for name in sorted(os.listdir(wfdir)):
    if not name.endswith((".yml", ".yaml")):
        continue
    raw = open(os.path.join(wfdir, name), encoding="utf-8").read()
    if "GOOGLE_MAPS_API_KEY" not in raw:
        continue
    wf = g.load(name)
    inputs = ((wf.get("on") or {}).get("workflow_dispatch") or {}).get("inputs") or {}
    rn = wf.get("run-name")
    if not rn:
        bad.append(f"{name}: không có run-name")
        continue
    # input quyết định thật/giả: dry_run hoặc skip_enrich
    key = "dry_run" if "dry_run" in inputs else ("skip_enrich" if "skip_enrich" in inputs else None)
    vals = VALS if key else [None]
    for v in vals:
        inp = {k: (str(x.get("default")) if isinstance(x, dict) and x.get("default") is not None else "") for k, x in inputs.items()}
        if key:
            inp[key] = v
        title = g.render(rn, inp).strip()
        real = []
        for job in wf["jobs"].values():
            for s in job.get("steps", []):
                if "GOOGLE_MAPS_API_KEY" not in json.dumps(s.get("env") or {}):
                    continue
                cond = s.get("if")
                if cond is not None and not g._truthy(g.evaluate(str(cond), inp)):
                    continue
                script = s.get("run") or ""
                # bash: nhánh `if [ "<input>" = "true" ]; then … --dry-run …` -> chỉ đúng chữ "true" (phân biệt hoa thường) là dry
                m = re.search(r'if \[ "\$\{\{\s*github\.event\.inputs\.(\w+)\s*\}\}" = "true" \]', script)
                if m and m.group(1) == key and v == "true":
                    continue
                if "--dry-run" in script and not m and "python" in script and script.count("python") == script.count("--dry-run"):
                    continue
                real.append(s.get("name") or s.get("id") or "?")
        checked += 1
        if real and not title.startswith("REAL "):
            bad.append(f"{name} {key}={v!r}: run-name '{title}' nhưng bước gọi Google thật vẫn chạy: {real}")
if not checked:
    g.fail("không tìm thấy workflow nào dùng GOOGLE_MAPS_API_KEY")
if bad:
    g.fail("lần gọi Google thật mang tên không phải REAL (lọt sổ đăng ký): " + " | ".join(bad))
g.ok(f"PASS {checked} tổ hợp workflow x input: mọi lần gọi Google thật đều mang run-name REAL")
