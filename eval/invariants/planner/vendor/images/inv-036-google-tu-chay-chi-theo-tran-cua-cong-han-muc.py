#!/usr/bin/env python3
"""Nguồn: T-135 (spec products/T-135-resolve-tu-chay-pool-o-back.md v3, D8 "Trần chi của đường tự động"; Spec Gate T-135-D1 B1, T-135-D2 C1), qua Spec Gate 2026-11-13 (spec-critic).
Nằm ở eval/T-135/bat-bien-cho-merge/ cho tới khi PR code T-135 merge và bất biến xanh trên main (ADR-028); Chief of Staff đưa vào eval/invariants/planner/vendor/images/ và đặt số.
INV-??? · Workflow của tohong có GOOGLE_MAPS_API_KEY mà TỰ chạy (`on` có `pull_request`) thì:
  (a) có một bước tên bắt đầu "Cổng: hạn mức", có `id`, đứng TRƯỚC mọi bước có GOOGLE_MAPS_API_KEY trong env;
  (b) MỌI bước có GOOGLE_MAPS_API_KEY và gọi script Google (resolve_overrides.py, enrich.py, refresh_photos.py, kể cả `--suggest`; bỏ qua `--dry-run`/`--probe`, không gọi Places)
      truyền `--max-requests` với giá trị lấy từ `steps.<id cổng>.outputs` (trần do cổng quyết, có thể là 0), không phải số cứng hay input của người bấm;
  (c) không bước nào có GOOGLE_MAPS_API_KEY mà chạy lệnh Python khác ngoài ba script trên (bước Google mới phải đi qua cổng trước khi thêm).
Lý do: đường tự động chỉ được tiêu đúng phần cổng hạn mức đã tính trên sổ chi tháng (phương án A: chi thật $0). Một bước Google không nhận trần của cổng (số cứng, thiếu cờ, bước mới)
  sẽ gọi Google trả tiền khi tháng đã vượt hạn mức miễn phí, dù cổng đã báo "cần Capu duyệt chạy tay".
Tĩnh, không mạng. Repo: $TOHONG_REPO, rồi <gốc HQ>/../tohong. Không workflow Google nào tự chạy: PASS 'chưa áp dụng'. Chạy: python3 -I <file>. 0 = đạt."""
import glob, os, re, sys
try:
    import yaml
except ImportError:
    print("FAIL thiếu PyYAML"); sys.exit(1)
HQ = os.path.dirname(os.path.abspath(__file__))
while HQ != os.path.dirname(HQ) and not os.path.isfile(os.path.join(HQ, "scripts", "gate.py")):  # ADR-057/070: tìm gốc tohong-hq ở mọi độ sâu
    HQ = os.path.dirname(HQ)
repo = next((c for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isdir(os.path.join(c, ".github", "workflows"))), None)
if not repo:
    print("PASS chưa áp dụng (không thấy .github/workflows của tohong)"); sys.exit(0)
SCRIPT = re.compile(r"\b(resolve_overrides|enrich|refresh_photos)\.py\b")
PY = re.compile(r"\bpython3?\s+(?:-\w+\s+)*([\w./-]+\.py|-m\s+\S+)")
bad, seen = [], 0
for p in sorted(glob.glob(os.path.join(repo, ".github", "workflows", "*.y*ml"))):
    n = os.path.basename(p); raw = open(p, encoding="utf-8").read()
    if "GOOGLE_MAPS_API_KEY" not in raw:
        continue
    wf = yaml.safe_load(raw) or {}
    on = wf.get("on", wf.get(True)) or {}
    trig = set(on) if isinstance(on, dict) else ({on} if isinstance(on, str) else set(on))
    if "pull_request" not in trig:
        continue
    seen += 1
    for jn, j in (wf.get("jobs") or {}).items():
        steps = j.get("steps") or []
        jkey = "GOOGLE_MAPS_API_KEY" in str(j.get("env", ""))
        if jkey:
            bad.append("%s job %s: GOOGLE_MAPS_API_KEY ở env cấp job (mọi bước đều có khoá; phải chỉ ở bước Google sau cổng)" % (n, jn))
        qi = next((i for i, s in enumerate(steps) if str(s.get("name", "")).startswith("Cổng: hạn mức")), None)
        qid = steps[qi].get("id") if qi is not None else None
        if qi is None or not qid:
            bad.append("%s job %s: thiếu bước 'Cổng: hạn mức…' có id" % (n, jn)); continue
        for i, s in enumerate(steps):
            if "GOOGLE_MAPS_API_KEY" not in str(s.get("env", "")):
                continue
            label = "%s job %s bước #%d %r" % (n, jn, i, s.get("name", ""))
            if i < qi:
                bad.append("%s: có khoá Google nhưng đứng trước cổng hạn mức" % label)
            run = str(s.get("run", ""))
            for m in PY.finditer(run):
                if not SCRIPT.search(m.group(1)):
                    bad.append("%s: chạy %s có khoá Google mà không qua trần của cổng" % (label, m.group(1)))
            flat = re.sub(r"\$\{\{.*?\}\}", lambda e: "EXPR_QUOTA" if ("steps.%s.outputs" % qid) in e.group(0) else "EXPR_OTHER", run, flags=re.S)
            for line in re.split(r"\n|&&|;|\|\|", flat):
                if not SCRIPT.search(line) or not re.search(r"\bpython", line) or re.search(r"--(dry-run|probe)\b", line):
                    continue
                mm = re.search(r"--max-requests[ =]+(\"[^\"]*\"|'[^']*'|\S+)", line)
                if not mm:
                    bad.append("%s: gọi script Google không có --max-requests" % label)
                elif "EXPR_QUOTA" not in mm.group(1):
                    bad.append("%s: --max-requests %s không lấy từ steps.%s.outputs (trần của cổng)" % (label, mm.group(1)[:60], qid))
if not seen:
    print("PASS chưa áp dụng (không workflow Google nào của tohong tự chạy theo pull_request)"); sys.exit(0)
if bad:
    print("FAIL " + bad[0] + (" (+%d lỗi nữa)" % (len(bad) - 1) if len(bad) > 1 else "")); sys.exit(1)
print("PASS mọi bước Google của workflow tự chạy đứng sau cổng hạn mức và nhận --max-requests từ cổng"); sys.exit(0)
