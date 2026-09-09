/**
 * Model-facing `read_pdf` tool: extract text from PDF files using pdfjs-dist.
 * @module @deepseek-ai/dsh-tool-pdf/src/read-pdf
 */

import { extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { FsError } from '@deepseek-ai/dsh-fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import { resolveRegularReadTarget } from './read-target.ts'

/** Default maximum pages one `read_pdf` call extracts (the `maxPages` config). */
export const PDF_MAX_PAGES = 50

/** Default maximum output bytes one `read_pdf` call retains (the `maxBytes` config). */
export const PDF_MAX_BYTES = 50 * 1024

/** Resolved read-pdf tool caps — plugin config after defaulting (see `Config` in index.ts). */
export interface PdfToolCaps {
  /** Max pages extracted from one PDF. */
  maxPages: number
  /** Max output bytes retained inline; overflow produces a truncated footer. */
  maxBytes: number
}

/**
 * Extract text from a PDF file page by page.
 * @param ctx - plugin context for fs resolution.
 * @param exec - tool execution context with signal for cancellation.
 * @param filePath - the path to the PDF.
 * @param maxPages - max pages to extract.
 * @param maxBytes - max output bytes.
 * @returns the extracted text, total pages, and whether output was truncated by byte cap.
 */
export async function extractPdfText(
  ctx: Context,
  exec: ToolExecution,
  filePath: string,
  maxPages: number,
  maxBytes: number,
): Promise<{ text: string; totalPages: number; truncatedByBytes: boolean }> {
  const { target } = await resolveRegularReadTarget(ctx, exec, filePath)
  // Read up to 4x the output cap to give pdfjs enough data; the bound prevents unbounded buffering.
  const data = await ctx.fs.readBytes(target, exec.signal, maxBytes * 4)

  // Configure pdfjs to use the bundled worker.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: true })
  const pdf = await loadingTask.promise

  const totalPages = pdf.numPages
  const lines: string[] = []
  let byteCount = 0

  for (let pageNum = 1; pageNum <= Math.min(totalPages, maxPages); pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map(item => (item as { str: string }).str).join(' ')
    const line = `=== Page ${pageNum} ===\n${pageText}`

    if (byteCount + line.length > maxBytes && lines.length > 0) {
      break
    }
    lines.push(line)
    byteCount += line.length
  }

  const text = lines.join('\n')
  const truncatedByBytes = byteCount >= maxBytes && lines.length > 0
  return { text, totalPages, truncatedByBytes }
}

/**
 * Register the `read_pdf` tool into the given context.
 * @param ctx - the plugin context; registrations are effects scoped to it.
 * @param caps - the deployment's resolved caps (plugin config after defaulting).
 */
export function applyReadPdfTool(ctx: Context, caps: PdfToolCaps): void {
  ctx.systemPrompt.section({
    name: 'tool:read-pdf',
    order: ctx.systemPrompt.getSectionOrder('TOOL_READ'),
    text: 'Use the read_pdf tool — not shell commands like pdftotext — to extract text from PDF files. Results are bounded by max_pages and max_bytes.',
  })

  ctx.tools.register(defineTool({
    name: 'read_pdf',
    description: 'Extract text from a PDF file. Returns text per page with pagination footer. Bounded by max_pages and max_bytes.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Path to the PDF file, resolved by the filesystem backend.' },
      max_pages: { type: 'number', description: 'Maximum pages to extract. Defaults to 50.' },
      max_bytes: { type: 'number', description: 'Maximum output bytes. Defaults to 51200.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          totalPages: { type: 'integer', required: true },
          pagesExtracted: { type: 'integer', required: true },
          truncatedByBytes: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [
        { type: 'text', text: `[PDF: ${value.path} — ${value.pagesExtracted}/${value.totalPages} pages${value.truncatedByBytes ? ' (truncated)' : ''}]` },
      ],
      presentationMeta: (_args, value) => ({ path: value.path, totalPages: value.totalPages }),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (args.file_path.trim().length === 0) throw new Error('file_path must be a non-empty string')

      const extension = extname(args.file_path).toLowerCase()
      if (extension !== '.pdf') {
        throw new Error(`cannot read "${args.file_path}": the ${extension} extension does not declare a supported PDF format; read_pdf accepts .pdf files only`)
      }

      const maxPages = args.max_pages === undefined ? caps.maxPages : Math.min(args.max_pages, caps.maxPages)
      const maxBytes = args.max_bytes === undefined ? caps.maxBytes : Math.min(args.max_bytes, caps.maxBytes)

      let result: { text: string; totalPages: number; truncatedByBytes: boolean }
      try {
        result = await extractPdfText(ctx, exec, args.file_path, maxPages, maxBytes)
      } catch (error: unknown) {
        if (error instanceof FsError) throw error
        if (error instanceof Error && /invalid pdf/i.test(error.message)) {
          throw new Error(`cannot read "${args.file_path}": the file is not a valid PDF; the file may be truncated or corrupt`)
        }
        throw new Error(`cannot read "${args.file_path}": ${error instanceof Error ? error.message : String(error)}`)
      }

      const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path)
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      return {
        path: target.displayPath,
        totalPages: result.totalPages,
        pagesExtracted: Math.min(result.totalPages, maxPages),
        truncatedByBytes: result.truncatedByBytes,
      }
    },
    presentCall(args): GenericCallView {
      return {
        card: 'generic',
        title: `Read PDF ${args.file_path}`,
        kind: 'read',
        locations: [{ path: args.file_path }],
      }
    },
  }))
}
