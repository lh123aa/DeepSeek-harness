# Agent Note: 移除侧边栏的「新会话」胶囊按钮

Status: implemented

[English](2026-08-17-sidebar-new-session-capsule-removed.md) | 中文

## Problem

侧边栏外壳同时提供了两个新建会话入口：品牌 wordmark 的隐藏快捷键和一个带标签的胶囊按钮。工作区浏览区（`sidebar.workspaces`）本身已拥有自己的新建入口——每个工作区一个空白行加一个操作——因此胶囊只是重复了浏览区已有的能力，没有任何独有功能。

## Decision

- `ui-sidebar` 的 `SidebarRoot` 不再渲染「新会话」胶囊：按钮标记、其 `.newSession` CSS 规则（含 rail/折叠与 rail-in 变体）以及不再使用的 `session.new` 标签键均已移除。
- 品牌 wordmark 保留其新建会话快捷键（仅在行为上是按钮，无可见外观），侧栏仍保留启动会话的路径，但不再有冗余的带标签控件。
- 工作区浏览区仍是新建会话的主要入口。

## Alternatives considered

- **同时移除 wordmark 快捷键。** 已拒绝：logo 是零视觉成本的按钮，保留了侧栏内的启动路径；请求针对的是冗余的带标签胶囊。
- **保留胶囊。** 已拒绝：工作区浏览区已拥有可见的新建入口，且胶囊被报告为低价值。

## Consequences

- 侧栏 rail 少了一个上部控件；`rail-in` 动画与折叠 rail 的几何不再包含它。
- `session.new` 标签（「新会话」/ "New Session"）从侧栏消失；`session.new.label` 保留用于 wordmark 的无障碍名称。

## Testing

- `sidebar-root.client.spec.tsx` 改为仅通过 wordmark 路由新建会话。
- `sidebar-snapshot.client.spec.tsx` 从展开与折叠快照中移除胶囊。
- `sidebar-styles.client.spec.ts` 不再断言 `.newSession` 几何。
