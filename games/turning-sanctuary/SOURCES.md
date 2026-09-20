# 来源与许可

核对日期：2026-09-21。`web/` 是**构建产物**，不是手写前端，因此这里记录的是产物里实际打包进去的第三方内容。

## 游戏本体

- 玩法、关卡、HUD、建模与场景脚本来自本项目自己的 Godot 4.7.2 工程；本仓库只收录 Web 导出产物。
- 导出设置：single-threaded、无 GDExtension、兼容渲染器（WebGL2），因此不需要 COOP/COEP 响应头。
- 封面图 `web/assets/turning-sanctuary-cover-v1.jpg` 是本游戏运行画面的截图（1280×720，本地裁剪压缩），属于项目自有内容。
- 玩法为原创设计，未使用任何已发行游戏的美术、扫描件或规则文案。

## 引擎运行时

- `web/index.wasm`、`web/index.js`、`web/index.pck` 内含 [Godot Engine](https://godotengine.org/) 4.7.2 的运行时，版权归 Godot Engine 贡献者所有，MIT / Expat 许可。
- 完整版权与第三方组件清单保留在 [`licenses/Godot-Engine-COPYRIGHT.txt`](licenses/Godot-Engine-COPYRIGHT.txt)（对应 `godotengine/godot` 标签 `4.7.2-stable` 的 `COPYRIGHT.txt`）。
- wasm 由 Emscripten 4.0.20 生成，其许可同样记录在上述文件的第三方清单内。

## 字体

- 游戏内置 **Noto Sans SC** 子集（正文 400 / 强调 600）与 **Noto Sans Math** 子集（符号兜底 `↶ ↷`）。
- 二者均为 SIL Open Font License 1.1，允许随产品分发（含子集化），要求保留许可证副本：见 [`licenses/Noto-Sans-OFL.txt`](licenses/Noto-Sans-OFL.txt)。
- 字体已内嵌进 `index.pck`，不再依赖系统字体，因此浏览器端中文不会退化成空方框。

## 音频

全部为 **CC0 1.0**（可商用、无需署名），随 `index.pck` 一同分发：

| 用途 | 文件 | 作者 / 来源 |
| --- | --- | --- |
| 标题 / 菜单 BGM | `crystal_cave.ogg` | tricksntraps · [Free Surreal/Dream Music Pack](https://opengameart.org/content/free-surrealdream-music-pack) |
| 游玩 BGM | `mystical_fungi_cave.ogg` | tricksntraps · 同上 |
| 备用 BGM | `calm_ambient2.mp3` | The Cynic Project · [Calm Ambient 2](https://opengameart.org/content/calm-ambient-2-synthwave-15k) |
| 备用 BGM | `budding_of_consciousness.mp3` | Yoiyami · [OpenGameArt](https://opengameart.org/node/182247) |
| UI / 行走 / 旋转 / 胜利音效 | Kenney UI Audio（51 个 WAV） | Kenney (kenney.nl) · [UI Audio](https://opengameart.org/node/12394)，许可文本见 [`licenses/Kenney-UI-Audio-CC0.txt`](licenses/Kenney-UI-Audio-CC0.txt) |

## 不包含

- 不含上游 Godot 工程、iOS 工程、测试与构建脚本，也不含任何运行数据或凭据。
