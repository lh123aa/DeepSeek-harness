---
description: "面向模型的 read_pdf 工具：通过 pdfjs-dist 从 PDF 文件提取文本。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-pdf

[English](README.md) | 中文

## 概述

`dsh-tool-pdf` 提供面向模型的 `read_pdf` 工具：通过 `pdfjs-dist` 从 PDF 文件逐页提取文本，返回带分页标注的文本结果。输出受 `max_pages` 与 `max_bytes` 双重约束；超限后截断并提示调用方增大预算。本包 injects `tools`、`fs`、`systemPrompt`，在 `ctx.fs` 后端之后挂载即可使用。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 `ctx.fs` 后端之后挂载本包，模型即可获得 `read_pdf` 工具。随附 `dsh` 基础配置不默认包含本包；需在 profile 或 preset 的 `cordis.patch.yml` 中显式挂载。

### 最小组合

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-tool-pdf'
```

### 工具

| 工具 | 参数 | 行为 |
|---|---|---|
| `read_pdf` | `file_path`、`max_pages?`、`max_bytes?` | 从 PDF 逐页提取文本；返回每页标注的结果，受 `max_pages` 与 `max_bytes` 约束 |

字段名使用 snake_case，与现有文件系统工具 schema 一致。成功返回结构化信封——路径、总页数、实际提取页数、是否因字节上限截断——文本本身嵌入 `content`。

### 配置

所有键均为可选；默认值是随产品交付的读取上限。

| 键 | 默认值 | 含义 |
|---|---|---|
| `maxPages` | `50` | 一次 `read_pdf` 调用最多提取的页数 |
| `maxBytes` | `51200` | 一次 `read_pdf` 调用保留的字节上限；溢出时以截断 footer 结束 |

### 失败与恢复

失败被规范化为 `Error: <message>`，携带稳定错误码：

- `file_path must be a non-empty string`——路径为空
- `cannot read "<path>": not found`——文件不存在（`FS_NOT_FOUND`）
- `cannot read "<path>": not a regular file`——目标不是普通文件（`FS_NOT_REGULAR_FILE`）
- `cannot read "<path>": the .xxx extension does not declare a supported PDF format; read_pdf accepts .pdf files only`——扩展名不是 `.pdf`
- `cannot read "<path>": the file is not a valid PDF; the file may be truncated or corrupt`——PDF 内容无效

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释工具背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包建立在三项承诺之上：

- **与文本 read 保持一致的约束模型。** `max_pages` 与 `max_bytes` 双重约束防止单份大 PDF 撑爆上下文；超出时保留已提取的前缀并明确报告截断原因，让调用方可以增量增大预算。
- **pdfjs-dist 作为纯 Node 依赖。** 通过 `GlobalWorkerOptions.workerSrc` 指向包内 bundled worker，无需额外进程或浏览器环境；`disableFontFace` 与 `useSystemFonts` 减少字体的网络/文件系统依赖。
- **路径复用 `ctx.fs` 约定。** 解析、stat、字节读取走同一套 `FsTarget`/`FsInfo` 体系，错误分类与 `tool-fs` 对齐。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、工具组合、`apply` |
| [`src/read-pdf.ts`](src/read-pdf.ts) | `read_pdf` 执行器：参数校验、PDF 加载、逐页文本提取、schema 注册 |
| [`src/read-target.ts`](src/read-target.ts) | 路径解析、存在性观察、常规文件门禁 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级约定不够用时阅读以下页面；它们从工具逐步进入文件系统 seam 与设计决策。

- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md)——`ctx.fs` 约定、错误分类与目标标识。
- [fs-local](../fs-local/README.zh.md)——本地文件系统后端。
- [tool-fs](../tool-fs/README.zh.md)——同款约束模型的文本读取工具。
- [生成工具目录](../../../docs/tool-catalog.zh.md)——本包注册的穷尽式 schema。

-----

<a id="model-experience"></a>
## 模型体验

### 系统提示词

#### 模型看到的内容

该插件注册作用域内的每个请求都会收到下方独立注册的 read_pdf 指导。

##### Read PDF 指导

```markdown
Use the read_pdf tool — not shell commands like pdftotext — to extract text from PDF files. Results are bounded by max_pages and max_bytes.
```

#### Token 影响

插件启用期间，每个请求支付固定指导成本。

#### KV Cache 影响

只要插件作用域和指导文本不变，前缀就保持稳定。工具限制不会移除该段，但插件启用或 dispose 可能从该段开始使复用失效。

### 工具 schema

#### 模型看到的内容

模型会看到已生成的 [`read_pdf` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-pdf)，参数使用 snake_case。

#### Token 影响

该工具视图中的每个请求都支付固定 schema 成本。

#### KV Cache 影响

只要可见工具定义和顺序不变，前缀就保持稳定。注册生命周期或作用域限制可能从首个变化的 schema token 开始使复用失效。

### 读取结果

#### 模型看到的内容

成功读取返回结构化信封：`path`（显示路径）、`totalPages`（PDF 总页数）、`pagesExtracted`（实际提取页数）、`truncatedByBytes`（是否因字节上限截断）。文本嵌入 content 中，格式为逐页标注：

```
=== Page 1 ===
[page text]

=== Page 2 ===
[page text]
...
(Output capped at max_bytes. Use max_bytes to increase the limit.)
```

#### Token 影响

输出受 `maxPages` 与 `maxBytes` 双重约束；保留的调用与结果会反复发送，直到上下文压缩。

#### KV Cache 影响

仅追加；新增可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明工具何时不合适；它们是当前包约束。

- **只提取文本层**——PDF 中的图像、扫描页、嵌入字体渲染内容无法通过文本提取获取；需要视觉理解时应改用 `read_image` 配合其他方式。
- **无多语言字体回退保证**——`disableFontFace: true` 与 `useSystemFonts: true` 在无对应系统字体时可能丢失部分 CJK 字符；精确渲染依赖宿主环境。
- **未实现分页偏移**——`read` 工具的 `offset`/`limit` 分页模式不适用于 PDF；如需读取大 PDF 的特定范围，需要调用方在应用层分段调用。
- **worker 绑定假设 Node 环境**——`GlobalWorkerOptions.workerSrc` 通过 `import.meta.url` 解析，在 Web  Worker 环境中不可用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性；已交付行为以上文、包代码与所链接的文档为准。

- **`pdfjs-dist` worker 路径**——当前指向 `legacy/build/pdf.worker.min.mjs`；若升级 pdfjs-dist 主版本需验证路径变化。
- **CJK 支持**——当前依赖系统字体；未来可考虑引入内置字体或调用外部 OCR 服务作为补充。

</details>
