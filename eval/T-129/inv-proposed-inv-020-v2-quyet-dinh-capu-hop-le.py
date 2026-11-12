#!/usr/bin/env python3
"""Đề xuất SỬA INV-020 (T-129, ADR-065). Bản đầy đủ thay file eval/invariants/planner/vendor/images/inv-020-duyet-tay-co-quyet-dinh-cua-capu.py khi Capu duyệt spec và Chief of Staff ghi decisions/.
INV-020 v2 · Mọi mục duyệt tay có quyết định HỢP LỆ của Capu, từ một trong HAI nguồn (giữ nguyên mọi ràng buộc khác của v1):
  (A) như v1: `decision` là đường dẫn decisions/<tên>.md, sau realpath nằm trong <HQ>/decisions/, frontmatter có `decided_by: capu`, nội dung nhắc vendor_id.
  (B) cú bấm của Capu trên trang admin (ADR-065): `decision` = `admin-review:<label>@<reviewed_at>` với
        label        = admin:<8 hex> (8 ký tự đầu của sha256(Clerk user id), không bao giờ là id thô);
        reviewed_at  = thời điểm UTC của cú bấm, dạng YYYY-MM-DDTHH:MM:SS[.fff]Z;
      và đồng thời: (1) label nằm trong `capu_admin_labels:` ở frontmatter của MỘT file decisions/ (realpath trong <HQ>/decisions/) có `decided_by: capu`
      (danh sách người được coi là Capu do Capu chốt, Chief of Staff ghi; ví dụ `capu_admin_labels: admin:1a2b3c4d`; nhiều nhãn cách nhau dấu phẩy);
      (2) `reason` kết thúc đúng bằng `[duyệt qua admin: <label>, <reviewed_at>]` (cùng label, cùng reviewed_at với `decision`: dấu vết kiểm được, tra nhật ký admin bằng băm id);
      (3) approved_on (YYYY-MM-DD) không sớm hơn ngày của reviewed_at.
  Thêm (mọi nguồn): không trường nào của mục (kể cả reason) chứa Clerk user id thô (mẫu `user_` + >= 10 ký tự chữ-số): id thô không được vào lịch sử git của tohong.
Lý do: ADR-065 "bấm approve tính là anh đã quyết". Nguồn (B) vẫn truy được về Capu: nhãn phải do Capu chốt trong decisions/, dấu thời gian khớp nhật ký admin, mục chỉ do apply_admin_reviews.py sinh từ export chỉ chứa review của Capu.
GIỚI HẠN (nói thẳng): bất biến chạy offline nên chứng minh được TRUY VẾT và NHẤT QUÁN, không chứng minh được cú bấm có thật; phần đó do back (chỉ đánh dấu by_capu theo token, không nhận từ thân yêu cầu), apply (từ chối mục không by_capu) và việc Capu tự merge PR bậc C bảo đảm.
Chưa có repo tohong hoặc manual_overrides.json: PASS 'chưa áp dụng'. Không gọi Google.
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

ADMIN_DEC = re.compile(r"^admin-review:(admin:[0-9a-f]{8})@(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$")
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


def capu_labels():
    out = set()
    for name in sorted(os.listdir(DEC)):
        if not name.endswith(".md"):
            continue
        txt = read_dec(os.path.join(DEC, name))
        fm = frontmatter(txt or "")
        if not re.search(r"^decided_by:\s*capu\s*$", fm, re.M):
            continue
        for m in re.finditer(r"^capu_admin_labels:\s*(.+?)\s*$", fm, re.M):
            out.update(re.findall(r"admin:[0-9a-f]{8}", m.group(1)))
    return out


LABELS = capu_labels()

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
    am = ADMIN_DEC.fullmatch(dec)
    if am:  # nguồn (B)
        label, day = am.group(1), am.group(2)
        at = dec.split("@", 1)[1]
        if label not in LABELS:
            bad.append("%s: nhãn %s không nằm trong capu_admin_labels của file decisions/ nào có decided_by: capu" % (v, label))
        elif not str(e.get("reason") or "").endswith("[duyệt qua admin: %s, %s]" % (label, at)):
            bad.append("%s: reason không kết thúc bằng [duyệt qua admin: %s, %s]" % (v, label, at))
        elif str(e.get("approved_on") or "") < day:
            bad.append("%s: approved_on %s sớm hơn ngày bấm %s" % (v, e.get("approved_on"), day))
        continue
    if dec.startswith("admin-review:"):
        bad.append("%s: decision %r sai dạng admin-review:<admin:8hex>@<ISO UTC>" % (v, dec)); continue
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
print("PASS %d mục duyệt tay đều hợp schema và có quyết định của Capu (file decisions/ hoặc cú bấm của Capu có nhãn do Capu chốt)" % len(seen)); sys.exit(0)
