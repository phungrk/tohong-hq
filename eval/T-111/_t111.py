"""Helper dùng chung cho eval T-111 (enrich toàn bộ vendor, trần $30). KHÔNG eval nào gọi Google thật: mọi lệnh CLI chạy trong bản sao tools/scraper của repo
`tohong` (không có output/ thật), với Google GIẢ nạp qua PYTHONPATH (eval/T-111/_fake). Eval chạy ĐÚNG lệnh CLI mà spec định nghĩa, không gọi hàm nội bộ.
Dùng lại hạ tầng của T-110 (Root, fixture, place, vendor). Biến môi trường: TOHONG_REPO, TOHONG_BACK_REPO (chỉ check_1, check_9). In PASS hoặc FAIL <lý do>."""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-110"))
sys.path.insert(0, HERE)
import _t110 as t  # noqa: E402
from _short import short_name, fold  # noqa: E402

t.FAKE = os.path.join(HERE, "_fake")
fail, done, vendor, place = t.fail, t.done, t.vendor, t.place
MONTH = "2026-11"
TS_USD, PH_USD, FREE, MARGIN, CAP_MAX = 0.040, 0.007, 1000, 50, 30.0
ORDER = ["venue", "photography", "wedding_attire", "makeup", "flower", "wedding_interior", "ceremony", "invitation", "wedding_gift",
         "wedding_ring", "wedding_car", "honeymoon", "wedding_planner", "other"]
MATCHER_CATS = {"photography", "venue", "decor", "attire", "makeup", "ceremony", "jewelry", "transport", "stationery", "honeymoon"}


def enrich_all(cats="all", budget="30", basis=None, photos=2, extra=()):
    a = ["enrich.py", "--state", "HCMC", "--category", cats if isinstance(cats, str) else ",".join(cats), "--budget-usd", str(budget),
         "--max-photos", str(photos), "--usage-root", "run-logs", "--month", MONTH]
    if basis:
        a += ["--cap-basis", basis]
    return a + list(extra)


def net_usd(ts, ph, ts_used=0, ph_used=0, margin=MARGIN):
    return round(TS_USD * max(0, ts - max(0, FREE - ts_used - margin)) + PH_USD * max(0, ph - max(0, FREE - ph_used - margin)), 6)


def gross_usd(ts, ph):
    return round(TS_USD * ts + PH_USD * ph, 6)


def usage_logs(root, ts=0, details=0, media=0, baseline_photos=0, baseline_ts=0, name="T-106/20261108-040329-x.log"):
    """Ghi run-logs của tháng: một log với dòng GOOGLE_USAGE và usage-baseline.json (ghi chú tay của Capu, vd 606 request ảnh)."""
    d = os.path.join(root.path, "run-logs")
    os.makedirs(os.path.join(d, os.path.dirname(name)), exist_ok=True)
    open(os.path.join(d, name), "w").write("noise\nGOOGLE_USAGE text_search=%d photo_details=%d photo_media=%d\n" % (ts, details, media))
    json.dump({"month": MONTH, "text_search": baseline_ts, "photos": baseline_photos, "source": "Capu console (fixture)"},
              open(os.path.join(d, "usage-baseline.json"), "w"))


def kv(out, tag):
    """Mọi dòng bắt đầu bằng `tag` -> list dict {khoá: giá trị chuỗi}."""
    rows = []
    for l in out.splitlines():
        if l.startswith(tag + " ") or l == tag:
            rows.append(dict(re.findall(r"(\w+)=(\S+)", l)))
    return rows


def is_temp_closed(audit_row):
    """Đọc trạng thái tạm đóng cửa đúng định nghĩa T-110 (Hành vi 6): dòng audit có hiệu lực mang status temporarily_closed hoặc manual_override temporarily_closed.
    Nếu T-110 đổi tên trường, đổi MỘT chỗ này."""
    return bool(audit_row) and (audit_row.get("status") == "temporarily_closed" or audit_row.get("manual_override") == "temporarily_closed")


