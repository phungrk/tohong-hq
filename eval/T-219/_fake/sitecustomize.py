"""Google Places + Gemini GIẢ cho eval T-219 (không bao giờ gọi mạng thật). Tự nạp khi PYTHONPATH trỏ tới thư mục này và FAKE_P0_FIXTURE được đặt.
Vá requests.sessions.Session.request (mọi requests.get/post và Session.get/post đi qua đây). Mỗi lượt gọi ghi một dòng JSON vào FAKE_P0_LOG:
{"kind": search|details|gemini|other, "role": grid|classify|enrich|"" (chỉ gemini), "url", "method", "key_in_url": bool, "key_header": str|None,
 "mask": str (X-Goog-FieldMask), "tools": bool (body có google_search), "model": str, "text": str (toàn bộ văn bản prompt), "q": textQuery, "page_token": str}
Mode {"deny": true}: mọi lượt gọi bị ghi rồi ném lỗi. Host khác googleapis.com -> kind other, luôn ném lỗi.
Fixture: {"places": {pid: {name,address,status,reviews,rating,types}},
          "search": [{"match": "<chuỗi con của textQuery đã bỏ dấu, chữ thường>", "pages": [[pid,...],[pid,...]]}],
          "gemini": {"grid": {"phrasings": [...]}, "grid_status": 200, "status": 200,
                     "classify": {pid: {"label": str|None, "reason": str}},
                     "enrich": [{"match": "<chuỗi con của prompt đã bỏ dấu>", "resp": {...}, "queries": [...], "chunks": [{"uri","title"}], "raw": "<văn bản thô thay resp>"}],
                     "tokens_in": 10000, "tokens_out": 1000},
          "deny": bool}
Fake cố ý trả THỪA trường (location, số điện thoại, website, review) bất kể field mask, để eval kiểm CLI không lưu thứ nó không cần.
Fake từ chối (HTTP 400) Text Search có mask chứa trường bậc Enterprise (rating, userRatingCount, websiteUri, internationalPhoneNumber, reviews, photos,
currentOpeningHours, editorialSummary) và Place Details có mask chứa website/điện thoại/review/ảnh/giờ mở cửa/editorialSummary."""
import json, os, re, unicodedata

