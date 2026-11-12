#!/usr/bin/env python3
"""T-129 tiêu chí 4: bản đề xuất INV-020 v2 và INV-015 v2 (điều khoản miễn) nhận quyết định của Capu qua cú bấm trên admin, và vẫn từ chối mọi giả mạo.
Đo trên HQ giả + tohong giả (không đụng repo thật, không mạng, không Google):
  INV-020 v2 (eval/T-129/inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py) PASS: mục cũ nguồn (A); mục nguồn (B) hợp lệ; trộn (A)+(B).
  INV-020 v2 FAIL (mỗi ca một lỗi): nhãn không nằm trong danh sách; danh sách nằm ở file không `decided_by: capu`; danh sách nằm ngoài decisions/ (symlink); reason không có/khác vết;
    reason khác reviewed_at của decision; approved_on sớm hơn ngày bấm; approved_by khác capu; decision dạng sai (nhãn dài, thiếu @, giờ không phải UTC Z, có ../); Clerk id thô trong reason;
    nguồn (A) vẫn đỏ khi decision thiếu vendor_id; v1 nguyên văn của bể vẫn xanh trên mục nguồn (A) (không làm hỏng dữ liệu cũ).
  Trên dữ liệu thật của tohong (nếu có): v2 PASS.
  INV-015 v2: hàm `_exempt` (cắt từ file đề xuất) miễn cho accept_place có quyết định (B) hợp lệ, KHÔNG miễn khi nhãn lạ / reason sai, và vẫn miễn đúng như cũ cho nguồn (A).
Chạy: python3 -I eval/T-129/check_4_inv_020_v2.py   In PASS hoặc FAIL <lý do>; thoát 0/1."""
import copy, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
HQ = os.path.abspath(os.path.join(HERE, "..", ".."))
INV20 = os.path.join(HERE, "inv-proposed-inv-020-v2-quyet-dinh-capu-hop-le.py")
INV15 = os.path.join(HERE, "inv-proposed-inv-015-v2-mien-theo-quyet-dinh-capu.py")
INV20_V1 = os.path.join(HQ, "eval", "invariants", "planner", "vendor", "images", "inv-020-duyet-tay-co-quyet-dinh-cua-capu.py")
for f in (INV20, INV15):
    if not os.path.isfile(f):
        print("FAIL thiếu %s" % os.path.relpath(f, HQ)); sys.exit(1)

LABEL, AT = "admin:1a2b3c4d", "2026-11-12T03:04:05.678Z"
tmp = tempfile.mkdtemp(prefix="t129-inv-")
fails = []
N = 0


def fm(extra=""):
    return "---\ntype: decision\nid: ADR-998\ndecided_by: capu\n%s---\n# x\n" % extra


def world(name, decisions, entries, link=None):
    hq = os.path.join(tmp, name, "hq"); th = os.path.join(tmp, name, "tohong")
    os.makedirs(os.path.join(hq, "decisions")); os.makedirs(os.path.join(hq, "eval", "invariants", "planner", "vendor", "images"))
    os.makedirs(os.path.join(th, "tools", "scraper", "output", "HCMC"))
    open(os.path.join(th, "tools", "scraper", "enrich.py"), "w").write("")
    for k, v in decisions.items():
        open(os.path.join(hq, "decisions", k), "w", encoding="utf-8").write(v)
    if link:
        os.makedirs(os.path.join(tmp, name, "outside")); open(os.path.join(tmp, name, "outside", "labels.md"), "w", encoding="utf-8").write(link)
        os.symlink(os.path.join(tmp, name, "outside", "labels.md"), os.path.join(hq, "decisions", "2026-11-12-adr-997-nhan.md"))
    json.dump({"schema_version": 1, "overrides": entries}, open(os.path.join(th, "tools", "scraper", "output", "HCMC", "manual_overrides.json"), "w"), ensure_ascii=False)
    return hq, th


def run_inv(src, hq, th):
    dst = os.path.join(hq, "eval", "invariants", "planner", "vendor", "images", "inv.py"); shutil.copy(src, dst)
    p = subprocess.run([sys.executable, "-I", dst], env=dict(os.environ, TOHONG_REPO=th), capture_output=True, text=True, timeout=60, cwd=hq)
    return p.returncode, (p.stdout + p.stderr).strip()


def ent_b(vid="marry_aaaaaaaaaaaa", label=LABEL, at=AT, action="remove", **kw):
    e = {"vendor_id": vid, "action": action, "reason": "Không có trên Maps [duyệt qua admin: %s, %s]" % (label, at), "approved_by": "capu", "approved_on": "2026-11-12",
         "decision": "admin-review:%s@%s" % (label, at)}
    e.update(kw); return e


