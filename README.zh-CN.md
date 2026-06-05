# 零幺幺零线上排练房 / guitarpro-rehearsal-room

[![version](https://img.shields.io/badge/version-v1.0.1-1a73e8)](#)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-188038)](#)
[![runtime](https://img.shields.io/badge/runtime-Node.js%20%2B%20WebSocket-202124)](#)

零幺幺零线上排练房是一个给乐队排练现场使用的局域网同步看谱工具。

房主电脑启动本地服务、上传 Guitar Pro 谱子并统一播放音频；成员用手机、平板或电脑在同一个 Wi-Fi 下扫码加入，实时同步看到当前谱子、播放位置和滚动进度。第一版不依赖公网服务器，也不需要打包成桌面软件，直接用源码即可跨平台运行。

个人排练现场的完整操作手册请看 [README.local.md](README.local.md)。

## v1.0.1 已实现

- 房主端显示局域网访问地址和成员扫码二维码。
- 成员扫码进入成员页，支持编辑自己的昵称。
- 支持上传并渲染 `.gp/.gp3/.gp4/.gp5/.gpx/.gpif` 等 Guitar Pro 谱子。
- 使用 alphaTab 播放合成音频，房主电脑统一输出声音到声卡、音响或现场设备。
- WebSocket 同步当前谱子、播放/暂停、播放位置、成员加入和昵称更新。
- 谱面支持轨道选择、缩放、全屏看谱、进度条跳转。
- 房主端支持音轨混音台：Solo、Mute、单轨音量调节。
- 成员端会跟随房主播放位置自动滚动到当前游标附近。
- 房主端支持开启/关闭节拍器。
- 旧 Guitar Pro 中文文件按 `gb18030` 解码，减少 GP3-5 中文乱码。
- **支持内嵌音频轨（backing track）**：含有音频轨的 GP 文件，MIDI 音轨通过合成器播放，音频轨通过独立音频元素同步播放。
- **音频轨加入调音台**：混音台识别音频轨，支持 Solo/Mute/音量调节。
- **进度条显示总时长**：点击进度条可跳转。

## 技术栈

- 前端：React + Vite + TypeScript
- 后端：Node.js + Express + WebSocket
- 看谱与播放：alphaTab
- 二维码：qrcode
- 上传处理：multer
- 包管理：npm workspaces

## 快速启动

先确认终端可以直接运行：

```bash
node --version
npm --version
```

然后在项目根目录运行：

```bash
npm install
npm run dev
```

启动后常用地址：

- 房主页：`http://localhost:3000/host`
- 成员页：`http://localhost:3000/join`
- API 服务：`http://localhost:3010/api/room`

如果端口被占用：

```bash
npm run stop
npm run dev
```

## 现场使用流程

1. 房主电脑连接排练室 Wi-Fi、手机热点或便携路由器。
2. 在房主电脑打开项目目录。
3. 运行 `npm run dev`。
4. 浏览器打开 `http://localhost:3000/host`。
5. 房主页上传 Guitar Pro 谱子。
6. 房主电脑点击播放，音频从房主电脑输出。
7. 成员扫描房主页二维码加入。
8. 成员在自己的设备上看谱，播放位置会跟随房主同步。

二维码地址会类似：

```text
http://192.168.31.186:3000/join
```

这里的 IP 是房主电脑在局域网里的地址。成员扫码时必须使用这个局域网地址，不能使用 `localhost` 或 `127.0.0.1`。

## 房主端能力

- 上传 Guitar Pro 谱子。
- 播放、暂停、跳转播放进度。
- 开启或关闭节拍器。
- 选择当前显示轨道。
- 调整谱面缩放。
- 进入只显示谱面的全屏模式。
- 展开音轨混音台，对不同轨道执行 Solo、Mute、音量调节。
- 查看当前在线成员和成员昵称。

音轨混音台默认折叠，需要时点击“展开音轨混音台”。少数 Guitar Pro 文件如果多个音轨共用 MIDI channel，静音或音量调节可能会影响共享 channel 的其他音轨。

## 成员端能力

- 扫码进入房间。
- 编辑自己的昵称。
- 同步显示当前谱子和房主播放进度。
- 选择自己要看的轨道。
- 调整谱面缩放。
- 进入只显示谱面的全屏模式。
- 播放时自动跟随当前游标滚动。

手机上建议先点“全屏看谱”，再把缩放调到 45%-75% 之间。横屏通常更接近 Guitar Pro 的阅读体验。

## 开发命令

```bash
npm run dev      # 同时启动 server 和 web
npm run stop     # 停掉 3000 和 3010 端口上的旧服务
npm run check    # TypeScript 检查
npm run build    # 构建前端
npm run start    # 运行后端生产入口
```

## 更新日志

### v1.0.1 (2026-06-06)

- **音频轨支持**：含有内嵌音频轨（backing track）的 GP 文件现在可以正常播放。MIDI 音轨通过 SoundFont 合成，音频轨通过独立 `HTMLAudioElement` 播放，两者与 alphaTab 播放器同步（播放/暂停/跳转）。
- **音频轨加入调音台**：房主混音台中新增"音频轨"虚拟轨道，支持 Solo/Mute/音量调节。
- **进度条显示总时长**：进度条同时显示当前播放位置和总时长，点击进度条可跳转。
- **换谱子不串音**：重新上传新谱子时，旧谱子的音频轨道会被正确停用和清理。
- **事件监听器重构**：音频轨同步逻辑移至 alphaTab API 主事件循环，只注册一次，通过 React ref 动态读取当前音频对象——反复换谱子不会堆积失效的监听器。
- **服务端 durationMs**：后端在 `host_playback` 消息中保留 `durationMs` 字段，成员端始终能看到总时长。
- **谱子加载重构**：从 `api.load()` 改为 `ScoreLoader.loadScoreFromBytes()` + `api.renderScore()`，加载过程可访问 score 对象检测音频轨。
- **配置调整**：`playerMode` 设为 `EnabledSynthesizer`（2），始终使用 SoundFont 合成 MIDI，不因检测到音频轨而切到只播放音频的模式。
- **中文文件名改进**：服务端 Content-Disposition 正确编码中文文件名，上传文件名乱码自动检测和修复。

### v1.0.0 (2025-11)

- 首个版本。

- 成员各自独立选择声部并记住偏好。
- 上传文件落盘和房间重载恢复。
- 更接近 Guitar Pro 的谱面播放与定位体验。
- v1 稳定后考虑 Electron 桌面打包。
