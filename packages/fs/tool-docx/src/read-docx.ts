/**
 * Model-facing `read_docx` tool: extract text from Word .docx files using mammoth.
 * @module @deepseek-ai/dsh-tool-docx/src/read-docx
 */

import { extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import mammoth from 'mammoth'
import { resolveRegularReadTarget } from './read-target.ts'

/** Default maximum output bytes one `read_docx` call retains (the `maxBytes` config). */
export const DOCX_MAX_BYTES = 50 * 1024

/**
 * Extract raw text from a .docx file.
 * @param ctx - plugin context for fs resolution.
 * @param exec - tool execution context with signal for cancellation.
 * @param filePath - the path to the .docx file.
 * @param maxBytes - max output bytes to retain.
 * @returns the extracted plain text and whether it was truncated by the byte cap.
 */
export async function extractDocxText(
  ctx: Context,
  exec: ToolExecution,
  filePath: string,
  maxBytes: number,
): Promise<{ text: string; truncatedByBytes: boolean }> {
  const { target } = await resolveRegularReadTarget(ctx, exec, filePath)
  const data = await ctx.fs.readBytes(target, exec.signal, maxBytes * 4)

  // mammoth.extractRawText accepts a Buffer; convert from Uint8Array.
  const buffer = Buffer.from(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength)
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value
  const truncatedByBytes = text.length > maxBytes
  const truncatedText = truncatedByBytes ? text.slice(0, maxBytes) : text
  return { text: truncatedText, truncatedByBytes }
}

/**
 * Register the `read_docx` tool into the given context.
 * @param ctx - the plugin context; registrations are effects scoped to it.
 */
export function applyReadDocxTool(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'tool:read-docx',
    order: ctx.systemPrompt.getSectionOrder('TOOL_READ'),
    text: 'Use the read_docx tool — not shell commands like pandoc — to extract text from Word (.docx) files. Results are bounded by max_bytes.',
  })

  ctx.tools.register(defineTool({
    name: 'read_docx',
    description: 'Extract text from a Word (.docx) file. Returns plain text with a truncation footer if exceeding max_bytes.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Path to the .docx file, resolved by the filesystem backend.' },
      max_bytes: { type: 'number', description: 'Maximum output bytes. Defaults to 51200.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          truncatedByBytes: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [
        { type: 'text', text: `[DOCX: ${value.path}${value.truncatedByBytes ? ' (truncated)' : ''}]` },
      ],
      presentationMeta: (_args, value) => ({ path: value.path }),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (args.file_path.trim().length === 0) throw new Error('file_path must be a non-empty string')

      const extension = extname(args.file_path).toLowerCase()
      if (extension !== '.docx') {
        throw new Error(`cannot read "${args.file_path}": the ${extension} extension does not declare a supported DOCX format; read_docx accepts .docx files only`)
      }

      const maxBytes = args.max_bytes === undefined ? DOCX_MAX_BYTES : Math.min(args.max_bytes, DOCX_MAX_BYTES)

      let result: { text: string; truncatedByBytes: boolean }
      try {
        result = await extractDocxText(ctx, exec, args.file_path, maxBytes)
      } catch (error: unknown) {
        if (error instanceof FsError) throw error
        if (error instanceof Error && /error/i.test(error.message) && /docx|word|zip|pack/i.test(error.message)) {
          throw new Error(`cannot read "${args.file_path}": the file is not a valid .docx document; the file may be corrupted or use an unsupported format`)
        }
        throw new Error(`cannot read "${args.file_path}": ${error instanceof Error ? error.message : String(error)}`)
      }

      const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path)
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      return {
        path: target.displayPath,
        truncatedByBytes: result.truncatedByBytes,
      }
    },
    presentCall(args): GenericCallView {
      return {
        card: 'generic',
        title: `Read DOCX ${args.file_path}`,
        kind: 'read',
        locations: [{ path: args.file_path }],
      }
    },
  }))
}
