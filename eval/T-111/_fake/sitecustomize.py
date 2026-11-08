"""Google GIẢ cho eval T-111 (bản của T-110 + hai khoá luật search: "absent" = chỉ khớp khi chuỗi này KHÔNG có trong query; "status" = trả mã HTTP lỗi) (không bao giờ gọi mạng thật). Tự nạp khi PYTHONPATH trỏ tới thư mục này và FAKE_GOOGLE_FIXTURE được đặt.
Vá requests.sessions.Session.request (mọi requests.get/post/head và Session.get/post đều đi qua đây), nên eval chạy ĐÚNG lệnh CLI như workflow
mà không cần biết cài đặt dùng hàm nào. Mọi lượt gọi ghi một dòng JSON vào FAKE_GOOGLE_LOG: {"kind","method","url"}.
kind: share (share.google, goo.gl, maps.app.goo.gl) | maps (google.com/maps/*) | search (places:searchText) | details (places/<id>) | media (/media) | other.
Mode deny (fixture {"deny": true}): MỌI lượt gọi đều bị ghi lại rồi ném lỗi (chạy offline thật sự). 'other' luôn ném lỗi.
Fixture: {"places": {pid: {name,address,status,lat,lng,photos:[{name,authorAttributions}]}},
          "search": [{"match": "<chuỗi con của textQuery, không dấu, chữ thường>", "ids": [pid,...]}],
          "links": {url: {"status": 200|404|..., "to": "<url đích sau chuyển hướng>"}}, "deny": bool}"""
import json
import os
import re
import unicodedata

_fx = os.environ.get("FAKE_GOOGLE_FIXTURE")
if _fx:
    import requests
    from requests.sessions import Session

    def _fold(s):
        s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
        return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()

    def _resp(code, body=None, url="", headers=None):
        r = requests.Response()
        r.status_code = code
        r._content = json.dumps(body if body is not None else {}).encode("utf-8")
        r.url = url
        r.encoding = "utf-8"
        r.headers.update(headers or {"Content-Type": "application/json"})
        return r

    def _log(kind, method, url, q=""):
        p = os.environ.get("FAKE_GOOGLE_LOG")
        if p:
            with open(p, "a", encoding="utf-8") as f:
                f.write(json.dumps({"kind": kind, "method": method.upper(), "url": url, "q": q}, ensure_ascii=False) + "\n")

    def _fake_request(self, method, url, *args, **kwargs):
        fx = json.load(open(_fx, encoding="utf-8"))
        url = str(url)
        host = re.sub(r"^https?://", "", url).split("/")[0].lower()
        if host in ("share.google", "goo.gl", "maps.app.goo.gl"):
            kind = "share"
        elif host.endswith("google.com") and "/maps" in url:
            kind = "maps"
        elif host == "places.googleapis.com" and url.endswith(":searchText"):
            kind = "search"
        elif host == "places.googleapis.com" and url.rstrip("/").endswith("/media"):
            kind = "media"
        elif host == "places.googleapis.com" and "/v1/places/" in url:
            kind = "details"
        else:
            kind = "other"
        _log(kind, method, url, (kwargs.get("json") or {}).get("textQuery", "") if kind == "search" else "")
        if fx.get("deny") or kind == "other":
            raise requests.ConnectionError("eval T-110: không cho phép gọi %s %s (kind=%s)" % (method, url, kind))
        if kind == "share":
            link = (fx.get("links") or {}).get(url)
            if not link:
                return _resp(404, {}, url)
            if link.get("status", 200) != 200:
                return _resp(link["status"], {}, url)
            if kwargs.get("allow_redirects", True) is False:
                return _resp(302, {}, url, {"Location": link["to"]})
            return _resp(200, {}, link["to"])
        if kind == "maps":
            return _resp(200, {}, url)
        places = fx.get("places") or {}

        def obj(pid):
            p = places[pid]
            o = {"id": pid, "displayName": {"text": p["name"]}, "formattedAddress": p["address"], "businessStatus": p.get("status", "OPERATIONAL"),
                 "photos": p.get("photos") or []}
            if p.get("lat") is not None:
                o["location"] = {"latitude": p["lat"], "longitude": p["lng"]}
            return o

        if kind == "search":
            q = _fold((kwargs.get("json") or {}).get("textQuery", ""))
            for rule in fx.get("search") or []:
                if _fold(rule["match"]) in q and not (rule.get("absent") and _fold(rule["absent"]) in q):
                    if rule.get("status"):
                        return _resp(rule["status"], {"error": {"code": rule["status"]}}, url)
                    return _resp(200, {"places": [obj(i) for i in rule["ids"]][:1]}, url)
            return _resp(200, {}, url)
        if kind == "details":
            pid = url.split("/v1/places/")[1].split("?")[0]
            if pid not in places:
                return _resp(404, {"error": {"code": 404, "status": "NOT_FOUND"}}, url)
            return _resp(200, obj(pid), url)
        if kind == "media":
            name = url.split("/v1/")[1].rsplit("/media", 1)[0]
            return _resp(200, {"name": name + "/media", "photoUri": "https://lh3.googleusercontent.com/fixture/" + name.replace("/", "_")}, url)
        raise AssertionError(kind)

    Session.request = _fake_request
