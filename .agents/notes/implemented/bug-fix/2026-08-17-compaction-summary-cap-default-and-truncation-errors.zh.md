# Agent Note: 摘要生成上限默认值提高，截断错误改为可操作提示

Status: implemented

[English](2026-08-17-compaction-summary-cap-default-and-truncation-errors.md) | 中文

## 问题

在大型会话上手动执行 `/compact` 会以 `summarization truncated at the token cap (incomplete checkpoint)` 失败。摘要调用的默认 `maxTokens` 是 `8192`，并要在表面化的推理 token 与隐藏的推理 token 之间分配；长会话的结构化检查点经常超过该上限，而 fail-closed 事务随后只向人类命令报告笼统的 `summary` 错误文本（`Compaction could not produce a useful summary`），掩盖了真实原因。

## 决策

- 摘要调用的服务级默认 `maxTokens` 从 `8192` 提高到 `32768`（`dsh-compaction-basic` 的 `resolveConfig`）。该上限仍是可配置的、部署方可调的字段；需要之前上限的部署显式设置 `maxTokens: 8192`。
- `dsh-command-compact` 现在检查 `ManualCompactionError` 的 cause 链中是否有摘要器的 `MAX_TOKENS` 标记（`finishError` 在 `max-tokens` 终止时发出 `MAX_TOKENS` 代码）。当原因是截断时，命令返回一段有针对性的提示，指明输出 token 上限及解决办法（提高 `maxTokens` 或配置摘要模型），而不是笼统的摘要失败文本。其他摘要失败保留原有文本。

## 考虑过的替代方案

- **只改进错误文本，把默认上限保持在 `8192`**——否决：有针对性的提示有助于诊断截断，但不能阻止最常见的大型会话失败；默认值对于长结构化检查点来说就是太小。
- **截断时用更大的上限自动重试**——否决：收敛本来就是动态的（隐藏的推理 token 会不可预测地消耗上限），重试昂贵的摘要调用会在没有有界改进保证的情况下成倍增加成本；更高的默认值加上显式的解决办法更简单、更诚实。
- **继承已路由对话请求的 `maxTokens`**——否决：摘要调用是独立的辅助请求，其预算应由部署方掌控；静默继承对话上限会把两个策略耦合在一起，并使摘要成本变得不透明。

## 后果

- `dsh-compaction-basic` 的 README、配置表、`CompactionPolicyConfig.maxTokens` 的 JSDoc、生成的 `docs/config-catalog` 双语文档，以及复述该默认值的已实现压缩 Agent Note，现在都记载 `32768`。
- 自动压缩行为不变：过高的上限是天花板而非目标，非缩小摘要拒绝仍然要求带框架的检查点小于被遮蔽内容。
- `dsh-command-compact` 新增一个辅助函数（`causeIsTokenCap`）遍历 `cause` 链；闭合的 `ManualCompactionErrorCode` 联合类型保持不变。

## 测试

- `compaction-basic.spec.ts` 固定已解析默认值为 `maxTokens: 32768`。
- `command-compact.spec.ts` 把由 `MAX_TOKENS` 引起的 `summary` 失败映射为有针对性的截断文本，并为其他错误代码保留原有通用文本表。
