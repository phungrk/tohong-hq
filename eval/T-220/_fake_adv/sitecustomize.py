"""Fake cho eval đối kháng T-220: nạp nguyên fake của eval/T-219/_fake rồi (tuỳ chọn) gộp thêm khoá vào usageMetadata của mọi phản hồi Gemini 200
(FAKE_ADV_USAGE = JSON, vd {"thoughtsTokenCount": 3000, "toolUsePromptTokenCount": 5000}). Không gọi mạng."""
import json, os, runpy

_here = os.path.dirname(os.path.abspath(__file__))
runpy.run_path(os.path.join(_here, "..", "..", "T-219", "_fake", "sitecustomize.py"))
if os.environ.get("FAKE_P0_FIXTURE") and os.environ.get("FAKE_ADV_USAGE"):
    from requests.sessions import Session
    _orig = Session.request
    _extra = json.loads(os.environ["FAKE_ADV_USAGE"])

    def _req(self, method, url, *a, **kw):
        r = _orig(self, method, url, *a, **kw)
        if "generativelanguage.googleapis.com" in str(url) and r.status_code == 200:
            d = json.loads(r._content)
            d.setdefault("usageMetadata", {}).update(_extra)
            r._content = json.dumps(d).encode("utf-8")
        return r

    Session.request = _req
