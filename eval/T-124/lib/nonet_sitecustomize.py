# T-124: nạp tự động (PYTHONPATH) vào tiến trình con để mọi kết nối mạng ném lỗi: bằng chứng "không gọi Google".
import socket
def _blocked(*a, **k):
    raise OSError("eval T-124: mạng bị chặn")
socket.socket.connect = _blocked
socket.socket.connect_ex = _blocked
socket.create_connection = _blocked
socket.getaddrinfo = _blocked
