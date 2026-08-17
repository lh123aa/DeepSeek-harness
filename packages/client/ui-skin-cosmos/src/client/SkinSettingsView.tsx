import type { ReactNode } from 'react'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SkinSettings } from '../skin-settings.ts'
import type { createSkinStore } from './skin-store.ts'
import css from './SkinSettingsView.module.css'

/** Injected business face: persist one partial skin section. */
export interface SkinSettingsInjected {
  set: (patch: Partial<SkinSettings>) => void
}

/** Full component props: settings-section runtime share + store share + injected face. */
export type SkinSettingsViewProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createSkinStore>> & SkinSettingsInjected

/** Skin settings page: toggles and sliders over the persisted section. */
export function SkinSettingsView({ useStore, set }: SkinSettingsViewProps) {
  const skin = useStore(s => s)
  const toggle = (key: 'enabled' | 'hud', on: string, off: string) => (
    <button
      type="button"
      className={skin[key] ? css.toggleOn : css.toggle}
      onClick={() => { set({ [key]: !skin[key] }) }}
    >
      {skin[key] ? on : off}
    </button>
  )
  const pct = (key: 'nebula' | 'stars') => (
    <div className={css.control}>
      <input
        type="range"
        min="0"
        max="150"
        step="5"
        value={String(Math.round(skin[key] * 100))}
        onChange={(event) => { set({ [key]: Number(event.target.value) / 100 }) }}
        className={css.slider}
      />
      <span className={css.value}>{`${Math.round(skin[key] * 100)}%`}</span>
    </div>
  )
  const orbit = (
    <div className={css.control}>
      <input
        type="range"
        min="60"
        max="300"
        step="10"
        value={String(skin.orbit)}
        onChange={(event) => { set({ orbit: Number(event.target.value) }) }}
        className={css.slider}
      />
      <span className={css.value}>{`${skin.orbit}s`}</span>
    </div>
  )
  const row = (label: string, desc: string, control: ReactNode) => (
    <div className={css.row}>
      <div>
        <div className={css.label}>{label}</div>
        <div className={css.desc}>{desc}</div>
      </div>
      <div className={css.controlWrap}>{control}</div>
    </div>
  )
  return (
    <div className={css.page}>
      <div className={css.head}>JARVIS 皮肤 · Cosmos</div>
      <div className={css.sub}>深空星云与 3D 视差背景。外观偏好已由皮肤接管，可在「外观」恢复浅色或深色。</div>
      {row('宇宙背景', '星云、银河与暗角的整体开关', toggle('enabled', '开启', '关闭'))}
      {row('星云浓度', '星云与银河光晕的强度', pct('nebula'))}
      {row('3D 翻滚周期', '数值越小，镜头翻滚越快', orbit)}
      {row('星星亮度', '星河星点的明暗', pct('stars'))}
      {row('系统状态条', '输入框下方的环境读数', toggle('hud', '显示', '隐藏'))}
    </div>
  )
}
