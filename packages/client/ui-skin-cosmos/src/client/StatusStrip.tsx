import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { createSkinStore } from './skin-store.ts'
import css from './StatusStrip.module.css'

/** Full component props: input-region owner share + store share. */
export type StatusStripProps =
  PropsRuntime<'conversation.composer.dock'> & PropsStore<ReturnType<typeof createSkinStore>>

/** Mono readout under the composer: core status, input phase, queue, draft length. */
export function StatusStrip({ session, input, useStore }: StatusStripProps) {
  const hud = useStore(s => s.hud)
  if (!hud) return null
  const running = session.running
  const queueLen = session.queue.length
  const phase = input.phase
  const chars = input.draft.length
  const seg = (key: string, value: string) => (
    <span className={css.seg}>
      <span className={css.key}>{key}</span>
      <span className={css.val}>{value}</span>
    </span>
  )
  return (
    <div className={css.status}>
      <span className={running ? css.dotRunning : css.dot} />
      {seg('CORE · ', running ? 'RUNNING' : 'STANDBY')}
      <span className={css.div} />
      {seg('PHASE · ', phase)}
      <span className={css.div} />
      {seg('QUEUE · ', String(queueLen))}
      <span className={css.div} />
      {seg('CH · ', String(chars))}
    </div>
  )
}
