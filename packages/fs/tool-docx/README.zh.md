---
description: "面向模型的 read_docx 工具：通过 mammoth 从 Word (.docx) 文件提取文本。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-docx

[English](README.md) | 中文

## 概述

`dsh-tool-docx` 提供面向模型的 `read_docx` 工具：通过 `mammoth` 从 Word `.docx` 文件中逐段提取纯文本，返回受 `max_bytes` 约束的文本结果。本包 injects `tools`、`fs`、`systemPrompt`，在 `ctx.fs` 后端之后挂载即可使用。

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

在 `ctx.fs` 后端之后挂载本包，模型即可获得 `read_docx` 工具。随附 `dsh` 基础配置默认包含本包；如需调整上限可在 profile 或 preset 的 `cordis.patch.yml` 中覆盖。

### 最小组合

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-tool-docx'
```

### 工具

| 工具 | 参数 | 行为 |
|---|---|---|
| `read_docx` | `file_path`、`max_bytes?` | 从 `.docx` 文件提取纯文本；返回受 `max_bytes` 约束的结果 |

字段名使用 snake_case，与现有文件系统工具 schema 一致。成功返回结构化信封——路径与是否因字节上限截断——文本本身嵌入 `content`。

### 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `maxBytes` | `51200` | 一次 `read_docx` 调用保留的字节上限；溢出时以截断 footer 结束 |

### 失败与恢复

失败被规范化为 `Error: <message>`，携带稳定错误码：

- `file_path must be a non-empty string`——路径为空
- `cannot read "<path>": not found`——文件不存在（`FS_NOT_FOUND`）
- `cannot read "<path>": not a regular file`——目标不是普通文件（`FS_NOT_REGULAR_FILE`）
- `cannot read "<path>": the .xxx extension does not declare a supported DOCX format; read_docx accepts .docx files only`——扩展名不是 `.docx`
- `cannot read "<path>": the file is not a valid .docx document; the file may be corrupted or use an unsupported format`——DOCX 内容无效

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释工具背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计理念

本包建立在三项承诺之上：

- **与 PDF 读取保持相同的约束模型。** `max_bytes` 防止单份大文档撑爆上下文；超出时保留已提取的前缀并明确报告截断原因，让调用方可以增量增大预算。
- **mammoth 作为纯 Node 依赖。** `mammoth.extractRawText` 直接处理 Buffer，无需额外进程或浏览器环境；输出为纯文本，不保留样式信息，适合模型消费。
- **路径复用 `ctx.fs` 约定。** 解析、stat、字节读取走同一套 `FsTarget`/`FsInfo` 体系，错误分类与 `tool-fs` 对齐。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：`Config`、工具组合、`apply` |
| [`src/read-docx.ts`](src/read-docx.ts) | `read_docx` 执行器：参数校验、DOCX 加载、文本提取、schema 注册 |
| [`src/read-target.ts`](src/read-target.ts) | 路径解析、存在性观察、常规文件门禁 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级约定不够用时阅读以下页面；它们从工具逐步进入文件系统 seam 与设计决策。

- [文件系统子系统](../../../docs/subsystems/filesystem.zh.md)——`ctx.fs` 约定、错误分类与目标标识。
- [fs-local](../fs-local/README.zh.md)——本地文件系统后端。
- [tool-pdf](../tool-pdf/README.zh.md)——同款约束模型的 PDF 读取工具。
- [生成工具目录](../../../docs/tool-catalog.zh.md)——本包注册的穷尽式 schema。

-----

<a id="model-experience"></a>
## 模型体验

### 系统提示词

#### 模型看到的内容

该插件注册作用域内的每个请求都会收到下方独立注册的 read_docx 指导。

##### Read DOCX 指导

```markdown
Use the read_docx tool — not shell commands like pandoc — to extract text from Word (.docx) files. Results are bounded by max_bytes.
```

#### Token 影响

插件启用期间，每个请求支付固定指导成本。

#### KV Cache 影响

只要插件作用域和指导文本不变，前缀就保持稳定。工具限制不会移除该段，但插件启用或 dispose 可能从该段开始使复用失效。

### 工具 schema

#### 模型看到的内容

模型会看到已生成的 [`read_docx` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-docx)，参数使用 snake_case。

#### Token 影响

该工具视图中的每个请求都支付固定 schema 成本。

#### KV Cache 影响

只要可见工具定义和顺序不变，前缀就保持稳定。注册生命周期或作用域限制可能从首个变化的 schema token 开始使复用失效。

### 读取结果

#### 模型看到的内容

成功读取返回结构化信封：`path`（显示路径）、`truncatedByBytes`（是否因字节上限截断）。文本嵌入 content 中。

#### Token 影响

输出受 `maxBytes` 约束；保留的调用与结果会反复发送，直到上下文压缩。

#### KV Cache 影响

仅追加；新增可见内容位于可复用请求前缀之后，不会使现有 KV Cache 条目失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明工具何时不合适；它们是当前包约束。

- **只提取纯文本**——`.docx` 中的图像、表格、样式、宏等无法通过 `mammoth.extractRawText` 获取；需要结构化格式时应考虑其他方案。
- **不支持旧版 `.doc` 格式**——`.doc`（Word 97-2003）是二进制格式，`mammoth` 无法解析；需要调用方先转换为 `.docx`。
- **无分页偏移**——与 PDF 不同，DOCX 没有"页"的概念；如需读取大文档的特定段落，需要调用方在应用层分段。
- **样式信息丢失**——`mammoth` 输出纯文本，标题、加粗、列表等格式信息均不保留。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文，明确不具权威性；已交付行为以上文、包代码与所链接的文档为准。

- **`mammoth` Buffer 转换**——`ctx.fs.readBytes` 返回 `Uint8Array`，而 `mammoth` 期望 `Buffer`；通过 `Buffer.from(data.buffer, offset, length)` 转换，避免额外内存拷贝。
- **与 `tool-pdf` 保持一致**——两个包的读取上限、错误分类、observed 事件模式完全对齐，方便未来合并为统一的 `read_file` 工具族。

</details>
