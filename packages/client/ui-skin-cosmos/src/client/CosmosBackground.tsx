import type { CSSProperties } from 'react'
import clsx from 'clsx'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { makeBandStars, makeStars } from './starfield.ts'
import type { createSkinStore } from './skin-store.ts'
import css from './CosmosBackground.module.css'

/** One box-shadow layer per star class; deterministic seeds keep the sky stable. */
const STAR_LAYERS = {
  far: makeStars(230, 1, 'rgba(220,230,255,0.45)', 7),
  mid: makeStars(120, 1.6, 'rgba(200,215,255,0.60)', 13),
  near: makeStars(40, 2.2, 'rgba(255,236,210,0.95)', 29),
  blue: makeStars(30, 1.6, 'rgba(160,190,255,0.80)', 47),
  band: `${makeBandStars(85, 'rgba(255,240,215,0.85)', 21)}, ${makeBandStars(45, 'rgba(190,210,255,0.70)', 33)}`,
}

/** Root CSS variables consumed by the background stylesheet. */
type SkinVars = CSSProperties & Record<'--jv-orbit-s' | '--jv-nebula-a' | '--jv-star-a', string>

/** Full component props: runtime share + store share. */
export type CosmosBackgroundProps =
  PropsRuntime<'shell.overlay'> & PropsStore<ReturnType<typeof createSkinStore>>

/** Full-window Cosmos background: nebulas, star layers, galaxy band, grade, vignette. */
export function CosmosBackground({ useStore }: CosmosBackgroundProps) {
  const skin = useStore(s => s)
  const vars: SkinVars = {
    '--jv-orbit-s': `${skin.orbit}s`,
    '--jv-nebula-a': String(skin.nebula),
    '--jv-star-a': String(skin.stars),
  }
  return (
    <div className={clsx(css.cosmos, !skin.enabled && css.off)} style={vars}>
      <div className={css.space}>
        <div className={css.galaxyBand} />
        <div className={clsx(css.nebula, css.n1)} />
        <div className={clsx(css.nebula, css.n2)} />
        <div className={clsx(css.nebula, css.n3)} />
        <div className={clsx(css.nebula, css.n4)} />
        <div className={clsx(css.stars, css.s1)} data-star-layer="far" style={{ boxShadow: STAR_LAYERS.far }} />
        <div className={clsx(css.stars, css.s2)} data-star-layer="mid" style={{ boxShadow: STAR_LAYERS.mid }} />
        <div className={clsx(css.stars, css.s3)} data-star-layer="near" style={{ boxShadow: STAR_LAYERS.near }} />
        <div className={clsx(css.stars, css.s4)} data-star-layer="blue" style={{ boxShadow: STAR_LAYERS.blue }} />
        <div className={clsx(css.stars, css.band)} data-star-layer="band" style={{ boxShadow: STAR_LAYERS.band }} />
        <span className={css.glint1} />
        <span className={css.glint2} />
        <span className={css.glint3} />
      </div>
      <div className={css.grade} />
      <div className={css.vignette} />
    </div>
  )
}
