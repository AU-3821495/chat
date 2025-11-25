const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e6 // 最大5MBの画像送信に対応
});

// 静的ファイルを配信（publicフォルダ）
app.use(express.static(path.join(__dirname, "public")));

// メモリ上のルーム・ユーザー管理
const rooms = new Map(); // roomName → Map(userId → userInfo)
const sockets = new Map(); // socket.id → { room, userId }

io.on("connection", (socket) => {
  socket.on("join", (payload) => {
    const { room, displayName, userId, iconBase64, bubbleColor, textColor } = payload || {};
    if (!room || !displayName || !userId) return;

    if (!rooms.has(room)) rooms.set(room, new Map());
    const roster = rooms.get(room);

    roster.set(userId, {
      displayName,
      userId,
      iconBase64: iconBase64 || "",
      bubbleColor: bubbleColor || "#e6f7ff",
      textColor: textColor || "#222"
    });

    sockets.set(socket.id, { room, userId });
    socket.join(room);
    io.to(room).emit("roster", Array.from(roster.values()));
  });

  socket.on("chat", (msg) => {
    const meta = sockets.get(socket.id);
    if (!meta) return;
    const { room, userId } = meta;
    const roster = rooms.get(room);
    const sender = roster?.get(userId);
    if (!sender) return;

    const payload = {
      type: "chat",
      from: sender,
      text: msg?.text || "",
      imageBase64: msg?.imageBase64 || "",
      stamp: msg?.stamp || ""
    };

    io.to(room).emit("chat", payload);
  });

  socket.on("private", (msg) => {
    const meta = sockets.get(socket.id);
    if (!meta) return;
    const { room, userId } = meta;
    const roster = rooms.get(room);
    const sender = roster?.get(userId);
    const target = roster?.get(msg?.toUserId);
    if (!sender || !target) return;

    const payload = {
      type: "private",
      toUserId: target.userId,
      from: sender,
      text: msg?.text || "",
      imageBase64: msg?.imageBase64 || "",
      stamp: msg?.stamp || ""
    };

    for (const [sid, meta2] of sockets.entries()) {
      if (meta2.room === room && meta2.userId === target.userId) {
        io.to(sid).emit("private", payload);
      }
    }
  });

  socket.on("updateProfile", (update) => {
    const meta = sockets.get(socket.id);
    if (!meta) return;
    const { room, userId } = meta;
    const roster = rooms.get(room);
    const user = roster?.get(userId);
    if (!user) return;

    if (typeof update.iconBase64 === "string") user.iconBase64 = update.iconBase64;
    if (typeof update.bubbleColor === "string") user.bubbleColor = update.bubbleColor;
    if (typeof update.textColor === "string") user.textColor = update.textColor;

    roster.set(userId, user);
    io.to(room).emit("roster", Array.from(roster.values()));
  });

  socket.on("leave", () => {
    const meta = sockets.get(socket.id);
    if (!meta) return;
    const { room, userId } = meta;
    const roster = rooms.get(room);
    if (roster?.has(userId)) {
      roster.delete(userId);
      io.to(room).emit("roster", Array.from(roster.values()));
    }
    sockets.delete(socket.id);
    socket.leave(room);
  });

  socket.on("disconnect", () => {
    const meta = sockets.get(socket.id);
    if (!meta) return;
    const { room, userId } = meta;
    const roster = rooms.get(room);
    if (roster?.has(userId)) {
      roster.delete(userId);
      io.to(room).emit("roster", Array.from(roster.values()));
    }
    sockets.delete(socket.id);
  });
});

// Render Free プラン対応：PORTは環境変数から取得
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
