// @vitest-environment jsdom
/** SkinSettingsView behavior: renders every control row, toggles and sliders
 * route partial sections through the injected set callback. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { SkinSettingsView } from '../src/client/SkinSettingsView.tsx'
import type { SkinSettingsViewProps } from '../src/client/SkinSettingsView.tsx'
import { createSkinStore } from '../src/client/skin-store.ts'
import { SKIN_DEFAULTS } from '../src/skin-settings.ts'

afterEach(cleanup)

const set = vi.fn()
beforeEach(() => { set.mockClear() })

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

function mount(section: Partial<typeof SKIN_DEFAULTS> = {}) {
  const store = createSkinStore().create()
  store.actions.sync({ ...SKIN_DEFAULTS, ...section })
  const props: SkinSettingsViewProps = {
    close: () => {},
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    set,
  }
  render(<SkinSettingsView {...props} />)
  return { store }
}

describe('SkinSettingsView', () => {
  it('renders the page header and all five control rows', () => {
    mount()
    expect(screen.getByText('JARVIS 皮肤 · Cosmos')).toBeTruthy()
    expect(screen.getByText('宇宙背景')).toBeTruthy()
    expect(screen.getByText('星云浓度')).toBeTruthy()
    expect(screen.getByText('3D 翻滚周期')).toBeTruthy()
    expect(screen.getByText('星星亮度')).toBeTruthy()
    expect(screen.getByText('系统状态条')).toBeTruthy()
  })

  it('routes a toggle click through the injected set callback', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: '开启' }))
    expect(set).toHaveBeenCalledWith({ enabled: false })
  })

  it('routes a slider change as a percentage-scaled value', () => {
    mount({ nebula: 0.5 })
    fireEvent.change(screen.getAllByRole('slider')[0]!, { target: { value: '120' } })
    expect(set).toHaveBeenCalledWith({ nebula: 1.2 })
  })
})
