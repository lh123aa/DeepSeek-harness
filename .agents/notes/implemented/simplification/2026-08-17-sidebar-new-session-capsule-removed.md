# Agent Note: Sidebar New Session capsule removed

Status: implemented

English | [中文](2026-08-17-sidebar-new-session-capsule-removed.zh.md)

## Problem

The sidebar shell offered two New Session starters side by side: the brand wordmark's hidden shortcut and a labeled capsule button. The workspace browser region (`sidebar.workspaces`) already owns its own new-session entries — a blank row per workspace plus a per-workspace action — so the capsule duplicated an affordance the browsing region already provides, with no unique capability.

## Decision

- `ui-sidebar`'s `SidebarRoot` no longer renders the New Session capsule: the button markup, its `.newSession` CSS rules (including the rail/collapsed and rail-in variants), and the now-unused `session.new` label key are removed.
- The brand wordmark keeps its New Session shortcut (a button only in behavior, no visible affordance), so the sidebar retains a start-session path without a redundant labeled control.
- The workspace browser remains the primary new-session surface.

## Alternatives considered

- **Remove the wordmark shortcut too.** Rejected: the logo is a zero-visual-cost button and preserves an in-sidebar start path; the request targeted the redundant labeled capsule.
- **Leave the capsule.** Rejected: the workspace browser already owns the visible new-session entry points, and the capsule was reported as low-value.

## Consequences

- The sidebar rail loses one upper control; the `rail-in` animation and the collapsed-rail geometry no longer include it.
- The `session.new` label ("新会话" / "New Session") disappears from the sidebar; `session.new.label` remains for the wordmark's accessible name.

## Testing

- `sidebar-root.client.spec.tsx` routes New Session through the wordmark alone.
- `sidebar-snapshot.client.spec.tsx` drops the capsule from the expanded and collapsed snapshots.
- `sidebar-styles.client.spec.ts` no longer asserts `.newSession` geometry.
