/** Cosmos skin plugin, browser half: theme overrides, background, status strip, Skin settings page. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import { SKIN_DEFAULTS, SKIN_SETTINGS_NAMESPACE, type SkinSettings } from '../skin-settings.ts'
import { COSMOS_THEME_TOKENS, COSMOS_TOKEN_OVERRIDES, JARVIS_THEME_ID } from './cosmos-theme.ts'
import { CosmosBackground } from './CosmosBackground.tsx'
import { StatusStrip } from './StatusStrip.tsx'
import { SkinSettingsView, type SkinSettingsInjected } from './SkinSettingsView.tsx'
import { createSkinStore } from './skin-store.ts'

/** Required services: settings transport, slot surface, theme registry, and the transport pair the scope binder reads. */
export const inject = ['settingsScope', 'slots', 'theme', 'connection', 'remote']

/** Mount every Cosmos skin surface over the persisted skin section. One store
 * handle per scope: the root-scope background and Skin page share one, the
 * session-scope status strip mirrors the same section through a second handle. */
export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind<SkinSettings>({ namespace: SKIN_SETTINGS_NAMESPACE })
  const rootStore = createSkinStore()
  const dockStore = createSkinStore()
  let boundRoot: BoundActions<typeof rootStore> | undefined
  let boundDock: BoundActions<typeof dockStore> | undefined

  const adopt = (): void => {
    const section = scope.getSnapshot().value ?? SKIN_DEFAULTS
    boundRoot?.sync(section)
    boundDock?.sync(section)
  }
  ctx.effect(() => scope.subscribe(adopt), 'ui-skin-cosmos: settings adoption')

  // Deep-space palette: activate the registered dark theme and stack the
  // token overrides so every surface follows the cosmos look in either mode.
  ctx.effect(() => {
    const disposeTheme = ctx.theme.register({
      id: JARVIS_THEME_ID,
      colorScheme: 'dark',
      tokens: COSMOS_THEME_TOKENS,
    })
    ctx.theme.setTheme(JARVIS_THEME_ID)
    return disposeTheme
  }, 'ui-skin-cosmos: jarvis-core theme')
  ctx.effect(() => ctx.theme.overrideTokens('ui-skin-cosmos', COSMOS_TOKEN_OVERRIDES), 'ui-skin-cosmos: token overrides')

  const injectedSkin = (actions: BoundActions<typeof rootStore>): SkinSettingsInjected => {
    boundRoot = actions
    adopt()
    return {
      set: (patch) => {
        for (const [field, value] of Object.entries(patch)) void scope.set(field, value)
      },
    }
  }

  const injectedDock = (_sessionId: SessionId, actions: BoundActions<typeof dockStore>): Record<string, never> => {
    boundDock = actions
    adopt()
    return {}
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'jarvis-cosmos',
    order: -100,
    store: rootStore,
  }, CosmosBackground))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'jarvis-status',
    order: 1,
    store: dockStore,
    inject: injectedDock,
  }, StatusStrip))

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'jarvis-skin',
    order: 18,
    label: '皮肤',
    store: rootStore,
    inject: injectedSkin,
  }, SkinSettingsView))
}
