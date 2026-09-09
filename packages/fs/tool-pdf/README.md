---
description: "Model-facing read_pdf tool for extracting text from PDF files via pdfjs-dist."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-pdf

English | [中文](README.zh.md)

## Overview

`dsh-tool-pdf` provides the model-facing `read_pdf` tool: it extracts text from PDF files page by page using `pdfjs-dist`, returning paginated text bounded by `max_pages` and `max_bytes`. Double-cap overflow produces a truncated footer with a recoverable hint. This package injects `tools`, `fs`, and `systemPrompt`; mount it after `ctx.fs` is available.

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

Mount this package after the `ctx.fs` backend; the model gains a `read_pdf` tool. The shipped `dsh` base profile does not include it by default — override your profile or preset `cordis.patch.yml` to mount it explicitly.

### Minimal composition

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-tool-pdf'
```

### Tool

| Tool | Args | Behavior |
|---|---|---|
| `read_pdf` | `file_path`, `max_pages?`, `max_bytes?` | Extracts text from a PDF page by page; bounded by `max_pages` and `max_bytes` |

Fields use snake_case, consistent with the existing filesystem tool schemas. Success returns a structured envelope — path, total pages, pages extracted, whether byte-cap truncation occurred — with the text embedded in `content`.

### Configuration

All keys are optional; defaults match the shipped caps.

| Key | Default | Meaning |
|---|---|---|
| `maxPages` | `50` | Maximum pages extracted by one `read_pdf` call |
| `maxBytes` | `51200` | Maximum output bytes retained inline; overflow produces a truncated footer |

### Failures and recovery

Failures normalize to `Error: <message>` with stable error codes:

- `file_path must be a non-empty string` — empty path
- `cannot read "<path>": not found` — file absent (`FS_NOT_FOUND`)
- `cannot read "<path>": not a regular file` — target is not a regular file (`FS_NOT_REGULAR_FILE`)
- `cannot read "<path>": the .xxx extension does not declare a supported PDF format; read_pdf accepts .pdf files only` — extension is not `.pdf`
- `cannot read "<path>": the file is not a valid PDF; the file may be truncated or corrupt` — PDF content is invalid

-----

<a id="understand-the-implementation"></a>
## Understanding the implementation

<details>
<summary>Implementation details — click to expand</summary>

This section explains design decisions behind the tool; observable behavior is fully documented under [Using this package](#use-this-package).

### Design principles

The package rests on three commitments:

- **Bounded constraints mirroring text read.** `max_pages` and `max_bytes` double-cap prevent a single large PDF from flooding context; overflow preserves the extracted prefix and reports the truncation reason so callers can incrementally raise the budget.
- **pdfjs-dist as a pure Node dependency.** `GlobalWorkerOptions.workerSrc` points to the bundled worker inside the package — no separate process or browser environment needed. `disableFontFace` and `useSystemFonts` reduce font network/filesystem dependencies.
- **Path resolution reuses `ctx.fs` conventions.** Resolution, stat, and byte reads flow through the same `FsTarget`/`FsInfo` system; error taxonomy aligns with `tool-fs`.

### Source map

| File | Responsibility |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `Config`, tool composition, `apply` |
| [`src/read-pdf.ts`](src/read-pdf.ts) | `read_pdf` executor: argument validation, PDF loading, per-page extraction, schema registration |
| [`src/read-target.ts`](src/read-target.ts) | Path resolution, presence observation, regular-file gate |

</details>

-----

<a id="further-exploration"></a>
## Further exploration

When package-level conventions are insufficient, read the pages below; they move from the tool into the filesystem seam and design decisions.

- [Filesystem subsystem](../../../docs/subsystems/filesystem.md) — `ctx.fs` conventions, error taxonomy, and target identity.
- [fs-local](../fs-local/README.md) — local filesystem backend.
- [tool-fs](../tool-fs/README.md) — the same bounded-constraint model for text reading.
- [Generated tool catalog](../../../docs/tool-catalog.md) — exhaustive schema registered by this package.

-----

<a id="model-experience"></a>
## Model experience

### System prompt

#### What the model sees

Every request within this plugin's scope receives the standalone read_pdf guidance below.

##### Read PDF guidance

```markdown
Use the read_pdf tool — not shell commands like pdftotext — to extract text from PDF files. Results are bounded by max_pages and max_bytes.
```

#### Token effect

Fixed guidance cost per request while the plugin is active.

#### KV Cache effect

Prefix stays stable as long as the plugin scope and guidance text are unchanged. Tool caps do not remove the section; plugin enable or dispose may invalidate reuse from that point.

### Tool schema

#### What the model sees

The model sees the generated [`read_pdf` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-pdf) with snake_case parameters.

#### Token effect

Fixed schema cost per request in the tool view.

#### KV Cache effect

Prefix stays stable while visible tool definitions and order remain unchanged. Registration lifecycle or scope restriction may invalidate reuse from the first changed schema token.

### Read results

#### What the model sees

Success returns a structured envelope: `path` (display path), `totalPages` (total pages in the PDF), `pagesExtracted` (pages actually extracted), `truncatedByBytes` (whether byte-cap truncation occurred). Text is embedded in `content`, formatted as paginated blocks:

```
=== Page 1 ===
[page text]

=== Page 2 ===
[page text]
...
(Output capped at max_bytes. Use max_bytes to increase the limit.)
```

#### Token effect

Output is double-capped by `maxPages` and `maxBytes`; retained calls and results send repeatedly until compaction.

#### KV Cache effect

Append-only; newly visible content sits after the reusable request prefix and does not invalidate existing KV cache entries.

## Known limitations and deferred work

<a id="known-limitations-and-deferred-work"></a>

These limits describe when the tool is inappropriate; they are current package constraints.

- **Text layer only** — images, scanned pages, and font-rendered content inside PDFs cannot be obtained through text extraction; use `read_image` with alternative approaches for visual understanding.
- **No multilingual font fallback guarantee** — `disableFontFace: true` and `useSystemFonts: true` may lose certain CJK characters when corresponding system fonts are absent; precise rendering depends on the host environment.
- **No page-offset pagination** — the `read` tool's `offset`/`limit` windowing pattern does not apply to PDFs; callers needing a specific range must segment calls at the application layer.
- **Worker binding assumes Node** — `GlobalWorkerOptions.workerSrc` resolves via `import.meta.url`, unavailable in Web Worker contexts.

<a id="dev-note"></a>
### Dev note

<details>
<summary>Maintainer context — click to expand</summary>

This dev note is maintainer context and explicitly non-authoritative; delivered behavior follows the prose above, package code, and linked documentation.

- **`pdfjs-dist` worker path** — currently points to `legacy/build/pdf.worker.min.mjs`; verify the path on major version upgrades.
- **CJK support** — currently relies on system fonts; consider introducing built-in fonts or an external OCR service as a supplement in future.

</details>
