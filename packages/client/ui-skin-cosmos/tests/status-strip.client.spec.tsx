// @vitest-environment jsdom
/** StatusStrip behavior: hidden while hud is off, telemetry fields from the
 * input-region owner props while on, running dot class from the session flag. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { StatusStrip } from '../src/client/StatusStrip.tsx'
import type { StatusStripProps } from '../src/client/StatusStrip.tsx'
import { createSkinStore } from '../src/client/skin-store.ts'
import { SKIN_DEFAULTS } from '../src/skin-settings.ts'

afterEach(cleanup)

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}

function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(hud: boolean, running: boolean, phase = 'plain', draft = 'hi', queueLen = 2) {
  const store = createSkinStore().create()
  store.actions.sync({ ...SKIN_DEFAULTS, hud })
  const props: StatusStripProps = {
    session: { running, queue: Array.from({ length: queueLen }) } as never,
    input: { phase, draft } as never,
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useSession: undefined as never,
    sessionId: 'session-1' as never,
    useProjection: undefined as never,
    useInput: undefined as never,
    inputActions: undefined as never,
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
  }
  render(<StatusStrip {...props} />)
  return { store }
}

describe('StatusStrip', () => {
  it('renders nothing while the hud setting is off', () => {
    mount(false, true)
    expect(screen.queryByText(/STANDBY|RUNNING/)).toBeNull()
  })

  it('renders the telemetry fields from the owner props', () => {
    mount(true, true, 'submitting', '你好', 3)
    expect(screen.getByText('RUNNING')).toBeTruthy()
    expect(screen.getByText('submitting')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('uses the standby label while the session is idle', () => {
    mount(true, false)
    expect(screen.getByText('STANDBY')).toBeTruthy()
  })
})
