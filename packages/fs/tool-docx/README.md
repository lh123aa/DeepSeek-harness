---
description: "Model-facing read_docx tool for extracting text from Word (.docx) files via mammoth."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-docx

English | [中文](README.zh.md)

## Overview

`dsh-tool-docx` provides the model-facing `read_docx` tool: it extracts plain text from Word `.docx` files using `mammoth`, returning text bounded by `max_bytes`. Double-cap overflow produces a truncated footer with a recoverable hint. This package injects `tools`, `fs`, and `systemPrompt`; mount it after `ctx.fs` is available.

## Contents

- [Using this package](#use-this-package)
- [Understanding the implementation](#understand-the-implementation)
- [Further exploration](#further-exploration)
- [Model experience](#model-experience)
- [Known limitations and deferred work](#known-limitations-and-deferred-work)
- [Dev note](#dev-note)

-----

<a id="use-this-package"></a>
## Using this package

Mount this package after the `ctx.fs` backend; the model gains a `read_docx` tool. The shipped `dsh` base profile includes it by default; override your profile or preset `cordis.patch.yml` to adjust caps.

### Minimal composition

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-tool-docx'
```

### Tool

| Tool | Args | Behavior |
|---|---|---|
| `read_docx` | `file_path`, `max_bytes?` | Extracts plain text from a `.docx` file; bounded by `max_bytes` |

Fields use snake_case, consistent with the existing filesystem tool schemas. Success returns a structured envelope — path and whether byte-cap truncation occurred — with the text embedded in `content`.

### Configuration

| Key | Default | Meaning |
|---|---|---|
| `maxBytes` | `51200` | Maximum output bytes retained inline; overflow produces a truncated footer |

### Failures and recovery

Failures normalize to `Error: <message>` with stable error codes:

- `file_path must be a non-empty string` — empty path
- `cannot read "<path>": not found` — file absent (`FS_NOT_FOUND`)
- `cannot read "<path>": not a regular file` — target is not a regular file (`FS_NOT_REGULAR_FILE`)
- `cannot read "<path>": the .xxx extension does not declare a supported DOCX format; read_docx accepts .docx files only` — extension is not `.docx`
- `cannot read "<path>": the file is not a valid .docx document; the file may be corrupted or use an unsupported format` — DOCX content is invalid

-----

<a id="understand-the-implementation"></a>
## Understanding the implementation

<details>
<summary>Implementation details — click to expand</summary>

This section explains design decisions behind the tool; observable behavior is fully documented under [Using this package](#use-this-package).

### Design principles

The package rests on three commitments:

- **Bounded constraints mirroring PDF read.** `max_bytes` prevents a single large document from flooding context; overflow preserves the extracted prefix and reports the truncation reason so callers can incrementally raise the budget.
- **mammoth as a pure Node dependency.** `mammoth.extractRawText` handles Buffers directly — no separate process or browser environment needed. Output is plain text without styling, suitable for model consumption.
- **Path resolution reuses `ctx.fs` conventions.** Resolution, stat, and byte reads flow through the same `FsTarget`/`FsInfo` system; error taxonomy aligns with `tool-fs`.

### Source map

| File | Responsibility |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `Config`, tool composition, `apply` |
| [`src/read-docx.ts`](src/read-docx.ts) | `read_docx` executor: argument validation, DOCX loading, text extraction, schema registration |
| [`src/read-target.ts`](src/read-target.ts) | Path resolution, presence observation, regular-file gate |

</details>

-----

<a id="further-exploration"></a>
## Further exploration

When package-level conventions are insufficient, read the pages below; they move from the tool into the filesystem seam and design decisions.

- [Filesystem subsystem](../../../docs/subsystems/filesystem.md) — `ctx.fs` conventions, error taxonomy, and target identity.
- [fs-local](../fs-local/README.md) — local filesystem backend.
- [tool-pdf](../tool-pdf/README.md) — the same bounded-constraint model for PDF reading.
- [Generated tool catalog](../../../docs/tool-catalog.md) — exhaustive schema registered by this package.

-----

<a id="model-experience"></a>
## Model experience

### System prompt

#### What the model sees

Every request within this plugin's scope receives the standalone read_docx guidance below.

##### Read DOCX guidance

```markdown
Use the read_docx tool — not shell commands like pandoc — to extract text from Word (.docx) files. Results are bounded by max_bytes.
```

#### Token effect

Fixed guidance cost per request while the plugin is active.

#### KV Cache effect

Prefix stays stable as long as the plugin scope and guidance text are unchanged. Tool caps do not remove the section; plugin enable or dispose may invalidate reuse from that point.

### Tool schema

#### What the model sees

The model sees the generated [`read_docx` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-docx) with snake_case parameters.

#### Token effect

Fixed schema cost per request in the tool view.

#### KV Cache effect

Prefix stays stable while visible tool definitions and order remain unchanged. Registration lifecycle or scope restriction may invalidate reuse from the first changed schema token.

### Read results

#### What the model sees

Success returns a structured envelope: `path` (display path), `truncatedByBytes` (whether byte-cap truncation occurred). Text is embedded in `content`.

#### Token effect

Output is capped by `maxBytes`; retained calls and results send repeatedly until compaction.

#### KV Cache effect

Append-only; newly visible content sits after the reusable request prefix and does not invalidate existing KV cache entries.

## Known limitations and deferred work

<a id="known-limitations-and-deferred-work"></a>

These limits describe when the tool is inappropriate; they are current package constraints.

- **Plain text only** — images, tables, styles, and macros inside `.docx` cannot be obtained through `mammoth.extractRawText`; use alternative approaches for structured format needs.
- **No legacy `.doc` support** — `.doc` (Word 97-2003) is a binary format that `mammoth` cannot parse; callers must convert to `.docx` first.
- **No page-offset pagination** — unlike PDFs, DOCX has no "page" concept; callers needing a specific range must segment calls at the application layer.
- **No style preservation** — `mammoth` outputs plain text; headings, bold, lists, and other formatting are discarded.

<a id="dev-note"></a>
### Dev note

<details>
<summary>Maintainer context — click to expand</summary>

This dev note is maintainer context and explicitly non-authoritative; delivered behavior follows the prose above, package code, and linked documentation.

- **`mammoth` Buffer conversion** — `ctx.fs.readBytes` returns a `Uint8Array`, while `mammoth` expects a `Buffer`; converted via `Buffer.from(data.buffer, offset, length)` to avoid extra memory copy.
- **Aligned with `tool-pdf`** — both packages share identical read caps, error taxonomy, and observed-event patterns, enabling future consolidation into a unified `read_file` tool family.

</details>
