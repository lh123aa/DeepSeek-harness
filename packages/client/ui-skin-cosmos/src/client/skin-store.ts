/** Shared skin view store: persisted section mirror + declared mutation surface. */

import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { SKIN_DEFAULTS, type SkinSettings } from '../skin-settings.ts'

/** Store state: the resolved durable section, always defined. */
export type SkinStoreState = SkinSettings

type SkinStoreActions = {
  /** Adopt one resolved section from the settings scope. */
  sync: (draft: SkinStoreState, section: SkinSettings) => void
}

/** Declares the skin view state and write surface. */
export function createSkinStore(): EngineStoreHandle<SkinStoreState, SkinStoreActions> {
  return defineStore({
    init: (): SkinStoreState => ({ ...SKIN_DEFAULTS }),
    actions: {
      sync: (d, section) => {
        d.enabled = section.enabled
        d.nebula = section.nebula
        d.orbit = section.orbit
        d.stars = section.stars
        d.hud = section.hud
      },
    },
  })
}
