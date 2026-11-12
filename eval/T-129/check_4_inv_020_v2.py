#!/usr/bin/env python3
"""T-129 tiêu chí 4: bản đề xuất INV-020 v2 và INV-015 v2 (điều khoản miễn) nhận quyết định của Capu qua cú bấm trên admin CHỈ khi có chữ ký Ed25519 đúng (ADR-066), và từ chối mọi giả mạo.
Đo trên HQ giả + tohong giả (không đụng repo thật, không mạng, không Google), khoá sinh tại chỗ:
  INV-020 v2 PASS: mục nguồn (A) cũ; mục nguồn (B) có chữ ký đúng; trộn (A)+(B); hai khoá (xoay khoá), mục ký bằng khoá cũ vẫn hợp lệ khi ADR còn khoá cũ; đổi tài khoản Clerk của Capu (nhãn khác) không cần ADR mới.
  INV-020 v2 FAIL (mỗi ca một lỗi): chép nhãn công khai + tự viết reason + chữ ký rác; ký bằng khoá kẻ tấn công (key_id khớp ADR); sửa từng trường đã ký (vendor_id, action, place_id, maps_link, reason, nhãn, giờ);
    key_id không có trong ADR; khoá khai ở file không `decided_by: capu`, ngoài frontmatter, hoặc qua symlink ra ngoài decisions/; hai ADR khai cùng key_id khác giá trị; approved_on khác ngày bấm (sớm hoặc muộn);
    approved_by khác capu; reason thiếu vết; decision sai dạng (kể cả xuống dòng thừa); Clerk id thô; vendor_id trùng; tohong giữ khoá không có/khác trong ADR; nguồn (A) thiếu vendor_id; v1 nguyên văn của bể vẫn xanh trên nguồn (A).
  Trên dữ liệu thật của tohong (nếu có): v2 PASS.
  INV-015 v2: hàm `_exempt` (cắt từ file đề xuất) miễn cho accept_place có chữ ký hợp lệ, KHÔNG miễn khi chữ ký sai/khoá lạ/trường bị sửa, và vẫn miễn đúng như cũ cho nguồn (A).
Chạy: python3 -I eval/T-129/check_4_inv_020_v2.py   In PASS hoặc FAIL <lý do>; thoát 0/1."""
import base64, copy, importlib.util, json, os, re, shutil, subprocess, sys, tempfile
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
INV20 = os.path.join(HERE, "inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py")
INV15 = os.path.join(HERE, "inv-proposed-inv-015-v2-mien-theo-quyet-dinh-capu.py")
HELPER = os.path.join(HERE, "capu_decision.py")
INV20_V1 = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images", "inv-020-duyet-tay-co-quyet-dinh-cua-capu.py")
for f in (INV20, INV15, HELPER):
    if not os.path.isfile(f):
        print("FAIL thiếu %s" % os.path.relpath(f, HQ)); sys.exit(1)
_sp = importlib.util.spec_from_file_location("cd", HELPER); CD = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(CD)

b64 = lambda b: base64.b64encode(b).decode()
b64u = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
def newkey():
    k = Ed25519PrivateKey.generate()
    return k, b64(k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))
K1, P1 = newkey(); K2, P2 = newkey(); ATTACKER, _PA = newkey()
LABEL, AT = "admin:1a2b3c4d", "2026-11-12T03:04:05.678Z"
tmp = tempfile.mkdtemp(prefix="t129-inv-")
fails = []
N = 0


def fm(extra=""):
    return "---\ntype: decision\nid: ADR-998\ndecided_by: capu\n%s---\n# x\n" % extra


def sign(key, kid, vid, action, place_id, maps_link, reason, label, at):
    return b64u(key.sign(CD.payload(kid, vid, action, place_id, maps_link, reason, label, at)))


def ent_b(vid="marry_aaaaaaaaaaaa", key=K1, kid="k1", action="remove", reason="Không có trên Maps", label=LABEL, at=AT, place_id=None, maps_link=None, **kw):
    sig = sign(key, kid, vid, action, place_id, maps_link, reason, label, at)
    e = {"vendor_id": vid, "action": action, "reason": "%s [duyệt qua admin: %s, %s]" % (reason, label, at), "approved_by": "capu", "approved_on": at[:10],
         "decision": "admin-review:%s:%s@%s:%s" % (kid, label, at, sig)}
    if place_id: e["place_id"] = place_id
    if maps_link: e["maps_link"] = maps_link
    e.update(kw); return e


