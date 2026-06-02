import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPort = Number(process.env.SERVER_PORT ?? 3010);
const webPort = Number(process.env.WEB_PORT ?? 3000);
const roomName = process.env.ROOM_NAME ?? "零幺幺零排练房";
const host = "0.0.0.0";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const uploadedSongs = new Map();

const state = {
  roomName,
  members: new Map(),
  song: null,
  playback: {
    isPlaying: false,
    positionMs: 0,
    updatedAt: Date.now()
  }
};

app.use(cors());
app.use(express.json());

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = Object.values(interfaces)
    .flat()
    .filter(Boolean)
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  return (
    candidates.find((ip) => ip.startsWith("192.168.")) ??
    candidates.find((ip) => ip.startsWith("10.")) ??
    candidates.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ??
    candidates[0] ??
    "localhost"
  );
}

function getRoomInfo() {
  const lanIp = getLanIp();
  const joinUrl = `http://${lanIp}:${webPort}/join`;

  return {
    roomName,
    lanIp,
    webPort,
    serverPort,
    joinUrl,
    status: "ready"
  };
}

function publicState() {
  return {
    ...getRoomInfo(),
    clients: state.members.size,
    members: Array.from(state.members.entries()).map(([id, member]) => ({
      id,
      role: member.role,
      name: member.name,
      joinedAt: member.joinedAt
    })),
    song: state.song,
    playback: state.playback
  };
}

async function roomPayload() {
  const room = getRoomInfo();
  return {
    ...room,
    qrCodeDataUrl: await QRCode.toDataURL(room.joinUrl, {
      margin: 1,
      width: 280
    })
  };
}

function sendJson(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message) {
  for (const client of wss.clients) {
    sendJson(client, message);
  }
}

function broadcastRoomState() {
  broadcast({
    type: "room_state",
    payload: publicState()
  });
}

app.get("/api/room", async (_request, response) => {
  response.json(await roomPayload());
});

app.post("/api/songs", upload.single("song"), (request, response) => {
  const file = request.file;
  if (!file) {
    response.status(400).json({ message: "No song file uploaded." });
    return;
  }

  const song = {
    id: crypto.randomUUID(),
    title: file.originalname ?? "未命名谱子",
    size: file.size ?? 0,
    mimeType: file.mimetype || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
    alphaTabStatus: "ready"
  };
  song.fileUrl = `/songs/${song.id}/file`;

  uploadedSongs.set(song.id, {
    buffer: file.buffer,
    mimeType: song.mimeType,
    filename: song.title
  });
  state.song = song;
  broadcast({
    type: "song_selected",
    payload: song
  });
  broadcastRoomState();
  response.status(201).json(song);
});

app.get("/songs/:id/file", (request, response) => {
  const stored = uploadedSongs.get(request.params.id);
  if (!stored) {
    response.status(404).send("Song file not found.");
    return;
  }

  response.setHeader("Content-Type", stored.mimeType);
  response.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(stored.filename)}"`);
  response.send(stored.buffer);
});

const webDist = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get(/^\/(?!api).*/, (_request, response) => {
  response.sendFile(path.join(webDist, "index.html"), (error) => {
    if (error) {
      response.status(404).send("Web build not found. Run npm run dev for development or npm run build first.");
    }
  });
});

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (socket) => {
  socket.id = crypto.randomUUID();
  sendJson(socket, {
    type: "room_state",
    payload: publicState()
  });
  broadcastRoomState();

  socket.on("message", (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      sendJson(socket, {
        type: "error",
        payload: { message: "Invalid JSON message." }
      });
      return;
    }

    if (message.type === "join") {
      state.members.set(socket.id, {
        role: message.payload?.role ?? "member",
        name: sanitizeMemberName(message.payload?.name),
        joinedAt: new Date().toISOString()
      });
      broadcast({
        type: "member_joined",
        payload: {
          name: state.members.get(socket.id).name,
          joinedAt: state.members.get(socket.id).joinedAt
        }
      });
      broadcastRoomState();
      return;
    }

    if (message.type === "member_update") {
      const current = state.members.get(socket.id);
      if (!current) return;

      const name = sanitizeMemberName(message.payload?.name);
      state.members.set(socket.id, {
        ...current,
        name
      });
      broadcast({
        type: "member_updated",
        payload: {
          id: socket.id,
          name
        }
      });
      broadcastRoomState();
      return;
    }

    if (message.type === "host_playback") {
      state.playback = {
        isPlaying: Boolean(message.payload?.isPlaying),
        positionMs: Number(message.payload?.positionMs ?? state.playback.positionMs),
        updatedAt: Date.now()
      };
      broadcast({
        type: "host_playback",
        payload: state.playback
      });
      broadcastRoomState();
      return;
    }

    if (message.type === "song_selected") {
      state.song = message.payload ?? state.song;
      broadcast({
        type: "song_selected",
        payload: state.song
      });
      broadcastRoomState();
    }
  });

  socket.on("close", () => {
    state.members.delete(socket.id);
    broadcastRoomState();
  });
});

function sanitizeMemberName(value) {
  const name = String(value ?? "").trim();
  return name.slice(0, 24) || "匿名成员";
}

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${serverPort} is already in use. Stop the old dev server and run npm run dev again.`);
    process.exit(1);
  }
  throw error;
});

httpServer.listen(serverPort, host, () => {
  const room = getRoomInfo();
  console.log(`${roomName} server ready`);
  console.log(`API: http://localhost:${serverPort}/api/room`);
  console.log(`LAN join URL: ${room.joinUrl}`);
});
