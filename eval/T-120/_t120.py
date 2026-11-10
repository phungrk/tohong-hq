"""Helper dùng chung cho eval T-120 (nới luật nhận khớp Google cho vendor ngoài venue: tên gần tuyệt đối + cùng TP.HCM; địa chỉ theo Google).
KHÔNG eval nào gọi Google thật: mọi lệnh CLI chạy trong bản sao tools/scraper của repo `tohong` (không có output/ thật), với Google GIẢ
(eval/T-111/_fake) nạp qua PYTHONPATH. Eval chạy ĐÚNG lệnh CLI mà spec định nghĩa, không gọi hàm nội bộ.
Dữ liệu thật: eval/T-120/audit_snapshot.json (664 vendor bị cần-duyệt của run 42635049304, tohong@a682fc3; không do code sinh).
Biến môi trường: TOHONG_REPO (repo tohong). Mỗi eval in PASS hoặc FAIL <lý do>; thoát 0/1. Thiếu cài đặt thì FAIL, không ERROR."""
import json, os, re, sys, unicodedata
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(HQ, "eval", "T-111"))
sys.path.insert(0, HERE)
import _t111 as x  # noqa: E402  (dùng lại hạ tầng T-110/T-111: Root, Google giả, enrich_all, usage_logs)

t = x.t
c = t.c  # eval/T-106/_common.py: in_province, shared_place_id_groups, address_match, reject_reason (hàm chuẩn sáu cổng, KHÔNG đổi)
MONTH = x.MONTH
THRESHOLD = 0.95                      # ngưỡng "tên gần tuyệt đối" (spec T-120, Hành vi 1)
RECHECK_FLAG = "--recheck-name-match"  # cờ CLI mà spec T-120 định nghĩa (Hành vi 4)
ELIGIBLE_REASONS = ("address_conflict", "address_unconfirmed")
DIR_CATEGORY = {"venue": "venue", "photography": "photography", "wedding_attire": "attire", "makeup": "makeup", "flower": "decor", "wedding_interior": "decor",
                "ceremony": "ceremony", "invitation": "stationery", "wedding_gift": "stationery", "wedding_ring": "jewelry", "wedding_car": "transport",
                "honeymoon": "honeymoon"}
ORDER = [k for k in x.ORDER if k in DIR_CATEGORY]


def norm(s):
    """Chuẩn hoá tên: cùng phép đo với pipeline hôm nay (bỏ dấu qua NFD, đ bị bỏ, chỉ giữ a-z0-9 và dấu cách)."""
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9 ]", "", s).strip()


def name_sim(a, b):
    return round(SequenceMatcher(None, norm(a), norm(b)).ratio(), 3)


def digit_seq(s):
    return re.findall(r"\d+", norm(s))


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(ch for ch in s if unicodedata.category(ch) != "Mn")).strip()


def name_rule(name, matched, gaddr, conf=None):
    """Hàm chuẩn của luật mới (spec T-120 Hành vi 1, N1-N3), chỉ phần xét MỘT ứng viên: độ giống tên >= 0,95, cùng TP.HCM (G2 của T-106), cùng dãy chữ số trong tên."""
    s = name_sim(name, matched) if conf is None else conf
    return s >= THRESHOLD - 1e-9 and c.in_province(gaddr) and digit_seq(name) == digit_seq(matched)


def load_rows():
    return json.load(open(os.path.join(HERE, "audit_snapshot.json"), encoding="utf-8"))["rows"]


def is_venue_row(r):
    return r["cat"] == "venue" or "venue" in r.get("cats", [])


def ref_eligible(rows):
    """Tập (vendor_id) mà luật mới cho phép hỏi lại Google: lý do từ chối là address_conflict/address_unconfirmed, không phải venue, qua N1-N3, rồi trừ nhóm G6 tính OFFLINE
    trên place_id ứng viên đã lưu (hai vendor khác địa chỉ gốc chung place_id thì cả hai bị loại)."""
    cand = [r for r in rows if not is_venue_row(r) and r["reason"] in ELIGIBLE_REASONS and name_rule(r["name"], r["matched"], r["gaddr"], r["conf"])]
    g6 = c.shared_place_id_groups([(r["id"], r["pid"], r["src"]) for r in cand])
    return [r for r in cand if r["id"] not in g6], cand


