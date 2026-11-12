#!/usr/bin/env python3
"""Eval đối kháng T-134 (tầng 3) · adversary · 2026-11-12.
Input phá: chạy bước "Áp dụng" của `.github/workflows/apply-admin-reviews.yml` bằng ĐÚNG shell mà GitHub Actions dùng cho bước đó
  (docs GitHub "jobs.<id>.steps[*].shell": không khai `shell` trên Linux → `bash -e {0}`, KHÔNG pipefail; chỉ khi khai `shell: bash`
  mới là `bash --noprofile --norc -eo pipefail {0}`), với export mà apply_admin_reviews.py phải từ chối:
  (a) khoá công khai trống như file admin_review_keys.json đang ship (lần chạy đầu) → unknown_key;
  (b) khoá k1 khác khoá đã ký → bad_signature.
Mong đợi (spec T-129 Hành vi 4.2: "workflow đỏ (curl 403, chữ ký sai, khoá lạ, test T-110 đỏ) thì không có PR mới và job báo lỗi"):
  bước thoát khác 0 (job đỏ). Nếu bước xanh, các bước sau chạy tiếp, manual_overrides.json bằng main, peter-evans ĐÓNG PR đang mở và job xanh.
Lỗi tìm được trên tohong#91: `python apply_admin_reviews.py … | tee …` không pipefail trên runner thật → mã 2 của apply bị tee nuốt.
  Eval #5 của T-129 chạy mọi bước bằng `bash -eo pipefail` nên không thấy.
Tự chứa: chép tools/scraper vào thư mục tạm, khoá Ed25519 sinh tạm, không mạng, không Google. Repo: TOHONG_REPO hoặc ../tohong.
Chạy: python3 -I <file>. 0 = đạt, 1 = vi phạm.
"""
import base64, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))


def hq_root(d):
    while d != os.path.dirname(d):
        if os.path.isfile(os.path.join(d, "scripts", "gate.py")):
            return d
        d = os.path.dirname(d)


HQ = hq_root(HERE) or os.getcwd()
TOHONG = next((os.path.abspath(p) for p in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
               if p and os.path.isfile(os.path.join(p, "tools", "scraper", "enrich.py"))), None)
if not TOHONG:
    print("FAIL không thấy repo tohong"); sys.exit(1)
WF = os.path.join(TOHONG, ".github", "workflows", "apply-admin-reviews.yml")
if not os.path.isfile(WF):
    print("PASS chưa có apply-admin-reviews.yml (chưa áp dụng)"); sys.exit(0)

import yaml  # noqa: E402
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402

wf = yaml.safe_load(open(WF, encoding="utf-8"))
jobs = wf.get("jobs") or {}
found = None
for jn, j in jobs.items():
    for s in j.get("steps") or []:
        if "apply_admin_reviews.py" in (s.get("run") or ""):
            found = (j, s)
if not found:
    print("FAIL không thấy bước run gọi apply_admin_reviews.py"); sys.exit(1)
job, step = found
shell = step.get("shell") or ((job.get("defaults") or {}).get("run") or {}).get("shell") or ((wf.get("defaults") or {}).get("run") or {}).get("shell")
wd = step.get("working-directory") or ((job.get("defaults") or {}).get("run") or {}).get("working-directory") or ((wf.get("defaults") or {}).get("run") or {}).get("working-directory") or "."
if shell in (None, ""):
    argv = ["bash", "-e", "-c"]                      # mặc định GitHub trên Linux khi không khai shell
elif shell == "bash":
    argv = ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c"]
elif shell == "sh":
    argv = ["sh", "-e", "-c"]
else:
    print(f"FAIL shell {shell!r} chưa được eval mô hình hoá"); sys.exit(1)


def payload(fields):
    out = b"tohong-enrich-review-v1|"
    for f in fields:
        b = f.encode("utf-8")
        out += str(len(b)).encode() + b":" + b + b","
    return out


