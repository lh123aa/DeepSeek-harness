# Agent Note: Web 会话删除（墓碑式归档）

Status: implemented

[English](2026-08-16-web-session-deletion-tombstone.md) | 中文

## Problem

侧边栏会话行菜单只有重命名、分叉、归档，没有删除对话的途径。[会话归档 note](../feature/2026-07-31-session-archive-global-set.zh.md) 有意将删除留作后续：归档隐藏行但保留日志和归属槽位，README 把「没有 Session 删除与取消归档控件」记为已知限制。用户需要一个破坏性路径：把对话从所有分组表面和其工作区归属中移除，日志留在磁盘，且无法在界面撤销。

## Decision

**会话删除复用归档集合作为持久墓碑。** `ctx.workspaceRegistry.deleteSession(id)` 运行在注册表写链上：校验会话已知（否则抛 `WorkspaceUnknownSessionError`），把 id 加入归档所用的同一个 `archivedSessionIds` 集合（四个分组表面和重连基线因此已隐藏它），然后把 id 从每个记账工作区实体上摘除。会话日志从不触碰。由于墓碑就是既有归档集合，不引入新的域字段、帧或客户端投影状态。

**线上动词是 `workspace.deleteSession`** —— `workspace.archiveSession` 的姊妹方法，同样的请求 `{sessionId}`、同样的全量集合响应 `{archivedSessionIds}`。宿主 handler 对运行中的 agent（`running`）以既有 `agent-busy` 错误码拒绝（运行中删除行会让停止入口失联），未知 id 映射为 `session-not-found`，返回全量更新集合让客户端不必等待 changed 帧即可安装回显（域变更监视器仍像归档一样广播 `host/archived-sessions-changed`）。客户端 `WorkspaceRuntime.deleteSession` 委托给 manager，与 `archiveSession` 完全一致地安装返回的集合，因此既有投影清扫会把被删除的当前选择清进新会话视图。

**UI 行菜单新增第四个破坏性项。** `删除对话` 位于会话菜单最底部、使用危险样式，并打开浏览器持有的确认对话框（不同于归档的直接提交手势）：对话框说明对话将从侧边栏永久移除、日志保留在磁盘、此操作无法在界面撤销。`WorkspaceBrowser` 持有对话框状态，使成功时行的卸载不会拆掉进行中的确认状态；失败保持对话框打开并显示警示，可重试或取消。

## Alternatives considered

**物理删除日志。** 拒绝：用户的产品决定是「从列表移除、日志保留磁盘、界面不可恢复」；会话日志是持久记录，删除它还会破坏墓碑校验依赖的会话 `list()` 基线。

**专门的 `deletedSessionIds` 集合。** 拒绝：可见行为与归档完全相同（处处隐藏、基线永不复活），第二个集合只会重复归档集合的存储、帧、客户端投影与对账，不带来任何额外能力。单一集合也保持了未来取消归档／恢复语义的一致。

**仅摘除归属（无墓碑）。** 拒绝：仅摘除会让会话回到未分组桶，与移除相反；墓碑才是删除跨重载持久可见的保证。

**删除当前会话时保留行。** 拒绝：投影清扫把墓碑与归档统一处理，当前选择清进新会话视图 —— 这正是用户删除正在查看的对话时所期望的行为。

## Consequences

会话行菜单现为 重命名 / 分叉会话 / 归档会话 / 删除对话，删除由确认对话框和运行中拒绝把关。共享的 `WorkspaceUnknownSessionError` 消息改为中性表述（「unknown session 'id': …」），因为归档和删除现在都会抛出它；一处 workspace.spec 断言随消息更新。被删会话与已归档会话在 UI 上不可区分（都隐藏、都在墓碑集合中）——差异在于意图与摘除；README 已知限制从「没有 Session 删除与取消归档控件」改为「没有 Session 取消归档控件」。workspace-management e2e 新增删除场景（行菜单 → 确认 → 行消失 → 重载后仍消失、日志仍在），复用共享 seed 配场景专属 id，在 Linux CI lane 上运行。