_fx = os.environ.get("FAKE_P0_FIXTURE")
if _fx:
    import requests
    from requests.sessions import Session

    def _fold(s):
        s = unicodedata.normalize("NFD", (s or "").lower().replace("đ", "d"))
        return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()

    def _resp(code, body=None, url=""):
        r = requests.Response()
        r.status_code = code
        r._content = json.dumps(body if body is not None else {}).encode("utf-8")
        r.url = url
        r.encoding = "utf-8"
        r.headers.update({"Content-Type": "application/json"})
        return r

    ENT = ("rating", "userratingcount", "websiteuri", "internationalphonenumber", "reviews", "photos", "currentopeninghours", "editorialsummary")
    DET_BAD = ("websiteuri", "internationalphonenumber", "reviews", "photos", "currentopeninghours", "editorialsummary", "nationalphonenumber", "location")

    def _fake_request(self, method, url, *args, **kwargs):
        fx = json.load(open(_fx, encoding="utf-8"))
        url = str(url)
        hdr = {str(k).lower(): v for k, v in (kwargs.get("headers") or {}).items()}
        host = re.sub(r"^https?://", "", url).split("/")[0].lower()
        body = kwargs.get("json")
        if body is None and kwargs.get("data"):
            try:
                body = json.loads(kwargs["data"])
            except (TypeError, ValueError):
                body = {}
        body = body or {}
        keys = [k for k in (os.environ.get("FAKE_P0_KEYS") or "").split(",") if k]
        rec = {"kind": "other", "role": "", "url": url, "method": method.upper(), "key_in_url": any(k in url for k in keys) or bool(re.search(r"[?&]key=", url)),
               "key_header": hdr.get("x-goog-api-key"), "mask": hdr.get("x-goog-fieldmask", ""), "tools": False, "model": "", "text": "", "q": "", "page_token": ""}
        if host == "places.googleapis.com" and url.endswith(":searchText"):
            rec.update(kind="search", q=body.get("textQuery", ""), page_token=body.get("pageToken", "") or "")
        elif host == "places.googleapis.com" and "/v1/places/" in url:
            rec["kind"] = "details"
        elif host == "generativelanguage.googleapis.com" and ":generateContent" in url:
            parts = [p.get("text", "") for c in body.get("contents", []) for p in c.get("parts", [])]
            si = body.get("systemInstruction") or body.get("system_instruction") or {}
            parts += [p.get("text", "") for p in si.get("parts", [])]
            tools = any("google_search" in t or "googleSearch" in t for t in body.get("tools") or [])
            rec.update(kind="gemini", tools=tools, text="\n".join(parts), model=url.split("/models/")[1].split(":")[0])
        places = fx.get("places") or {}
        gm = fx.get("gemini") or {}
        if fx.get("deny") or rec["kind"] == "other":
            _write(rec)
            raise requests.ConnectionError("eval T-219: không cho phép gọi %s %s" % (method, url))
        if rec["kind"] == "search":
            _write(rec)
            m = rec["mask"].lower()
            if any(e in m for e in ENT):
                return _resp(400, {"error": {"code": 400, "message": "fake: mask bậc Enterprise không được dùng cho Text Search Pro"}}, url)
            q = _fold(rec["q"])
            for rule in fx.get("search") or []:
                if _fold(rule["match"]) in q:
                    pages = rule["pages"]
                    i = int(rec["page_token"][3:]) if rec["page_token"].startswith("tok") else 0
                    out = {"places": [_place(places, pid) for pid in pages[i]]}
                    if i + 1 < len(pages):
                        out["nextPageToken"] = "tok%d" % (i + 1)
                    return _resp(200, out, url)
            return _resp(200, {}, url)
        if rec["kind"] == "details":
            _write(rec)
            m = rec["mask"].lower()
            if any(e in m for e in DET_BAD):
                return _resp(400, {"error": {"code": 400, "message": "fake: mask Place Details chứa trường không cần cho P0"}}, url)
            pid = url.split("/v1/places/")[1].split("?")[0]
            if pid not in places or pid in (fx.get("details_404") or []):
                return _resp(404, {"error": {"code": 404, "status": "NOT_FOUND"}}, url)
            return _resp(200, _place(places, pid), url)
        # gemini
        pids = [p for p in (gm.get("classify") or {}) if re.search(r"(?<![A-Za-z0-9])%s(?![A-Za-z0-9])" % re.escape(p), rec["text"])]
        if rec["tools"]:
            rec["role"] = "enrich"
        elif pids:
            rec["role"] = "classify"
        else:
            rec["role"] = "grid"
        _write(rec)
        st = gm.get("grid_status", 200) if rec["role"] == "grid" else gm.get("status", 200)
        if st != 200:
            return _resp(st, {"error": {"code": st, "message": "fake gemini lỗi"}}, url)
        meta = {}
        if rec["role"] == "grid":
            payload = gm.get("grid") or {}
        elif rec["role"] == "classify":
            payload = [{"place_id": p, "label": gm["classify"][p]["label"], "reason": gm["classify"][p].get("reason", "")} for p in pids if gm["classify"][p].get("label") is not None]
        else:
            payload = {"price": None, "description": None, "capacity": None, "contact": None}
            t = _fold(rec["text"])
            for rule in gm.get("enrich") or []:
                if _fold(rule["match"]) in t:
                    payload = rule.get("raw") if rule.get("raw") is not None else rule["resp"]
                    meta = {"webSearchQueries": rule.get("queries", []), "groundingChunks": [{"web": c} for c in rule.get("chunks", [])]}
                    break
        text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        cand = {"content": {"role": "model", "parts": [{"text": text}]}}
        if rec["tools"]:
            cand["groundingMetadata"] = meta
        return _resp(200, {"candidates": [cand], "usageMetadata": {"promptTokenCount": gm.get("tokens_in", 10000), "candidatesTokenCount": gm.get("tokens_out", 1000)}}, url)

    def _place(places, pid):
        p = places[pid]
        return {"id": pid, "displayName": {"text": p["name"], "languageCode": "vi"}, "formattedAddress": p["address"], "businessStatus": p.get("status", "OPERATIONAL"),
                "types": p.get("types", ["car_rental"]), "rating": p.get("rating", 4.6), "userRatingCount": p.get("reviews", 40),
                "location": {"latitude": 10.123456, "longitude": 106.654321}, "internationalPhoneNumber": "+84 909 000 111", "websiteUri": "https://sentinel-site.example/",
                "reviews": [{"text": {"text": "REVIEWTEXT-SENTINEL"}}]}

    def _write(rec):
        with open(os.environ["FAKE_P0_LOG"], "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    Session.request = _fake_request
