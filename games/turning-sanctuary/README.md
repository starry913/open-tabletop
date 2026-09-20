# 旋转归途（turning-sanctuary）

3D 空间解谜。你是漂流归乡的旅人，站在一座 3×3×3 魔方之城的**表面**上，转动任意一层把回家的路「转」出来，收齐散落的符印走到家门。

- 单人单机，不需要服务端与房间：`/games/turning-sanctuary/index.html` 直接可玩。
- 已登记在 `games/catalog.json`，首页会列出；没有联机模式，因此不填 `online`。

## 来源与构成

`web/` 是 Godot 4.7.2 的 Web(HTML5) 导出产物，不是手写前端：

- `index.html` / `index.js`：导出模板的加载器与启动流程。
- `index.wasm`（约 40 MB）与 `index.pck`（约 27 MB）：引擎本体与游戏资源包。
- `index.audio*.worklet.js`、`index*.png`：音频 worklet、启动图与图标。

产物是 single-threaded、无 GDExtension 的版本，**不需要 COOP/COEP 跨源隔离响应头**，
任意静态托管（本仓库的 Node 服务、静态构建、对象存储）都能直接跑。

## 重新导出

上游 Godot 工程在游戏项目仓库里，导出脚本为 `tools/build_web.sh`：

```bash
tools/build_web.sh          # release 出包到 build/web/
tools/build_web.sh serve    # 出包并起本地静态服务预览
```

导出后把 `build/web/` 里的上述文件覆盖到本目录 `web/`。`index.pck` 等文件名是加载器写死的，
不要改名或加哈希后缀。

## 服务端要求

- `server/index.mjs` 的 mime 表已加入 `.wasm`（`application/wasm`）与 `.pck`（`application/octet-stream`）。
  缺了这两项，静态路由会按未知类型拒绝，页面直接 404 —— 换部署环境时同样要保证这两条 MIME。
- 首次加载约 65 MB，公网部署建议开 gzip / brotli（gzip 后约 38 MB）。
- 静态路由返回 `Cache-Control: no-cache`，靠 ETag 重验证；文件名固定，重新发布后刷新即生效。

## 已知限制

- **手机浏览器会显示桌面 HUD**（键盘操作提示条）。游戏按 `OS.has_feature("mobile")` 判断是否切触控 UI，
  浏览器里恒为 false；触控本身能玩，只是提示条不对。
- 存档在浏览器 localStorage，换浏览器或清缓存会丢进度，与服务器无关。
