import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as alphaTab from "@coderline/alphatab";
import "./styles.css";

type RoomInfo = {
  roomName: string;
  lanIp: string;
  webPort: number;
  serverPort: number;
  joinUrl: string;
  status: string;
  qrCodeDataUrl?: string;
  clients?: number;
  members?: MemberInfo[];
  song?: Song | null;
  playback?: PlaybackState;
};

type MemberInfo = {
  id: string;
  role: "host" | "member";
  name: string;
  joinedAt: string;
};

type Song = {
  id: string;
  title: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  fileUrl: string;
  alphaTabStatus: "ready";
};

type PlaybackState = {
  isPlaying: boolean;
  positionMs: number;
  durationMs?: number;
  updatedAt: number;
};

type TrackInfo = {
  index: number;
  name: string;
  shortName: string;
};

type TrackControl = TrackInfo & {
  solo: boolean;
  muted: boolean;
  volume: number;
};

type SocketMessage =
  | { type: "room_state"; payload: RoomInfo }
  | { type: "member_joined"; payload: { name: string; joinedAt: string } }
  | { type: "member_updated"; payload: { id: string; name: string } }
  | { type: "host_playback"; payload: PlaybackState }
  | { type: "song_selected"; payload: Song | null }
  | { type: "error"; payload: { message: string } };

type AlphaTabApi = InstanceType<typeof alphaTab.AlphaTabApi>;