def ent_a(vid="marry_bbbbbbbbbbbb", dec="decisions/2026-11-08-adr-048-x.md"):
    return {"vendor_id": vid, "action": "remove", "reason": "Capu duyệt", "approved_by": "capu", "approved_on": "2026-11-08", "decision": dec}


def world(decisions, entries, link=None, keysfile=None):
    global N
    N += 1
    hq = os.path.join(tmp, "w%d" % N, "hq"); th = os.path.join(tmp, "w%d" % N, "tohong")
    os.makedirs(os.path.join(hq, "decisions")); os.makedirs(os.path.join(hq, "eval", "invariants", "planner", "vendor", "images")); os.makedirs(os.path.join(hq, "eval", "lib"))
    os.makedirs(os.path.join(th, "tools", "scraper", "output", "HCMC"))
    shutil.copy(HELPER, os.path.join(hq, "eval", "lib", "capu_decision.py"))
    open(os.path.join(th, "tools", "scraper", "enrich.py"), "w").write("")
    for k, v in decisions.items():
        open(os.path.join(hq, "decisions", k), "w", encoding="utf-8").write(v)
    if link:
        os.makedirs(os.path.join(tmp, "w%d" % N, "outside")); open(os.path.join(tmp, "w%d" % N, "outside", "keys.md"), "w", encoding="utf-8").write(link)
        os.symlink(os.path.join(tmp, "w%d" % N, "outside", "keys.md"), os.path.join(hq, "decisions", "2026-11-12-adr-997-khoa.md"))
    if keysfile is not None:
        json.dump({"schema_version": 1, "keys": keysfile}, open(os.path.join(th, "tools", "scraper", "admin_review_keys.json"), "w"))
    json.dump({"schema_version": 1, "overrides": entries}, open(os.path.join(th, "tools", "scraper", "output", "HCMC", "manual_overrides.json"), "w"), ensure_ascii=False)
    return hq, th


def run_inv(src, hq, th):
    dst = os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv.py"); shutil.copy(src, dst)
    p = subprocess.run([sys.executable, "-I", dst], env=dict(os.environ, TOHONG_REPO=th), capture_output=True, text=True, timeout=60, cwd=hq)
    return p.returncode, (p.stdout + p.stderr).strip()


def expect(name, src, decisions, entries, ok, why=None, **kw):
    hq, th = world(decisions, entries, **kw)
    rc, out = run_inv(src, hq, th)
    good = (rc == 0 and out.startswith("PASS")) if ok else (rc == 1 and out.startswith("FAIL") and (why is None or why in out))
    if not good:
        fails.append("%s: mong %s%s; thấy rc=%s %s" % (name, "PASS" if ok else "FAIL", " (%s)" % why if why else "", rc, out[:150]))


KEYADR = "2026-11-12-adr-998-khoa-ky.md"
GOOD = {"2026-11-08-adr-048-x.md": fm() + "marry_bbbbbbbbbbbb\n", KEYADR: fm("capu_signing_keys: k1=%s\n" % P1)}
TWO = {**GOOD, KEYADR: fm("capu_signing_keys: k1=%s, k2=%s\n" % (P1, P2))}
PID = "ChIJ_Q8PLiQvdTERNk66UVRKf8U"

