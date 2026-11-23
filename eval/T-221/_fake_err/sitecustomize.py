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

    def _req(self, method, url, *a, **kw):
        r = _orig(self, method, url, *a, **kw)
        k = _kind(str(url))
        c = _cfg.get(k)
        if c:
            n = _seen[k] = _seen.get(k, 0) + 1
            if n > c.get("after", 0) and (c.get("times") is None or n <= c.get("after", 0) + c["times"]):
                b = c.get("body", "")
                r.status_code = c["status"]
                r._content = (b if isinstance(b, str) else json.dumps(b)).encode("utf-8")
                r.headers["Content-Type"] = "text/html" if isinstance(b, str) and not b.lstrip().startswith("{") else "application/json"
        return r

    _orig = Session.request
    Session.request = _req
