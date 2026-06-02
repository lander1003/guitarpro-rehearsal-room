# 零幺幺零线上排练房：个人详细使用手册

这份文档是给自己留的，不追求简短，主要记录项目背景、现场用途、启动关闭方式、部署情形和排错经验。

## 建设背景

真实使用场景：

- 现在用 Windows 台式机开发。
- 后续用 MacBook Air 继续开发，并带到排练室当房主电脑。
- 房主电脑负责打开本地服务、上传 Guitar Pro 谱子、播放音频、显示二维码。
- 乐队成员用手机、平板或电脑浏览器扫码进入，只看自己需要跟随的谱面。
- 排练现场不依赖公网服务器，只要求所有设备在同一个局域网里。

设计目标：

- Windows 和 macOS 都能运行同一套源码。
- 手机扫码访问的是房主电脑的局域网地址。
- 房主电脑统一播放声音，再输出到声卡、音响或其他现场设备。
- 第一阶段先跑通房间、二维码、WebSocket 同步和 alphaTab 看谱播放。

## 当前 v1.0 功能

- 房主页面显示局域网访问地址和二维码。
- 成员扫码进入成员页。
- 成员可以编辑自己的昵称，并同步到在线成员列表。
- WebSocket 同步成员加入事件、昵称更新、当前谱子、播放/暂停和播放位置。
- Guitar Pro 文件上传后会临时保存在房主电脑内存中。
- 前端使用 alphaTab 渲染 `.gp/.gp3/.gp4/.gp5/.gpx/.gpif` 等谱子。
- 房主端启用 alphaTab 播放器和 soundfont，可播放合成音频。
- 成员端同步显示当前谱子和播放状态；音频由房主电脑统一输出到现场音响。
- 谱面支持轨道选择、缩放、全屏看谱。
- 全屏模式只展示谱面和退出按钮，不展示混音台和其他面板。
- 房主端支持播放进度条和 alphaTab 游标，成员端会跟随房主播放位置并自动滚动到当前播放位置附近。
- 房主端支持可折叠音轨混音台：Solo、Mute、单轨音量调节。
- 房主端支持开启/关闭节拍器。
- 旧 Guitar Pro 中文文件按 `gb18030` 解码，减少 GP3-5 中文乱码。

## 技术路线

- 前端：React + Vite + TypeScript
- 后端：Node.js + Express + WebSocket
- 二维码：`qrcode`
- 文件上传：`multer`
- 同步方式：局域网 WebSocket
- 看谱引擎：alphaTab
- 包管理：npm workspaces

项目结构：

```text
guitarpro-rehearsal-room/
  server/        本地房间服务，负责 API、二维码、WebSocket
  web/           房主页和成员页
  package.json   跨平台 npm scripts
  README.md      GitHub 默认展示
  README.zh-CN.md 中文展示说明
  README.local.md 自己使用的详细手册
  .env.example
```

## 环境准备

需要安装 Node.js，并确保终端里能直接运行：

```bash
node --version
npm --version
```

当前这台 Windows 机器已经准备好 Node.js：

- Node.js：`v24.16.0`
- npm：`11.13.0`
- 可执行目录：`C:\Users\lander\Tools\nodejs\PFiles64\nodejs`
- 该目录已加入当前用户 PATH

如果 PowerShell 提示 `npm.ps1 cannot be loaded because running scripts is disabled`，需要执行一次：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

本机已经设置为 `RemoteSigned`。

## 启动方式

在项目根目录运行：

```bash
npm install
npm run dev
```

启动后常用地址：

- 房主页：`http://localhost:3000/host`
- 成员页：`http://localhost:3000/join`
- API 服务：`http://localhost:3010/api/room`

房主页会显示成员扫码用的二维码。二维码地址会类似：

```text
http://192.168.31.186:3000/join
```

这个地址里的 IP 是房主电脑在局域网里的地址。成员扫码时必须使用这个地址，不能使用 `localhost` 或 `127.0.0.1`。

## 关闭方式

正常开发时可以在运行 `npm run dev` 的终端里按：

```text
Ctrl + C
```

如果旧服务还在后台占用端口，执行：

```bash
npm run stop
```

然后重新启动：

```bash
npm run dev
```

当前项目要求 web 固定使用 `3000`，server 固定使用 `3010`。如果端口被占用，会直接失败，不会自动跳到 `3001`、`3002`，这样可以避免二维码地址和真实服务端口错位。

## 现场使用流程

1. 房主电脑连接排练室 Wi-Fi、手机热点或便携路由器。
2. 在房主电脑打开项目目录。
3. 运行 `npm run dev`。
4. 浏览器打开 `http://localhost:3000/host`。
5. 房主页上传 Guitar Pro 谱子。
6. 房主电脑播放谱子音频。
7. 房主电脑的系统声音输出选择声卡、3.5mm、USB 音频接口或现场音响。
8. 成员扫描房主页二维码加入。
9. 成员进入后修改自己的昵称。
10. 成员选择自己要看的轨道，必要时进入全屏看谱。

蓝牙音箱可以用于测试，但排练现场更稳的是：

```text
MacBook Air -> 声卡 / 3.5mm / USB 音频接口 -> 排练室音响
```

## 部署情形

### Windows 台式机开发

