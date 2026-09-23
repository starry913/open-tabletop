# 规则与素材

- [Hasbro C1009 官方说明书](https://instructions.hasbro.com/api/download/C1009_en-nz_monopoly-classic-game.pdf)：主要规则机制参考。
- [Hasbro 旧版规则](https://www.hasbro.com/common/instruct/monins.pdf)：抵押、房屋库存和破产流程交叉核对。
- 中文地名、事件描述、界面、建筑线稿与 CSS 视觉由本项目创作。未包含棋盘扫描件、商标图案、原作角色、美术或录音。
- 地块图片为内置 `image_gen` 生成的 40 张 3D 卡通棋盘模型插画，每个棋盘位置使用独立图片，包括同名事件格。以钟楼街样图统一圆角造型、玩具材质、立体底座、视角和光照，其余 39 张单独生成。同色街区保持配色，但不复用图片。新版文件位于 `web/assets/illustrations/game3d-v1/`，完整提示词、参考关系、棋盘位置和 SHA-256 内容哈希记录在上级目录 `ARTWORK.json`。WebP 编码保留原始尺寸、构图和透明通道；旧版图片保留备份。
- 数值及固定事件效果见 `web/data.js`；数字改编差异见游戏内玩法和 README。未声称逐卡复刻某一实体版。
- Monopoly 名称用于说明玩法参考；商标归相应权利人，本项目非官方、无授权或背书声明。仓库 MIT 许可仅覆盖本项目可许可代码与原创内容。