def b64u(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


errs = []
with tempfile.TemporaryDirectory(prefix="adv134-04-") as tmp:
    repo = os.path.join(tmp, "repo")
    shutil.copytree(os.path.join(TOHONG, "tools", "scraper"), os.path.join(repo, "tools", "scraper"),
                    ignore=shutil.ignore_patterns("__pycache__", ".cache", "*.pyc"))
    scraper = os.path.join(repo, "tools", "scraper")
    mo = os.path.join(scraper, "output", "HCMC", "manual_overrides.json")
    have = {x["vendor_id"] for x in json.load(open(mo, encoding="utf-8"))["overrides"]} if os.path.exists(mo) else set()
    sys.path.insert(0, scraper)
    from apply_admin_reviews import known_vendor_ids  # noqa: E402
    vid = sorted(known_vendor_ids(Path(scraper, "output", "HCMC")) - have)[0]
    shim = os.path.join(tmp, "bin")
    os.makedirs(shim)
    os.symlink(sys.executable, os.path.join(shim, "python"))
    rt = os.path.join(tmp, "runner_temp")
    os.makedirs(rt)
    sk = Ed25519PrivateKey.generate()
    at, label, reason, kid = "2026-11-12T01:02:03.456Z", "admin:0a1b2c3d", "Admin sửa thủ công: gỡ vendor (không có trên Maps). adv", "k1"
    sig = b64u(sk.sign(payload([kid, vid, "remove", "", "", reason, label, at])))
    entry = {"vendor_id": vid, "action": "remove", "reason": reason, "reviewer_label": label, "reviewed_at": at, "by_capu": True, "key_id": kid, "sig": sig}
    other_pub = base64.b64encode(Ed25519PrivateKey.generate().public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    keys_path = os.path.join(scraper, "admin_review_keys.json")
    shipped = open(keys_path, encoding="utf-8").read() if os.path.exists(keys_path) else '{"schema_version":1,"keys":{}}'
    before = open(mo, "rb").read() if os.path.exists(mo) else None
    for name, keys_text, want in [("khoá trống như bản ship", shipped, "unknown_key"),
                                  ("khoá k1 khác khoá ký", json.dumps({"schema_version": 1, "keys": {"k1": other_pub}}), "bad_signature")]:
        if name.startswith("khoá trống") and json.loads(shipped).get("keys"):
            continue  # file ship đã có khoá thật: ca (a) không áp dụng
        open(keys_path, "w", encoding="utf-8").write(keys_text)
        json.dump({"exported_at": "2026-11-12T02:00:00.000Z", "count": 1, "waiting_capu": 0, "skipped_not_approvable": 0, "entries": [entry]},
                  open(os.path.join(rt, "export.json"), "w", encoding="utf-8"))
        env = dict(os.environ, PATH=shim + os.pathsep + os.environ.get("PATH", ""), RUNNER_TEMP=rt, GITHUB_WORKSPACE=repo, CI="true")
        cmd = step["run"].replace("${{ runner.temp }}", rt)
        p = subprocess.run(argv + [cmd], cwd=os.path.join(repo, wd), env=env, capture_output=True, text=True, timeout=300)
        log = open(os.path.join(rt, "apply.log"), encoding="utf-8").read() if os.path.exists(os.path.join(rt, "apply.log")) else p.stdout
        if f"APPLY_REFUSED {want}" not in log:
            errs.append(f"{name}: apply không in APPLY_REFUSED {want} (log: {log.strip()[-200:]!r})")
        elif p.returncode == 0:
            errs.append(f"{name}: apply từ chối ({want}) nhưng bước '{step.get('name')}' thoát 0 dưới shell runner thật {' '.join(argv[:-1])!r} → job xanh, PR dữ liệu bị đóng thay vì báo lỗi")
        after = open(mo, "rb").read() if os.path.exists(mo) else None
        if after != before:
            errs.append(f"{name}: manual_overrides.json bị đổi")
if errs:
    for e in errs:
        print("FAIL " + e)
    sys.exit(1)
print(f"PASS bước apply đỏ khi apply từ chối (shell {' '.join(argv[:-1])})")
