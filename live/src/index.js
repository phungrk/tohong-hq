// tohong-live: đường truyền realtime của Tơ Hồng HQ.
//
//   POST /event      agent gửi sự kiện hoặc nhịp hoạt động (cần Authorization: Bearer <LIVE_TOKEN>)
//   GET  /ws         dashboard mở WebSocket, nhận ảnh chụp rồi nhận từng sự kiện ngay khi xảy ra
//   GET  /snapshot   ảnh chụp hiện tại dạng JSON (sự kiện gần nhất + agent đang hoạt động)
//
// Chỉ lưu và phát các trường công khai: không có nội dung defect, ghi chú hay đường dẫn file.
// Git vẫn là sổ cái gốc; đây chỉ là đường truyền nhanh.

import { DurableObject } from "cloudflare:workers";

const KEEP_EVENTS = 300;          // số sự kiện giữ lại cho ảnh chụp
const ACTIVITY_TTL_MS = 120_000;  // agent không có nhịp mới sau 2 phút coi như nghỉ
const MAX_BODY = 8_192;

const EVENT_FIELDS = ["id", "t", "task", "title", "event", "from", "to", "round", "severity", "cost",
                      "state", "holder", "owner", "reviewer", "rounds"];
const ACTIVITY_FIELDS = ["agent", "action", "tool", "task"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

function pick(obj, fields) {
  const out = {};
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null) continue;
    if (typeof v === "string") out[f] = v.slice(0, 300);
    else if (typeof v === "number" && Number.isFinite(v)) out[f] = v;
  }
  return out;
}

function sameToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class LiveHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT UNIQUE, body TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS activity (agent TEXT PRIMARY KEY, at INTEGER NOT NULL, body TEXT NOT NULL)`);
  }

  snapshot() {
    const events = this.sql.exec(`SELECT body FROM events ORDER BY seq DESC LIMIT ?`, KEEP_EVENTS)
      .toArray().map((r) => JSON.parse(r.body)).reverse();
    const since = Date.now() - ACTIVITY_TTL_MS;
    const activity = this.sql.exec(`SELECT body FROM activity WHERE at > ?`, since)
      .toArray().map((r) => JSON.parse(r.body));
    return { type: "snapshot", server_time: Date.now(), events, activity };
  }

  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(text); } catch (_) { /* kết nối đã đóng */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify(this.snapshot()));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/snapshot") return json(this.snapshot());

    if (url.pathname === "/event" && request.method === "POST") {
      const msg = await request.json();
      const now = Date.now();
      if (msg.type === "activity") {
        const a = { type: "activity", ...pick(msg, ACTIVITY_FIELDS), at: now };
        if (!a.agent) return json({ ok: false, error: "thiếu agent" }, 400);
        this.sql.exec(`INSERT INTO activity (agent, at, body) VALUES (?, ?, ?)
                       ON CONFLICT(agent) DO UPDATE SET at = excluded.at, body = excluded.body`,
                      a.agent, now, JSON.stringify(a));
        this.broadcast(a);
        return json({ ok: true });
      }
      const e = { type: "event", ...pick(msg, EVENT_FIELDS), received: now };
      if (!e.event || !e.t) return json({ ok: false, error: "thiếu event hoặc t" }, 400);
      const key = [e.id, e.task, e.event, e.t].join("|");
      const res = this.sql.exec(`INSERT OR IGNORE INTO events (k, body) VALUES (?, ?)`, key, JSON.stringify(e));
      if (res.rowsWritten > 0) {
        this.sql.exec(`DELETE FROM events WHERE seq <= (SELECT MAX(seq) FROM events) - ?`, KEEP_EVENTS);
        this.broadcast(e);
      }
      return json({ ok: true, duplicate: res.rowsWritten === 0 });
    }

    return json({ ok: false, error: "không có đường dẫn này" }, 404);
  }

  async webSocketMessage(ws, message) {
    if (message === "ping") ws.send("pong");
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch (_) { /* đã đóng */ }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const hub = env.HUB.get(env.HUB.idFromName("tohong-hq"));

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "cần WebSocket" }, 426);
      return hub.fetch(request);
    }
    if (url.pathname === "/snapshot" && request.method === "GET") return hub.fetch(request);

    if (url.pathname === "/event" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!sameToken(token, env.LIVE_TOKEN || "")) return json({ ok: false, error: "sai hoặc thiếu token" }, 401);
      const len = Number(request.headers.get("Content-Length") || 0);
      if (len > MAX_BODY) return json({ ok: false, error: "quá lớn" }, 413);
      return hub.fetch(request);
    }

    if (url.pathname === "/") {
      return new Response("tohong-live: đường truyền realtime của Tơ Hồng HQ. Xem /snapshot.", { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } });
    }
    return json({ ok: false, error: "không có đường dẫn này" }, 404);
  },
};
