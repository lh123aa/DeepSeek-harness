# Agent Note: No Ungrouped Sessions — every session belongs to a workspace

Status: rejected — the adoptSessions path already implements this without adding a new surface

English | [中文](2026-09-05-no-ungrouped-sessions.zh.md)

## Problem

The product surface names a visible `Ungrouped` bucket in the workspace sidebar
([apps/web](../../../../apps/web) e2e tests assert it throughout). Auto-generated
conversations land there whenever a session is created without an explicit
workspace home. That is the non-goal stated by the operator: no ungrouped
workspace and no ungrouped auto-generated conversation should be produced.

A session becomes Ungrouped through many creation paths, not one. The GUI
"New Session" flow materializes a workspace and attaches the session, but the
remaining paths bypass that flow entirely:

- `session.create({ cwd })` resolves `cwd` and creates the session, then never
  calls `attachSession`, even when the directory is already owned by a
  workspace ([commands.ts](../../../../packages/api/session-controller/src/commands.ts)).
- `ctx.agents.create({ meta: { cwd } })` is used directly by subagent, ACP,
  webhook, headless, SDK, hooks, schedule, and goal callers; none of them attach.
- `fork` attaches only when `forkWorkspace` resolves a workspace, which may be
  undefined ([commands.ts](../../../../packages/api/session-controller/src/commands.ts)).
- A missing, invalid, moved, or deleted `cwd` produces no groupable directory.
- Deleting a workspace registration leaves its sessions Ungrouped by design.

The membership invariant blocks the naive guarantee. `attachSession` revalidates
the stored header `cwd` against the workspace path, and membership requires both
an id in the account and a matching canonical `cwd`
([types.ts](../../../../packages/workspace/workspace/src/types.ts)). A session with
no `cwd` therefore structurally cannot belong to any workspace. Guaranteeing "no
ungrouped" must run through two mechanisms, not one.

## Proposal

Add an opt-in **adopt-on-create** policy to the workspace registry so that any
session, however it was created, lands in exactly one workspace. It is off by
default, so every current composition and test keeps the existing Ungrouped
behavior until a profile enables it.

### The policy surface

`WorkspaceRegistry` gains one opt-in `Config` field:

```ts
interface Config {
  /** Adopt every created session into a workspace; default `false`. */
  readonly adoptSessions?: boolean
}
```

When `adoptSessions` is `false` (default) the registry behaves exactly as today.
When it is `true`, creation and bootstrap enforce the guarantee below.

### Adoption order at creation

A session is adopted as soon as it is observable, on the `session/created`
event, in this order:

1. Read the session header `cwd`. Canonicalize it through the registry's
   `realpath` canon.
2. A valid directory: resolve the workspace owning that canonical path and
   `attachSession` (idempotent). When no workspace owns it, `create` the
   workspace for that path (title = `basename`) and attach. This is the
   operator-accepted auto-create behavior.
3. No groupable `cwd` (missing, invalid, moved, or deleted): the registry
   leaves the session Ungrouped and logs, never fabricating membership. A
   session belongs to a workspace only when its stored `cwd` equals the
   workspace path, and that header `cwd` is set at creation and immutable, so a
   cwd-less session structurally cannot be attached.

This one listener covers every creation path, because every session emits
`session/created` regardless of which caller made it. No agent, tool, or
subagent code needs to know about workspaces.

### Startup reconciliation

The one-time bootstrap is extended, still header-only, to be idempotent for
existing sessions. When `adoptSessions` is on, after the historical bootstrap
the registry walks every stored and live header and re-applies the adoption
order: sessions that already appear in a matching workspace account are
skipped; sessions with a valid canonical cwd that no workspace owns get a
workspace created and attached; the rest stay Ungrouped. The initialized marker
is written last so an interrupted reconciliation resumes safely, matching the
existing bootstrap contract.

### The ungroupable-cwd edge

The operator's third decision — fall back to a default workspace for sessions
with no cwd — is the one requirement this design does **not** implement. The
membership rule requires a session's stored `cwd` to equal the workspace path,
and that `cwd` is stamped at creation and immutable, so a session with no cwd
cannot be attached to any workspace without either rewriting the header or
relaxing the invariant. Assigning a default `cwd` at creation would have to be
injected into the agent-create boundary, which is core and model-facing and is
not a place the host-side workspace registry can influence. The GUI
`session.create` path already resolves a `cwd` for every session, so the real
auto-generated conversations always carry one; genuinely cwd-less sessions
come from deep `agents.create` callers and remain Ungrouped as the documented
last resort rather than fabricating membership.

