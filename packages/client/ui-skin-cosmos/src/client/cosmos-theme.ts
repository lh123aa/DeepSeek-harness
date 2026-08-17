/** Theme id, palette, and token overrides backing the Cosmos skin. */

import type { ThemeTokenOverrides, ThemeTokens } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Registered dark theme id activated by the skin at boot. */
export const JARVIS_THEME_ID = 'jarvis-core'

/** Single-mode alias tokens for the registered dark theme. */
export const COSMOS_THEME_TOKENS: ThemeTokens = {
  '--dsw-alias-bg-base': '#070A15',
  '--dsw-alias-bg-layer-1': '#0D1426',
  '--dsw-alias-bg-layer-2': '#141C34',
  '--dsw-alias-bg-overlay': 'rgba(10,14,26,0.96)',
  '--dsw-alias-border-l1': 'rgba(155,175,235,0.28)',
  '--dsw-alias-border-l2': 'rgba(200,220,255,0.48)',
  '--dsw-alias-brand-primary': '#5E7DFB',
  '--dsw-alias-label-primary': '#F7FAFF',
  '--dsw-alias-label-secondary': '#B4C2EA',
  '--dsw-alias-state-error-primary': '#FF8296',
  '--dsw-alias-state-success-primary': '#62F0BE',
  '--dsw-alias-state-warn-primary': '#FFD394',
  '--dsw-specific-sidebar-fill': '#05070F',
}

/** Both-mode overrides stacked over whichever base palette is active. */
export const COSMOS_TOKEN_OVERRIDES: ThemeTokenOverrides = {
  '--dsw-alias-bg-base': { light: '#070A15', dark: '#070A15' },
  '--dsw-alias-bg-layer-1': { light: '#0D1426', dark: '#0D1426' },
  '--dsw-alias-bg-layer-2': { light: '#141C34', dark: '#141C34' },
  '--dsw-alias-bg-overlay': { light: 'rgba(10,14,26,0.96)', dark: 'rgba(10,14,26,0.96)' },
  '--dsw-alias-border-l1': { light: 'rgba(155,175,235,0.28)', dark: 'rgba(155,175,235,0.28)' },
  '--dsw-alias-border-l2': { light: 'rgba(200,220,255,0.48)', dark: 'rgba(200,220,255,0.48)' },
  '--dsw-alias-brand-primary': { light: '#5E7DFB', dark: '#5E7DFB' },
  '--dsw-alias-label-primary': { light: '#F7FAFF', dark: '#F7FAFF' },
  '--dsw-alias-label-secondary': { light: '#B4C2EA', dark: '#B4C2EA' },
  '--dsw-alias-state-error-primary': { light: '#FF8296', dark: '#FF8296' },
  '--dsw-alias-state-success-primary': { light: '#62F0BE', dark: '#62F0BE' },
  '--dsw-alias-state-warn-primary': { light: '#FFD394', dark: '#FFD394' },
  '--dsw-specific-sidebar-fill': { light: '#05070F', dark: '#05070F' },
}
