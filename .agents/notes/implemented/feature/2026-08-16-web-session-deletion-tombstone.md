# Agent Note: Web session deletion (tombstone archive)

Status: implemented

English | [中文](2026-08-16-web-session-deletion-tombstone.zh.md)

## Problem

The sidebar session row menu offered Rename, Fork, and Archive, but no way to delete a conversation. The [session archive note](../feature/2026-07-31-session-archive-global-set.md) deliberately left deletion out of scope: archive hides the row while keeping the log and the accounting slot, and the README recorded "No Session deletion or unarchive control" as a Known Limitation. Users need a destructive path that removes the conversation from every grouping surface and from its workspace accounting, keeps the log on disk, and cannot be undone from the interface.

## Decision

**Session deletion reuses the archive set as the durable tombstone.** `ctx.workspaceRegistry.deleteSession(id)` runs on the registry write chain: it verifies the session is known (`WorkspaceUnknownSessionError` otherwise), adds the id to the same `archivedSessionIds` set archive uses (so all four grouping surfaces and the reconnect baseline already hide it), and then detaches the id from every accounting workspace entity. The session log is never touched. Because the tombstone is the existing archive set, no new domain field, frame, or client projection state is introduced.

**The wire verb is `workspace.deleteSession`** — a sibling of `workspace.archiveSession` with the same request `{sessionId}` and the same full-set response `{archivedSessionIds}`. The host handler rejects a live session whose agent is `running` with the existing `agent-busy` code (deleting the row while the turn runs would strand the stop affordance), maps unknown ids to `session-not-found`, and returns the full updated set so the client installs the echo without waiting for the changed frame (the domain change watcher still broadcasts `host/archived-sessions-changed` as for archive). The client `WorkspaceRuntime.deleteSession` delegates to the manager, which installs the returned set exactly like `archiveSession`, so the existing projection sweep clears a deleted current selection into the New Session view.

**The UI row menu gains a fourth, destructive item.** `Delete conversation` sits last in the session menu with danger styling and opens a browser-owned confirmation dialog (unlike archive's commit-directly gesture): the dialog states that the conversation is permanently removed from the sidebar, its log stays on disk, and the action cannot be undone from the interface. `WorkspaceBrowser` owns the dialog state so the row unmount on success cannot tear down in-flight confirmation state; failures keep the dialog open with the alert and allow retry or cancel.

## Alternatives considered

**Physical log deletion.** Rejected: the user's product decision is "removed from the list, log retained on disk, not restorable from the interface"; the session log is the durable record and deleting it would also break the session `list()` baselines the tombstone verification relies on.

**A dedicated `deletedSessionIds` set.** Rejected: the visible behavior is identical to archiving (hidden everywhere, never resurfacing from baselines), so a second set would duplicate the archive set's storage, frames, client projection, and reconciliation without any additional capability. The single set also keeps unarchive/restore semantics coherent if one is ever added.

**Detach-only (no tombstone).** Rejected: detaching alone would return the session to the Ungrouped bucket, the opposite of removal; the tombstone is what makes deletion durable and visible-across-reload.

**Deleting the current session keeps the row.** Rejected: the projection sweep treats the tombstone uniformly with archive, so the current selection clears into the New Session view — the behavior the user expects when deleting the conversation they are viewing.

## Consequences

The session row menu now reads Rename / Fork / Archive / Delete conversation, with deletion gated behind a confirmation dialog and the running-turn rejection. The shared `WorkspaceUnknownSessionError` message became neutral ("unknown session 'id': ...") because both archive and delete now raise it; one workspace.spec assertion was updated with the message. Deleted sessions are indistinguishable from archived ones in the UI (both hidden, both in the tombstone set) — the difference is intent and the detach; the README Known Limitation now reads "No Session unarchive control" instead of "No Session deletion or unarchive control". The workspace-management e2e gained a delete scenario (row menu → confirm → row gone → still gone after reload, log present); it reuses the shared seed with a per-scenario id and runs on the Linux CI lane.
