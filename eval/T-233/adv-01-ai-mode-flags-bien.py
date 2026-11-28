"""T-233 đối kháng 01 (adversary). Spec T-232 Hành vi 2 và 5: `ai_mode_flags.py count|check`.
Dựng một repo git tạm (không chạm repo thật), chép ai_mode_flags.py của TOHONG_REPO vào, chạy ở tools/scraper. Mong đợi:
A. `check --base <ref không tồn tại>` khi có bản ghi đổi cờ và đổi verification_status mà không ghi log: KHÔNG được in AI_MODE_FLAGS_OK và thoát khác 0
   (công cụ kiểm không được báo sạch khi không kiểm được điều được yêu cầu; ref đúng thì báo status_changed).
B. Giá trị " found", "Found", "", 1, true: mỗi cái một invalid_value, thoát 1; count đếm invalid=5.
C. Miễn trừ có reason chỉ toàn khoảng trắng: không có tác dụng; miễn trừ cho id không tồn tại: không lỗi, không tác dụng; file miễn trừ hỏng JSON: không in OK, thoát khác 0.
D. count trên hạng mục không có cờ: mọi khoá 0 trừ empty = số bản ghi.
E. --base hợp lệ, file chưa có ở nền: không status_changed.
F. Sau mọi lần chạy: git status sạch (công cụ không ghi gì).
Chạy: TOHONG_REPO=<checkout nhánh> python3 -I eval/T-233/adv-01-ai-mode-flags-bien.py"""
import json, os, shutil, subprocess, sys, tempfile
HQ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOHONG = os.environ.get("TOHONG_REPO") or os.path.join(os.path.dirname(HQ), "tohong")
SRC = os.path.join(TOHONG, "tools", "scraper", "ai_mode_flags.py")
if not os.path.isfile(SRC):
    print("FAIL không thấy tools/scraper/ai_mode_flags.py trong TOHONG_REPO"); sys.exit(1)
fails = []
def check(ok, msg):
    print(("  ok " if ok else "  XX ") + msg)
    if not ok: fails.append(msg)
def log(**ch): return [{"source": "google_ai_mode", "timestamp": "2026-11-28T00:00:00Z", "changes": ch}]
def rec(i, flag=None, status="auto_scraped", lg=None):
    v = {"id": i, "name": i, "verification_status": status, "enrichment_log": lg or []}
    if flag is not None: v["ai_mode_result"] = flag
    return v

tmp = tempfile.mkdtemp(prefix="t233adv-")
try:
    sc = os.path.join(tmp, "tools", "scraper"); os.makedirs(sc)
    shutil.copy(SRC, sc)
    ex = os.path.join(sc, "ai_mode_flags_exempt.json")
    def put_ex(obj): open(ex, "w").write(obj if isinstance(obj, str) else json.dumps(obj))
    put_ex({"exempt": []})
    def put(cat, vs):
        d = os.path.join(sc, "output", "HCMC", cat); os.makedirs(d, exist_ok=True)
        json.dump({"vendors": vs}, open(os.path.join(d, "vendors.json"), "w"), ensure_ascii=False)
    git = lambda *a: subprocess.run(["git", "-c", "user.email=a@b", "-c", "user.name=adv", *a], cwd=tmp, capture_output=True, text=True)
    git("init", "-q"); put("venue", [rec("v1"), rec("v2")]); put("noflag", [rec("n1"), rec("n2"), rec("n3")])
    git("add", "-A"); git("commit", "-qm", "base")
    def run(*a):
        p = subprocess.run([sys.executable, "-I", "ai_mode_flags.py", *a], cwd=sc, capture_output=True, text=True)
        return p.returncode, p.stdout + p.stderr
    # A: đổi cờ + đổi trạng thái không ghi log trạng thái
    put("venue", [rec("v1", "not_found", "needs_review", log(ai_mode_result="not_found")), rec("v2")])
    git("add", "-A"); git("commit", "-qm", "pr")
    code, out = run("check", "--base", "HEAD~1")
    check(code == 1 and "status_changed venue v1" in out, f"A ref đúng: status_changed, thoát 1 ({code})")
    code, out = run("check", "--base", "origin/khong-ton-tai")
    check(code != 0 and "AI_MODE_FLAGS_OK" not in out, f"A ref không tồn tại: không báo OK, thoát khác 0 (thoát {code}, {out.strip()[:80]!r})")
    # E: file mới chưa có ở nền
    put("newcat", [rec("x1", "found", lg=log(ai_mode_result="found"))]); git("add", "-A"); git("commit", "-qm", "new")
    code, out = run("check", "--base", "HEAD~1")
    check("status_changed newcat" not in out, "E file mới ở nền: không status_changed")
    # B: giá trị lạ
    put("odd", [rec(f"o{i}", val, lg=log(ai_mode_result=val)) for i, val in enumerate([" found", "Found", "", 1, True])])
    code, out = run("check")
    check(code == 1 and out.count("invalid_value odd") == 5, f"B 5 giá trị lạ: 5 invalid_value ({out.count('invalid_value odd')})")
    code, out = run("count"); c = json.loads(out[: out.rindex("}") + 1])
    check(c.get("odd", {}).get("invalid") == 5 and sum(c["odd"].values()) == 5, f"B count odd invalid=5 ({c.get('odd')})")
    # D: hạng mục không có cờ
    check(c.get("noflag") == {"found": 0, "not_found": 0, "address_mismatch": 0, "wrong_category": 0, "empty": 3, "invalid": 0}, f"D count noflag ({c.get('noflag')})")
    # C: miễn trừ
    put_ex({"exempt": [{"category": "odd", "id": "o0", "rule": "invalid_value", "reason": "   "}, {"category": "odd", "id": "khong-co", "rule": "invalid_value", "reason": "x"}]})
    code, out = run("check")
    check(code == 1 and "AI_MODE_FLAG_VIOLATION invalid_value odd o0" in out and "Traceback" not in out, "C reason toàn khoảng trắng: không miễn; id không tồn tại: không lỗi")
    put_ex('{"exempt": [ hỏng')
    code, out = run("check")
    check(code != 0 and "AI_MODE_FLAGS_OK" not in out, f"C file miễn trừ hỏng: không báo OK (thoát {code})")
    put_ex({"exempt": []})
    # F: công cụ không ghi gì (so với cây sau lần ghi cuối của eval)
    git("add", "-A"); git("commit", "-qm", "snap"); run("check"); run("count"); run("check", "--base", "HEAD~1")
    st = git("status", "--porcelain").stdout.strip()
    check(st == "", f"F git status sạch sau khi chạy ({st[:80]!r})")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print("FAIL " + "; ".join(fails)); sys.exit(1)
print("PASS")
