import { describe, expect, it } from 'vitest'

import type { ProxyGroupView, ProxyViewV1 } from '@/types/proxy-view'

import { visibleGroups, visibleMembers } from './node-list-model'

const group = (name: string, hidden = false): ProxyGroupView => ({
  name,
  hidden,
  type: 'Selector',
  alive: true,
  udp: true,
  xudp: false,
  tfo: false,
  mptcp: false,
  smux: false,
  history: [],
  members: [
    { kind: 'unresolved', name: 'Tokyo', reason: 'provider-unavailable' },
    { kind: 'unresolved', name: 'Singapore', reason: 'missing' },
  ],
})
const view: ProxyViewV1 = {
  schemaVersion: 1,
  orderSource: 'runtime',
  providerState: 'unavailable',
  global: group('GLOBAL'),
  direct: 'DIRECT',
  groups: [
    group('Main'),
    group('Hidden', true),
    { ...group('Empty'), members: [] },
  ],
  records: {},
  standalone: [],
  providers: [],
}

describe('minimal node list', () => {
  it('keeps selectable group order and handles global and direct modes', () => {
    expect(visibleGroups(view, 'rule').map((item) => item.name)).toEqual([
      'Main',
    ])
    expect(visibleGroups(view, 'global').map((item) => item.name)).toEqual([
      'GLOBAL',
      'Main',
    ])
    expect(visibleGroups(view, 'direct')).toEqual([])
    expect(visibleGroups(undefined, 'rule')).toEqual([])
  })
  it('preserves member identity and original position during search and provider failures', () => {
    const result = visibleMembers(view, view.groups[0], '  SINGA ')
    expect(result).toHaveLength(1)
    expect(result[0].index).toBe(1)
    expect(result[0].member.kind).toBe('unresolved')
    expect(result[0].member.ref.name).toBe('Singapore')
    expect(visibleMembers(view, view.groups[0], '')).toHaveLength(2)
    expect(visibleMembers(view, view.groups[0], 'unknown')).toEqual([])
  })
})
