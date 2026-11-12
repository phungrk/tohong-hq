#!/usr/bin/env python3
"""Đề xuất SỬA INV-020 (T-129, ADR-065, ADR-066). Bản đầy đủ thay file eval/invariants/planner/vendor/images/inv-020-duyet-tay-co-quyet-dinh-cua-capu.py khi Capu duyệt spec và Chief of Staff ghi decisions/.
INV-020 v2 · Mọi mục duyệt tay có quyết định HỢP LỆ của Capu, từ một trong HAI nguồn (giữ nguyên mọi ràng buộc khác của v1):
  (A) như v1: `decision` là đường dẫn decisions/<tên>.md, sau realpath nằm trong <HQ>/decisions/, frontmatter có `decided_by: capu`, nội dung nhắc vendor_id.
  (B) cú bấm của Capu trên trang admin, có CHỮ KÝ kiểm được offline (ADR-066): `decision` = `admin-review:<key_id>:<label>@<reviewed_at>:<sig>`; back ký Ed25519 từng entry export bằng khoá bí mật của Worker;
      khoá công khai do Capu duyệt, ghi ở dòng `capu_signing_keys: k1=<base64 32 byte>[, k2=…]` trong frontmatter của MỘT file <HQ>/decisions/ có `decided_by: capu`. Hợp lệ khi:
      (1) key_id nằm trong các khoá đó; (2) chữ ký đúng trên (key_id, vendor_id, action, place_id, maps_link, reason gốc, label, reviewed_at) (định dạng ở eval/lib/capu_decision.py);
      (3) `reason` kết thúc đúng `[duyệt qua admin: <label>, <reviewed_at>]`; (4) approved_by = capu; (5) approved_on = ngày (UTC) của reviewed_at.
      Nhãn băm KHÔNG còn là bằng chứng: đổi tài khoản Clerk của Capu không cần ADR; chỉ đổi/xoay khoá ký mới cần ADR.
  Nếu repo tohong có tools/scraper/admin_review_keys.json: mọi key_id trong đó phải có trong ADR với đúng giá trị (tohong không giữ khoá lạ).
  Thêm (mọi nguồn): không trường nào của mục (kể cả reason) chứa Clerk user id thô (mẫu `user_` + >= 10 ký tự chữ-số).
Lý do: ADR-065 "bấm approve tính là anh đã quyết"; ADR-066: giữ tính chất "không agent nào tự thêm mục được" bằng chữ ký mà agent không có khoá bí mật để tạo; chép nhãn công khai hay tự viết reason không đủ.
GIỚI HẠN: ai giữ khoá bí mật Worker thì ký được; khoá bị lộ phải do Capu quyết ngoài bất biến (ADR thu hồi). Bất biến chỉ nói "mục này do Worker của Capu ký", không nói người nào bấm.
Chưa có repo tohong hoặc manual_overrides.json: PASS 'chưa áp dụng'. Cần thư viện cryptography. Không gọi Google.
Chạy không tham số (gate.py: python3 -I). In PASS hoặc FAIL <lý do>. Mã thoát 0 = đạt, 1 = vi phạm."""
import json, os, re, sys


def _hq():
    d = os.path.dirname(os.path.abspath(__file__))
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, "decisions")) and os.path.isdir(os.path.join(d, "eval")):
            return d
        d = os.path.dirname(d)
    return None


HQ = _hq()
if not HQ:
    print("FAIL không tìm thấy gốc HQ (thư mục có decisions/ và eval/)"); sys.exit(1)
DEC = os.path.realpath(os.path.join(HQ, "decisions"))
t = next((os.path.abspath(x) for x in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong"))
          if x and os.path.isfile(os.path.join(x, "tools", "scraper", "enrich.py"))), None)
fp = t and os.path.join(t, "tools", "scraper", "output", "HCMC", "manual_overrides.json")
if not fp or not os.path.isfile(fp):
    print("PASS chưa áp dụng (chưa có repo tohong hoặc manual_overrides.json)"); sys.exit(0)
try:
    doc = json.load(open(fp, encoding="utf-8"))
except ValueError as e:
    print("FAIL manual_overrides.json không phải JSON: %s" % e); sys.exit(1)
