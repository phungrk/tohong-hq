"""Hàm chuẩn `short_name(name)` của T-111 (tên rút gọn cho lần thử lại duy nhất khi Google không trả gì). Cài đặt của Engineering phải cho ĐÚNG kết quả
của hàm này trên bảng short_name_cases.json (eval check_3). Thuần chuỗi, không mạng. Luật (S1 đến S4):
  S1 bỏ nội dung trong ngoặc ( ) [ ] { }.
  S2 cắt tại cụm mô tả đuôi đầu tiên {chuyên, tại, cho thuê} (so không dấu, theo từ, không phải từ đầu), giữ phần trái.
  S3 bỏ mọi cụm loại hình/mô tả chung {nhà hàng, tiệc cưới, trung tâm, hội nghị, yến tiệc, khách sạn, công ty, cty, cửa hàng, tiệm, dịch vụ, chuyên nghiệp}
     ở bất kỳ vị trí (so không dấu, theo từ), rồi bỏ phân cách thừa ở hai đầu.
  S4 cắt tại phân cách đầu tiên {" - ", " – ", " — ", " | ", ": ", ", ", "; ", " & ", " + "}, giữ phần trái.
  Mỗi bước S2, S3, S4 chỉ được nhận khi kết quả "hợp lệ" (>= 2 từ, hoặc >= 8 ký tự chữ-số không dấu); không hợp lệ thì bỏ bước đó (giữ giá trị trước bước).
Kết quả bằng tên gốc (đã chuẩn hoá khoảng trắng) hoặc rỗng: trả None (không có tên rút gọn)."""
import re, unicodedata

GENERIC = ["chuyen nghiep", "nha hang", "tiec cuoi", "trung tam", "hoi nghi", "yen tiec", "khach san", "cong ty", "cua hang", "dich vu", "cty", "tiem"]
STOP = ["chuyen", "tai", "cho thue"]
SEP = re.compile(r"\s+[-–—|]\s*|\s*[-–—|]\s+|\s*[:,;]\s+|\s+&\s+|\s+\+\s+")
EDGE = " .,-–—|:;&+/"


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d").replace("Đ", "d"))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn"))).strip()


def _ok(s):
    f = fold(s)
    return bool(f) and (len(f.split()) >= 2 or len(f.replace(" ", "")) >= 8)


def _strip_generic(s):
    toks = s.split(" ")
    out, i = [], 0
    while i < len(toks):
        hit = 0
        for g in GENERIC:
            n = len(g.split())
            if fold(" ".join(toks[i:i + n])) == g:
                hit = n
                break
        if hit:
            out.append("\x00")  # chỗ bỏ
            i += hit
        else:
            out.append(toks[i])
            i += 1
    return " ".join(x for x in out if x != "\x00").strip(EDGE)


def short_name(name):
    orig = re.sub(r"\s+", " ", unicodedata.normalize("NFC", name or "")).strip()
    cur = orig
    t = re.sub(r"\s*[\(\[\{][^\)\]\}]*[\)\]\}]", "", cur).strip()
    if t and _ok(t):
        cur = t
    words = cur.split()
    for i, w in enumerate(words):
        if i > 0 and fold(w) in STOP:
            t = " ".join(words[:i]).strip(EDGE)
            if _ok(t):
                cur = t
            break
    t = _strip_generic(cur)
    if t and _ok(t):
        cur = t
    m = SEP.search(cur)
    if m:
        t = cur[:m.start()].strip(EDGE)
        if t and _ok(t):
            cur = t
    cur = cur.strip(EDGE)
    return cur if cur and cur != orig else None
