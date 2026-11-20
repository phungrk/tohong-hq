"""T-217: phần dùng chung cho check_*.py. Ngoại tuyến (python bị chặn socket ở các bước chạy công cụ), không ghi .pyc, không sửa repo thật.
Repo: TOHONG_REPO / TOHONG_BACK_REPO (ADR-070: dò ngược tới scripts/gate.py, không đếm cấp thư mục). Nền dựng bản sao tạm bằng eval/lib/regen_fixture.py.
Tập S (spec T-217, mục Định nghĩa) được tính ở đây từ chính dữ liệu nguồn, KHÔNG đọc verification_status, nên cùng một phép đo đúng cả trước lẫn sau thay đổi."""
import json, os, subprocess, sys

sys.dont_write_bytecode = True
_d = os.path.dirname(os.path.abspath(__file__))
while _d != os.path.dirname(_d) and not os.path.isfile(os.path.join(_d, "scripts", "gate.py")):
    _d = os.path.dirname(_d)
HQ = _d
sys.path.insert(0, os.path.join(HQ, "eval", "lib"))
import regen_fixture as R  # noqa: E402

VENUE = "tools/scraper/output/HCMC/venue/vendors.json"
AUDIT = "tools/scraper/output/HCMC/venue/enrichment-audit.json"
BINH_QUOI_2 = "marry_b92e8a86175d"
Fail = R.Fail


def tohong():
    t, _ = R.repos(need_back=False)
    return t


def load(path):
    d = json.load(open(path, encoding="utf-8"))
    return d, (d["vendors"] if isinstance(d, dict) else d)


def last_ai(rec):
    rows = [e for e in rec.get("enrichment_log") or [] if isinstance(e, dict) and e.get("source") == "google_ai_mode"]
    return rows[-1] if rows else None


def temp_closed_ids(audit_path):
    """Đúng luật build_pool.temporarily_closed_ids: dòng audit mới nhất của vendor có closed_state=temporarily_closed, hoặc status=temporarily_closed cùng retry=true."""
    if not os.path.isfile(audit_path):
        return set()
    last = {}
    for r in json.load(open(audit_path, encoding="utf-8")):
        if isinstance(r, dict):
            last[r.get("vendor_id")] = r
    return {i for i, r in last.items() if r.get("closed_state") == "temporarily_closed"
            or (r.get("status") == "temporarily_closed" and r.get("retry") is True)}


def carries(row):
    ch = row.get("changes") if isinstance(row, dict) else None
    if not isinstance(ch, dict):
        return False
    d = ch.get("description")
    return (isinstance(d, str) and d.strip() != "") or "capacity_min" in ch or "capacity_max" in ch


def pool_venue_ids(root):
    """id mà pool dựng từ dữ liệu cùng cây xếp vào hạng mục venue. Đo bằng chính build_pool.py (chỉ đọc output/, ghi --out vào thư mục tạm, mạng bị chặn):
    vendor xuất hiện ở nhiều thư mục category có thể được gộp theo bản ghi của category khác; khi đó pool nhận mô tả/hạng mục của bản ghi kia."""
    import tempfile, shutil
    sc = os.path.join(root, "tools", "scraper")
    tmp = tempfile.mkdtemp(prefix="t217-bp-")
    try:
        nd = os.path.join(tmp, "nonet"); os.makedirs(nd)
        open(os.path.join(nd, "sitecustomize.py"), "w").write(R.NONET)
        env = dict(os.environ, PYTHONPATH=nd, PYTHONDONTWRITEBYTECODE="1", GOOGLE_MAPS_API_KEY="")
        out = os.path.join(tmp, "pool-vendors.json")
        p = subprocess.run([sys.executable, "build_pool.py", "--out", out], cwd=sc, env=env, capture_output=True, text=True, timeout=600)
        if p.returncode != 0 or not os.path.isfile(out):
            raise Fail("build_pool.py lỗi: " + (p.stderr or p.stdout)[-200:])
        d = json.load(open(out, encoding="utf-8"))
        vs = d["vendors"] if isinstance(d, dict) else d
        cats = ("photography", "venue", "decor", "attire", "makeup", "ceremony", "jewelry", "transport", "stationery", "honeymoon")
        return {v["id"] for v in vs if next((c for c in (v.get("categories") or []) if c in cats), None) == "venue"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def target_ids(root):
    """S: bản ghi trong HCMC/venue/vendors.json thoả CẢ BỐN: (1) có dòng google_ai_mode CUỐI mang description không rỗng hoặc khoá capacity_min/capacity_max;
    (2) id không thuộc vendor tạm đóng cửa (audit); (3) id khác Bình Quới 2; (4) pool xếp id đó vào hạng mục venue (xem pool_venue_ids).
    Trả (S theo thứ tự nguồn, mọi bản ghi)."""
    _, vs = load(os.path.join(root, VENUE))
    closed = temp_closed_ids(os.path.join(root, AUDIT))
    cand = [v["id"] for v in vs if v["id"] != BINH_QUOI_2 and v["id"] not in closed and carries(last_ai(v))]
    pv = pool_venue_ids(root)
    return [i for i in cand if i in pv], vs


def u16_cut(s, n):
    """JS String.prototype.slice(0, n): n đơn vị UTF-16."""
    b = s.encode("utf-16-le", "surrogatepass")[: 2 * n]
    return b.decode("utf-16-le", "surrogatepass")


def expected_capacity(rec, prev):
    """Sức chứa pool phải có (spec T-217, Hành vi 3). prev = capacity đang có trong pool nền."""
    mn, mx = rec.get("capacity_min"), rec.get("capacity_max")
    if mn is None and mx is None:
        return prev
    return {"min": 100 if mn is None else mn, "max": 300 if mx is None else mx}


def base_dir_for_diff(root):
    """Thư mục tạm chứa bản nền của vendors.json (merge-base của HEAD với origin/main hoặc main; T217_BASE_REF ghi đè). None nếu không dựng được."""
    ref = os.environ.get("T217_BASE_REF")
    cands = [ref] if ref else ["origin/main", "main"]
    for c in cands:
        p = subprocess.run(["git", "-C", root, "merge-base", "HEAD", c], capture_output=True, text=True)
        if p.returncode == 0 and p.stdout.strip():
            return p.stdout.strip()
    return None
