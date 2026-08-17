# @deepseek-ai/dsh-client-ui-skin-cosmos

[English](README.md) | 中文

DeepSeek Harness Web GUI 的 **宇宙皮肤**：深空配色、动态星云背景、输入区状态条，以及持久化的「皮肤」设置页。

本包包含两半。宿主半注册 `ui-skin-cosmos` 设置命名空间及其 wire schema，皮肤偏好因此可跨重启保留。浏览器半激活注册的深色主题（`jarvis-core`）、叠加宇宙配色 Token 覆写，并注册三个插槽贡献：

- `shell.overlay` id `jarvis-cosmos` —— 全窗口背景：四团分层星云（光晕 / 气体团块 / 尘埃暗缝）、银河带、五层视差星点、三颗亮星十字光斑、电影感调色与暗角。该层点击穿透，绝不拦截输入。
- `conversation.composer.dock` id `jarvis-status` —— 输入框下方的等宽读数：核心状态、输入阶段、队列长度、草稿长度。
- `settings.section` id `jarvis-skin` —— 「皮肤」设置页：背景开关、星云浓度、3D 翻滚周期、星星亮度、状态条开关。

背景通过共享的 `defineStore` 句柄读取持久化配置；设置页通过设置作用域写回，因此每次修改即时生效且可持久。

## Model Experience

无——本包仅改变浏览器外观，不注册任何面向模型的内容。

#### KV Cache effect

无——本包既不组装也不发送任何 provider 请求。

## Known Limitations and Deferred Work

- **仅深色配色** —— 皮肤在启动时激活 `jarvis-core` 深色主题并叠加双模式覆写，激活期间刻意不提供浅色表面。在「外观」选择浅色/深色会回退到基础配色，但宇宙背景的 Token 覆写仍叠加其上。
- **外观偏好由本包接管** —— 插件挂载期间主题偏好被强制为 `jarvis-core`；用户选择内置偏好前，「外观」行没有选中的立方块。
- **进程级作用域** —— 插件随 Web bundle 发布，皮肤对宿主上的每个会话生效，而非按 agent 生效。