# --- INV-020 v2 xanh
expect("nguồn (A) cũ", INV20, GOOD, [ent_a()], True)
expect("nguồn (B) có chữ ký đúng", INV20, GOOD, [ent_b()], True)
expect("accept_place với place_id và maps_link", INV20, GOOD, [ent_b(action="accept_place", place_id=PID), ent_b("marry_cccccccccccc", action="accept_place", maps_link="https://maps.app.goo.gl/abc")], True)
expect("trộn (A)+(B), giờ không phần lẻ, ngày khác nhau", INV20, GOOD, [ent_a(), ent_b(at="2026-11-13T03:04:05Z", vid="marry_cccccccccccc")], True)
expect("xoay khoá: mục ký khoá cũ k1 vẫn hợp lệ khi ADR còn k1, mục mới ký k2", INV20, TWO, [ent_b(), ent_b("marry_cccccccccccc", key=K2, kid="k2")], True)
expect("đổi tài khoản Clerk của Capu (nhãn khác) không cần ADR nhãn", INV20, GOOD, [ent_b(label="admin:99999999")], True)
expect("tohong giữ đúng khoá đã duyệt", INV20, GOOD, [ent_b()], True, keysfile={"k1": P1})
# --- INV-020 v2 đỏ
expect("chép nhãn công khai, tự viết reason, chữ ký rác", INV20, GOOD, [ent_b(decision="admin-review:k1:%s@%s:%s" % (LABEL, AT, "A" * 86))], False, "chữ ký")
expect("ký bằng khoá kẻ tấn công nhưng key_id k1", INV20, GOOD, [ent_b(key=ATTACKER)], False, "chữ ký")
for fld, mut in (("vendor_id", lambda e: e.update(vendor_id="marry_dddddddddddd")), ("action", lambda e: e.update(action="temporarily_closed")),
                 ("place_id", lambda e: e.update(place_id=PID)), ("maps_link", lambda e: e.update(maps_link="https://goo.gl/x")),
                 ("reason", lambda e: e.update(reason="Gỡ thật ra [duyệt qua admin: %s, %s]" % (LABEL, AT)))):
    e = ent_b(); mut(e); expect("sửa trường đã ký: %s" % fld, INV20, GOOD, [e], False, "chữ ký")
e = ent_b(); d = e["decision"].replace(LABEL, "admin:99999999"); e["decision"] = d; e["reason"] = e["reason"].replace(LABEL, "admin:99999999")
expect("sửa nhãn trong decision và reason (nhưng giữ chữ ký)", INV20, GOOD, [e], False, "chữ ký")
e = ent_b(); e["decision"] = e["decision"].replace("03:04:05.678Z", "03:04:06.678Z"); e["reason"] = e["reason"].replace("03:04:05.678Z", "03:04:06.678Z")
expect("sửa giờ bấm (decision và reason) giữ chữ ký", INV20, GOOD, [e], False, "chữ ký")
expect("key_id không có trong ADR", INV20, GOOD, [ent_b(key=K2, kid="k2")], False, "key_id k2")
expect("chưa có ADR khai khoá", INV20, {"2026-11-08-adr-048-x.md": GOOD["2026-11-08-adr-048-x.md"]}, [ent_b()], False, "key_id")
expect("khai khoá ở file không decided_by: capu", INV20, {**GOOD, KEYADR: "---\ntype: decision\ndecided_by: chief-of-staff\ncapu_signing_keys: k1=%s\n---\n" % P1}, [ent_b()], False, "key_id")
expect("khai khoá ở thân (không phải frontmatter)", INV20, {**GOOD, KEYADR: fm() + "capu_signing_keys: k1=%s\n" % P1}, [ent_b()], False, "key_id")
expect("khai khoá qua symlink ra ngoài decisions/", INV20, {"2026-11-08-adr-048-x.md": GOOD["2026-11-08-adr-048-x.md"]}, [ent_b()], False, "key_id", link=fm("capu_signing_keys: k1=%s\n" % P1))
expect("hai ADR khai k1 hai giá trị khác nhau", INV20, {**GOOD, "2026-11-13-adr-999-khoa.md": fm("capu_signing_keys: k1=%s\n" % P2)}, [ent_b()], False)
expect("approved_on sớm hơn ngày bấm", INV20, GOOD, [ent_b(approved_on="2026-11-11")], False, "approved_on")
expect("approved_on muộn hơn ngày bấm", INV20, GOOD, [ent_b(approved_on="2026-11-14")], False, "approved_on")
expect("approved_by không phải capu", INV20, GOOD, [ent_b(approved_by="admin")], False, "approved_by")
e = ent_b(); e["reason"] = "Không có trên Maps"
expect("reason thiếu vết duyệt", INV20, GOOD, [e], False, "reason")
for bad_dec in ("admin-review:k1:%s@%s" % (LABEL, AT), "admin-review:k1:%s@%s:%s" % ("admin:1a2b3c4d5e", AT, "A" * 86), "admin-review:k1:%s@%s:%s" % (LABEL, "2026-11-12T10:04:05+07:00", "A" * 86),
                "admin-review:k1:%s@%s:%s\n" % (LABEL, AT, "A" * 86), "admin-review:%s@%s" % (LABEL, AT), "Admin-Review:k1:%s@%s:%s" % (LABEL, AT, "A" * 86)):
    expect("decision sai dạng %r" % bad_dec[:50], INV20, GOOD, [ent_b(decision=bad_dec)], False)
