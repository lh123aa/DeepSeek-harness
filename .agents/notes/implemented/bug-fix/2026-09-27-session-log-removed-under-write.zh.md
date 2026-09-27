# Agent Note: A vanished session log is refused, never recreated

Status: implemented

[English](2026-09-27-session-log-removed-under-write.md) | 中文

## Problem

会话的持久工件可能在本 harness 仍以写方式持有该会话时消失：运维人员、清理脚本或本仓库之外的插件删除了 `sessions/<project>/<session-id>/`。JSONL 写路径以 `open(path, 'a')` 打开该工件，于是下一批数据泄漏出原始的 Node 失败 `ENOENT: no such file or directory, open '<path>/session.v3.jsonl.zstd'`——该消息既未指明会话，也未指明持有者与补救办法——该轮次因 harness 既无法恢复也无法解释的存储而失败。同样的追加模式还掩盖了范围更窄的一种情形：仅日志文件被删除而目录仍在时，`open(..., 'a')` 重建了一个空文件，该批次在缺少 header 行的情况下发布，使该会话自己的日志成为无法读取的无 header 日志。

## Decision

写句柄把其已提交工件视为必然存在。`JsonlSessionPersistence.openCommittedArtifact` 以 `'r+'` 打开它，`writeAt` 把每个批次写到工件当前字节长度处，而不是句柄位置；工件缺失会映射为来自 seam 的 [`SessionPersistenceArtifactMissingError(sessionId, path)`](../../../../packages/session/session-persistence/src/errors.ts)。撕裂尾部修复也以同样方式映射工件缺失。句柄绝不重建被删除的日志，因为替代文件会携带缺少标识所存储会话的 header 的事件行。非缺失类失败保留其 errno，因此同一次打开或修复阶段 truncate 产生的 `EACCES` 仍原样送达调用方。

## Testing

`packages/session/session-persistence-jsonl/tests/vanished-artifact.spec.ts` 固定五种情形：会话目录被删除、日志文件被删除（事后证明确实不存在，因此没有发布无 header 日志）、非 `ENOENT` 的打开失败、工件被删除后的撕裂尾部修复，以及非 `ENOENT` 的修复失败。

## Alternatives considered

**重建目录并继续追加。** 新文件是空的，该批次会在缺少 header 的情况下发布，下一次读取会以无 header 日志拒绝它。改为重新实体化完整前缀，需要持久化句柄内部持有此前的全部事件，而句柄在首次追加后会有意丢弃已准备的 prefix；为抵御外部删除而在后端保留贯穿整个会话的日志副本，是存储层原本不付出的内存代价。

**复用 `SessionPersistenceNotFoundError`。** seam 已为“该身份没有持久日志”给出专门的失败，恢复流程把它当作新建会话的理由。在活跃写句柄之下被删除的日志是另一回事——身份存在而转录已丢失——把它并入同一类别会让丢失的转录看起来像一个从未写入过的会话。

**保留追加模式并先做检查。** 在 `open(path, 'a')` 之前 `stat`，仍留下文件在检查之后被删除的时间窗，追加模式会在该窗口内重建它。以更新方式打开则消除了该窗口，而不是缩小它。

## Consequences

存储在被持有期间被删除的会话，现在会以其 id 与缺失路径失败，并且不再能通过发布无 header 日志损害自身。被删除的转录依然缺失：持久前缀就是外部删除后留下的内容，内存中的会话是唯一剩余的副本，消息陈述这一点，而不是暗示重试会成功。每次追加现在都以更新方式而非创建方式打开，因此写句柄要求实体化本已建立的工件存在。
