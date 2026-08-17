# Agent Note: llm-pi-ai 的 compat 增加 supportsStore 线上开关

Status: implemented

[English](2026-08-17-llm-pi-ai-compat-supports-store.md) | 中文

## Problem

直接配置到 Google OpenAI 兼容端点（`https://generativelanguage.googleapis.com/v1beta/openai`）的提供商每次请求都以 `CONTEXT_WINDOW_EXCEEDED: 400 status code (no body)` 失败。pi-ai 按 URL 得出的 compat 检测把该端点视为标准端点——其非标准列表覆盖 `open.bigmodel.cn` 等主机，但不含 `generativelanguage.googleapis.com`——因此 `buildParams` 会发送 `store: false`。Google 端点用 HTTP 400 拒绝未知字段（`Unknown name "store": Cannot find field.`），空响应体在 harness 中呈现为上下文窗口错误。报告中的配置还叠加了 baseURL 指向 9000 端口本地代理但该端口并无监听的问题。

## Decision

- `PiAiCompatProfile`（`dsh-llm-pi-ai` 配置中的路由级与模型级 `compat` 对象）新增 `supportsStore?: boolean`。`resolveModelCompat` 将其转发到 pi-ai 模型的 `compat`，`compatProfile` schema 接受布尔值；缺省时保留已安装 catalog 条目的值，其次 pi-ai 按 URL 得出的检测。
- 在路由上设置 `compat: { supportsStore: false }` 告知 pi-ai 该端点拒绝 OpenAI 的 `store` 字段，于是该字段不再发送。此开关为可选启用；接受 `store` 的端点（OpenAI 本身、标准网关）保持 pi-ai 的检测。
- 该开关沿用推理开关的守卫：非 `openai-completions` 路由上的模型级 `supportsStore` 使解析失败，路由级开关跳过其他协议的模型，没有任何 `openai-completions` 模型的路由被拒绝。

## Alternatives considered

- **在 harness 中特判 Google 端点 URL。** 已拒绝：提供商差异留在 pi-ai 的检测与用户配置中，而非写死在 harness URL 里；显式可配置开关同样覆盖其他拒绝 `store` 的网关。
- **修补 pi-ai 的 `detectCompat`，把 `generativelanguage.googleapis.com` 视为非标准。** 已拒绝：pi-ai 是按 manifest 固定的 vendored 依赖；本地补丁会在下次 vendor 同步时丢失，且 harness 已为这类提供商差异暴露了 compat 表面。

## Consequences

- 直连 Gemini 的路由需要同时配置 Google baseURL 与 `compat.supportsStore: false`；该字段记录在 llm-pi-ai README 双语与生成的配置目录中。
- compat 表面的描述从"仅推理"改为"推理分派与 `store` 线上开关"。
- 对任何不设置该开关的使用者，pi-ai 自身的检测缺口仍然存在。

## Testing

- `catalog.spec.ts` 验证路由级 `supportsStore: false` 物化到每个 `openai-completions` 模型上。
- `config.spec.ts` 接受声明的布尔值并拒绝非布尔值。
- 针对真实 Google 端点的 headless agent 运行成功，而相同配置此前以 400 失败。
