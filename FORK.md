# Fork Notice — DeepSeek Harness (lh123aa fork)

This repository is an independently maintained fork of
[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness).
It is **not affiliated with, endorsed by, or a product of DeepSeek**. The
"DeepSeek" name and logo are trademarks of their respective owners and are used
here only to identify the upstream project this fork derives from.

## Provenance

- Fork of: `deepseek-ai/deepseek-harness`
- Upstream base: `47f943859bef60e4160492346772ded9b24f765a` (master)
- Fork remote: `https://github.com/lh123aa/DeepSeek-harness`
- Maintainer: [lh123aa](https://github.com/lh123aa)

## Modifications relative to upstream

1. `feat(web): add session delete with durable tombstone` (4d03295fd4)
2. `feat(host): adopt a cwd-matching workspace on unattached session create` (9f4dc47f40)
3. `feat(workspace): adopt stray persisted sessions into owning workspaces` — the
   registry-side `adoptStraySessions` implementation, its tests, and the
   `workspace.list` wiring that calls it.

All other files are unmodified upstream source.

## License

The project remains licensed under the [MIT License](LICENSE). The original
copyright notice of DeepSeek is preserved; fork contributions are
`Portions Copyright (c) 2026 lh123aa`. Third-party dependency licenses are
disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Compliance notes

- **Redistribution obligations**: any redistribution of source or binaries must
  retain the MIT license text, the BSD-3-Clause notice of
  `@deepseek-ai/node-addon-landlock-run` where its binaries are shipped, and the
  third-party notices in `THIRD_PARTY_NOTICES.md`.
- **Anthropic Claude Code binaries are NOT open source**: the optional Claude
  Code compatibility plugins (`subagent-claude-code`, `hooks-claude-code`) may
  resolve `@anthropic-ai/claude-agent-sdk` platform payloads at install time.
  Those binaries are "© Anthropic PBC. All rights reserved" and subject to
  <https://code.claude.com/docs/en/legal-and-compliance>. Do **not** bundle or
  redistribute them in release artifacts; leave them to be installed by the end
  user under Anthropic's terms.
- **No warranty / no support**: this fork is provided "AS IS" without warranty
  of any kind (MIT). It receives no support, security updates, or verification
  from DeepSeek or from this fork's maintainer, and upstream compatibility is
  not guaranteed.
- **Trademark**: do not present this fork as an official DeepSeek product;
  building a commercial offering should use a distinct product name.