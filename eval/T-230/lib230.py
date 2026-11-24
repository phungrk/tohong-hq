"""Khung chung cho eval T-230 (không phải eval). Dựng bản sao tạm tohong + tohong-back bằng eval/lib/regen_fixture.py (không mạng, không chạm repo thật),
đặt `ai_mode_result` trên bản ghi nguồn, chạy bước 6 (tools/regen-pool-styles.sh, đường production) và đọc pool sinh ra.
Repo: TOHONG_REPO (mặc định ../tohong), TOHONG_BACK_REPO (mặc định ../tohong-back). Chạy: python3 -I <check>."""
import collections, json, os, subprocess, sys
sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
HQ = _d
sys.path.insert(0, os.path.join(HQ, "eval", "lib"))
import regen_fixture as R  # noqa: E402

Fail = R.Fail
MISSING = object()


def build(prepare=None, full_back=False):
    return R.build(prepare=prepare, full_back=full_back)


def counts(fx):
    return collections.Counter(v["id"] for _, v in fx.records())


def picks(fx, n_single=3):
    """Vendor đang có trong pool nền, chọn tất định theo id: `single` = có đúng 1 bản ghi nguồn, `multi` = có >= 2 bản ghi (nhiều hạng mục)."""
    pool, c = fx.pool(), counts(fx)
    single = sorted(i for i in pool if c.get(i) == 1)
    multi = sorted(i for i in pool if c.get(i, 0) >= 2)
    if len(single) < n_single or not multi:
        raise Fail(f"dữ liệu không đủ vendor để thử (single={len(single)}, multi={len(multi)})")
    return single[:n_single], multi[0]


def set_field(fx, vid, value, only_first=False, log_only=False):
    """Đặt ai_mode_result trên bản ghi nguồn của vid (mọi file, hoặc chỉ bản ghi đầu). value=MISSING thì xoá khoá.
    log_only: không đặt khoá cấp vendor, chỉ thêm một dòng enrichment_log google_ai_mode có changes.ai_mode_result."""
    done = 0
    for f in fx.source_files():
        d = json.load(open(f, encoding="utf-8"))
        vs = d["vendors"] if isinstance(d, dict) else d
        hit = False
        for v in vs:
            if v.get("id") != vid or (only_first and done):
                continue
            if log_only:
                v.setdefault("enrichment_log", []).append({"source": "google_ai_mode", "timestamp": "2026-11-24T00:00:00Z", "changes": {"ai_mode_result": value}})
            elif value is MISSING:
                v.pop("ai_mode_result", None)
            else:
                v["ai_mode_result"] = value
            done += 1
            hit = True
        if hit:
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    if not done:
        raise Fail(f"không thấy bản ghi nguồn của {vid}")
    return done


def drop_from_base_pool(fx, ids):
    """Bỏ các id khỏi pool nền (giả lập vendor mới, chưa từng vào pool)."""
    p = fx.pool_file()
    s = open(p, encoding="utf-8").read()
    i, j = s.index("= [") + 2, s.rindex("]") + 1
    arr = [v for v in json.loads(s[i:j]) if v["id"] not in set(ids)]
    open(p, "w", encoding="utf-8").write(s[:i] + json.dumps(arr, ensure_ascii=False, indent=2) + s[j:])


def report(fx):
    """Sinh lại enrich-report.json như PR dữ liệu phải làm (INV-003); trả (bytes, dict)."""
    sc = os.path.join(fx.tohong, "tools", "scraper")
    p = subprocess.run([sys.executable, "build_enrich_report.py", "--state", "HCMC", "--output-dir", "output"], cwd=sc, env=fx.env,
                       capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        raise Fail("build_enrich_report.py lỗi: " + (p.stderr or p.stdout)[-300:])
    path = os.path.join(sc, "output", "HCMC", "enrich-report.json")
    b = open(path, "rb").read()
    return b, json.loads(b)


def run(fn):
    R.main_guard(fn)
