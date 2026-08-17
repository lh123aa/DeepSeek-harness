# Agent Note: Cosmos skin plugin and the Cordis panel relocation

Status: implemented

[English](2026-08-17-cosmos-skin.md) | 中文

## Problem

Web GUI 没有自带的皮肤。曾存在一个临时动态插件皮肤，但动态插件天生是进程级临时的：定义、运行中的客户端一半、以及所有设置都驻留在内存中，因此一次进程重启、或在「拒绝一切」审批策略下的一次页面刷新，都会静默丢掉整个皮肤，重新启用还需要每次重新批准。另外，动态插件管理面板（`dsh-client-ui-cordis` 的 `CordisPanel`）注册在侧边栏底部（`sidebar.footer.action`），与 Settings 已拥有的「插件」区并列为第二个插件管理入口——侧边栏入口冗余，其弹层内容本可由 Settings 直接承载。

## Decision

发布一个随 web bundle 安装的插件包 `@deepseek-ai/dsh-client-ui-skin-cosmos`：

- 宿主半注册 `ui-skin-cosmos` 设置命名空间及其 schemastery schema（`enabled` / `nebula` / `orbit` / `stars` / `hud`），皮肤偏好因此写入用户设置文档、跨重启保留。
- 浏览器半在启动时激活注册的 `jarvis-core` 深色主题并叠加双模式 Token 覆写，使所有表面在任一配色方案下都遵循该配色；随后注册三个插槽贡献——`shell.overlay` 的 Cosmos 背景（分层星云、银河带、五层视差星点、亮星十字光斑、调色层、暗角）、`conversation.composer.dock` 状态条、`settings.section` 的「皮肤」页（开关与滑杆经设置作用域写回）。
- 按插槽作用域（root 与 session）各建一个 store 句柄，镜像同一份持久化配置，满足"一个句柄一个作用域"的插槽规则，同时保持所有表面同步。

将 `CordisPanel` 从 `sidebar.footer.action` 移入 `settings.plugins.tab` 作为 `dynamic` tab（order 20，标签「动态插件」）：面板以内嵌设置页形式直接渲染——无徽标、无弹层、不自动展开——侧边栏底部动作位恢复为空。Define 卡片中的 `panel.hint` 文案改为指向 设置 → 插件 → 动态插件。

配色为仅深色、高对比：`--dsw-alias-label-primary` 近纯白，`--dsw-alias-label-secondary` 在 12px 等宽下清晰可读；背景层刻意保持在内容对比度之下——星云、调色层与暗角的透明度均保持较低，环境层不会洗淡文字。

## Alternatives considered

**保留动态插件皮肤。** 拒绝：动态插件是进程级临时的且每次激活需批准；本 Note 修复的用户可见故障（刷新/重启后皮肤丢失）是该机制的约定，而非缺陷。

**在顶层新建 `settings.section` 承载面板。** 拒绝：「插件」区已拥有插件表面（`configurable` 与 `all` 两个 tab），再加一个导航行只会割裂插件管理。

**仅覆写 Token 而不激活深色主题。** 拒绝：`overrideTokens` 只作用于别名层，浅色基础配色下未覆写的表面仍为浅色，结果正是配色迭代中被移除的"混杂、低对比"观感。

## Consequences

- 皮肤对宿主上的所有会话生效（进程级作用域），其设置在跨重启后保留。
- 激活期间配色仅深色；主题偏好被强制为 `jarvis-core`，用户选择内置偏好前「外观」行没有选中的立方块。
- 侧边栏不再承载 Cordis 面板；批准、版本与生命周期控制位于 设置 → 插件 → 动态插件 以及会话内的运行卡片。

## Testing

- `ui-skin-cosmos` 包规格覆盖背景（CSS 变量、off 类、五个星层）、状态条（hud 开关、遥测字段）、皮肤页（行、开关与滑杆写入）以及 apply 装配（三个注册、迟到的插槽声明、HMR 折叠恢复、teardown 移除）。
- `ui-cordis` 规格不变且通过；`cordis-tool-round` 回放快照已随新提示文案更新。
- 类型检查、oxlint、包 bundle、`verify-cordis-config` 与 `verify-package-invariants` 均通过。
