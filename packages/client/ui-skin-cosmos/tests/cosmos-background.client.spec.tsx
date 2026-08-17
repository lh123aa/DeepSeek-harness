// @vitest-environment jsdom
/** CosmosBackground behavior: enabled/off class, CSS variables from the store,
 * and one star layer per class with its deterministic box-shadow. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { CosmosBackground } from '../src/client/CosmosBackground.tsx'
import type { CosmosBackgroundProps } from '../src/client/CosmosBackground.tsx'
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

function mount(section: Partial<typeof SKIN_DEFAULTS> = {}) {
  const store = createSkinStore().create()
  store.actions.sync({ ...SKIN_DEFAULTS, ...section })
  const props: CosmosBackgroundProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
  }
  const view = render(<CosmosBackground {...props} />)
  return { view, store }
}

describe('CosmosBackground', () => {
  it('renders the fixed layer and exposes the skin CSS variables', () => {
    const { view } = mount({ orbit: 90, nebula: 1.2, stars: 0.5 })
    const el = view.container.firstElementChild as HTMLElement
    expect(el.style.getPropertyValue('--jv-orbit-s')).toBe('90s')
    expect(el.style.getPropertyValue('--jv-nebula-a')).toBe('1.2')
    expect(el.style.getPropertyValue('--jv-star-a')).toBe('0.5')
  })

  it('renders five star layers and no off class by default', () => {
    const { view } = mount()
    const root = view.container.firstElementChild as HTMLElement
    expect(root.className).not.toContain('off')
    expect(root.querySelectorAll('[data-star-layer]')).toHaveLength(5)
  })

  it('adds the off class when the background is disabled', () => {
    const { view } = mount({ enabled: false })
    const root = view.container.firstElementChild as HTMLElement
    expect(root.className).toContain('off')
  })
})
