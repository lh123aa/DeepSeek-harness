/**
 * Model-facing `read_pdf` tool for extracting text from PDF files.
 * @module @deepseek-ai/dsh-tool-pdf
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { PDF_MAX_BYTES, PDF_MAX_PAGES, applyReadPdfTool } from './read-pdf.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-pdf'

/** Services required by the PDF reading tool. */
export const inject = ['tools', 'fs', 'systemPrompt']

/** Plugin config (all optional — `Config` supplies the defaults). */
export interface Config {
  /** Maximum pages one `read_pdf` call extracts. */
  maxPages?: number
  /** Maximum output bytes one `read_pdf` call retains inline. */
  maxBytes?: number
}

export const Config: z<Config> = z.object({
  maxPages: z.number().default(PDF_MAX_PAGES),
  maxBytes: z.number().default(PDF_MAX_BYTES),
})

/** The shape after schemastery applied the defaults. */
type ResolvedConfig = Required<Config>

/** Every PDF cap counts pages/bytes — a positive integer, or windowing arithmetic misbehaves silently. */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`tool-pdf: ${name} must be a positive integer`)
  }
}

/**
 * Register the `read_pdf` PDF text extraction tool.
 * @param ctx - the plugin context; registrations are effects scoped to it.
 * @param config - resolved plugin configuration from schemastery.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as ResolvedConfig
  assertPositiveInteger('maxPages', resolved.maxPages)
  assertPositiveInteger('maxBytes', resolved.maxBytes)
  applyReadPdfTool(ctx, {
    maxPages: resolved.maxPages,
    maxBytes: resolved.maxBytes,
  })
}
