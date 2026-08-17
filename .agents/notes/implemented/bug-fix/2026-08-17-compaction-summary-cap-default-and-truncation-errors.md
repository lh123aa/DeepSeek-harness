# Agent Note: Summarization cap default raised and truncation made actionable

Status: implemented

English | [中文](2026-08-17-compaction-summary-cap-default-and-truncation-errors.zh.md)

## Problem

Manual `/compact` failed on large sessions with `summarization truncated at the token cap (incomplete checkpoint)`. The default `maxTokens` for the summarization call was `8192`, split between surfaced and hidden reasoning tokens; a long conversation's structured checkpoint routinely exceeded it, and the fail-closed transaction then reported only the generic `summary` error text (`Compaction could not produce a useful summary`) to the human command, hiding the real cause.

## Decision

- The service-wide default `maxTokens` for the summarization call rises from `8192` to `32768` (`resolveConfig` in `dsh-compaction-basic`). The cap remains a configured, deployment-tunable field; deployments that want the previous ceiling set `maxTokens: 8192` explicitly.
- `dsh-command-compact` now inspects the `ManualCompactionError` cause chain for the summarizer's `MAX_TOKENS` marker (code `MAX_TOKENS`, emitted by `finishError` on a `max-tokens` finish). When the cause is truncation, the command returns a targeted message naming the output token cap and the remedy (raise `maxTokens` or configure a summarization model) instead of the generic summary failure text. Other summary failures keep the previous text.

## Alternatives considered

- **Improve only the error text, leave the default cap at `8192`** — rejected: the targeted message helps diagnose a truncation but does not prevent the most common large-session failure; the default simply was too small for a long structured checkpoint.
- **Auto-retry truncation with a larger cap** — rejected: convergence is already dynamic (hidden reasoning tokens can consume the ceiling unpredictably), and retrying the expensive summarization call multiplies its cost without a bounded improvement guarantee; a higher default plus an explicit remedy is simpler and honest.
- **Inherit the routed conversation request's `maxTokens`** — rejected: the summarization call is a separate auxiliary request whose budget the deployment should own; silently inheriting a conversation cap couples two policies and makes the summarization cost opaque.

## Consequences

- `dsh-compaction-basic` README, config table, `CompactionPolicyConfig.maxTokens` JSDoc, the generated `docs/config-catalog` pair, and the implemented compaction notes that recite the default now document `32768`.
- Automatic compaction behavior is unchanged: an overstated cap is a ceiling, not a target, and the non-shrinking-summary rejection still requires the framed checkpoint to be smaller than the shadowed content.
- `dsh-command-compact` adds one helper (`causeIsTokenCap`) walking the `cause` chain; the closed `ManualCompactionErrorCode` union is unchanged.

## Testing

- `compaction-basic.spec.ts` pins the resolved default `maxTokens: 32768`.
- `command-compact.spec.ts` maps a `MAX_TOKENS`-caused `summary` failure to the targeted truncation text and keeps the existing generic-text table for other codes.
