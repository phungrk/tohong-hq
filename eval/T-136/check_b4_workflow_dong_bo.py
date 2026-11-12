#!/usr/bin/env python3
"""T-136 tiêu chí 7: workflow đẩy file matcher lên bucket. KHÔNG chạy được thật (cấm gọi Google / ghi GCS) nên đây là kiểm tĩnh trên văn bản workflow, ghi rõ lý do; mỗi dòng là một điều
người ta quan sát được ở hành vi workflow (khi nào chạy, quyền, thứ tự, khi nào đỏ), không phải kiểu viết. Thiếu tohong-back: PASS chưa áp dụng. Chỉ đọc. In PASS / FAIL <lý do>.
File: tohong-back/.github/workflows/sync-matcher-vendors.yml"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
B = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_BACK_REPO"), os.path.join(HQ, "..", "tohong-back")) if c and os.path.isfile(os.path.join(c, "matcher/match.py"))), None)
if not B: print("PASS chưa áp dụng (thiếu tohong-back)"); sys.exit(0)
p = os.path.join(B, ".github/workflows/sync-matcher-vendors.yml")
if not os.path.isfile(p): print("FAIL chưa có .github/workflows/sync-matcher-vendors.yml"); sys.exit(1)
t = open(p, encoding="utf-8").read(); fails = []
def need(cond, msg):
    if not cond: fails.append(msg)
head = t.split("jobs:")[0]
need(re.search(r"push:\s*\n\s*branches:\s*\[?\s*main", head), "phải chạy khi push vào main")
need("matcher-service/vendors.json" in head, "phải lọc theo đường dẫn matcher-service/vendors.json (chạy khi PR pool merge, không chạy mọi push)")
need("workflow_dispatch" in head, "phải có workflow_dispatch (đẩy lần đầu / chạy lại tay)")
need(not re.search(r"pull_request", head), "không được chạy theo pull_request (secret GCP không được lộ cho PR)")
need(re.search(r"permissions:\s*\n\s*contents:\s*read", t), "permissions: contents: read")
need(re.search(r"concurrency:", t), "phải có concurrency (hai lần đồng bộ không đè nhau)")
secrets = set(re.findall(r"secrets\.([A-Z0-9_]+)", t))
need(secrets <= {"GCP_SA_KEY", "GCP_PROJECT_ID", "MATCHER_URL", "MATCHER_API_KEY", "GITHUB_TOKEN"}, f"chỉ dùng secret đã có, thấy thêm: {sorted(secrets - {'GCP_SA_KEY','GCP_PROJECT_ID','MATCHER_URL','MATCHER_API_KEY','GITHUB_TOKEN'})}")
need("GCP_SA_KEY" in secrets, "phải xác thực bằng GCP_SA_KEY")
need("wedding-planner-vendors" in t, "đích là bucket wedding-planner-vendors")
i_pre, i_cp, i_rev, i_ver = (t.find(x) for x in ("vendors.prev.json", "vendors.json\n", "POOL_VERSION", "pool_size"))
up = [m.start() for m in re.finditer(r"(gcloud storage cp|gsutil (-\w+ )?cp)[^\n]*vendors\.json", t)]
need(i_pre >= 0 and up and i_pre < max(up), "phải sao file cũ sang vendors.prev.json TRƯỚC khi ghi đè (đường lui)")
need("vendorPool.generated.js" in t, "trước khi đẩy phải kiểm tập id file == tập id pool (vendorPool.generated.js), lệch thì dừng")
need(re.search(r"gcloud run services (update|deploy)[^\n]*", t) and i_rev > max(up or [0]), "sau khi đẩy phải tạo revision mới (POOL_VERSION) để mọi instance nạp lại file, không chỉ một instance")
need(i_ver > i_rev and "/health" in t and re.search(r"(for|while|until)\b", t[i_ver - 600:i_ver + 600] or ""), "phải kiểm /health pool_size == số vendor trong file, có thử lại")
need(re.search(r"exit 1", t[t.find("pool_size"):] if "pool_size" in t else ""), "pool_size lệch sau khi hết lượt thử thì workflow phải ĐỎ (exit 1)")
if "|" in t and re.search(r"\|\s*tee\b", t): need("pipefail" in t, "dùng | tee thì phải pipefail (planner inv-006)")
print("PASS" if not fails else "FAIL " + "; ".join(fails))
sys.exit(0 if not fails else 1)
