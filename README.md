# 零幺幺零排练房

[![version](https://img.shields.io/badge/version-v1.0.0-1a73e8)](#)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-188038)](#)
[![runtime](https://img.shields.io/badge/runtime-Node.js%20%2B%20WebSocket-202124)](#)

零幺幺零排练房是一个给乐队排练现场使用的局域网同步看谱工具。

房主电脑启动本地服务、上传 Guitar Pro 谱子并统一播放音频；成员用手机、平板或电脑在同一个 Wi-Fi 下扫码加入，实时同步看到当前谱子、播放位置和滚动进度。第一版不依赖公网服务器，也不需要打包成桌面软件，直接用源码即可跨平台运行。

## v1.0 已实现

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

## 适合的使用场景

- 排练室里房主电脑接声卡或音响，其他成员用手机看谱。
- 乐队临时排练，不想搭公网服务器，也不想每个人分别找谱和对进度。
- Windows 电脑开发，之后迁移到 MacBook Air 作为现场房主机。
- 先做可运行 MVP，后续再考虑 Electron 桌面打包或更完整的曲库管理。

## 技术栈

- 前端：React + Vite + TypeScript
- 后端：Node.js + Express + WebSocket
- 看谱与播放：alphaTab
- 二维码：qrcode
- 上传处理：multer
- 包管理：npm workspaces

项目结构：

```text
0110-rehearsal-room/
  server/        本地房间服务，负责 API、二维码、WebSocket
  web/           房主页和成员页
  package.json   跨平台 npm scripts
  README.md
  .env.example
```

## 快速启动

先确认终端可以直接运行 Node.js 和 npm：

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

如果端口被占用，先停掉旧服务：

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

房主端负责排练现场的核心控制：

- 上传 Guitar Pro 谱子。
- 播放、暂停、跳转播放进度。
- 开启或关闭节拍器。
- 选择当前显示轨道。
- 调整谱面缩放。
- 进入全屏看谱模式。
- 展开音轨混音台，对不同轨道执行 Solo、Mute、音量调节。
- 查看当前在线成员和成员昵称。

音轨混音台默认折叠，需要时点击“展开音轨混音台”。少数 Guitar Pro 文件如果多个音轨共用 MIDI channel，静音或音量调节可能会影响共享 channel 的其他音轨，这是文件结构和 alphaTab 播放模型带来的限制。

## 成员端能力

成员端尽量保持轻量，适合手机使用：

- 扫码进入房间。
- 编辑自己的昵称。
- 同步显示当前谱子和房主播放进度。
- 选择自己要看的轨道。
- 调整谱面缩放。
- 进入只显示谱面的全屏模式。
- 播放时自动跟随当前游标滚动。

手机上建议先点“全屏看谱”，再把缩放调到 45%-75% 之间。横屏通常更接近 Guitar Pro 的阅读体验。

## 跨平台约束

这个项目的第一版目标是“源码跨平台运行”，因此保持这些原则：

- 不使用 `.bat` 或 PowerShell 专属脚本作为启动入口。
- 不写死 Windows 路径。
- 路径处理使用 Node.js 标准能力。
- 服务监听 `0.0.0.0`，让同一局域网设备可以访问。
- 成员扫码地址使用自动探测到的 LAN IP。
- 不依赖公网服务器。
- v1.0 暂不做 `.exe`、`.app` 或 `.dmg` 打包。

## Windows 注意事项

如果 PowerShell 提示 `npm.ps1 cannot be loaded because running scripts is disabled`，需要执行一次：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

安装 Node.js 后，如果终端仍然找不到 `node` 或 `npm`，请关闭并重新打开终端，让 PATH 生效。

## macOS 注意事项

MacBook Air 作为房主时，如果 macOS 弹出“是否允许接受传入网络连接”，需要允许，否则成员手机可能访问不到本地服务。

蓝牙音箱可以用于测试，但排练现场更稳定的是：

```text
MacBook Air -> 声卡 / 3.5mm / USB 音频接口 -> 排练室音响
```

## 常见问题

### 成员手机扫码打不开

优先检查：

- 手机和房主电脑是否在同一个 Wi-Fi / 热点 / 便携路由器下。
- 二维码地址是否是 `192.168.x.x`、`10.x.x.x` 或 `172.16.x.x` 这类局域网地址。
- 房主电脑防火墙是否阻止了 Node.js 或本地服务。
- macOS 是否拒绝了“传入网络连接”权限。

### 房主页能打开，但成员页不同步

优先检查：

- `npm run dev` 是否同时启动了 web 和 server。
- `http://localhost:3010/api/room` 是否能返回 JSON。
- 浏览器控制台是否有 WebSocket 连接错误。

### 提示端口被占用

说明旧的开发服务还在后台运行。执行：

```bash
npm run stop
npm run dev
```

当前项目要求 web 固定使用 `3000`，server 固定使用 `3010`。如果端口被占用，会直接失败，不会自动跳到 `3001`、`3002`，这样可以避免二维码地址和真实服务端口错位。

### 上传 GP5 后不能播放

正常流程是：

1. 在房主页上传 `.gp5` 文件。
2. 等待页面显示“已载入”或“播放器已准备好”。
3. 点击房主页播放按钮。

浏览器可能要求用户手动点击一次按钮后才允许发声，这是浏览器音频自动播放策略，不是项目错误。

### 中文仍然显示乱码

项目已将 alphaTab 导入编码设为 `gb18030`，适合多数中文 GP3-5 文件。少数谱子如果原始编码不是 GBK/GB18030，谱内标题、歌词或标记仍可能乱码。当前 UI 会优先显示上传文件名，减少乱码标题影响。

## 开发命令

```bash
npm run dev      # 同时启动 server 和 web
npm run stop     # 停掉 3000 和 3010 端口上的旧服务
npm run check    # TypeScript 检查
npm run build    # 构建前端
npm run start    # 运行后端生产入口
```

## 后续计划

- 成员各自独立选择声部并记住偏好。
- 上传文件落盘和房间重载恢复。
- 更接近 Guitar Pro 的谱面播放与定位体验。
- v1 稳定后考虑 Electron 桌面打包。

## License

当前项目为个人排练工具 v1.0。正式开源协议可在后续版本中补充。
