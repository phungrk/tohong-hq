"""Hàm chuẩn `short_name(name)` của T-111 v3 (tên rút gọn cho lượt thử lại thứ nhất khi lượt 1 Google không trả gì). Cài đặt của Engineering phải cho ĐÚNG kết quả
của hàm này trên bảng short_name_cases.json (eval check_3). Thuần chuỗi, không mạng. Luật:
  S1 bỏ nội dung trong ngoặc ( ) [ ] { } (v3: KHÔNG bỏ nếu ngoặc đứng ở ĐẦU tên: "[Paper Color] - …" là tên riêng).
  S2 cắt tại cụm đuôi {"tại", "chuyên", "cho thuê"} (khớp THEO TỪ, GIỮ NGUYÊN DẤU, không phân biệt hoa thường; không phải từ đầu), giữ phần trái.
     (v1 so không dấu nên "Tài" bị coi là "tại"; v2 so có dấu.)
  S3 bỏ mọi cụm loại hình chung {nhà hàng, tiệc cưới, trung tâm, hội nghị, yến tiệc, khách sạn, công ty, cty, cửa hàng, tiệm, dịch vụ, chuyên nghiệp} ở bất kỳ vị trí
     (so không dấu, theo từ), rồi bỏ từ nối ở hai đầu {và, and, tnhh, cp, tm, dv, mtv} và phân cách thừa.
  S4 tách tên tại mọi phân cách {" - ", " – ", " — ", " | ", ": ", ", ", "; ", " & ", " + "} thành các vế; (v3) KHÔNG tách tại " & "/" + " khi một trong hai vế chỉ có một từ ("Marks & Spencer");
     bỏ vế mở đầu bằng từ hành chính {quận, huyện, phường, thành phố, tp, tỉnh}; chọn vế HỢP LỆ ĐẦU TIÊN từ trái (hợp lệ = đủ độ dài và còn ít nhất một từ ngoài COMMON, nên vế toàn từ chung như "Hoa giấy", "In Thiệp Cưới Giá Rẻ" bị bỏ qua).
  Mỗi bước S2, S3, S4 chỉ được nhận khi kết quả HỢP LỆ; không hợp lệ thì bỏ bước đó (giữ giá trị trước bước). Hợp lệ = (>= 2 từ, hoặc >= 4 ký tự chữ-số không dấu) VÀ có ít nhất một từ
  KHÔNG thuộc tập từ chung COMMON (loại hình, sản phẩm/dịch vụ cưới phổ biến, từ nối) — tức là còn tên riêng, không biến tên riêng thành từ chung.
Kết quả: tên rút gọn hợp lệ khác tên gốc (đã chuẩn hoá khoảng trắng), hoặc None. None nghĩa là "không rút được tên riêng có nghĩa": lượt 2 dùng tên gốc không kèm địa danh (spec, Hành vi 2)."""
import re, unicodedata

GENERIC = ["chuyen nghiep", "nha hang", "tiec cuoi", "trung tam", "hoi nghi", "yen tiec", "khach san", "cong ty", "cua hang", "dich vu", "cty", "tiem"]
STOP = ["tại", "chuyên", "cho thuê"]
CONNECT = {"va", "and", "tnhh", "cp", "tm", "dv", "mtv"}
COMMON = set("""nha hang tiec cuoi trung tam hoi nghi yen tiec khach san cong ty cua tiem dich vu chuyen nghiep cty
co dau nha giay in gia re quay dep lang man gioi noi shop store tiec ao dai vay anh studio wedding bridal makeup make up trang diem suc bac nhan vang xe hoa cao cap cho thue thiep qua tang banh kem planner event events
van tai quoc te thuong san pham tphcm sai gon hcm ho chi minh thanh pho viet nam the va and tnhh cp tm dv mtv phong su chup hinh quay phim noi that
may do thiet ke trai cuoi ngoai troi ket hon vinh cuu hoc vien salon spa nails nail beauty hair""".split())
SEP = re.compile(r"\s+[-–—|]\s*|\s*[-–—|]\s+|\s*[:,;]\s+|\s+&\s+|\s+\+\s+")
EDGE = " .,-–—|:;&+/"
ADMIN = {"quan", "huyen", "phuong", "tinh", "tp", "thanh"}


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
    t = re.sub(r"(?<=\S)\s*[\(\[\{][^\)\]\}]*[\)\]\}]", "", cur).strip()   # chỉ ngoặc KHÔNG ở đầu tên
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
    parts, seps, pos = [], [], 0
    for m in SEP.finditer(cur):
        parts.append(cur[pos:m.start()])
        seps.append(m.group(0).strip())
        pos = m.end()
    parts.append(cur[pos:])
    if len(parts) > 1:
        # không tách tại & / + khi một vế chỉ có một từ: gộp lại
        k = 0
        while k < len(seps):
            if seps[k] in ("&", "+") and (len(parts[k].split()) == 1 or len(parts[k + 1].split()) == 1):
                parts[k:k + 2] = [parts[k] + " " + seps[k] + " " + parts[k + 1]]
                del seps[k]
            else:
                k += 1
        cands = []
        for idx, pt in enumerate(parts):
            pt = pt.strip(EDGE)
            if not pt or fold(pt).split()[0] in ADMIN:
                continue
            t = pt.strip("[](){} ")
            if _ok(t):
                cands.append((idx, t))
        if cands:
            cur = cands[0][1]   # vế hợp lệ đầu tiên từ trái (hợp lệ = còn tên riêng ngoài COMMON)
    cur = cur.strip(EDGE)
    return cur if cur and cur != orig and _ok(cur) else None
