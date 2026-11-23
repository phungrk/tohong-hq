"""Fake cho eval T-221: nạp nguyên fake của eval/T-219/_fake rồi, nếu FAKE_ERR được đặt, THAY phản hồi của lượt gọi thuộc loại đã chọn bằng một lỗi tuỳ ý (mã + thân thô như Google trả).
FAKE_ERR = JSON {"gemini"|"search"|"details": {"status": 402, "body": <chuỗi thô, hoặc đối tượng JSON>, "after": n (bỏ n lượt đầu loại đó, mặc định 0), "times": m (tối đa m lượt, mặc định không giới hạn),
 "ascii": true|false (đối tượng JSON được tuần tự hoá với ensure_ascii này; mặc định true: tên/địa chỉ tiếng Việt thành \\uXXXX như json.dumps mặc định), "ctype": chuỗi Content-Type (mặc định tự suy: text/html hoặc application/json; "" = không có header)}}.
Ký hiệu trong thân: <<PID>>, <<NAME>>, <<ADDR>>, <<WEB>>, <<QUERY>> thay bằng giá trị đã gửi; hậu tố @k chọn vendor thứ k của lô phân loại (0 = đầu, -1 = cuối; mặc định 0), vd <<NAME@-1>>;
hậu tố :upper / :lower đổi hoa-thường; :ent đổi MỌI ký tự thành thực thể số HTML (&#NN;), vd <<NAME:ent>>.
Lượt gốc vẫn đi qua fake T-219 (để ghi FAKE_P0_LOG), chỉ phản hồi bị thay. Không gọi mạng."""
import json, os, runpy

_here = os.path.dirname(os.path.abspath(__file__))
runpy.run_path(os.path.join(_here, "..", "..", "T-219", "_fake", "sitecustomize.py"))
if os.environ.get("FAKE_P0_FIXTURE") and os.environ.get("FAKE_ERR"):
    from requests.sessions import Session
    _cfg = json.loads(os.environ["FAKE_ERR"])
    _seen = {}

    def _kind(url):
        if "generativelanguage.googleapis.com" in url:
            return "gemini"
        if url.endswith(":searchText"):
            return "search"
        if "/v1/places/" in url:
            return "details"
        return ""

    def _sent(k, url, kw):
        """Giá trị đã gửi của lượt gọi này (để thân lỗi giả nhắc lại như Google có thể làm): PID (id trong đường dẫn Details, hoặc id đầu của lô phân loại),
        NAME/ADDR/WEB (vendor đầu của lô phân loại hoặc của prompt enrich), QUERY (Text Search). Thân lỗi dùng <<PID>>, <<NAME>>, <<ADDR>>, <<WEB>>, <<QUERY>>."""
        import re as _re
        d = {"PID": "", "NAME": "", "ADDR": "", "WEB": "", "QUERY": "", "BATCH": []}
        j = kw.get("json") or {}
        if k == "details":
            m = _re.search(r"/v1/places/([^/?#]+)", url)
            d["PID"] = m.group(1) if m else ""
        elif k == "search":
            d["QUERY"] = j.get("textQuery", "")
        elif k == "gemini":
            try:
                text = j["contents"][0]["parts"][0]["text"]
            except Exception:
                text = ""
            for ln in text.splitlines():
                parts = ln.split(" | ")
                if len(parts) == 4:
                    d["BATCH"].append({"PID": parts[0], "NAME": parts[1], "ADDR": parts[3]})
                    continue
                m = _re.match(r"tên: (.*) · địa chỉ: (.*) · website: (.*) · hạng mục: ", ln)
                if m:
                    d.update(NAME=m.group(1), ADDR=m.group(2), WEB=m.group(3))
                    break
            if d["BATCH"]:
                d.update(d["BATCH"][0])
        return d

    def _sub(x, sent):
        import re as _re
        def rep(m):
            k, at, mod = m.group(1), m.group(2), m.group(3)
            v = sent[k]
            if at is not None and sent["BATCH"] and k in ("PID", "NAME", "ADDR"):
                v = sent["BATCH"][int(at)][k]
            if mod == "upper":
                v = v.upper()
            elif mod == "lower":
                v = v.lower()
            elif mod == "ent":
                v = "".join("&#%d;" % ord(ch) for ch in v)
            return v
        if isinstance(x, str):
            return _re.sub(r"<<(PID|NAME|ADDR|WEB|QUERY)(?:@(-?\d+))?(?::(upper|lower|ent))?>>", rep, x)
        if isinstance(x, list):
            return [_sub(i, sent) for i in x]
        if isinstance(x, dict):
            return {k: _sub(v, sent) for k, v in x.items()}
        return x

    def _req(self, method, url, *a, **kw):
        r = _orig(self, method, url, *a, **kw)
        k = _kind(str(url))
        c = _cfg.get(k)
        if c:
            n = _seen[k] = _seen.get(k, 0) + 1
            if n > c.get("after", 0) and (c.get("times") is None or n <= c.get("after", 0) + c["times"]):
                b = c.get("body", "")
                sent = _sent(k, str(url), kw)
                b = _sub(b, sent)
                r.status_code = c["status"]
                r._content = (b if isinstance(b, str) else json.dumps(b, ensure_ascii=c.get("ascii", True))).encode("utf-8")
                if os.environ.get("FAKE_ERR_SENT"):
                    with open(os.environ["FAKE_ERR_SENT"], "a", encoding="utf-8") as f:
                        f.write(json.dumps(dict(sent, kind=k, body_bytes=len(r._content)), ensure_ascii=False) + "\n")
                ct = c.get("ctype")
                if ct is None:
                    ct = "text/html" if isinstance(b, str) and not b.lstrip().startswith("{") else "application/json"
                r.headers.pop("Content-Type", None)
                if ct:
                    r.headers["Content-Type"] = ct
        return r

    _orig = Session.request
    Session.request = _req