def seed_rows(rows):
    """Bỏ vendor cùng tên (đã chuẩn hoá) nhưng khác place_id ứng viên với vendor khác (Google giả khớp theo tên nên không phân biệt được); giữ dòng có conf cao nhất."""
    by = {}
    for r in rows:
        by.setdefault(fold(r["name"]), []).append(r)
    drop = set()
    for g in by.values():
        if len({r["pid"] for r in g}) > 1:
            keep = max(g, key=lambda r: r["conf"])
            drop |= {r["id"] for r in g if r is not keep}
    return [r for r in rows if r["id"] not in drop], sorted(drop)


def row_cats(r):
    """Mọi category file có id này (dữ liệu thật: 38/639 vendor nằm ở 2-3 file; 4/49 vendor được nhận)."""
    return [k for k in ORDER if k in (r.get("cats") or [r["cat"]])] or [r["cat"]]


def first_cat(r):
    return row_cats(r)[0]


def vendor_of(r, cat=None):
    cat = cat or r["cat"]
    return t.vendor(r["id"], r["name"], r["src"], (DIR_CATEGORY[cat],))


def build_files(rows):
    files = {}
    for r in rows:
        for cat in row_cats(r):
            files.setdefault(cat, []).append(vendor_of(r, cat))
    return files


def records(root, vid):
    """[(category, bản ghi vendor, dòng audit có hiệu lực)] ở MỌI category file có id."""
    out = []
    for cat in sorted(os.listdir(root.out)):
        if os.path.isdir(root.p(cat)):
            v = root.vendor(vid, cat)
            if v:
                out.append((cat, v, (root.audit(cat) or {}).get(vid)))
    return out


def build_fixture(rows, extra_places=None, extra_rules=()):
    places, rules = {}, []
    for r in sorted(rows, key=lambda r: -len(fold(r["name"]))):
        places[r["pid"]] = t.place(r["matched"], r["gaddr"], pid=r["pid"], nphotos=3)
        rules.append((fold(r["name"]), [r["pid"]]))
    places.update(extra_places or {})
    return x.fx(places, list(extra_rules) + rules)


def cats_arg(rows):
    present = {k for r in rows for k in row_cats(r)}
    return [k for k in ORDER if k in present]


def make_root(rows, parent=None):
    r = t.Root(build_files(rows), parent=parent)
    x.usage_logs(r, ts=0, details=0, media=0, baseline_photos=0, baseline_ts=0)
    return r


def baseline_run(root, FX, rows, budget="30"):
    """Bước 0 (đối chứng): chạy luật HIỆN HÀNH (sáu cổng) để dựng trạng thái 'sau run 42635049304': mọi vendor bị từ chối đúng lý do đã ghi trong dữ liệu thật."""
    return root.run(x.enrich_all(cats_arg(rows), budget=budget), FX, timeout=900)


def recheck_argv(rows, budget="30", extra=()):
    return x.enrich_all(cats_arg(rows), budget=budget, extra=[RECHECK_FLAG] + list(extra))


def all_audit(root):
    return x.audit_all(root)


def find_vendor(root, vid):
    for cat in os.listdir(root.out):
        if os.path.isdir(root.p(cat)):
            v = root.vendor(vid, cat)
            if v:
                return v, cat
    return None, None


def prepare(parent=None):
    """Dựng gốc tạm từ snapshot và chạy bước 0. Trả (root, rows_seeded, FX, dropped). FAIL nếu đối chứng không tái hiện dữ liệu thật."""
    rows, dropped = seed_rows(load_rows())
    root = make_root(rows, parent=parent)
    FX = build_fixture(rows)
    rc, out, calls = baseline_run(root, FX, rows)
    if rc != 0:
        t.fail("fixture hỏng (đối chứng): luật hiện hành thoát %d: %s" % (rc, (out.strip().splitlines() or [""])[-1][:160]))
    au = all_audit(root)
    wrong = []
    for r in rows:
        a = next((au[(k, r["id"])] for k in row_cats(r) if (k, r["id"]) in au), {})
        if a.get("status") != "low_confidence" or a.get("reject_reason") != r["reason"] or abs((a.get("confidence") or 0) - r["conf"]) > 0.0006:
            wrong.append((r["id"][-6:], a.get("status"), a.get("reject_reason"), r["reason"]))
    if len(wrong) > 8:   # dung sai nhỏ: vài vendor có thể lệch vì G4/G6 chéo giữa các vendor trong fixture
        t.fail("fixture hỏng (đối chứng): %d/%d vendor không tái hiện lý do từ chối của dữ liệu thật, vd %r" % (len(wrong), len(rows), wrong[:3]))
    return root, rows, FX, dropped
