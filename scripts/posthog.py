#!/usr/bin/env python3
"""Đọc dữ liệu sản phẩm Tơ Hồng từ PostHog (chỉ đọc), cho bộ phận Insight.

Mọi con số trong báo cáo insight phải tái lập được: script này in kèm truy vấn HogQL đã chạy.

Cấu hình (không bao giờ đưa key vào repo):
  POSTHOG_HOST        mặc định https://us.posthog.com
  POSTHOG_PROJECT_ID  mặc định 469478 (project Tơ Hồng, US Cloud)
  POSTHOG_API_KEY     personal API key CHỈ ĐỌC. Không đặt cũng được nếu môi trường cloud có
                      Network secret gắn header Authorization cho host *.posthog.com.

Lệnh:
  python3 scripts/posthog.py schema                 # event nào đang được gửi, property gì (30 ngày)
  python3 scripts/posthog.py summary [--days 7]     # số event theo loại, người dùng, phiên
  python3 scripts/posthog.py funnel [--days 7]      # phễu mặc định: xem danh sách → xem hồ sơ → liên hệ (đổi bằng --steps)
  python3 scripts/posthog.py zero [--days 7]        # tìm kiếm ra 0 kết quả (cần event có property result_count)
  python3 scripts/posthog.py errors [--days 7]      # $exception theo ngày và theo loại
  python3 scripts/posthog.py sql "SELECT event, count() FROM events WHERE timestamp > now() - interval 7 day GROUP BY event"
  --json để máy đọc; --md (mặc định) để dán vào báo cáo.

Chỉ dùng endpoint đọc: /api/projects/<id>/query (HogQL) và /api/projects/<id>/event_definitions.
Không có lệnh nào ghi, xoá, hay chạm dữ liệu cá nhân (không SELECT distinct_id, email, phone ra báo cáo).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

HOST = os.environ.get("POSTHOG_HOST", "https://us.posthog.com").rstrip("/")
PROJECT = os.environ.get("POSTHOG_PROJECT_ID", "469478")
KEY = os.environ.get("POSTHOG_API_KEY", "")
FORBIDDEN = ("distinct_id", "$email", "email", "phone", "$ip", "person.properties")


def call(path, body=None):
    url = f"{HOST}/api/projects/{PROJECT}/{path}"
    headers = {"Content-Type": "application/json", "User-Agent": "tohong-hq-insight/1.0"}
    if KEY:
        headers["Authorization"] = f"Bearer {KEY}"
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:400]
        if e.code in (401, 403):
            raise SystemExit(f"PostHog từ chối ({e.code}): thiếu hoặc sai key/scope. Cần personal API key chỉ đọc cho project {PROJECT}. {msg}")
        raise SystemExit(f"PostHog lỗi {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Không tới được {HOST}: {e.reason}. Môi trường cloud cần cho phép host *.posthog.com.")


def hogql(query):
    bad = [w for w in FORBIDDEN if w in query.lower()]
    if bad:
        raise SystemExit(f"Truy vấn chạm dữ liệu cá nhân ({', '.join(bad)}). Insight chỉ đọc số liệu tổng hợp.")
    res = call("query/", {"query": {"kind": "HogQLQuery", "query": query}})
    return {"query": query, "columns": res.get("columns", []), "rows": res.get("results", [])}


def md_table(cols, rows, limit=50):
    if not rows:
        return "_(không có dòng nào)_"
    out = ["| " + " | ".join(str(c) for c in cols) + " |", "|" + "---|" * len(cols)]
    for r in rows[:limit]:
        out.append("| " + " | ".join(str(x) for x in r) + " |")
    if len(rows) > limit:
        out.append(f"\n_… {len(rows) - limit} dòng nữa_")
    return "\n".join(out)


def emit(a, title, result):
    if a.json:
        print(json.dumps({"title": title, **result}, ensure_ascii=False, indent=2))
        return
    print(f"### {title}\n")
    print(md_table(result["columns"], result["rows"]))
    print(f"\n<details><summary>HogQL</summary>\n\n```sql\n{result['query'].strip()}\n```\n</details>\n")


def cmd_schema(a):
    res = call("event_definitions/?limit=200&order_by=-last_seen_at")
    rows = [[d.get("name"), d.get("volume_30_day") or 0, (d.get("last_seen_at") or "")[:10]] for d in res.get("results", [])]
    rows.sort(key=lambda r: -(r[1] or 0))
    emit(a, "Event đang được gửi (30 ngày)", {"query": "GET event_definitions", "columns": ["event", "volume_30d", "last_seen"], "rows": rows})
    print("_Event nào Insight cần mà chưa có trong bảng này → đề xuất đo thêm trong báo cáo tuần._")


def cmd_summary(a):
    d = a.days
    emit(a, f"Số event theo loại, {d} ngày", hogql(f"""
        SELECT event, count() AS n, count(DISTINCT person_id) AS nguoi, count(DISTINCT $session_id) AS phien
        FROM events WHERE timestamp > now() - interval {d} day AND event NOT LIKE '$%'
        GROUP BY event ORDER BY n DESC LIMIT 40"""))
    emit(a, f"Người dùng và phiên theo ngày, {d} ngày", hogql(f"""
        SELECT toDate(timestamp) AS ngay, count(DISTINCT person_id) AS nguoi, count(DISTINCT $session_id) AS phien, count() AS event
        FROM events WHERE timestamp > now() - interval {d} day GROUP BY ngay ORDER BY ngay"""))


def cmd_funnel(a):
    steps = [s.strip() for s in a.steps.split(",")]
    d = a.days
    parts = ", ".join(f"countIf(event = '{s}') AS b{i}" for i, s in enumerate(steps))
    emit(a, f"Phễu {' → '.join(steps)}, {d} ngày (số người qua từng bước)", hogql(f"""
        SELECT {', '.join(f"countIf(b{i} > 0) AS buoc{i + 1}_{steps[i].replace(' ', '_')}" for i in range(len(steps)))}
        FROM (SELECT person_id, {parts} FROM events WHERE timestamp > now() - interval {d} day GROUP BY person_id)"""))


def cmd_zero(a):
    d = a.days
    emit(a, f"Tìm kiếm ra 0 kết quả, {d} ngày", hogql(f"""
        SELECT countIf(toInt64OrNull(toString(properties.{a.prop})) = 0) AS khong_ket_qua, count() AS tong,
               round(100 * khong_ket_qua / tong, 1) AS ty_le_pct
        FROM events WHERE timestamp > now() - interval {d} day AND event = '{a.event}'"""))
    emit(a, "Bộ lọc hay ra 0 kết quả nhất (top 20)", hogql(f"""
        SELECT properties.category AS hang_muc, properties.budget_max AS ngan_sach_toi_da, count() AS lan
        FROM events WHERE timestamp > now() - interval {d} day AND event = '{a.event}'
          AND toInt64OrNull(toString(properties.{a.prop})) = 0
        GROUP BY hang_muc, ngan_sach_toi_da ORDER BY lan DESC LIMIT 20"""))


def cmd_errors(a):
    d = a.days
    emit(a, f"Sự cố ($exception) theo ngày, {d} ngày", hogql(f"""
        SELECT toDate(timestamp) AS ngay, count() AS loi, count(DISTINCT $session_id) AS phien_bi
        FROM events WHERE timestamp > now() - interval {d} day AND event = '$exception' GROUP BY ngay ORDER BY ngay"""))
    emit(a, "Loại lỗi gặp nhiều nhất", hogql(f"""
        SELECT properties.$exception_types AS loai, properties.$current_url AS trang, count() AS lan
        FROM events WHERE timestamp > now() - interval {d} day AND event = '$exception'
        GROUP BY loai, trang ORDER BY lan DESC LIMIT 20"""))


def cmd_sql(a):
    emit(a, "HogQL", hogql(a.query))


def main():
    p = argparse.ArgumentParser(description="Đọc PostHog cho Insight (chỉ đọc)")
    p.add_argument("--json", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("schema").set_defaults(fn=cmd_schema)
    for name, fn in (("summary", cmd_summary), ("errors", cmd_errors)):
        s = sub.add_parser(name); s.add_argument("--days", type=int, default=7); s.set_defaults(fn=fn)
    s = sub.add_parser("funnel"); s.add_argument("--days", type=int, default=7)
    s.add_argument("--steps", default="vendor_list_viewed,vendor_viewed,vendor_contacted", help="tên event, cách nhau bằng dấu phẩy")
    s.set_defaults(fn=cmd_funnel)
    s = sub.add_parser("zero"); s.add_argument("--days", type=int, default=7)
    s.add_argument("--event", default="vendor_search"); s.add_argument("--prop", default="result_count"); s.set_defaults(fn=cmd_zero)
    s = sub.add_parser("sql"); s.add_argument("query"); s.set_defaults(fn=cmd_sql)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