function getSocketUrl(serverPort: number) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:${serverPort}/ws`;
}

function formatMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function looksMojibake(value: string) {
  return /[ÃÂ�]|[\u00c0-\u00ff]{2,}/.test(value);
}

function cleanTitle(primary?: string, fallback = "未命名谱子") {
  const value = primary?.trim();
  if (!value || value === "Untitled" || value === "未命名谱子" || looksMojibake(value)) return fallback;
  return value;
}

function useRoomSocket(role: "host" | "member", displayName: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const displayNameRef = useRef(displayName);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(() => {
    const abortController = new AbortController();
    let socket: WebSocket | null = null;
    let closed = false;

    fetch("/api/room", { signal: abortController.signal })
      .then((response) => response.json())
      .then((roomInfo: RoomInfo) => {
        if (closed) return;

        setRoom(roomInfo);
        socket = new WebSocket(getSocketUrl(roomInfo.serverPort));
        socketRef.current = socket;

        socket.addEventListener("open", () => {
          setConnected(true);
          socket?.send(
            JSON.stringify({
              type: "join",
              payload: {
                role,
                name: displayNameRef.current
              }
            })
          );
        });

        socket.addEventListener("message", (event) => {
          const message = JSON.parse(event.data) as SocketMessage;

          if (message.type === "room_state") {
            setRoom((current) => ({ ...current, ...message.payload }));
          }

          if (message.type === "host_playback") {
            setRoom((current) =>
              current ? { ...current, playback: message.payload } : current
            );
          }

          if (message.type === "song_selected") {
            setRoom((current) => (current ? { ...current, song: message.payload } : current));
          }

          if (message.type === "member_joined") {
            setEvents((current) => [
              `${message.payload.name} 加入了房间`,
              ...current.slice(0, 5)
            ]);
          }

          if (message.type === "member_updated") {
            setEvents((current) => [
              `${message.payload.name} 更新了昵称`,
              ...current.slice(0, 5)
            ]);
          }

          if (message.type === "error") {
            setEvents((current) => [message.payload.message, ...current.slice(0, 5)]);
          }
        });

        socket.addEventListener("close", () => setConnected(false));
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setEvents((current) => ["无法读取房间信息，请确认后端服务已启动。", ...current]);
        }
      });

    return () => {
      closed = true;
      abortController.abort();
      socket?.close();
    };
  }, [role]);

  function send(type: string, payload: unknown) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    }
  }

  return { room, connected, events, send };
}

function Landing() {
  return (
    <main className="landing-shell">
      <section className="landing-card">
        <p className="eyebrow">0110 Rehearsal Room</p>
        <h1>零幺幺零排练房</h1>
        <p>局域网同步看谱。房主上传 Guitar Pro 谱子，成员扫码加入。</p>
        <div className="actions">
          <a className="button primary" href="/host">房主模式</a>
          <a className="button" href="/join">成员模式</a>
        </div>
      </section>
    </main>
  );
}

function HostPage() {
  const { room, connected, events, send } = useRoomSocket("host", "房主");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [alphaTabApi, setAlphaTabApi] = useState<AlphaTabApi | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const playback = room?.playback ?? { isPlaying: false, positionMs: 0, durationMs: 0, updatedAt: 0 };

  async function uploadSong(file: File | null) {
    if (!file) return;

    const formData = new FormData();
    formData.append("song", file);
    setUploading(true);
    setUploadError("");

    try {
      const response = await fetch("/api/songs", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("上传失败");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  function togglePlayback() {
    if (!alphaTabApi || !playerReady) {
      setUploadError("谱子和播放器还没准备好。");
      return;
    }

    alphaTabApi.playPause();
  }

  function seek(seconds: number) {
    if (alphaTabApi?.player) {
      alphaTabApi.timePosition = Math.max(0, (alphaTabApi.player.timePosition ?? 0) + seconds * 1000);
    }
  }

  function toggleMetronome() {
    if (!alphaTabApi) return;
    const next = !metronomeOn;
    alphaTabApi.metronomeVolume = next ? 0.9 : 0;
    alphaTabApi.countInVolume = next ? 0.6 : 0;
    setMetronomeOn(next);
  }

  return (
    <main className="studio-shell">
      <AppHeader
        mode="房主模式"
        room={room}
        connected={connected}
        clients={room?.clients ?? 0}
      />

      <section className="host-layout">
        <aside className="side-panel">
          <h2>加入房间</h2>
          {room?.qrCodeDataUrl ? (
            <img className="qr" src={room.qrCodeDataUrl} alt="成员加入二维码" />
          ) : (
            <div className="qr loading">生成二维码中</div>
          )}
          <code className="join-url">{room?.joinUrl ?? "检测局域网地址中..."}</code>
          <p className="muted">成员和房主电脑必须在同一 Wi-Fi、热点或便携路由器下。</p>

          <h2>上传谱子</h2>
          <label className="upload-box compact">
            <span>{uploading ? "上传中..." : "选择 Guitar Pro 文件"}</span>
            <input
              type="file"
              accept=".gp,.gp3,.gp4,.gp5,.gpx,.gpif,.musicxml,.xml"
              onChange={(event) => uploadSong(event.target.files?.[0] ?? null)}
            />
          </label>
          {uploadError ? <p className="error-text">{uploadError}</p> : null}

          <ActivityPanel clients={room?.clients ?? 0} members={room?.members ?? []} events={events} embedded />
        </aside>

        <section className="score-workspace">
          <TransportBar
            playback={playback}
            playerReady={playerReady}
            metronomeOn={metronomeOn}
            onPlay={togglePlayback}
            onSeek={seek}
            onMetronome={toggleMetronome}
          />
          <AlphaTabScore
            role="host"
            song={room?.song ?? null}
            playback={playback}
            onApiReady={setAlphaTabApi}
            onPlayerReady={setPlayerReady}
            onPlayback={(payload) => send("host_playback", payload)}
          />
        </section>
      </section>
    </main>
  );
}

function JoinPage() {
  const [nickname, setNickname] = useState(() => localStorage.getItem("0110-member-name") || "成员");
  const { room, connected, events, send } = useRoomSocket("member", nickname);
  const playback = room?.playback ?? { isPlaying: false, positionMs: 0, durationMs: 0, updatedAt: 0 };

  function updateNickname(nextName: string) {
    const normalized = nextName.trim().slice(0, 24) || "成员";
    setNickname(normalized);
    localStorage.setItem("0110-member-name", normalized);
    send("member_update", { name: normalized });
  }

  return (
    <main className="studio-shell member-mode">
      <AppHeader
        mode="成员模式"
        room={room}
        connected={connected}
        clients={room?.clients ?? 0}
      />
      <section className="member-profile">
        <label>
          我的昵称
          <input
            value={nickname}
            maxLength={24}
            onChange={(event) => setNickname(event.target.value)}
            onBlur={(event) => updateNickname(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                updateNickname(event.currentTarget.value);
                event.currentTarget.blur();
              }
            }}
          />
        </label>
      </section>
      <section className="member-layout">
        <section className="score-workspace">
          <MiniProgress playback={playback} />
          <AlphaTabScore role="member" song={room?.song ?? null} playback={playback} />
        </section>
        <aside className="side-panel member-side">
          <ActivityPanel clients={room?.clients ?? 0} members={room?.members ?? []} events={events} embedded />
        </aside>
      </section>
    </main>
  );
}

function AppHeader({
  mode,
  room,
  connected,
  clients
}: {
  mode: string;
  room: RoomInfo | null;
  connected: boolean;
  clients: number;
}) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">{mode}</p>
        <h1>{room?.roomName ?? "零幺幺零排练房"}</h1>
      </div>
      <div className="header-status">
        <span>{clients} 人在线</span>
        <ConnectionPill connected={connected} />
      </div>
    </header>
  );
}

function TransportBar({
  playback,
  playerReady,
  metronomeOn,
  onPlay,
  onSeek,
  onMetronome
}: {
  playback: PlaybackState;
  playerReady: boolean;
  metronomeOn: boolean;
  onPlay: () => void;
  onSeek: (seconds: number) => void;
  onMetronome: () => void;
}) {
  return (
    <div className="transport-bar">
      <button className="icon-button primary" type="button" onClick={onPlay} disabled={!playerReady}>
        {playback.isPlaying ? "暂停" : "播放"}
      </button>
      <button className="icon-button" type="button" onClick={() => onSeek(-10)} disabled={!playerReady}>-10s</button>
      <button className="icon-button" type="button" onClick={() => onSeek(10)} disabled={!playerReady}>+10s</button>
      <button className={metronomeOn ? "icon-button active" : "icon-button"} type="button" onClick={onMetronome} disabled={!playerReady}>
        节拍器
      </button>
      <MiniProgress playback={playback} />
    </div>
  );
}

function MiniProgress({ playback }: { playback: PlaybackState }) {
  const duration = playback.durationMs || 0;
  const percent = duration ? Math.min(100, (playback.positionMs / duration) * 100) : 0;

  return (
    <div className="progress-wrap">
      <div className="time-row">
        <span>{formatMs(playback.positionMs)}</span>
        <span>{formatMs(duration)}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function AlphaTabScore({
  role,
  song,
  playback,
  onApiReady,
  onPlayerReady,
  onPlayback
}: {
  role: "host" | "member";
  song: Song | null;
  playback?: PlaybackState;
  onApiReady?: (api: AlphaTabApi | null) => void;
  onPlayerReady?: (ready: boolean) => void;
  onPlayback?: (playback: { isPlaying: boolean; positionMs: number; durationMs?: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<AlphaTabApi | null>(null);
  const backingTrackRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  const [status, setStatus] = useState("等待房主上传谱子");
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [trackControls, setTrackControls] = useState<TrackControl[]>([]);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [scale, setScale] = useState(role === "member" ? 0.72 : 0.86);
  const [fullscreen, setFullscreen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [scoreTitle, setScoreTitle] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const ignoreRemoteSeekRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const api = new alphaTab.AlphaTabApi(container, {
      core: {
        fontDirectory: "/font/"
      },
      importer: {
        encoding: "gb18030",
        beatTextAsLyrics: true
      },
      display: {
        scale,
        stretchForce: 0.78
      },
      player: {
        enablePlayer: true,
        playerMode: 2,
        soundFont: "/soundfont/sonivox.sf3",
        scrollElement: container
      }
    });

    if (role === "member") {
      api.masterVolume = 0;
    }

    apiRef.current = api;
    onApiReady?.(api);

    api.scoreLoaded.on((score: { title?: string; tracks?: Array<{ index: number; name?: string; shortName?: string }> }) => {
      const availableTracks = (score.tracks ?? []).map((track) => ({
        index: track.index,
        name: cleanTitle(track.name, `轨道 ${track.index + 1}`),
        shortName: cleanTitle(track.shortName, `T${track.index + 1}`)
      }));
      setTracks(availableTracks);
      const hasBackingTrack = !!(score as any).backingTrack?.rawAudioFile;
      setTrackControls((current) => {
        const controls = availableTracks.map((track) => {
          const existing = current.find((item) => item.index === track.index);
          return {
            ...track,
            solo: existing?.solo ?? false,
            muted: existing?.muted ?? false,
            volume: existing?.volume ?? 1
          };
        });
        if (hasBackingTrack) {
          controls.push({
            index: -1,
            name: "音频轨",
            shortName: "Audio",
            solo: false,
            muted: false,
            volume: 1
          });
        }
        return controls;
      });
      setSelectedTrack((current) => availableTracks.some((track) => track.index === current) ? current : availableTracks[0]?.index ?? 0);
      setScoreTitle(cleanTitle((score as any).title, song?.title ?? "未命名谱子"));
      setStatus(hasBackingTrack ? "已载入谱子（检测到音频轨，已切换合成器播放）" : "已载入谱子");
      setError("");
    });

    api.renderFinished.on(() => {
      setStatus((current) => current.replace("正在渲染", "已渲染"));
    });

    api.playerReady.on(() => {
      onPlayerReady?.(true);
      setStatus("谱面和播放器已准备好");
      if (role === "host") {
        setupBackingTrack(api);
      }
    });

    api.playerStateChanged.on((args: { state: unknown }) => {
      // Sync backing track (read current audio from ref dynamically)
      const bt = backingTrackRef.current;
      if (bt) {
        if (args.state === alphaTab.synth.PlayerState.Playing) {
          bt.audio.play().catch(() => {});
        } else {
          bt.audio.pause();
        }
      }
      // Host playback broadcast
      if (role === "host") {
        onPlayback?.({
          isPlaying: args.state === alphaTab.synth.PlayerState.Playing,
          positionMs: api.player?.timePosition ?? 0,
          durationMs
        });
      }
    });

    api.playerPositionChanged.on((args: { currentTime: number; endTime: number }) => {
      setDurationMs(args.endTime);
      // Sync backing track seek
      const bt = backingTrackRef.current;
      if (bt && role === "host") {
        const audioMs = bt.audio.currentTime * 1000;
        if (args.currentTime > 0 && Math.abs(audioMs - args.currentTime) > 600) {
          bt.audio.currentTime = args.currentTime / 1000;
        }
      }
      if (role === "host") {
        followPlaybackCursor();
        onPlayback?.({
          isPlaying: api.playerState === alphaTab.synth.PlayerState.Playing,
          positionMs: args.currentTime,
          durationMs: args.endTime
        });
      }
    });

    return () => {
      onApiReady?.(null);
      onPlayerReady?.(false);
      if (backingTrackRef.current) {
        backingTrackRef.current.audio.pause();
        URL.revokeObjectURL(backingTrackRef.current.url);
        backingTrackRef.current = null;
      }
      api.destroy();
      apiRef.current = null;
    };
  }, [role]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    api.settings.display.scale = scale;
    api.settings.display.stretchForce = scale < 0.75 ? 0.62 : 0.78;
    api.updateSettings();
    if (api.score) {
      renderSelectedTrack(api, selectedTrack);
    }
  }, [scale]);

  useEffect(() => {
    const api = apiRef.current;
    if (api?.score) {
      renderSelectedTrack(api, selectedTrack);
    }
  }, [selectedTrack]);

  useEffect(() => {
    applyTrackControls(trackControls);
  }, [trackControls]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !song) {
      setStatus("等待房主上传谱子");
      setError("");
      setTracks([]);
      setTrackControls([]);
      setScoreTitle("");
      return;
    }

    const abortController = new AbortController();
    setStatus("正在下载并渲染谱子...");
    setError("");

    fetch(song.fileUrl, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("谱子文件下载失败");
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buffer));
        const trackIndex = score.tracks.some((track) => track.index === selectedTrack) ? selectedTrack : 0;
        if (trackIndex !== selectedTrack) {
          setSelectedTrack(trackIndex);
        }
        api.renderScore(score, [trackIndex]);

        if (role === "host") {
          // Clean up previous song's backing track before setting up new one
          if (backingTrackRef.current) {
            backingTrackRef.current.audio.pause();
            URL.revokeObjectURL(backingTrackRef.current.url);
            backingTrackRef.current = null;
          }
          setupBackingTrack(api);
        }
      })
      .catch((loadError: Error) => {
        if (loadError.name !== "AbortError") {
          setError(loadError.message);
          setStatus("谱子载入失败");
        }
      });

    return () => {
      abortController.abort();
    };
  }, [song?.id]);

  useEffect(() => {
    const api = apiRef.current;
    if (role !== "member" || !api || !playback) return;
    if (ignoreRemoteSeekRef.current) return;

    const nextPosition = playback.positionMs ?? 0;
    const currentPosition = api.player?.timePosition ?? 0;
    if (Math.abs(currentPosition - nextPosition) > 400) {
      api.timePosition = nextPosition;
      window.setTimeout(() => followPlaybackCursor(), 80);
    }
  }, [role, playback?.positionMs]);

  function followPlaybackCursor() {
    const container = containerRef.current;
    if (!container) return;

    const cursor =
      container.querySelector<HTMLElement>(".at-cursor-bar") ??
      container.querySelector<HTMLElement>(".at-cursor-beat");
    if (!cursor) return;

    const containerRect = container.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    const visibleTop = containerRect.top + containerRect.height * 0.22;
    const visibleBottom = containerRect.top + containerRect.height * 0.72;

    if (cursorRect.top < visibleTop || cursorRect.bottom > visibleBottom) {
      const target =
        container.scrollTop +
        (cursorRect.top - containerRect.top) -
        container.clientHeight * 0.38;

      container.scrollTo({
        top: Math.max(0, target),
        behavior: "smooth"
      });
    }
  }

  function renderSelectedTrack(api: AlphaTabApi, trackIndex: number) {
    const track = api.score?.tracks?.find((item: { index: number }) => item.index === trackIndex);
    if (!track) return;
    api.renderTracks([track]);
  }

  function applyTrackControls(nextControls: TrackControl[]) {
    const api = apiRef.current;
    const scoreTracks = api?.score?.tracks ?? [];
    if (!api || scoreTracks.length === 0) return;

    for (const control of nextControls) {
      if (control.index === -1) {
        const audioEl = backingTrackRef.current?.audio;
        if (audioEl) {
          audioEl.volume = control.muted ? 0 : control.volume;
        }
        continue;
      }
      const track = scoreTracks.find((item: { index: number }) => item.index === control.index);
      if (!track) continue;
      api.changeTrackSolo([track], control.solo);
      api.changeTrackMute([track], control.muted);
      api.changeTrackVolume([track], control.volume);
    }
  }

  function updateTrackControl(index: number, patch: Partial<TrackControl>) {
    setTrackControls((current) => {
      const next = current.map((control) =>
        control.index === index ? { ...control, ...patch } : control
      );
      applyTrackControls(next);
      return next;
    });
  }

  function resetMixer() {
    setTrackControls((current) => {
      const next = current.map((control) => ({
        ...control,
        solo: false,
        muted: false,
        volume: 1
      }));
      applyTrackControls(next);
      return next;
    });
  }

  function changeScale(nextScale: number) {
    setScale(Math.min(1.55, Math.max(0.42, Number(nextScale.toFixed(2)))));
  }

  function seekToPercent(percent: number) {
    const api = apiRef.current;
    const duration = playback?.durationMs || durationMs || 0;
    if (!api || !duration) return;
    ignoreRemoteSeekRef.current = true;
    api.timePosition = Math.max(0, Math.min(duration, duration * percent));
    window.setTimeout(() => {
      ignoreRemoteSeekRef.current = false;
    }, 300);
  }

  function setupBackingTrack(api: AlphaTabApi) {
    const score = api.score;

    // Clean up previous backing track first (e.g. when song changes)
    if (backingTrackRef.current) {
      backingTrackRef.current.audio.pause();
      URL.revokeObjectURL(backingTrackRef.current.url);
      backingTrackRef.current = null;
    }

    if (!score?.backingTrack?.rawAudioFile) {
      setStatus("谱面和播放器已准备好");
      return;
    }

    const blob = new Blob([score.backingTrack.rawAudioFile as BlobPart]);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;

    backingTrackRef.current = { audio, url };

    setStatus("谱面和播放器已准备好（音频轨已就绪）");
  }

  const fileSize = useMemo(() => {
    if (!song?.size) return "";
    return `${(song.size / 1024).toFixed(1)} KB`;
  }, [song]);

  const shellClass = fullscreen ? "score-view fullscreen" : "score-view";
  const displayTitle = song ? cleanTitle(scoreTitle, song.title) : "等待房主上传谱子";
  const displayDurationMs = playback?.durationMs || durationMs;
  const progressPercent = displayDurationMs ? Math.min(1, ((playback?.positionMs ?? 0) / displayDurationMs)) : 0;

  return (
    <div className={shellClass}>
      <div className="score-toolbar">
        <div className="score-title">
          <p className="eyebrow">alphaTab Score</p>
          <h2>{displayTitle}</h2>
          <span>{song ? `${fileSize} · ${status}` : status}</span>
        </div>

        <div className="score-controls">
          <select
            value={selectedTrack}
            disabled={tracks.length === 0}
            onChange={(event) => setSelectedTrack(Number(event.target.value))}
            aria-label="选择轨道"
          >
            {tracks.length === 0 ? (
              <option value={0}>暂无轨道</option>
            ) : (
              tracks.map((track) => (
                <option key={track.index} value={track.index}>
                  {track.index + 1}. {track.name}
                </option>
              ))
            )}
          </select>

          <div className="zoom-control" aria-label="缩放">
            <button type="button" onClick={() => changeScale(scale - 0.08)}>-</button>
            <input
              type="range"
              min="0.42"
              max="1.55"
              step="0.01"
              value={scale}
              onChange={(event) => changeScale(Number(event.target.value))}
            />
            <button type="button" onClick={() => changeScale(scale + 0.08)}>+</button>
            <span>{Math.round(scale * 100)}%</span>
          </div>

          <button className="icon-button" type="button" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? "退出全屏" : "全屏看谱"}
          </button>
        </div>
      </div>

      {role === "host" && trackControls.length > 0 ? (
        <div className="mixer-panel">
          <div className="mixer-header">
            <button
              className="mixer-toggle"
              type="button"
              onClick={() => setMixerOpen((current) => !current)}
              aria-expanded={mixerOpen}
            >
              <span>{mixerOpen ? "收起" : "展开"}音轨混音台</span>
              <strong>{trackControls.length} 轨</strong>
            </button>
            {mixerOpen ? <button className="text-button" type="button" onClick={resetMixer}>重置</button> : null}
          </div>
          {mixerOpen ? (
            <div className="mixer-list">
              {trackControls.map((track) => (
                <div className="mixer-row" key={track.index}>
                  <span className="track-name">{track.index === -1 ? track.name : `${track.index + 1}. ${track.name}`}</span>
                  <button
                    className={track.solo ? "mini-toggle active" : "mini-toggle"}
                    type="button"
                    onClick={() => updateTrackControl(track.index, { solo: !track.solo })}
                  >
                    Solo
                  </button>
                  <button
                    className={track.muted ? "mini-toggle danger" : "mini-toggle"}
                    type="button"
                    onClick={() => updateTrackControl(track.index, { muted: !track.muted })}
                  >
                    Mute
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={track.volume}
                    aria-label={`${track.name} 音量`}
                    onChange={(event) => updateTrackControl(track.index, { volume: Number(event.target.value) })}
                  />
                  <span className="volume-value">{Math.round(track.volume * 100)}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {fullscreen ? (
        <button className="fullscreen-exit" type="button" onClick={() => setFullscreen(false)}>
          退出全屏
        </button>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="score-progress">
        <span>{formatMs(playback?.positionMs)}</span>
        <button
          type="button"
          className="progress-track score-click-track"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            seekToPercent((event.clientX - rect.left) / rect.width);
          }}
        >
          <span className="progress-fill" style={{ width: `${progressPercent * 100}%` }} />
        </button>
        <span>{formatMs(displayDurationMs)}</span>
      </div>

      <div ref={containerRef} className="alphatab-container" />
    </div>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span className={connected ? "pill online" : "pill offline"}>
      {connected ? "已连接" : "未连接"}
    </span>
  );
}

function ActivityPanel({
  clients,
  members,
  events,
  embedded = false
}: {
  clients: number;
  members: MemberInfo[];
  events: string[];
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "activity embedded" : "activity"}>
      <h2>房间状态</h2>
      <p className="big-number">{clients}</p>
      <p className="muted">当前连接数</p>
      {members.length > 0 ? (
        <div className="member-list">
          {members.map((member) => (
            <span key={member.id}>{member.name}</span>
          ))}
        </div>
      ) : null}
      <div className="events">
        {events.length > 0 ? (
          events.map((event, index) => <p key={`${event}-${index}`}>{event}</p>)
        ) : (
          <p className="muted">暂无新事件</p>
        )}
      </div>
    </div>
  );
}

function App() {
  const path = window.location.pathname;

  if (path === "/host") return <HostPage />;
  if (path === "/join") return <JoinPage />;
  return <Landing />;
}

createRoot(document.getElementById("root")!).render(<App />);
