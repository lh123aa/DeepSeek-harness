/** Durable Cosmos-skin preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the skin plugin. */
export const SKIN_SETTINGS_NAMESPACE = 'ui-skin-cosmos'

/** Durable skin section shared by the Host schema and the browser scope. */
export interface SkinSettings {
  /** Whether the cosmic background renders at all. */
  enabled: boolean
  /** Nebula and galaxy-band opacity multiplier (0..1.5). */
  nebula: number
  /** Full 3D orbit period in seconds (60..300). */
  orbit: number
  /** Star-field opacity multiplier (0..1.5). */
  stars: number
  /** Whether the composer status strip renders. */
  hud: boolean
}

/** Durable skin schema; also the wire envelope the browser scope validates against. */
export const SkinSettingsSchema: z<SkinSettings> = z.object({
  enabled: z.boolean().default(true),
  nebula: z.number().min(0).max(1.5).default(1),
  orbit: z.number().min(60).max(300).default(150),
  stars: z.number().min(0).max(1.5).default(1),
  hud: z.boolean().default(true),
})

/** Factory defaults; also the store's pre-first-read state. */
export const SKIN_DEFAULTS: SkinSettings = {
  enabled: true,
  nebula: 1,
  orbit: 150,
  stars: 1,
  hud: true,
}
