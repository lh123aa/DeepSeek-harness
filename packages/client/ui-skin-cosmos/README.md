# @deepseek-ai/dsh-client-ui-skin-cosmos

English | [中文](README.zh.md)

**Cosmos skin** for the DeepSeek Harness Web GUI: a deep-space palette, an animated nebula background, a composer status strip, and the persisted **皮肤** (Skin) settings page.

The package has two halves. The Host half registers the `ui-skin-cosmos` settings namespace with its wire schema, so the skin preferences survive restarts. The browser half activates a registered dark theme (`jarvis-core`), stacks the cosmic token overrides, and registers three slot contributions:

- `shell.overlay` id `jarvis-cosmos` — the full-window background: four layered nebulas (glow / gas clumps / dust lanes), a galaxy band, five parallax star layers, three star glints, a cinematic grade, and a vignette. The layer is click-through and never intercepts input.
- `conversation.composer.dock` id `jarvis-status` — the mono readout under the composer: core status, input phase, queue length, and draft length.
- `settings.section` id `jarvis-skin` — the Skin settings page: background toggle, nebula intensity, 3D orbit period, star brightness, status strip toggle.

The background reads the persisted section through a shared `defineStore` handle; the Skin page writes back through the settings scope, so every change is durable and live at the same time.

## Model Experience

None, as this package only changes browser appearance and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Dark-only palette** — the skin activates the `jarvis-core` dark theme at boot and stacks both-mode overrides, so light surfaces are deliberately absent while it is active. Selecting 浅色/深色 in Appearance falls back to the base palette; the cosmic background overrides remain stacked over it.
- **Settings namespace owns the appearance preference** — the theme preference is forced to `jarvis-core` while the plugin is mounted; the Appearance row shows no selected cube until the user picks a built-in preference.
- **Process-wide scope** — the plugin ships in the Web bundle, so the skin applies to every session on the host, not per agent.
