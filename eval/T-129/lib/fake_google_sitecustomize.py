# T-129: nạp tự động (PYTHONPATH) vào tiến trình con: chặn mọi kết nối mạng thật VÀ giả lập Google cho resolve_overrides.py (requests.get/post bị thay).
# share.google/<mã> -> 302 tới https://www.google.com/maps/place/Ten?place_id=ChIJFAKE<mã padding>; Place Details trả khối đủ trường; Text Search trả rỗng. Mọi URL khác -> lỗi mạng.
import socket
def _blocked(*a, **k):
    raise OSError("eval T-129: mạng bị chặn")
socket.socket.connect = _blocked
socket.socket.connect_ex = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _blocked
import requests
CALLS = []
class _R:
    def __init__(self, status=200, body=None, headers=None):
        self.status_code, self._b, self.headers, self.text = status, body, headers or {}, str(body)
    def json(self): return self._b
def _get(url, *a, **k):
    CALLS.append(("GET", url))
    if url.startswith("https://share.google/"):
        code = url.rsplit("/", 1)[1]
        return _R(302, None, {"Location": "https://www.google.com/maps/place/Ten+Gia?place_id=ChIJFAKE" + code.ljust(18, "x")[:18]})
    if url.startswith("https://places.googleapis.com/v1/places/"):
        pid = url.rsplit("/", 1)[1]
        return _R(200, {"id": pid, "displayName": {"text": "Ten Gia"}, "formattedAddress": "1 Duong Gia, Quan 1, Thanh pho Ho Chi Minh", "businessStatus": "OPERATIONAL",
                        "location": {"latitude": 10.77, "longitude": 106.7}})
    raise requests.ConnectionError("eval T-129: mạng bị chặn (" + url + ")")
def _post(url, *a, **k):
    CALLS.append(("POST", url))
    if "places:searchText" in url:
        return _R(200, {"places": []})
    raise requests.ConnectionError("eval T-129: mạng bị chặn (" + url + ")")
requests.get, requests.post = _get, _post
