"""T-129 (ADR-065, ADR-066): kiểm chữ ký Ed25519 của cú bấm Capu. Dùng chung cho INV-020 v2, INV-015 v2 (đề xuất) và eval. Khi bể nhận bản v2, Chief of Staff đặt file này ở eval/lib/capu_decision.py.
Không mạng. Cần thư viện `cryptography` (có sẵn trong môi trường gate).

Chữ ký của một entry (back ký lúc xuất, khoá bí mật là secret Worker) là Ed25519 trên chuỗi byte:
  b"tohong-enrich-review-v1|" + với mỗi trường theo thứ tự [key_id, vendor_id, action, place_id hoặc "", maps_link hoặc "", reason, reviewer_label, reviewed_at]: str(độ dài UTF-8) + b":" + UTF-8 + b","
`sig` = base64url không đệm (86 ký tự). Mục manual_overrides.json (nguồn B):
  Trường place_id trong chuỗi ký là chuỗi RỖNG khi mục có maps_link (back không bao giờ xuất cả hai; resolve_overrides.py ghi place_id + resolved vào mục accept_place có maps_link SAU khi ký nên không thuộc chữ ký).
  Mục có `resolved` hoặc (maps_link + place_id) phải nhất quán: resolved.place_id == place_id (luật T-110), nếu không là giả mạo.
  decision = admin-review:<key_id>:<label>@<reviewed_at>:<sig>;  reason = "<reason> [duyệt qua admin: <label>, <reviewed_at>]";  approved_by = capu;  approved_on = ngày (UTC) của reviewed_at.
"""
import base64, json, os, re

DOMAIN = b"tohong-enrich-review-v1|"
DEC_RE = re.compile(r"admin-review:(k[0-9a-z]{1,8}):(admin:[0-9a-f]{8})@((\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z):([A-Za-z0-9_-]{86})")
RAW_ID = re.compile(r"user_[A-Za-z0-9]{10,}")
ACTIONS = ("accept_place", "remove", "temporarily_closed", "reject_match")


def payload(key_id, vendor_id, action, place_id, maps_link, reason, label, at):
    out = DOMAIN
    for f in (key_id, vendor_id, action, place_id or "", maps_link or "", reason, label, at):
        b = f.encode("utf-8")
        out += str(len(b)).encode() + b":" + b + b","
    return out


def b64u_decode(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_signature(pub_b64, data, sig_b64u):
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    try:
        raw = base64.b64decode(pub_b64, validate=True)
        if len(raw) != 32:
            return False
        Ed25519PublicKey.from_public_bytes(raw).verify(b64u_decode(sig_b64u), data)
        return True
    except (InvalidSignature, ValueError):
        return False


def parse_key_list(text):
    """'k1=<b64>, k2=<b64>' -> {id: b64}."""
    return dict(re.findall(r"(k[0-9a-z]{1,8})=([A-Za-z0-9+/]{43}=)", text))


def hq_keys(hq):
    """Khoá công khai Capu đã duyệt: dòng `capu_signing_keys:` ở frontmatter của file <hq>/decisions/*.md (realpath trong decisions/) có `decided_by: capu`.
    Hai file khai cùng key_id khác giá trị: ném ValueError (mơ hồ)."""
    root = os.path.realpath(os.path.join(hq, "decisions"))
    keys = {}
    for name in sorted(os.listdir(root)):
        p = os.path.realpath(os.path.join(root, name))
        if not name.endswith(".md") or os.path.dirname(p) != root or not os.path.isfile(p):
            continue
        m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", open(p, encoding="utf-8").read(), re.S)
        fm = m.group(1) if m else ""
        if not re.search(r"^decided_by:\s*capu\s*$", fm, re.M):
            continue
        for ln in re.findall(r"^capu_signing_keys:\s*(.+?)\s*$", fm, re.M):
            for k, v in parse_key_list(ln).items():
                if keys.get(k, v) != v:
                    raise ValueError("khoá %s khai hai giá trị khác nhau" % k)
                keys[k] = v
    return keys


def check_entry(e, keys):
    """Mục manual_overrides.json nguồn (B) hợp lệ? -> (True, '') hoặc (False, lý do)."""
    dec = str(e.get("decision") or "")
    m = DEC_RE.fullmatch(dec)
    if not m:
        return False, "decision sai dạng admin-review:<key_id>:<label>@<ISO UTC>:<sig>"
    key_id, label, at, day, sig = m.groups()
    if key_id not in keys:
        return False, "key_id %s không nằm trong khoá Capu đã duyệt" % key_id
    if e.get("approved_by") != "capu":
        return False, "approved_by=%r" % e.get("approved_by")
    if e.get("approved_on") != day:
        return False, "approved_on %r phải bằng ngày bấm %s" % (e.get("approved_on"), day)
    suffix = " [duyệt qua admin: %s, %s]" % (label, at)
    reason = str(e.get("reason") or "")
    if not reason.endswith(suffix) or len(reason) == len(suffix):
        return False, "reason không kết thúc bằng %s" % suffix.strip()
    if e.get("action") not in ACTIONS:
        return False, "action %r" % e.get("action")
    link, pid = e.get("maps_link"), e.get("place_id")
    res = e.get("resolved")
    if res is not None and (not isinstance(res, dict) or not pid or res.get("place_id") != pid):
        return False, "resolved.place_id không khớp place_id của mục"
    if link and pid and res is None:
        return False, "mục có maps_link và place_id nhưng không có resolved (place_id chỉ do resolve ghi)"
    data = payload(key_id, str(e.get("vendor_id") or ""), e["action"], None if link else pid, link, reason[:-len(suffix)], label, at)
    if not verify_signature(keys[key_id], data, sig):
        return False, "chữ ký không khớp nội dung mục"
    return True, ""
