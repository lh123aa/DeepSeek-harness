/**
 * The summary blank bit means "conversation not started" (no turn has run),
 * not "log empty": standalone plugin events — command lifecycle records,
 * plan/mode, permission knob events, session titles — never flip it, so running /plan or /goal on a
 * fresh session keeps it list-hidden and reusable, while the first accepted
 * prompt's turn/start clears it. The host/session-added frame shares the
 * same predicate function (covered by the workspace spec's frame assertion).
 *
 * A cold row whose projection-cache record is a predecessor generation exposes
 * only its title, so the list recovers this metadata from one bounded read of
 * the stored artifact instead of leaving an abandoned blank Session visible as
 * a nameless row.
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SESSION_FORMAT_VERSION, SessionSeq } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { CommandId } from '@deepseek-ai/dsh-commands/brand'
// Side-effect type imports: the configuration-event SessionEventMap merges.
import type {} from '@deepseek-ai/dsh-permission-presets'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { createSessionTestRemote, testSessionPersistence, type TestSessionRemote } from './test-remote.ts'

async function harness(): Promise<{ ctx: Context; remote: TestSessionRemote; attach: (session: Session) => Promise<void> }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  return {
    ctx,
    remote: createSessionTestRemote(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' }),
    attach: async (session) => {
      await ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
    },
  }
}

/** Append the standalone (non-conversation) event family a fresh session can accumulate. */
function appendStandalone(session: Session): void {
  session.append('command/run', {
    commandId: CommandId('blank-cmd-1'), name: 'plan', args: '', source: { kind: 'user' },
  })
  session.append('plan/mode', { active: true })
  session.append('command/done', { commandId: CommandId('blank-cmd-1'), kind: 'success', text: 'Plan mode on.' })
  session.append('session/title', {
    title: 'standalone title', messageSeqs: [], source: { kind: 'fallback' },
  })
  // Permission configuration events from a /permission switch on a fresh session.
  session.append('permission/preset', { preset: 'danger-full-access' })
  session.append('sandbox/mode', { mode: 'danger-full-access' })
}

async function listBlank(remote: TestSessionRemote, id: string): Promise<boolean | undefined> {
  const result = await remote.list({})
  if (!result.ok) throw new Error('list failed')
  return result.value.items.find(item => item.sessionId === id)?.blank
}

describe('summary blank = conversation not started', () => {
  it('standalone events (command lifecycle, plan/mode, title) keep the session blank', async () => {
    const { ctx, remote, attach } = await harness()
    const session = ctx.sessions.create()
    await attach(session)
    expect(await listBlank(remote, session.id)).toBe(true)
    appendStandalone(session)
    expect(await listBlank(remote, session.id)).toBe(true)
  })

  it('the first turn clears blank', async () => {
    const { ctx, remote, attach } = await harness()
    const session = ctx.sessions.create()
    await attach(session)
    appendStandalone(session)
    session.append('turn/start', { turn: 0 })
    expect(await listBlank(remote, session.id)).toBe(false)
  })
})

const sid = (id: string): SessionId => id as SessionId

/** One complete stored turn: the cold artifact a cache miss must be read to describe. */
function conversationEvents(): SessionEvent[] {
  return [
    { type: 'turn/start', seq: SessionSeq(0), time: 800, data: { turn: 1 } },
    {
      type: 'user/message', seq: SessionSeq(1), time: 1200,
      data: createUserMessage({ content: [{ type: 'text', text: 'worked' }], source: { kind: 'user' } }),
      surfaceOp: 'append',
    },
    {
      type: 'turn/end', seq: SessionSeq(2), time: 1201,
      data: { turn: 1, reason: { kind: 'completed' } },
    },
  ] as SessionEvent[]
}

const COLD_HEADER: SessionHeader = {
  version: SESSION_FORMAT_VERSION,
  id: sid('cold-abandoned'),
  createdAt: 100,
  isSeeded: false,
  cwd: '/proj',
}

/**
 * Persisted Session with no projection-cache record at all: the row reaches the
 * list with metadata the cache cannot supply.
 */
async function coldHarness(options: {
  readonly events: readonly SessionEvent[]
  readonly sizeBytes?: number
  readonly listColdReadMaxBytes?: number
  readonly readFails?: boolean
}): Promise<{ ctx: Context; remote: TestSessionRemote; inspect: ReturnType<typeof vi.fn> }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  const inspect = vi.fn(async () => {
    if (options.readFails === true) throw new Error('stored artifact unreadable')
    return { meta: COLD_HEADER, events: options.events }
  })
  ctx.provide('sessionPersistence', testSessionPersistence(ctx, {
    list: () => Promise.resolve([COLD_HEADER]),
    inspect,
    ...options.sizeBytes === undefined ? {} : { sizeBytes: options.sizeBytes },
  }) as never)
  return {
    ctx,
    remote: createSessionTestRemote(ctx, {
      defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
      cwd: '/tmp',
      ...options.listColdReadMaxBytes === undefined
        ? {}
        : { listColdReadMaxBytes: options.listColdReadMaxBytes },
    }),
    inspect,
  }
}

async function coldRow(remote: TestSessionRemote): Promise<{ blank: boolean; updatedAt: number }> {
  const result = await remote.list({})
  if (!result.ok) throw new Error('list failed')
  const row = result.value.items.find(item => item.sessionId === COLD_HEADER.id)
  if (row === undefined) throw new Error('cold row missing from the list')
  return { blank: row.blank, updatedAt: row.updatedAt }
}

describe('abandoned cold Session metadata recovery', () => {
  it('reads a small artifact the cache cannot describe and keeps the unused Session blank', async () => {
    const { remote, inspect } = await coldHarness({ events: [], sizeBytes: 4_096 })

    await expect(coldRow(remote)).resolves.toEqual({ blank: true, updatedAt: 100 })
    expect(inspect).toHaveBeenCalledTimes(1)
  })

  it('recovers the last human prompt time from a small conversation artifact', async () => {
    const { remote, inspect } = await coldHarness({ events: conversationEvents(), sizeBytes: 4_096 })

    await expect(coldRow(remote)).resolves.toEqual({ blank: false, updatedAt: 1200 })
    expect(inspect).toHaveBeenCalledTimes(1)
  })

  it('refuses the read when the artifact exceeds the configured bound', async () => {
    const { remote, inspect } = await coldHarness({
      events: [], sizeBytes: 4_096, listColdReadMaxBytes: 0,
    })

    await expect(coldRow(remote)).resolves.toEqual({ blank: false, updatedAt: 100 })
    expect(inspect).not.toHaveBeenCalled()
  })

  it('keeps an unreadable artifact visible with unknown metadata', async () => {
    const { remote, inspect } = await coldHarness({ events: [], sizeBytes: 4_096, readFails: true })

    await expect(coldRow(remote)).resolves.toEqual({ blank: false, updatedAt: 100 })
    expect(inspect).toHaveBeenCalledTimes(1)
  })
})
