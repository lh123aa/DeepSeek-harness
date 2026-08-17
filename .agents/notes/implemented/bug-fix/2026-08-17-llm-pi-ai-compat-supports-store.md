# Agent Note: llm-pi-ai compat gains a supportsStore wire switch

Status: implemented

English | [中文](2026-08-17-llm-pi-ai-compat-supports-store.zh.md)

## Problem

A provider configured directly at Google's OpenAI-compatible endpoint (`https://generativelanguage.googleapis.com/v1beta/openai`) failed every request with `CONTEXT_WINDOW_EXCEEDED: 400 status code (no body)`. pi-ai's URL-derived compat detection counts the endpoint as standard — its non-standard list covers `open.bigmodel.cn` and similar hosts but not `generativelanguage.googleapis.com` — so `buildParams` sends `store: false`. Google's endpoint rejects the unknown field with HTTP 400 (`Unknown name "store": Cannot find field.`), and the empty response body surfaces in the harness as a context-window error. The reported setup compounded the failure with a baseURL pointing at a local proxy on port 9000 that had no listener.

## Decision

- `PiAiCompatProfile` (the route-level and model-level `compat` object in `dsh-llm-pi-ai` configuration) gains `supportsStore?: boolean`. `resolveModelCompat` forwards it onto the pi-ai model's `compat`, and the `compatProfile` schema accepts a boolean; an absent value keeps the installed catalog entry's, then pi-ai's URL-derived detection.
- Setting `compat: { supportsStore: false }` on a route tells pi-ai the endpoint rejects the OpenAI `store` field, so the field is never sent. The switch is opt-in; endpoints that accept `store` (OpenAI itself, standard gateways) keep pi-ai's detection.
- The switch follows the reasoning switches' guards: a model-level `supportsStore` on a non-`openai-completions` route fails resolution, a route-level one skips models of other protocols, and a route with no `openai-completions` model is refused.

## Alternatives considered

- **Special-case the Google endpoint URL in the harness.** Rejected: provider quirks stay in pi-ai's detection and user configuration, not hardcoded harness URLs; an explicit configurable switch also covers other gateways that reject `store`.
- **Patch pi-ai's `detectCompat` to treat `generativelanguage.googleapis.com` as non-standard.** Rejected: pi-ai is a pinned vendored dependency; a local patch would be lost on the next vendor sync, and the harness already exposes a compat surface for exactly this class of provider difference.

## Consequences

- A direct Gemini route needs both the Google baseURL and `compat.supportsStore: false`; the field is documented in the llm-pi-ai README pair and the generated config catalog.
- The compat surface description changes from reasoning-only to "reasoning-dispatch and `store` wire switches".
- pi-ai's own detection gap remains for any consumer that does not set the switch.

## Testing

- `catalog.spec.ts` materializes a route-level `supportsStore: false` on every `openai-completions` model.
- `config.spec.ts` accepts a declared boolean and rejects a non-boolean.
- A headless agent run against the real Google endpoint succeeds where the same configuration previously failed with the 400.
