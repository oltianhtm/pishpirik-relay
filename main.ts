// Pishpirik WebSocket Relay
const rooms = new Map();
let nextId = 1;
const PORT = parseInt(Deno.env.get("PORT") || "8000");

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/" && req.headers.get("upgrade") !== "websocket") {
    return new Response("Pishpirik Relay v1 — alive\n", {
      headers: { "content-type": "text/plain", "access-control-allow-origin": "*" },
    });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("not a websocket", { status: 400 });
  }

  const roomId = (url.searchParams.get("room") || "default").toLowerCase();
  const { socket, response } = Deno.upgradeWebSocket(req);
  const myId = nextId++;

  socket.onopen = () => {
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);
    const peers = Array.from(room.keys());
    socket.send(JSON.stringify({ type: "welcome", id: myId, peers }));
    for (const peer of room.values()) {
      if (peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify({ type: "peer-join", id: myId }));
      }
    }
    room.set(myId, socket);
  };

  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(typeof e.data === "string" ? e.data : ""); }
    catch { return; }
    msg.from = myId;
    const room = rooms.get(roomId);
    if (!room) return;
    const out = JSON.stringify(msg);
    if (typeof msg.to === "number") {
      const target = room.get(msg.to);
      if (target?.readyState === WebSocket.OPEN) target.send(out);
    } else {
      for (const [pid, peer] of room) {
        if (pid !== myId && peer.readyState === WebSocket.OPEN) peer.send(out);
      }
    }
  };

  const onGone = () => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.delete(myId);
    if (room.size === 0) { rooms.delete(roomId); return; }
    const out = JSON.stringify({ type: "peer-leave", id: myId });
    for (const peer of room.values()) {
      if (peer.readyState === WebSocket.OPEN) peer.send(out);
    }
  };
  socket.onclose = onGone;
  socket.onerror = onGone;

  return response;
});
