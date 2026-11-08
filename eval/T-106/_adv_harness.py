"""Harness chung cho eval đối kháng T-106 chạy enrich.py thật trên thư mục output tạm (adversary, Code Gate T-108).
HTTP giả: Text Search trả theo tên vendor trong bảng `places`; mọi GET (geocode, ảnh) bị chặn. KHÔNG gọi Google."""
import atexit, contextlib, io, json, os, shutil, sys, tempfile
from pathlib import Path
from unittest import mock

import _common as c

S = os.path.join(c.tohong(), "tools", "scraper")
if S not in sys.path:
    sys.path.insert(0, S)
import enrich  # noqa: E402


class R:
    status_code = 200

    def __init__(self, b):
        self.b, self.text = b, json.dumps(b)

    def json(self):
        return self.b


def vendor(i, name, addr, cats=("venue",)):
    return {"id": i, "name": name, "categories": list(cats), "city": "HCMC", "latitude": 10.77, "longitude": 106.7,
            "contact": {"address": addr}, "enrichment_log": [], "reviews": []}


def place(pid, name, addr, status=None):
    p = {"id": pid, "displayName": {"text": name}, "formattedAddress": addr}
    if status:
        p["businessStatus"] = status
    return p


def make_root(files):
    """files: {category: [vendor,...]} -> thư mục tạm có output/HCMC/<category>/vendors.json."""
    root = Path(tempfile.mkdtemp(prefix="adv-t106-"))
    atexit.register(shutil.rmtree, root, True)
    for cat, vs in files.items():
        d = root / "output" / "HCMC" / cat
        d.mkdir(parents=True)
        (d / "vendors.json").write_text(json.dumps({"vendors": vs}, ensure_ascii=False), encoding="utf-8")
    return root


def run_enrich(root, places, args=("--state", "HCMC", "--category", "venue", "--budget", "5.0")):
    """Chạy enrich.main() như workflow enrich-venue (mặc định --category venue). places: {tên vendor: [place,...]}.
    Trả (exit code, stdout, số lượt Text Search)."""
    calls = []

    def post(url, json=None, **kw):  # noqa: A002
        q = (json or {}).get("textQuery", "")
        calls.append(q)
        for name, ps in places.items():
            if name in q:
                return R({"places": ps})
        return R({"places": []})

    def get(*a, **kw):
        raise AssertionError("eval không cho phép GET (geocode/ảnh): %r" % (a[:1],))

    out = io.StringIO()
    with mock.patch.object(enrich, "SCRIPT_DIR", root), mock.patch.object(enrich, "OUTPUT_DIR", root / "output"), \
            mock.patch("enrichment.google_maps.requests.post", side_effect=post), \
            mock.patch("requests.get", side_effect=get), \
            mock.patch.dict(os.environ, {"GOOGLE_MAPS_API_KEY": "fake-not-a-key"}), \
            mock.patch.object(sys, "argv", ["enrich.py", *args]), contextlib.redirect_stdout(out):
        rc = enrich.main()
    return rc, out.getvalue(), calls


def vendors_in(root, cat):
    p = root / "output" / "HCMC" / cat / "vendors.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    return d.get("vendors", d) if isinstance(d, dict) else d


def all_ids(root):
    out = {}
    for p in sorted((root / "output" / "HCMC").glob("*/vendors.json")):
        for v in vendors_in(root, p.parent.name):
            out.setdefault(v["id"], []).append(p.parent.name)
    return out


def removed(root):
    out = []
    for p in sorted((root / "output" / "HCMC").glob("*/removed_vendors.json")):
        for r in json.loads(p.read_text(encoding="utf-8")):
            out.append((p.parent.name, (r.get("vendor") or {}).get("id")))
    return out


def audit(root, cat="venue"):
    p = root / "output" / "HCMC" / cat / "enrichment-audit.json"
    return {r.get("vendor_id"): r for r in json.loads(p.read_text(encoding="utf-8"))} if p.exists() else {}


def review_ids(root, cat="venue"):
    import csv
    p = root / "output" / "HCMC" / cat / "review-needed.csv"
    if not p.exists():
        return {}
    return {(r.get("id") or "").strip(): r for r in csv.DictReader(open(p, encoding="utf-8-sig", newline=""))}