def ent_a(vid="marry_bbbbbbbbbbbb", dec="decisions/2026-11-08-adr-048-x.md"):
    return {"vendor_id": vid, "action": "remove", "reason": "Capu duyệt", "approved_by": "capu", "approved_on": "2026-11-08", "decision": dec}


GOOD_DEC = {"2026-11-08-adr-048-x.md": fm() + "marry_bbbbbbbbbbbb\n", "2026-11-12-adr-998-nhan.md": fm("capu_admin_labels: %s\n" % LABEL)}


def expect(name, src, decisions, entries, ok, why=None, link=None):
    global N
    N += 1
    hq, th = world("w%d" % N, decisions, entries, link)
    rc, out = run_inv(src, hq, th)
    good = (rc == 0 and out.startswith("PASS")) if ok else (rc == 1 and out.startswith("FAIL") and (why is None or why in out))
    if not good:
        fails.append("%s: mong %s%s; thấy rc=%s %s" % (name, "PASS" if ok else "FAIL", " (%s)" % why if why else "", rc, out[:140]))


# --- INV-020 v2 xanh
expect("nguồn (A) cũ", INV20, GOOD_DEC, [ent_a()], True)
expect("nguồn (B) hợp lệ", INV20, GOOD_DEC, [ent_b()], True)
expect("trộn (A)+(B), giờ không phần lẻ", INV20, GOOD_DEC, [ent_a(), ent_b(at="2026-11-12T03:04:05Z", vid="marry_cccccccccccc")], True)
expect("danh sách nhãn nhiều nhãn, nhãn Capu ở vị trí sau", INV20, {**GOOD_DEC, "2026-11-12-adr-998-nhan.md": fm("capu_admin_labels: admin:00000000, %s\n" % LABEL)}, [ent_b()], True)
expect("approved_on muộn hơn ngày bấm", INV20, GOOD_DEC, [ent_b(approved_on="2026-11-14")], True)
# --- INV-020 v2 đỏ
expect("nhãn không có trong danh sách", INV20, GOOD_DEC, [ent_b(label="admin:ffffffff")], False, "capu_admin_labels")
expect("chưa có file nào khai nhãn", INV20, {"2026-11-08-adr-048-x.md": GOOD_DEC["2026-11-08-adr-048-x.md"]}, [ent_b()], False, "capu_admin_labels")
expect("khai nhãn ở file không decided_by: capu", INV20, {**GOOD_DEC, "2026-11-12-adr-998-nhan.md": "---\ntype: decision\ndecided_by: chief-of-staff\ncapu_admin_labels: %s\n---\n" % LABEL}, [ent_b()], False, "capu_admin_labels")
expect("khai nhãn ở thân (không phải frontmatter)", INV20, {**GOOD_DEC, "2026-11-12-adr-998-nhan.md": fm() + "capu_admin_labels: %s\n" % LABEL}, [ent_b()], False, "capu_admin_labels")
expect("khai nhãn qua symlink ra ngoài decisions/", INV20, {"2026-11-08-adr-048-x.md": GOOD_DEC["2026-11-08-adr-048-x.md"]}, [ent_b()], False, "capu_admin_labels", link=fm("capu_admin_labels: %s\n" % LABEL))
expect("reason thiếu vết duyệt", INV20, GOOD_DEC, [ent_b(reason="Không có trên Maps")], False, "reason")
expect("reason ghi nhãn khác decision", INV20, GOOD_DEC, [ent_b(reason="x [duyệt qua admin: admin:00000000, %s]" % AT)], False, "reason")
expect("reason ghi giờ khác decision", INV20, GOOD_DEC, [ent_b(reason="x [duyệt qua admin: %s, 2026-11-12T03:04:06.678Z]" % LABEL)], False, "reason")
expect("approved_on sớm hơn ngày bấm", INV20, GOOD_DEC, [ent_b(approved_on="2026-11-11")], False, "approved_on")
expect("approved_by không phải capu", INV20, GOOD_DEC, [ent_b(approved_by="admin")], False, "approved_by")
for bad_dec in ("admin-review:admin:1a2b3c4d5e@" + AT, "admin-review:" + LABEL, "admin-review:%s@2026-11-12T03:04:05+07:00" % LABEL, "admin-review:%s@../%s" % (LABEL, AT),
                "admin-review:%s@2026-11-12 03:04:05Z" % LABEL, "Admin-Review:%s@%s" % (LABEL, AT), "admin-review:%s@%s\n" % (LABEL, AT)):
    expect("decision sai dạng %r" % bad_dec, INV20, GOOD_DEC, [ent_b(decision=bad_dec)], False)