## Package boundaries

| Surface | Change |
|---|---|
| `packages/workspace/workspace` | `Config` fields; `session/created` adoption listener; startup reconciliation; `create`/`attachSession` reuse |
| `packages/client/ui-workspace` | `watchNavigation` no longer auto-creates and opens a conversation on entry: a real Session selection is restored, otherwise the empty New Session state remains and a conversation is created only by an explicit `startSession` or the first message |
| `packages/api/session-controller` | `create`/`fork` keep their explicit attach; no behavioral change required, only confirmation they do not double-attach |
| `apps/web` | When the composition enables adoption, the `Ungrouped` bucket withdraws when empty; e2e assertions that seed Ungrouped stay valid because they run with adoption off |

The workspace registry is host-side and model-invisible, so the host policy adds no
prompt, tool, or request tokens. The client change stops the automatic
conversation generation in the left menu; together they deliver the operator's
outcome.

## Alternatives considered

**Manual adoption only (a "group this session" action).** Rejected: it removes
the visible bucket only after the user acts, and the operator asked that
auto-generated conversations never be produced ungrouped, not that they be
fixable afterwards.

**Auto-adopt only into already-registered workspaces, never create.** Rejected:
many auto-generated sessions run in directories no workspace registers, so they
would still be Ungrouped; the operator accepted auto-create.

**Synthesize a single "Ungrouped" workspace for leftover sessions.** Rejected:
it names the same concept the operator wants gone, and it would still invent a
workspace for directories that carry no session cwd of their own.

**Relax the membership invariant so a cwd-less session can attach to a default
workspace.** Rejected: membership is a documented one-owner invariant over
canonical `cwd`, and parting with it weakens the ownership guarantee across the
whole registry for one bucket.

**Continuously derive workspaces from session cwd** (the flow already rejected in
the product-flow note). Rejected again: it cannot represent empty workspaces,
stable names, or explicit order, and would auto-adopt every non-workspace caller
with no record to delete.

## Acceptance criteria

- With `adoptSessions` off (default), every current workspace, session, and
  snapshot behavior is unchanged; the `Ungrouped` bucket still appears when
  sessions have no home.
- With `adoptSessions` on, a session created by `session.create({ cwd })` for an
  already-owned directory attaches to that workspace; a session for an unowned
  directory creates a workspace and attaches.
- A session created by `ctx.agents.create` with a valid `cwd` is adopted without
  that caller changing. A session created without a groupable `cwd` stays
  Ungrouped and logs; membership is never fabricated.
- Startup reconciliation assigns every existing valid-cwd session to a workspace
  (existing or newly created) and is idempotent across restarts.
- No workspace record is created for a directory that is not a real, existing
  directory; creation still rejects a nonexistent path.
- Deleting a workspace still never deletes its directory, files, or session
  logs; those sessions re-enter the Ungrouped bucket exactly as today.
- Keyless runnable snapshots cover the default-off path unchanged and the
  adopt-on creation and reconciliation paths; REAL-composition tests cover the
  subagent and cwd-less adoption cases.

## Risks

The biggest change is the operator-accepted auto-create: a session's directory
now materializes a workspace record without an explicit user create. That ties
workspace records to session activity and means re-adding a removed directory no
longer starts empty once a session runs there again. The adoption listener is
host-side and serialized through the registry operation chain, so it adds a
write per created session when enabled; the default-off path adds nothing.

The default-workspace fallback for cwd-less sessions is knowingly not
implemented. A session with no groupable `cwd` stays Ungrouped and logs, because
the immutable header `cwd` and the one-owner membership rule make any other
outcome require either relaxing the invariant or coupling a default-cwd
injection into the core create path. Most auto-generated conversations carry a
`cwd` — the GUI `session.create` path resolves one for every session — so this
edge is narrow, but it is a real gap against the original "default workspace"
intent.

The reconciliation walk touches every stored header at startup when enabled. It
is header-only and idempotent, but on a very large history it is one more
startup pass; the default-off path skips it entirely.

## Risks note and next step

This proposal was written for review. The operator's auto-create-by-`cwd` and
config-switch-default-off decisions are implemented; the default-workspace
fallback for cwd-less sessions is not, and the gap is recorded above. The same
PR lands the registry change, the reconciliation, the doc and Agent-Note
updates, and the gated tests.