def search_rules(spec):
    """spec: list (match, ids[, absent[, status]]) -> luật search cho fixture."""
    out = []
    for r in spec:
        d = {"match": r[0], "ids": r[1]}
        if len(r) > 2 and r[2]:
            d["absent"] = r[2]
        if len(r) > 3 and r[3]:
            d["status"] = r[3]
        out.append(d)
    return out


def fx(places, rules, deny=False):
    f = t.fixture(places, (), None, deny)
    f["search"] = search_rules(rules)
    return f


def queries(calls):
    return [x["q"] for x in calls if x["kind"] == "search"]


def audit_all(r):
    out = {}
    for cat in os.listdir(r.out):
        for k, v in r.audit(cat).items():
            out[(cat, k)] = v
    return out


def gone_everywhere(r, vid):
    return all(not r.vendor(vid, c) for c in os.listdir(r.out) if os.path.isdir(r.p(c)) and r.read(os.path.join(c, "vendors.json")))


def locality(addr):
    for pat in [r"Quận\s*\d+", r"Q\d+", r"Thành phố Hồ Chí Minh", r"HCM", r"TP\.?HCM"]:
        m = re.search(pat, addr, re.I)
        if m:
            return m.group(0)
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    return parts[-1] if parts else ""


ADDR = "%d Lê Lợi, Quận 1, Thành phố Hồ Chí Minh"
GADDR = "%d Lê Lợi, Bến Thành, Hồ Chí Minh"


# ---------------------------------------------------------------------------------------------------------------------
# Kịch bản cơ bản: 8 vendor, 2 category file, đủ mọi nhánh của luật ADR-049. Dùng chung check_2, check_8, check_9, check_11.
# ---------------------------------------------------------------------------------------------------------------------
def V(i, name, n, cats=("venue",)):
    v = vendor(i, name, ADDR % n, cats)
    v["portfolio_urls"] = ["https://www.marry.vn/images/detailed/%s.jpg" % i]
    return v


def scenario_basic(parent=None):
    A = V("s_keep", "Nhà hàng Alpha Garden", 1)
    B = V("s_closed_perm", "Nhà hàng Bravo Old", 2)
    C = V("s_temp", "Nhà hàng Charlie Temp", 3)
    D = V("s_low", "Nhà hàng Delta Khac", 4)
    E = V("s_short_ok", "Nhà hàng Tiệc Cưới Echo Pearl", 5)
    F = V("s_gone", "Nhà hàng Foxtrot Moon (Quận 1)", 6, ("attire",))
    G = V("s_noshort", "Mai House", 7, ("attire",))
    Bb = dict(B)
    Bb["categories"] = ["attire"]
    files = {"venue": [A, B, C, D, E], "wedding_attire": [Bb, F, G]}
    PL = {"PA": place(A["name"], GADDR % 1, nphotos=3), "PB": place(B["name"], GADDR % 2, status="CLOSED_PERMANENTLY"),
          "PC": place(C["name"], GADDR % 3, status="CLOSED_TEMPORARILY"), "PD": place("Hoàn Toàn Khác Biệt", "99 Trần Hưng Đạo, Cô Giang, Hồ Chí Minh"),
          "PE": place(E["name"], GADDR % 5, nphotos=3)}
    RULES = [("alpha garden", ["PA"]), ("bravo old", ["PB"]), ("charlie temp", ["PC"]), ("delta khac", ["PD"]), ("echo pearl", ["PE"], "tiec cuoi")]
    r = t.Root(files, parent=parent)
    return r, fx(PL, RULES), PL, RULES


def run_basic(r, FX, **kw):
    return r.run(enrich_all(["venue", "wedding_attire"], **kw), FX)


def count_for(calls, key):
    k = fold(key)
    return sum(1 for q in queries(calls) if k in fold(q))
