/** ui-skin-cosmos apply wiring: three slot contributions over the persisted
 * section, theme takeover at boot, and HMR collapse recovery. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-skin-cosmos/client'
import { CosmosBackground } from '../src/client/CosmosBackground.tsx'
import { StatusStrip } from '../src/client/StatusStrip.tsx'
import { SkinSettingsView } from '../src/client/SkinSettingsView.tsx'

const SLOTS = ['shell.overlay', 'conversation.composer.dock', 'settings.section'] as const

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'skin-describe' as never,
    result: {
      ok: true as const,
      value: { writable: true, hasDocument: true, namespaces: [] },
    },
  }))
  const mutate = vi.fn(() => Promise.resolve({
    rpcId: 'skin-mutate' as never,
    result: { ok: true as const, value: { ns: 'ui-skin-cosmos', schema: {}, value: {}, applies: 'live' as const, secrets: [], revision: 0 } },
  }))
  ctx.provide('connection', { api: { settings: { describe, mutate } }, isLoopback: true } as never)
  new TestRemote(ctx)
  await ctx.plugin(SettingsScopeBinder).await()
  const register = vi.fn(() => () => {})
  const setTheme = vi.fn()
  const overrideTokens = vi.fn(() => () => {})
  ctx.provide('theme', { register, setTheme, overrideTokens } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, register, setTheme, overrideTokens }
}

/** Stand in for the shell: declare the three target slots from root. */
function declareSlots(slots: SlotRegistry): () => void {
  return slots.register(
    {
      name: 'root',
      children: {
        'shell.overlay': { kind: 'list', scope: 'root' },
        'conversation.composer.dock': { kind: 'list', scope: 'session-maybe' },
        'settings.section': { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
}

describe('ui-skin-cosmos apply', () => {
  it('declares the services it reads', () => {
    expect(inject).toEqual(['settingsScope', 'slots', 'theme', 'connection', 'remote'])
  })

  it('registers the three contributions and takes over the theme at boot', async () => {
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('shell.overlay').some(e => e.component === CosmosBackground)).toBe(true)
    expect(b.slots.entries('conversation.composer.dock').some(e => e.component === StatusStrip)).toBe(true)
    const section = b.slots.entries('settings.section').find(e => e.component === SkinSettingsView)!
    expect(section.options).toMatchObject({ id: 'jarvis-skin', order: 18, label: '皮肤' })
    expect(b.register).toHaveBeenCalledWith(expect.objectContaining({ id: 'jarvis-core', colorScheme: 'dark' }))
    expect(b.setTheme).toHaveBeenCalledWith('jarvis-core')
    expect(b.overrideTokens).toHaveBeenCalledWith('ui-skin-cosmos', expect.any(Object))
  })

  it('registers after the declaring slots appear late', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    declareSlots(b.slots)
    await Promise.resolve()
    expect(b.slots.entries('shell.overlay').some(e => e.component === CosmosBackground)).toBe(true)
  })

  it('recovers after an HMR collapse of a declaring entry', async () => {
    const b = await bench()
    const host = declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries('settings.section')).toHaveLength(1)
    host()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declareSlots(b.slots)
    await Promise.resolve()
    expect(b.slots.entries('settings.section').some(e => e.component === SkinSettingsView)).toBe(true)
  })

  it('teardown removes every contribution', async () => {
    const b = await bench()
    declareSlots(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const slot of SLOTS) expect(b.slots.entries(slot)).toHaveLength(1)
    await fiber.dispose()
    for (const slot of SLOTS) expect(b.slots.entries(slot)).toHaveLength(0)
  })
})
