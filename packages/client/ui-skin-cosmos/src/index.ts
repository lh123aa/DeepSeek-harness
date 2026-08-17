/** Host registration for the Cosmos skin's persisted settings namespace. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { SKIN_SETTINGS_NAMESPACE, SkinSettingsSchema } from './skin-settings.ts'

export { SKIN_SETTINGS_NAMESPACE, type SkinSettings } from './skin-settings.ts'

const SKIN_NAMESPACE = settingsNamespace(SKIN_SETTINGS_NAMESPACE)

/** Register the durable skin section when the settings service is composed. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(SKIN_NAMESPACE, SkinSettingsSchema)
  })
}
