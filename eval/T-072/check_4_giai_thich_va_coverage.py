#!/usr/bin/env python3
"""T-072 tiêu chí 4: (a) reasons/whyThisVendor/whyThoseVendors và khối formatMatchBlock không có tag thô (tên vendor được loại khỏi phép quét);
(b) không nói 'gu'/'phong cách'/'style' khi matched = 0; (c) khi matched >= 1 câu nêu nhãn tiếng Việt của style cặp đôi đã chọn;
(d) mỗi vendor của computeMatches có match.styleCoverage = {matched,total} nguyên, 0<=matched<=total, total = số style khác nhau cặp đôi chọn. Mã thoát 0 = PASS."""
import json, os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
cands = [os.environ.get("TOHONG_BACK_REPO"), os.getcwd(), os.path.join(os.getcwd(), "..", "tohong-back"), os.path.join(HERE, "..", "..", "..", "tohong-back")]
repo = next((os.path.abspath(c) for c in cands if c and os.path.isfile(os.path.join(c, "lib", "vendorMatcher.js"))), None)
if not repo: print("FAIL không tìm thấy repo tohong-back (đặt TOHONG_BACK_REPO)"); sys.exit(1)
cases = os.path.join(HERE, "style-cases.json")
C = json.load(open(cases, encoding="utf-8"))
p = subprocess.run(["node", os.path.join(HERE, "lib", "run_js.mjs"), repo, cases, "text"], capture_output=True, text=True, timeout=300)
if p.returncode != 0: print("FAIL chạy lỗi node: " + (p.stderr or p.stdout)[-200:]); sys.exit(1)
R = json.loads(p.stdout)
RAW = set(C["all_tags"]) | {"gothic", "han"}
claim = re.compile(r"\bgu\b|phong cách|style", re.I)
def raw_in(text, name=""):
    t = text.replace(name, " ") if name else text
    return [w for w in RAW if re.search(r"(?<![\wÀ-ỹ])" + re.escape(w) + r"(?![\wÀ-ỹ])", t, re.I)]
bad = []
for v in R["vendors"]:
    tag = f'{v["cat"]}/{v["couple"]}/{v["name"][:25]}'
    cov = v["coverage"]
    want_total = len({s.lower().strip() for s in v["couple"]})
    if not (isinstance(cov, dict) and isinstance(cov.get("matched"), int) and isinstance(cov.get("total"), int) and 0 <= cov["matched"] <= cov["total"] and cov["total"] == want_total):
        bad.append(f"{tag}: styleCoverage={cov} cần total={want_total}"); continue
    if (cov["matched"] > 0) != v["truth_matched"]: bad.append(f"{tag}: matched={cov['matched']} lệch sự thật {v['truth_matched']}")
    texts = v["labels"] + [v["why"]]
    for t in texts:
        r = raw_in(t, v["name"])
        if r: bad.append(f"{tag}: tag thô {r} trong «{t[:60]}»")
    if cov["matched"] == 0:
        for t in texts:
            if claim.search(t.replace(v["name"], " ")): bad.append(f"{tag}: nói gu/style khi matched=0: «{t[:60]}»")
    else:
        labs = [C["labels_vi"][s] for s in (x.lower().strip() for x in v["couple"]) if s in C["labels_vi"]]
        if labs:
            if not any(l.lower() in v["why"].lower() for l in labs): bad.append(f"{tag}: whyThisVendor không nêu nhãn {labs}")
            if not any(l.lower() in lab.lower() for lab in v["labels"] for l in labs): bad.append(f"{tag}: reasons không nêu nhãn {labs}")
for L in R["lists"]:
    if L["text"]:
        r = raw_in(L["text"])
        if r: bad.append(f'list {L["cat"]}/{L["couple"]}: tag thô {r}')
        if not L["anyMatched"] and claim.search(L["text"]): bad.append(f'list {L["cat"]}/{L["couple"]}: nói gu/style dù không vendor nào khớp')
for F in R["formatter"]:
    tag = f'formatter pref={F["pref"]} tags={F["tags"]}'
    r = raw_in(F["text"], "Studio Mẫu")
    if r: bad.append(f"{tag}: tag thô {r}")
    body = F["text"].replace("Studio Mẫu", " ").split("Phù hợp vì:")[-1]
    if not F["truth_matched"] and claim.search(body): bad.append(f"{tag}: nói gu/style khi không khớp")
    if F["truth_matched"]:
        labs = [C["labels_vi"][s] for s in F["pref"]]
        if not any(l.lower() in body.lower() for l in labs): bad.append(f"{tag}: không nêu nhãn {labs}")
if bad: print(f'FAIL {len(bad)} lỗi trên {len(R["vendors"])} vendor, {len(R["formatter"])} khối formatter; đầu tiên: ' + " | ".join(bad[:3])); sys.exit(1)
print(f'PASS {len(R["vendors"])} vendor, {len(R["lists"])} danh sách, {len(R["formatter"])} khối formatter')