if not isinstance(doc, dict):
    print("FAIL manual_overrides.json không phải object"); sys.exit(1)
bad, seen = [], set()
if doc.get("schema_version") != 1:
    bad.append("schema_version=%r (mong 1)" % doc.get("schema_version"))
ov = doc.get("overrides")
if not isinstance(ov, list):
    bad.append("overrides không phải danh sách"); ov = []

RAW_ID = re.compile(r"user_[A-Za-z0-9]{10,}")


def frontmatter(txt):
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", txt, re.S)
    return m.group(1) if m else ""


def read_dec(path):
    """Nội dung file quyết định nếu nằm thật trong <HQ>/decisions/, ngược lại None."""
    p = os.path.realpath(path)
    if not p.startswith(DEC + os.sep) or not os.path.isfile(p):
        return None
    return open(p, encoding="utf-8").read()


def load_helper():
    import importlib.util
    for rel in (("eval", "lib", "capu_decision.py"), ("eval", "T-129", "capu_decision.py")):
        f = os.path.join(HQ, *rel)
        if os.path.isfile(f):
            sp = importlib.util.spec_from_file_location("capu_decision", f); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
    print("FAIL thiếu eval/lib/capu_decision.py (định nghĩa chuẩn chữ ký Capu)"); sys.exit(1)


try:
    CD = load_helper()
    KEYS = CD.hq_keys(HQ)
    import cryptography  # noqa: F401
except ImportError:
    print("FAIL thiếu thư viện cryptography (bất biến kiểm chữ ký)"); sys.exit(1)
except ValueError as ex:
    print("FAIL %s" % ex); sys.exit(1)
kf = os.path.join(t, "tools", "scraper", "admin_review_keys.json")
if os.path.isfile(kf):
    try:
        for k, v in (json.load(open(kf, encoding="utf-8")).get("keys") or {}).items():
            if KEYS.get(k) != v:
                bad.append("admin_review_keys.json có khoá %s không khớp ADR của Capu" % k)
    except (ValueError, AttributeError) as ex:
        bad.append("admin_review_keys.json hỏng: %s" % ex)

for e in ov:
    if not isinstance(e, dict):
        bad.append("mục không phải object: %r" % (e,)); continue
    v = e.get("vendor_id")
    if not v or v in seen:
        bad.append("vendor_id thiếu hoặc trùng: %r" % v)
    seen.add(v)
    if e.get("action") not in ("accept_place", "remove", "temporarily_closed", "reject_match"):
        bad.append("%s: action %r" % (v, e.get("action")))
    if not str(e.get("reason") or "").strip():
        bad.append("%s: thiếu reason" % v)
    if e.get("approved_by") != "capu":
        bad.append("%s: approved_by=%r (chỉ 'capu')" % (v, e.get("approved_by")))
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(e.get("approved_on") or "")):
        bad.append("%s: approved_on=%r" % (v, e.get("approved_on")))
    if RAW_ID.search(json.dumps(e, ensure_ascii=False)):
        bad.append("%s: mục chứa Clerk user id thô (chỉ được nhãn băm admin:<8 hex>)" % v)
    dec = str(e.get("decision") or "")
    if dec.startswith("admin-review:"):  # nguồn (B)
        ok, why = CD.check_entry(e, KEYS)
        if not ok:
            bad.append("%s: %s" % (v, why))
        continue
    p = os.path.join(HQ, dec) if dec and not os.path.isabs(dec) else ""  # nguồn (A), như v1
    txt = read_dec(p) if p else None
    if txt is None:
        bad.append("%s: decision %r không phải file trong decisions/ của HQ" % (v, dec)); continue
    if not re.search(r"^decided_by:\s*capu\s*$", frontmatter(txt), re.M):
        bad.append("%s: %s không có decided_by: capu ở frontmatter" % (v, dec))
    elif str(v) not in txt:
        bad.append("%s: %s không nhắc vendor_id" % (v, dec))
if bad:
    print("FAIL %d vi phạm, vd %s" % (len(bad), bad[0])); sys.exit(1)
print("PASS %d mục duyệt tay đều hợp schema và có quyết định của Capu (file decisions/ hoặc cú bấm của Capu có chữ ký hợp lệ)" % len(seen)); sys.exit(0)