适合现在日常开发。确保 Node.js、npm、Git 都在 PATH 里，然后直接运行：

```bash
npm install
npm run dev
```

Windows 防火墙如果弹出 Node.js 网络访问提示，需要允许专用网络访问，否则手机可能打不开二维码地址。

### MacBook Air 作为房主

把项目拉到 MacBook Air 后：

```bash
npm install
npm run dev
```

如果 macOS 弹出“是否允许接受传入网络连接”，需要允许，否则成员手机可能访问不到本地服务。

### 手机热点或便携路由器

排练室没有稳定 Wi-Fi 时，可以用手机热点或便携路由器。关键是房主电脑和成员手机必须在同一个局域网内。

如果房主电脑连的是手机热点，二维码里的 IP 可能是 `172.x.x.x` 或 `192.168.x.x`，这是正常的。

### 不适合的部署方式

v1.0 暂时不建议：

- 放到公网服务器上给外网访问。
- 做微信小程序。
- 直接打包 `.exe`、`.app` 或 `.dmg`。
- 多房间、多乐队同时使用。

这些可以后续再设计。

## 重要注意事项

- 不要把给成员扫码的地址写成 `localhost`。
- 不要把给成员扫码的地址写成 `127.0.0.1`。
- 手机上的 `localhost` 指的是手机自己，不是房主电脑。
- 不要写死 Windows 路径，比如 `C:\xxx`。
- 不要假设路径分隔符是反斜杠。
- 不要使用 `.bat` 或 PowerShell 专属脚本作为项目启动方式。
- 所有路径处理应使用 Node.js 标准路径能力。
- 服务需要监听 `0.0.0.0`，让同一局域网设备可以访问。
- 第一版不依赖公网服务器。
- 第一版不做 `.exe`、`.app` 或 `.dmg`。

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

### 上传 GP5 后不能播放

正常流程是：

1. 在房主页上传 `.gp5` 文件。
2. 等待页面显示“已载入”或“播放器已准备好”。
3. 点击房主页播放按钮。

浏览器可能要求用户手动点击一次按钮后才允许发声，这是浏览器音频自动播放策略，不是项目错误。

如果仍然不能播放，优先检查：

- 文件是否是 alphaTab 支持的 Guitar Pro 格式。
- 房主电脑浏览器控制台是否有 alphaTab 载入错误。
- 系统声音输出是否选择了正确的声卡或音响。

### 中文仍然显示乱码

项目已将 alphaTab 导入编码设为 `gb18030`，适合多数中文 GP3-5 文件。少数谱子如果原始编码不是 GBK/GB18030，谱内标题、歌词或标记仍可能乱码。当前 UI 会优先显示上传文件名，减少乱码标题影响。

### 手机看谱太小或一行太少

成员页和房主页的谱面区域都有：

- 轨道选择
- 缩放滑杆
- 全屏看谱按钮
- 可点击进度条
- 播放时自动跟随当前游标滚动

手机上建议先点“全屏看谱”，再把缩放调到 45%-75% 之间。横屏通常更接近 Guitar Pro 的阅读体验。

### 房主端怎样控制不同音轨

上传谱子并载入后，房主页谱面工具栏下方会出现“音轨混音台”。混音台默认折叠，需要时点开。

- `Solo`：只突出播放选中的音轨，可同时打开多个音轨的 Solo。
- `Mute`：静音某个音轨。
- 音量滑杆：单独调节该音轨音量，范围是 0%-150%。
- “重置混音”：恢复所有音轨为不 Solo、不静音、100% 音量。

这个功能使用 alphaTab 的音轨播放控制实现。少数 Guitar Pro 文件如果多个音轨共用同一组 MIDI channel，静音或音量调节可能会影响共享 channel 的其他音轨。

### 成员怎样改昵称

成员扫码进入后，在成员页左侧或顶部的“我的昵称”输入框里修改名字即可。按回车或输入框失焦后会同步给房间内其他人，并保存在当前浏览器里，下次进入会自动带上上次的昵称。

### 终端找不到 npm

说明 Node.js 没有完整安装，或者 npm 没有加入 PATH。安装官方 Node.js LTS 后，关闭并重新打开终端，再运行：

```bash
node --version
npm --version
```

## GitHub 上传记录

v1.0 仓库名：

```text
guitarpro-rehearsal-room
```

GitHub 标题：

```text
零幺幺零线上排练房 / guitarpro-rehearsal-room
```

本地首次发版：

```bash
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
```

如果 GitHub CLI 被网络卡住，V2RayN 本机代理端口：

```powershell
$env:HTTP_PROXY="http://127.0.0.1:10809"
$env:HTTPS_PROXY="http://127.0.0.1:10809"
$env:ALL_PROXY="socks5://127.0.0.1:10808"
```

Git 代理：

```powershell
git config --global http.proxy "socks5h://127.0.0.1:10808"
git config --global https.proxy "socks5h://127.0.0.1:10808"
```

取消 Git 代理：

```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 后续计划

1. 增加成员各自独立选择声部并记住偏好。
2. 增加上传文件落盘和房间重载恢复。
3. 更接近 Guitar Pro 的谱面播放与定位体验。
4. 第一版稳定后，再考虑 Electron 桌面打包。
