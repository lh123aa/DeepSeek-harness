# Agent Note: A vanished session log is refused, never recreated

Status: implemented

English | [中文](2026-09-27-session-log-removed-under-write.zh.md)

## Problem

A session's durable artifact can disappear while the harness still owns that session for writing: an operator, a cleanup script, or a plugin outside this repository removes `sessions/<project>/<session-id>/`. The JSONL write path opened that artifact with `open(path, 'a')`, so the next batch leaked the raw Node failure `ENOENT: no such file or directory, open '<path>/session.v3.jsonl.zstd'` — a message naming no session, no owner, and no remedy — and the turn failed on storage the harness could neither restore nor explain. The same append mode also hid a narrower case: when only the log file was removed and its directory survived, `open(..., 'a')` recreated an empty file, and the batch was published without the header line, leaving the session's own log unreadable as a header-less log.

## Decision

The write handle treats its committed artifact as existing. `JsonlSessionPersistence.openCommittedArtifact` opens it with `'r+'`, `writeAt` places each batch at the artifact's current size instead of at a handle position, and absence maps to [`SessionPersistenceArtifactMissingError(sessionId, path)`](../../../../packages/session/session-persistence/src/errors.ts) from the seam. Torn-tail repair maps a missing artifact the same way. The handle never recreates a removed log, because a replacement file would hold event rows without the header identifying the stored session. Failures that are not absence keep their errno, so an `EACCES` from the same open or from the repair truncate still reaches the caller unchanged.

## Testing

`packages/session/session-persistence-jsonl/tests/vanished-artifact.spec.ts` pins five cases: a removed session directory, a removed log file (proven absent afterwards, so no header-less log was published), a non-`ENOENT` open failure, a torn-tail repair whose artifact was removed, and a non-`ENOENT` repair failure.

## Alternatives considered

**Recreate the directory and continue the append.** A fresh file starts empty, so the batch would be published without its header and the log would be refused by the next read as header-less. Re-materializing the full prefix instead needs every prior event inside the persistence handle, which deliberately drops the primed prefix after its first append; keeping a session-long copy of the log in the backend to survive external deletion is memory the storage layer does not otherwise spend.

**Reuse `SessionPersistenceNotFoundError`.** The seam already gives "this identity has no durable log" its own failure, and resume treats it as a reason to create a fresh session. A log removed under a live write handle is a different fact — the identity exists and its transcript was lost — and folding it into the same class would let a lost transcript look like a session that was never written.

**Keep append mode and check the file first.** `stat` before `open(path, 'a')` still leaves a window in which the file is removed after the check, and append mode recreates it inside that window. Opening for update removes the window instead of narrowing it.

## Consequences

A session whose storage is removed under it now fails with its id and the missing path, and it can no longer damage itself by publishing a header-less log. The removed transcript stays removed: the durable prefix is whatever the external removal left and the in-memory session is the only remaining copy, which the message states instead of implying a retry would succeed. Every append now opens for update rather than creation, so the write handle requires the artifact materialization already establishes.
