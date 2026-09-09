# Agent Note: Web 删除会话（行菜单、持久擦除）

Status: implemented

[English](2026-09-06-web-session-delete.md) | 中文

## 问题

侧边栏会话行菜单提供归档与一个仅作视觉展示的删除占位，但没有真正删除对话的途径：会话日志永远留在持久化里，客户端也没有删除命令。操作者要求在「归档会话」菜单项的正下方增加一个真正的删除动作。

## 决定

**一条贯通全栈、需确认的破坏性 `deleteSession` 面，放在会话菜单的归档行之下。**

- 菜单/UI：会话行菜单在 `archive` 之下新增 `delete`（文案「删除会话」，danger 样式）；点击打开浏览器拥有的确认对话框（标题「删除会话？」），因此可以活过行节点卸载，调用失败时对话框保留并展示错误。
- 注册表：`WorkspaceRegistry.deleteSession(id)` 走既有 `enqueueOperation` 链：未知 id 以 `WorkspaceUnknownSessionError` 拒绝并点名 `delete` 动词；把会话从每个工作区账户中分离；从归档集合移除该 id；通过持久化后端擦除已存日志。
- 持久化：`SessionPersistence` 新增 `deleteSession(id)`；基类实现为文档化的 no-op（无法擦除的后端），JSONL 后端删除会话的日志目录（`rm -rf`，未知 id 幂等）。
- RPC：`workspace.deleteSession({sessionId}) → {deleted: true}`；未知会话映射到既有 `session/not-found` 远程码。客户端 fixture 同步分离 + 取消归档，并防止删除未归档会话时扰乱归档集合。
- 客户端运行时：`UiWorkspace.deleteSession` 在删除的会话是当前打开的会话时清除选中；浏览器通过 `workspaces` 服务注入该命令。

## 备选方案

**未知 id 的幂等删除。** 拒绝：`session/not-found` 保持明确的确定未命中语义，与归档一致；成功删除后行消失，UI 本就无法再次触发重试删除。

**回收站 / 软删除。** 拒绝：不存在存储支撑的回收站；操作者要求对话直接消失，且归档面已经提供了非破坏性隐藏。

**用浏览器原生 confirm 代替对话框。** 拒绝：工作区删除对话框是既有的破坏性确认模式，且承载错误展示。

## 后果

删除当前打开的会话会把主视图带回 New Session 主屏（投影清理已有归档当前规则；删除通过同一条规则清理）。擦除不可撤销；会话不再存在，因此从所有面消失。覆盖：注册表、控制器、持久化、连接 fixture 与组件套件钉住整条链；确认对话框为浏览器拥有，故行在成功后卸载也不影响它。

相关笔记：[会话归档（注册表全局集合）](2026-07-31-session-archive-global-set.zh.md) 描述同族的非破坏性隐藏；[工作区注册删除](2026-07-27-workspace-registration-deletion.zh.md) 覆盖仅删除工作区注册的路径，它刻意保留会话日志。
