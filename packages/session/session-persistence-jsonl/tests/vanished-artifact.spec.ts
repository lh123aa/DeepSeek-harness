import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionSeq } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { SessionPersistenceArtifactMissingError, type SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import JsonlSessionPersistence from '../src/index.ts'
import { logPath, sessionDir } from '../src/format.ts'
import { meta, oneTurnLog } from '../../session-persistence/tests/contract.ts'

/**
 * Durable storage a live write handle owns can be removed under it: an external
 * actor deletes the session directory, or a tool deletes just the log. Every
 * mutation must then refuse loudly instead of leaking the raw filesystem error
 * or publishing a header-less replacement log.
 */

const fsFaults = vi.hoisted(() => ({
  open: { path: undefined as string | undefined, error: undefined as Error | undefined },
  truncate: { path: undefined as string | undefined, error: undefined as Error | undefined },
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    open: (async (...args: Parameters<typeof actual.open>) => {
      if (String(args[0]) === fsFaults.open.path && fsFaults.open.error !== undefined) throw fsFaults.open.error
      return actual.open(...args)
    }) as typeof actual.open,
    truncate: (async (...args: Parameters<typeof actual.truncate>) => {
      if (String(args[0]) === fsFaults.truncate.path && fsFaults.truncate.error !== undefined) {
        throw fsFaults.truncate.error
      }
      return actual.truncate(...args)
    }) as typeof actual.truncate,
  }
})

const COMPRESSION = 'none' as const

const dirs: string[] = []
const contexts: Context[] = []

async function freshRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-jsonl-vanished-'))
  dirs.push(dir)
  return dir
}

async function mount(root: string): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: COMPRESSION })
  return ctx
}

afterEach(async () => {
  fsFaults.open.path = undefined
  fsFaults.open.error = undefined
  fsFaults.truncate.path = undefined
  fsFaults.truncate.error = undefined
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

/** One contiguous turn continuing a log whose stored next-seq is `cursor`. */
function nextTurn(cursor: number): SessionEvent[] {
  return [
    { type: 'turn/start', seq: SessionSeq(cursor), time: 9, data: { turn: 2 } },
    { type: 'turn/end', seq: SessionSeq(cursor + 1), time: 10, data: { turn: 2, reason: { kind: 'completed' } } },
  ] as SessionEvent[]
}

async function writeLog(persistence: SessionPersistence, header: ReturnType<typeof meta>): Promise<void> {
  const handle = await persistence.create(header)
  try {
    await handle.append(oneTurnLog())
  } finally {
    await handle.close()
  }
}

describe('durable storage removed under a live write handle', () => {
  it('refuses an append whose session directory was removed, and never recreates it', async () => {
    const root = await freshRoot()
    const ctx = await mount(root)
    const m = meta('vanished-directory', '/work')
    const handle = await ctx.sessionPersistence.create(m)
    try {
      await handle.append(oneTurnLog())
      const path = logPath(root, m.cwd, m.id, COMPRESSION)
      expect((await stat(path)).size).toBeGreaterThan(0)

      await rm(sessionDir(root, m.cwd, m.id), { recursive: true, force: true })

      const failure = await handle.append(nextTurn(oneTurnLog().length))
        .then(() => undefined, (error: unknown) => error)
      expect(failure).toBeInstanceOf(SessionPersistenceArtifactMissingError)
      expect(failure).toMatchObject({ sessionId: m.id, path })
      // The refused batch left nothing behind: no directory, no artifact.
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await handle.close()
    }
  })

  it('refuses an append whose log file was removed, rather than publishing a header-less log', async () => {
    const root = await freshRoot()
    const ctx = await mount(root)
    const m = meta('vanished-log', '/work')
    const handle = await ctx.sessionPersistence.create(m)
    try {
      await handle.append(oneTurnLog())
      const path = logPath(root, m.cwd, m.id, COMPRESSION)
      await rm(path)

      await expect(handle.append(nextTurn(oneTurnLog().length)))
        .rejects.toBeInstanceOf(SessionPersistenceArtifactMissingError)
      // Append mode would have created the file and made the log unreadable.
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await handle.close()
    }
  })

  it('surfaces an artifact-open failure that is not absence', async () => {
    const root = await freshRoot()
    const ctx = await mount(root)
    const m = meta('denied-open', '/work')
    const handle = await ctx.sessionPersistence.create(m)
    try {
      await handle.append(oneTurnLog())
      fsFaults.open.path = logPath(root, m.cwd, m.id, COMPRESSION)
      fsFaults.open.error = Object.assign(new Error('EACCES: denied'), { code: 'EACCES' })

      await expect(handle.append(nextTurn(oneTurnLog().length))).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      fsFaults.open.path = undefined
      fsFaults.open.error = undefined
      await handle.close()
    }
  })

  it('refuses a torn-tail repair whose artifact was removed', async () => {
    const root = await freshRoot()
    const ctx = await mount(root)
    const m = meta('vanished-repair', '/work')
    await writeLog(ctx.sessionPersistence, m)
    const path = logPath(root, m.cwd, m.id, COMPRESSION)
    // A crash left one incomplete trailing line: only the write path repairs it.
    await writeFile(path, '{"type":"assistant/chunk","seq":6,"ti', { flag: 'a' })

    const handle = await ctx.sessionPersistence.open(m.id, 'write')
    try {
      await rm(path)

      await expect(handle.append(nextTurn(oneTurnLog().length)))
        .rejects.toBeInstanceOf(SessionPersistenceArtifactMissingError)
      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await handle.close()
    }
  })

  it('surfaces a torn-tail repair failure that is not absence', async () => {
    const root = await freshRoot()
    const ctx = await mount(root)
    const m = meta('denied-repair', '/work')
    await writeLog(ctx.sessionPersistence, m)
    const path = logPath(root, m.cwd, m.id, COMPRESSION)
    await writeFile(path, '{"type":"assistant/chunk","seq":6,"ti', { flag: 'a' })

    const handle = await ctx.sessionPersistence.open(m.id, 'write')
    try {
      fsFaults.truncate.path = path
      fsFaults.truncate.error = Object.assign(new Error('EACCES: denied'), { code: 'EACCES' })

      await expect(handle.append(nextTurn(oneTurnLog().length))).rejects.toMatchObject({ code: 'EACCES' })
    } finally {
      fsFaults.truncate.path = undefined
      fsFaults.truncate.error = undefined
      await handle.close()
    }
  })
})
