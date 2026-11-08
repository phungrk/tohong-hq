"""Hàm chuẩn `short_name(name)` của T-111 v2 (tên rút gọn cho lượt thử lại thứ nhất khi lượt 1 Google không trả gì). Cài đặt của Engineering phải cho ĐÚNG kết quả
của hàm này trên bảng short_name_cases.json (eval check_3). Thuần chuỗi, không mạng. Luật:
  S1 bỏ nội dung trong ngoặc ( ) [ ] { }.
  S2 cắt tại cụm đuôi {"tại", "chuyên", "cho thuê"} (khớp THEO TỪ, GIỮ NGUYÊN DẤU, không phân biệt hoa thường; không phải từ đầu), giữ phần trái.
     (v1 so không dấu nên "Tài" bị coi là "tại"; v2 so có dấu.)
  S3 bỏ mọi cụm loại hình chung {nhà hàng, tiệc cưới, trung tâm, hội nghị, yến tiệc, khách sạn, công ty, cty, cửa hàng, tiệm, dịch vụ, chuyên nghiệp} ở bất kỳ vị trí
     (so không dấu, theo từ), rồi bỏ từ nối ở hai đầu {và, and, tnhh, cp, tm, dv, mtv} và phân cách thừa.
  S4 cắt tại phân cách đầu tiên {" - ", " – ", " — ", " | ", ": ", ", ", "; ", " & ", " + "}, giữ phần trái.
  Mỗi bước S2, S3, S4 chỉ được nhận khi kết quả HỢP LỆ; không hợp lệ thì bỏ bước đó (giữ giá trị trước bước). Hợp lệ = (>= 2 từ, hoặc >= 4 ký tự chữ-số không dấu) VÀ có ít nhất một từ
  KHÔNG thuộc tập từ chung COMMON (loại hình, sản phẩm/dịch vụ cưới phổ biến, từ nối) — tức là còn tên riêng, không biến tên riêng thành từ chung.
Kết quả: tên rút gọn hợp lệ khác tên gốc (đã chuẩn hoá khoảng trắng), hoặc None. None nghĩa là "không rút được tên riêng có nghĩa": lượt 2 dùng tên gốc không kèm địa danh (spec, Hành vi 2)."""
import re, unicodedata

GENERIC = ["chuyen nghiep", "nha hang", "tiec cuoi", "trung tam", "hoi nghi", "yen tiec", "khach san", "cong ty", "cua hang", "dich vu", "cty", "tiem"]
STOP = ["tại", "chuyên", "cho thuê"]
CONNECT = {"va", "and", "tnhh", "cp", "tm", "dv", "mtv"}
COMMON = set("""nha hang tiec cuoi trung tam hoi nghi yen tiec khach san cong ty cua tiem dich vu chuyen nghiep cty
ao dai vay anh studio wedding bridal makeup make up trang diem suc bac nhan vang xe hoa cao cap cho thue thiep qua tang banh kem planner event events
van tai quoc te thuong san pham tphcm sai gon hcm ho chi minh thanh pho viet nam the va and tnhh cp tm dv mtv phong su chup hinh quay phim noi that
may do thiet ke trai cuoi ngoai troi ket hon vinh cuu hoc vien salon spa nails nail beauty hair""".split())
SEP = re.compile(r"\s+[-–—|]\s*|\s*[-–—|]\s+|\s*[:,;]\s+|\s+&\s+|\s+\+\s+")
EDGE = " .,-–—|:;&+/"


def fold(s):
    s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d").replace("Đ", "d"))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn"))).strip()


def _ok(s):
    f = fold(s)
    toks = f.split()
    if not toks or toks[0] in CONNECT or toks[-1] in CONNECT:
        return False
    if not (len(toks) >= 2 or len(f.replace(" ", "")) >= 4):
        return False
    return any(t not in COMMON for t in toks)


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
            out.append("\x00")
            i += hit
        else:
            out.append(toks[i])
            i += 1
    out = [x for x in out if x != "\x00"]
    while out and fold(out[0]) in CONNECT:
        out.pop(0)
    while out and fold(out[-1]) in CONNECT:
        out.pop()
    return " ".join(out).strip(EDGE)


def short_name(name):
    orig = re.sub(r"\s+", " ", unicodedata.normalize("NFC", name or "")).strip()
    cur = orig
    t = re.sub(r"\s*[\(\[\{][^\)\]\}]*[\)\]\}]", "", cur).strip()
    if t and _ok(t):
        cur = t
    words = cur.split()
    low = [w.lower() for w in words]
    for i in range(1, len(words)):
        if low[i] in ("tại", "chuyên") or (low[i] == "cho" and i + 1 < len(words) and low[i + 1] == "thuê"):
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
    return cur if cur and cur != orig and _ok(cur) else None