expect("Clerk id thô trong reason", INV20, GOOD, [ent_b(reason="x user_2abcDEFghiJKL")], False, "id thô")
expect("Clerk id thô ở trường lạ", INV20, GOOD, [ent_a(), {**ent_a("marry_dddddddddddd"), "reviewed_by": "user_2abcDEFghiJKL"}], False, "id thô")
expect("nguồn (A) thiếu vendor_id trong decision", INV20, {**GOOD, "2026-11-08-adr-048-x.md": fm() + "khac\n"}, [ent_a()], False, "không nhắc vendor_id")
expect("nguồn (A) decision không có file", INV20, GOOD, [ent_a(dec="decisions/khong-co.md")], False, "decisions/")
expect("vendor_id trùng giữa (A) và (B)", INV20, GOOD, [ent_a(), ent_b(vid="marry_bbbbbbbbbbbb")], False, "trùng")
expect("tohong giữ khoá không có trong ADR", INV20, GOOD, [ent_b()], False, "admin_review_keys", keysfile={"k1": P1, "k9": P2})
expect("tohong giữ k1 với giá trị khác ADR", INV20, GOOD, [ent_b()], False, "admin_review_keys", keysfile={"k1": P2})
expect("v1 nguyên văn của bể vẫn xanh với dữ liệu nguồn (A)", INV20_V1, GOOD, [ent_a()], True)

# --- dữ liệu thật của tohong (nếu có): v2 xanh
real = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "output", "HCMC", "manual_overrides.json"))), None)
if real:
    p = subprocess.run([sys.executable, "-I", INV20], env=dict(os.environ, TOHONG_REPO=real), capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        fails.append("INV-020 v2 trên dữ liệu thật của tohong: %s" % (p.stdout + p.stderr).strip()[:140])

# --- INV-015 v2: cắt các hàm khỏi file đề xuất và chạy với HQ/tohong giả
src = open(INV15, encoding="utf-8").read()
m = re.search(r"def _frontmatter\(txt\):.*?(?=\n\ndef origin\()", src, re.S)
if not m or "_exempt" not in m.group(0) or "_cd()" not in m.group(0):
    fails.append("INV-015 v2: không thấy _exempt dùng _cd() trong file đề xuất")
else:
    def exempt(decisions, entry):
        hq, th = world(decisions, [entry])
        ns = {"os": os, "json": json, "_re": re, "importlib": importlib, "HQ": hq, "t": th}
        exec(m.group(0), ns)
        return ns["_exempt"](entry["vendor_id"], "ChIJxxxxxxxxxxxxxxxxxxxxxxxx")
    def acc(**kw):
        e = ent_b(action="accept_place", place_id=kw.pop("place_id", PID), **kw); e["resolved"] = {"place_id": "ChIJxxxxxxxxxxxxxxxxxxxxxxxx"}; return e
    def acc_a():
        e = ent_a("marry_bbbbbbbbbbbb"); e["action"] = "accept_place"; e["resolved"] = {"place_id": "ChIJxxxxxxxxxxxxxxxxxxxxxxxx"}; return e
    if not exempt(GOOD, acc()): fails.append("INV-015 v2: không miễn cho accept_place có chữ ký hợp lệ")
    if exempt(GOOD, acc(key=ATTACKER)): fails.append("INV-015 v2: miễn nhầm khi chữ ký là của kẻ tấn công")
    e = acc(); e["place_id"] = "ChIJother" + "x" * 15
    if exempt(GOOD, e): fails.append("INV-015 v2: miễn nhầm khi place_id bị sửa sau khi ký")
    if exempt(GOOD, acc(key=K2, kid="k2")): fails.append("INV-015 v2: miễn nhầm khi key_id không có trong ADR")
    if not exempt(GOOD, acc_a()): fails.append("INV-015 v2: mất điều khoản miễn cho nguồn (A)")
    if exempt({**GOOD, "2026-11-08-adr-048-x.md": fm() + "khac\n"}, acc_a()): fails.append("INV-015 v2: miễn nhầm nguồn (A) thiếu vendor_id")

shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print("FAIL %s%s" % (fails[0], " (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS INV-020 v2 và INV-015 v2: chỉ nhận cú bấm của Capu có chữ ký Ed25519 đúng, từ chối giả mạo"); sys.exit(0)
