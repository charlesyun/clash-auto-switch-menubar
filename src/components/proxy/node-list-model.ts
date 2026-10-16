import { resolveMember, type ProxyViewV1 } from '@/types/proxy-view'

export function visibleGroups(view: ProxyViewV1 | undefined, mode: string) {
  if (!view || mode === 'direct') return []
  const groups =
    mode === 'global' && view.global
      ? [view.global, ...view.groups]
      : view.groups
  return groups.filter((group) => !group.hidden && group.members.length > 0)
}

export function visibleMembers(
  view: ProxyViewV1,
  group: ReturnType<typeof visibleGroups>[number],
  query: string,
) {
  const keyword = query.trim().toLocaleLowerCase()
  return group.members.flatMap((ref, index) =>
    ref.name.toLocaleLowerCase().includes(keyword)
      ? [{ index, member: resolveMember(view, ref) }]
      : [],
  )
}
