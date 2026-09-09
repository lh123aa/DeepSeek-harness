/**
 * Model-facing `read_docx` tool for extracting text from Word (.docx) files.
 * @module @deepseek-ai/dsh-tool-docx
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DOCX_MAX_BYTES, applyReadDocxTool } from './read-docx.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-docx'

/** Services required by the DOCX reading tool. */
export const inject = ['tools', 'fs', 'systemPrompt']

/** Plugin config (all optional — `Config` supplies the defaults). */
export interface Config {
  /** Maximum output bytes one `read_docx` call retains inline. */
  maxBytes?: number
}

export const Config: z<Config> = z.object({
  maxBytes: z.number().default(DOCX_MAX_BYTES),
})

/** The shape after schemastery applied the defaults. */
type ResolvedConfig = Required<Config>

/** DOCX byte cap must be a positive integer, or truncation arithmetic misbehaves silently. */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`tool-docx: ${name} must be a positive integer`)
  }
}

/**
 * Register the `read_docx` DOCX text extraction tool.
 * @param ctx - the plugin context; registrations are effects scoped to it.
 * @param config - resolved plugin configuration from schemastery.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  assertPositiveInteger('maxBytes', resolved.maxBytes)
  applyReadDocxTool(ctx)
}