expect("Clerk id thô trong reason", INV20, GOOD_DEC, [ent_b(reason="x user_2abcDEFghiJKL [duyệt qua admin: %s, %s]" % (LABEL, AT))], False, "id thô")
expect("Clerk id thô ở trường lạ", INV20, GOOD_DEC, [ent_a(), {**ent_a("marry_dddddddddddd"), "reviewed_by": "user_2abcDEFghiJKL"}], False, "id thô")
expect("nguồn (A) thiếu vendor_id trong decision", INV20, {**GOOD_DEC, "2026-11-08-adr-048-x.md": fm() + "khac\n"}, [ent_a()], False, "không nhắc vendor_id")
expect("nguồn (A) decision không có file", INV20, GOOD_DEC, [ent_a(dec="decisions/khong-co.md")], False, "decisions/")
expect("vendor_id trùng giữa (A) và (B)", INV20, GOOD_DEC, [ent_a(), ent_b(vid="marry_bbbbbbbbbbbb")], False, "trùng")
expect("v1 nguyên văn của bể vẫn xanh với dữ liệu nguồn (A)", INV20_V1, GOOD_DEC, [ent_a()], True)

# --- dữ liệu thật của tohong (nếu có): v2 xanh
real = next((os.path.abspath(c) for c in (os.environ.get("TOHONG_REPO"), os.path.join(HQ, "..", "tohong")) if c and os.path.isfile(os.path.join(c, "tools", "scraper", "output", "HCMC", "manual_overrides.json"))), None)
if real:
    p = subprocess.run([sys.executable, "-I", INV20], env=dict(os.environ, TOHONG_REPO=real), capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        fails.append("INV-020 v2 trên dữ liệu thật của tohong: %s" % (p.stdout + p.stderr).strip()[:140])

# --- INV-015 v2: cắt _frontmatter, _capu_labels, _exempt khỏi file đề xuất và chạy với HQ/tohong giả
src = open(INV15, encoding="utf-8").read()
m = re.search(r"def _frontmatter\(txt\):.*?(?=\n\ndef origin\()", src, re.S)
if not m or "_capu_labels" not in m.group(0):
    fails.append("INV-015 v2: không thấy _capu_labels/_exempt trong file đề xuất")
else:
    def exempt(decisions, entry):
        global N
        N += 1
        hq, th = world("i%d" % N, decisions, [entry])
        ns = {"os": os, "json": json, "_re": re, "HQ": hq, "t": th}
        exec(m.group(0), ns)
        return ns["_exempt"](entry["vendor_id"], "ChIJxxxxxxxxxxxxxxxxxxxxxxxx")
    def acc(**kw):
        e = ent_b(action="accept_place", **kw); e["resolved"] = {"place_id": "ChIJxxxxxxxxxxxxxxxxxxxxxxxx"}; return e
    def acc_a():
        e = ent_a("marry_bbbbbbbbbbbb"); e["action"] = "accept_place"; e["resolved"] = {"place_id": "ChIJxxxxxxxxxxxxxxxxxxxxxxxx"}; return e
    if not exempt(GOOD_DEC, acc(vid="marry_aaaaaaaaaaaa")): fails.append("INV-015 v2: không miễn cho accept_place có quyết định (B) hợp lệ")
    if exempt(GOOD_DEC, acc(vid="marry_aaaaaaaaaaaa", label="admin:ffffffff")): fails.append("INV-015 v2: miễn nhầm khi nhãn không thuộc danh sách Capu")
    if exempt(GOOD_DEC, acc(vid="marry_aaaaaaaaaaaa", reason="x")): fails.append("INV-015 v2: miễn nhầm khi reason không khớp quyết định")
    if not exempt(GOOD_DEC, acc_a()): fails.append("INV-015 v2: mất điều khoản miễn cho nguồn (A)")
    if exempt({**GOOD_DEC, "2026-11-08-adr-048-x.md": fm() + "khac\n"}, acc_a()): fails.append("INV-015 v2: miễn nhầm nguồn (A) thiếu vendor_id")

shutil.rmtree(tmp, ignore_errors=True)
if fails:
    print("FAIL %s%s" % (fails[0], " (+%d lỗi nữa)" % (len(fails) - 1) if len(fails) > 1 else "")); sys.exit(1)
print("PASS INV-020 v2 và INV-015 v2: nhận quyết định của Capu qua cú bấm, vẫn từ chối giả mạo"); sys.exit(0)
