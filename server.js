// PK Efekt sunucusu — overlay (Studio) ve panel (telefon) arasında köprü
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const app = express();
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));
app.get("/overlay", (_, res) => res.sendFile(path.join(__dirname, "public", "overlay.html")));
app.get("/panel", (_, res) => res.sendFile(path.join(__dirname, "public", "panel.html")));
app.get("/", (_, res) => res.send("PK Efekt sunucusu çalışıyor."));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// oda = anahtar; her odada overlay'ler ve paneller
const rooms = new Map();
function room(key) { if (!rooms.has(key)) rooms.set(key, new Set()); return rooms.get(key); }

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  const key = (url.searchParams.get("key") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const role = url.searchParams.get("role") || "overlay";
  if (!key) return ws.close();
  ws.key = key; ws.role = role; ws.alive = true;
  room(key).add(ws);
  ws.on("pong", () => (ws.alive = true));
  ws.on("message", (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (ws.role !== "panel") return;              // sadece panel komut verir
    if (msg.type !== "play") return;
    const out = JSON.stringify({ type: "play", mult: String(msg.mult || "3").slice(0, 3),
      theme: msg.theme || "gold", name: String(msg.name || "").slice(0, 16), label: String(msg.label || "").slice(0, 24) });
    for (const c of room(key)) if (c.role === "overlay" && c.readyState === 1) c.send(out);
  });
  ws.on("close", () => { room(key).delete(ws); if (!room(key).size) rooms.delete(key); });
  ws.send(JSON.stringify({ type: "hello", role, key }));
});

// bağlantıyı canlı tut (Studio'nun eski tarayıcısı için)
setInterval(() => { for (const c of wss.clients) { if (!c.alive) return c.terminate(); c.alive = false; c.ping(); } }, 25000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("PK Efekt sunucusu " + PORT + " portunda"));
