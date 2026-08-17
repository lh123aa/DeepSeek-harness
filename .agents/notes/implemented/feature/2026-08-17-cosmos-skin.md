# Agent Note: Cosmos skin plugin and the Cordis panel relocation

Status: implemented

English | [中文](2026-08-17-cosmos-skin.zh.md)

## Problem

The web GUI shipped no appearance skin of its own. A temporary dynamic-plugin skin existed, but dynamic plugins are process-local by design: the definition, the running client half, and every setting lived in memory, so a restart or a page refresh under a reject-all approval policy silently dropped the whole surface, and re-enabling it required a fresh approval each time. Separately, the dynamic-plugin management panel (`CordisPanel` in `dsh-client-ui-cordis`) was registered into the sidebar footer (`sidebar.footer.action`), a second plugin-management entry beside the `Plugins` section that Settings already owns — the sidebar entry was redundant and its popover duplicated the panel content Settings could host directly.

## Decision

Ship a web-bundle plugin package, `@deepseek-ai/dsh-client-ui-skin-cosmos`:

- The Host half registers the `ui-skin-cosmos` settings namespace with its schemastery schema (`enabled` / `nebula` / `orbit` / `stars` / `hud`), so skin preferences persist in the user-settings document across restarts.
- The browser half activates the registered `jarvis-core` dark theme at boot and stacks both-mode token overrides, so every surface follows the palette in either color scheme; it then registers three slot contributions — the `shell.overlay` Cosmos background (layered nebulas, galaxy band, five parallax star layers, star glints, grade, vignette), the `conversation.composer.dock` status strip, and the `settings.section` Skin page (toggles and sliders that write back through the settings scope).
- One store handle per slot scope (root and session) mirrors the same durable section, satisfying the one-handle-one-scope slot rule while keeping every surface in sync.

Move `CordisPanel` from `sidebar.footer.action` into `settings.plugins.tab` as the `dynamic` tab (order 20, label 动态插件): the panel renders inline as an embedded settings page — no badge, no popover, no auto-open — and the sidebar footer action seat is empty again. The `panel.hint` copy in the Define card now points at Settings → Plugins → Dynamic plugins.

The palette is dark-only with high-contrast labels (`--dsw-alias-label-primary` near-white, `--dsw-alias-label-secondary` bright enough to read at 12px mono), and the background layers sit deliberately below content contrast: nebula, grade, and vignette alphas are kept low so the ambient layers never wash out text.

## Alternatives considered

**Keep the skin as a dynamic plugin.** Rejected: dynamic plugins are process-local and require per-activation approval; the user-visible failure this note fixes (skin lost after refresh/restart) is the mechanism's contract, not a bug.

**Register the panel in a new top-level `settings.section`.** Rejected: the `Plugins` section already owns the plugin surface (`configurable` and `all` tabs), and a separate nav row would fragment plugin management.

**Theme overrides without activating the dark theme.** Rejected: `overrideTokens` touches only the alias layer, so a light base palette would keep non-overridden surfaces light and the result is the mixed, low-contrast look the palette iteration removed.

## Consequences

- The skin applies to every session on the host (process-wide scope), and its settings persist across restarts.
- While active, the palette is dark-only; the theme preference is forced to `jarvis-core`, so the Appearance row shows no selected cube until the user picks a built-in preference.
- The sidebar no longer hosts the Cordis panel; approvals, versions, and lifecycle controls live in Settings → Plugins → Dynamic plugins and in the conversation run cards.

## Testing

- `ui-skin-cosmos` package specs cover the background (CSS variables, off class, five star layers), the status strip (hud toggle, telemetry fields), the Skin page (rows, toggle and slider writes), and the apply wiring (three registrations, late slot declaration, HMR collapse recovery, teardown removal).
- `ui-cordis` specs still pass unchanged; the `cordis-tool-round` replay snapshot was updated for the new hint copy.
- Typecheck, oxlint, the package bundle, `verify-cordis-config`, and `verify-package-invariants` all pass.
