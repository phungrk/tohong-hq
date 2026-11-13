#!/usr/bin/env python3
"""T-147 tiêu chí 1 (repo tohong): danh mục thuộc tính "dùng để tạo vendor pool" nằm ở MỘT file và khớp đúng với những gì các bước sinh pool thật sự đọc.
Danh mục: tools/scraper/pool-input-fields.json = {schema_version:1, fields:[{file, key, label, stages, pool, max_chars?}]}
  file    : "vendors.json" | "enrichment-audit.json" | "manual_overrides.json" | "enrich-report.json" (tệp nguồn của trường)
  key     : đường dẫn trong bản ghi của tệp đó, tối đa hai cấp: `k`, `k.sub` (dict) hoặc `k[].sub` (mảng dict); không trùng (file, key)
  label   : nhãn tiếng Việt hiện trên drawer (khác rỗng); stages: tập con không rỗng của {style, build, gen}; pool: danh sách tên trường của vendor trong pool bị ảnh hưởng
  max_chars (tuỳ chọn, số nguyên > 0): chuỗi dài hơn bị cắt khi nhúng vào báo cáo.
Đo (eval/T-147/lib/pool_reads.py, thực nghiệm trên bản sao dữ liệu thật, mạng bị chặn): với mỗi trường p của dữ liệu nguồn, đổi p rồi chạy lại clean_style_tags.py, build_pool.py
và generate-vendor-pool.js (cả chế độ sinh đầy đủ lẫn --styles-only --prune --photos-for all, như tools/regen-pool-styles.sh); đầu ra đổi thì bước đó đọc p.
Đạt khi: (a) mọi trường được đọc đều có mục trong danh mục (khớp trực tiếp, hoặc mục là tổ tiên/hậu duệ của đường dẫn đo được); (b) không mục nào của danh mục là thừa (không bước nào đọc);
(c) file/key/label/stages/pool đúng dạng, mọi tên `pool` là trường thật của vendor trong pool tohong-back; (d) không có mục nào thuộc `contact` (bước nào đọc contact thì spec phải được viết lại, không lặng lẽ lộ liên hệ);
(e) manual_overrides.json và enrich-report.json KHÔNG được bước nào đọc (kết luận của spec): nếu đọc thì phải có mục với đúng `file` đó.
(f) `extra_inputs` (đầu vào ngoài vendors.json) có đúng hai mục {id, label, note khác rỗng}: `pool_base` (pool nền --base: đo thực nghiệm đổi rating trong pool nền thì đầu ra --styles-only đổi) và
    `image_manifest` (generator áp edge/scripts/vendor-images/manifest.json: chỉ kiểm tệp generator còn nhắc tới manifest đó; đo thực nghiệm không có submodule edge/).
GIỚI HẠN (ghi trong spec, mục Ràng buộc): đo bằng đổi trường nên chỉ bắt được trường (1) có trong dữ liệu thật hoặc trong schema.py (class Vendor/Contact; fixture thêm một bản ghi tổng hợp mang mọi trường schema),
(2) sâu tối đa hai cấp. Generator đọc một trường chưa có ở cả hai nơi, hoặc sâu hơn hai cấp, thì eval này không bắt được.
Thiếu tohong: PASS "chưa áp dụng". Mất ~1-2 phút. Chạy: python3 -I eval/T-147/check_1_danh_muc_thuoc_tinh_pool.py. In PASS hoặc FAIL <lý do đầu> (+n); thoát 0/1."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.dont_write_bytecode = True
import common, pool_reads

root = common.tohong()
if not root:
    print("PASS chưa áp dụng (không thấy repo tohong)"); sys.exit(0)
cp = common.catalog_path(root)
if not os.path.isfile(cp):
    print("FAIL thiếu tools/scraper/pool-input-fields.json (danh mục thuộc tính dùng để tạo vendor pool)"); sys.exit(1)
fails = []
try:
    cat = json.load(open(cp, encoding="utf-8"))
except ValueError as e:
    print("FAIL pool-input-fields.json không phải JSON: %s" % e); sys.exit(1)
fields = cat.get("fields") if isinstance(cat, dict) else None
if not isinstance(fields, list) or cat.get("schema_version") != 1 or not fields:
    print("FAIL pool-input-fields.json phải là {schema_version:1, fields:[…]} không rỗng"); sys.exit(1)

FILES = {"vendors.json", "enrichment-audit.json", "manual_overrides.json", "enrich-report.json"}
pool_keys = set()
b = common.back()
if b and os.path.isfile(os.path.join(b, "lib", "vendorPool.generated.js")):
    t = open(os.path.join(b, "lib", "vendorPool.generated.js"), encoding="utf-8").read()
    for v in json.loads(t[t.index("= [") + 2:t.rindex("]") + 1]):
        pool_keys |= set(v)
seen = set()
for i, f in enumerate(fields):
    tag = "mục #%d" % i
    if not isinstance(f, dict):
        fails.append(tag + " không phải object"); continue
    k, fl = f.get("key"), f.get("file")
    tag = "%s %s" % (fl, k)
    if fl not in FILES: fails.append(tag + ": file lạ")
    if not (isinstance(k, str) and re.fullmatch(r"[a-z_][a-z0-9_]*(\[\]\.[a-z_][a-z0-9_]*|\.[a-z_][a-z0-9_]*)?", k)): fails.append(tag + ": key sai dạng (k, k.sub hoặc k[].sub)")
    if (fl, k) in seen: fails.append(tag + ": trùng")
    seen.add((fl, k))
    if not (isinstance(f.get("label"), str) and f["label"].strip()): fails.append(tag + ": thiếu label")
    st = f.get("stages")
    if not (isinstance(st, list) and st and set(st) <= {"style", "build", "gen"}): fails.append(tag + ": stages phải là tập con không rỗng của style/build/gen")
    pl = f.get("pool")
    if not (isinstance(pl, list) and all(isinstance(x, str) for x in pl)): fails.append(tag + ": pool phải là danh sách tên trường")
    elif pool_keys and not set(pl) <= pool_keys: fails.append("%s: pool có tên không phải trường vendor của pool: %s" % (tag, sorted(set(pl) - pool_keys)))
    if "max_chars" in f and not (isinstance(f["max_chars"], int) and not isinstance(f["max_chars"], bool) and f["max_chars"] > 0): fails.append(tag + ": max_chars phải là số nguyên > 0")
    if isinstance(k, str) and (k == "contact" or k.startswith("contact.") or k.startswith("contact[")): fails.append(tag + ": liên hệ (contact) không được nằm trong danh mục")

ex = cat.get("extra_inputs")
if not (isinstance(ex, list) and sorted(x.get("id") for x in ex if isinstance(x, dict)) == ["image_manifest", "pool_base"]
        and all(isinstance(x.get(k), str) and x[k].strip() for x in ex for k in ("label", "note"))):
    fails.append("extra_inputs phải có đúng hai mục pool_base và image_manifest, mỗi mục có label và note")
gp = os.path.join(root, "tools", "generate-vendor-pool.js")
if os.path.isfile(gp) and "vendor-images/manifest.json" not in open(gp, encoding="utf-8").read():
    fails.append("generator không còn nhắc manifest ảnh (edge/scripts/vendor-images/manifest.json) nhưng extra_inputs còn image_manifest")
try:
    reads = pool_reads.detect(root)
except Exception as e:  # noqa: BLE001
    print("FAIL không đo được bằng thực nghiệm: %s" % str(e)[:300]); sys.exit(1)
measured = {
    "vendors.json": reads["style"] | reads["build"] | reads["gen"],
    "enrichment-audit.json": reads["audit"],
    "manual_overrides.json": reads["overrides"],
    "enrich-report.json": reads["report"],
}


def related(a, b):
    """a, b là đường dẫn; khớp nếu bằng nhau hoặc một bên là tổ tiên của bên kia (k ⊃ k.sub ⊃ k[].sub)."""
    def anc(x, y):
        return y == x or y.startswith(x + ".") or y.startswith(x + "[].")
    return anc(a, b) or anc(b, a)


for fl, ps in measured.items():
    keys = [f.get("key") for f in fields if isinstance(f, dict) and f.get("file") == fl and isinstance(f.get("key"), str)]
    for p in sorted(ps):
        if not any(related(k, p) for k in keys):
            fails.append("bước sinh pool đọc `%s` của %s nhưng danh mục không có mục nào (drawer sẽ thiếu trường này)" % (p, fl))
    for k in keys:
        if not any(related(k, p) for p in ps):
            fails.append("danh mục có `%s` của %s nhưng không bước sinh pool nào đọc (mục thừa)" % (k, fl))
if not reads.get("pool_base"):
    fails.append("extra_inputs có pool_base nhưng đổi pool nền (--base) không làm đổi đầu ra --styles-only (mục thừa)")
if fails:
    print("FAIL " + fails[0] + (" (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS")
