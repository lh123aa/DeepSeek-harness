# Agent Note: Web session delete (row menu, durable erasure)

Status: implemented

English | [中文](2026-09-06-web-session-delete.zh.md)

## Problem

The sidebar session row menu offered archive and a visual-only delete placeholder, but no way to permanently remove a conversation: the log stayed in persistence forever, and the client had no delete command. The operator asked for a real delete action directly under the "Archive session" menu row.

## Decision

**A confirmed destructive `deleteSession` surface through the whole stack, placed under the archive row in the session menu.**

- Menu/UI: the session row menu gains `delete` (label "Delete session", danger styling) directly below `archive`; it opens a browser-owned confirmation dialog (title "Delete this session?") so the action outlives row unmounts, and the dialog stays open with the error when the call fails.
- Registry: `WorkspaceRegistry.deleteSession(id)` rides the existing `enqueueOperation` chain: it rejects unknown ids with `WorkspaceUnknownSessionError` naming the `delete` verb, detaches the session from every workspace account, removes the id from the archive set, and erases the stored log through the persistence backend.
- Persistence: `SessionPersistence` gains `deleteSession(id)`; the base implementation is a documented no-op for backends that cannot erase, and the JSONL backend erases the session's log directory (`rm -rf`, idempotent for unknown ids).
- RPC: `workspace.deleteSession({sessionId}) → {deleted: true}`; unknown sessions map to the existing `session/not-found` remote code. The client fixture mirrors detach + unarchive and guards against a non-archived delete disturbing the archive set.
- Client runtime: `UiWorkspace.deleteSession` clears the current selection when the deleted session was the open one; the browser injects the command through the `workspaces` service.

## Alternatives considered

**Idempotent delete for unknown ids.** Rejected: `session/not-found` stays a definite-miss error, matching archive; a retried delete after success is unreachable from the UI anyway because the row is gone.

**A recycle bin / soft delete.** Rejected: no storage-backed trash exists; the operator asked for the conversation to be gone, and the archive surface already provides the non-destructive hiding.

**Confirmation via the browser's native confirm instead of the dialog.** Rejected: the workspace delete dialog is the established destructive-confirmation pattern and carries the error display.

## Consequences

Deleting the currently open session returns the main view to the New Session hero (projection sweep already clears an archived current; delete clears through the same rule). Erasure is permanent and not undoable; the archive row is gone from every surface because the session no longer exists. Coverage: registry, controller, persistence, connection fixture, and component suites pin the chain; the confirmation dialog is browser-owned so it survives the row unmounting on success.

Related notes: [session archive (registry-global set)](2026-07-31-session-archive-global-set.md) describes the sibling non-destructive hiding; [workspace registration deletion](2026-07-27-workspace-registration-deletion.md) covers workspace-only deletion, which deliberately keeps session logs.
