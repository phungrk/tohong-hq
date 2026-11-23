"""Fake cho eval T-221: nạp nguyên fake của eval/T-219/_fake rồi, nếu FAKE_ERR được đặt, THAY phản hồi của lượt gọi thuộc loại đã chọn bằng một lỗi tuỳ ý (mã + thân thô như Google trả).
FAKE_ERR = JSON {"gemini"|"search"|"details": {"status": 402, "body": <chuỗi thô, hoặc đối tượng JSON>, "after": n (bỏ n lượt đầu loại đó, mặc định 0), "times": m (tối đa m lượt, mặc định không giới hạn)}}.
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
        d = {"PID": "", "NAME": "", "ADDR": "", "WEB": "", "QUERY": ""}
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
                    d.update(PID=parts[0], NAME=parts[1], ADDR=parts[3])
                    break
                m = _re.match(r"tên: (.*) · địa chỉ: (.*) · website: (.*) · hạng mục: ", ln)
                if m:
                    d.update(NAME=m.group(1), ADDR=m.group(2), WEB=m.group(3))
                    break
        return d

    def _sub(x, sent):
        import re as _re
        if isinstance(x, str):
            return _re.sub(r"<<(PID|NAME|ADDR|WEB|QUERY)>>", lambda m: sent[m.group(1)], x)
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
                if os.environ.get("FAKE_ERR_SENT"):
                    with open(os.environ["FAKE_ERR_SENT"], "a", encoding="utf-8") as f:
                        f.write(json.dumps(dict(sent, kind=k), ensure_ascii=False) + "\n")
                b = _sub(b, sent)
                r.status_code = c["status"]
                r._content = (b if isinstance(b, str) else json.dumps(b)).encode("utf-8")
                r.headers["Content-Type"] = "text/html" if isinstance(b, str) and not b.lstrip().startswith("{") else "application/json"
        return r

    _orig = Session.request
    Session.request = _req
