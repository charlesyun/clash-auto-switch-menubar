import { CheckCircleRounded, SpeedRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import delayManager from '@/services/delay'
import { showNotice } from '@/services/notice-service'
import {
  isInteractableMember,
  memberDetails,
  type ResolvedProxyMember,
} from '@/types/proxy-view'

import { visibleGroups, visibleMembers } from './node-list-model'

export const NodeList = () => {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const { current } = useProfiles()
  const { proxyView, isProxyViewPending } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy } = useAppRefreshers()
  const groups = visibleGroups(proxyView, clashConfig?.mode ?? 'rule')
  const [groupName, setGroupName] = useState('')
  const group = groups.find((item) => item.name === groupName) ?? groups[0]
  const [query, setQuery] = useState('')
  const [testing, setTesting] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [revision, setRevision] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const members =
    proxyView && group ? visibleMembers(proxyView, group, query) : []
  const virtualizer = useVirtualizer({
    count: members.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 68,
    overscan: 5,
  })
  const { changeProxy } = useProxySelection({
    onSuccess: () => {
      setSelecting(false)
      void refreshProxy()
    },
    onError: (error) => {
      setSelecting(false)
      showNotice.error(error)
    },
  })
  const name = group?.name
  const testUrl =
    (name && current?.latency_test_urls?.[name]) ||
    group?.testUrl ||
    verge?.default_latency_test ||
    'https://www.gstatic.com/generate_204'
  useEffect(() => {
    if (!name) return
    delayManager.setUrl(name, testUrl)
    return delayManager.addGroupListener(name, () =>
      setRevision((value) => value + 1),
    )
  }, [name, testUrl])
  const delayText = (member: ResolvedProxyMember) => {
    const delay = name ? delayManager.getDelayFix(member, name) : -1
    return delay === -2
      ? '…'
      : delay >= 1e6
        ? t('settings.minimal.timeout')
        : delay > 0
          ? `${delay} ms`
          : '—'
  }
  const test = async (member?: ResolvedProxyMember) => {
    if (!group || !proxyView || testing) return
    setTesting(true)
    delayManager.setUrl(group.name, testUrl)
    try {
      const targets = member
        ? [member]
        : visibleMembers(proxyView, group, '').map((entry) => entry.member)
      await delayManager.checkListDelay(
        targets.filter(isInteractableMember),
        group.name,
        verge?.default_latency_timeout ?? 10000,
        5,
      )
      await refreshProxy()
    } catch (error) {
      showNotice.error(error)
    } finally {
      setTesting(false)
    }
  }
  return (
    <Box className="essential-card" sx={{ bgcolor: 'background.paper' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ p: 2 }}
      >
        <Select
          size="small"
          value={name ?? ''}
          displayEmpty
          disabled={!groups.length}
          sx={{ minWidth: 150 }}
          inputProps={{ 'aria-label': t('settings.minimal.group') }}
          onChange={(event) => {
            setGroupName(event.target.value)
            scrollRef.current?.scrollTo(0, 0)
          }}
        >
          {!groups.length && (
            <MenuItem value="">{t('settings.minimal.group')}</MenuItem>
          )}
          {groups.map((item) => (
            <MenuItem value={item.name} key={item.name}>
              {item.name}
            </MenuItem>
          ))}
        </Select>
        <TextField
          size="small"
          placeholder={t('settings.minimal.searchNodes')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            scrollRef.current?.scrollTo(0, 0)
          }}
          sx={{ flex: 1 }}
          slotProps={{
            htmlInput: { 'aria-label': t('settings.minimal.searchNodes') },
          }}
        />
        <Button
          variant="outlined"
          startIcon={
            testing ? <CircularProgress size={16} /> : <SpeedRounded />
          }
          disabled={testing || !group}
          onClick={() => test()}
        >
          {t('settings.minimal.testGroup')}
        </Button>
      </Stack>
      {!members.length && (
        <Box
          sx={{ px: 3, py: 5, textAlign: 'center', color: 'text.secondary' }}
        >
          {isProxyViewPending ? (
            <CircularProgress size={24} />
          ) : query ? (
            t('settings.minimal.noMatches')
          ) : (
            t('settings.minimal.noNodes')
          )}
        </Box>
      )}
      <Box
        ref={scrollRef}
        role="radiogroup"
        aria-label={t('settings.minimal.nodes')}
        sx={{ height: members.length ? 408 : 0, overflow: 'auto' }}
      >
        <Box
          sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          data-delay-revision={revision}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const { index, member } = members[item.index]
            const active = member.ref.name === group?.now
            return (
              <Box
                key={`${name}:${index}`}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                  display: 'flex',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <ButtonBase
                  role="radio"
                  aria-checked={active}
                  disabled={selecting || member.kind === 'unresolved'}
                  onClick={() => {
                    if (!group) return
                    setSelecting(true)
                    changeProxy(
                      group.name,
                      member.ref.name,
                      group.now,
                      group.fixed,
                    )
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    justifyContent: 'flex-start',
                    px: 2.5,
                    gap: 1.5,
                    textAlign: 'left',
                    bgcolor: active ? 'action.selected' : undefined,
                  }}
                >
                  <CheckCircleRounded
                    sx={{
                      color: active ? 'primary.main' : 'divider',
                      fontSize: 20,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      noWrap
                      sx={{ fontSize: 14, fontWeight: active ? 650 : 500 }}
                    >
                      {member.ref.name}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                      {memberDetails(member)?.type ??
                        t('settings.minimal.unavailable')}
                    </Typography>
                  </Box>
                </ButtonBase>
                <Button
                  aria-label={`${t('settings.minimal.testNode')} ${member.ref.name}`}
                  disabled={testing || member.kind === 'unresolved'}
                  onClick={() => test(member)}
                  sx={{ minWidth: 90, fontVariantNumeric: 'tabular-nums' }}
                >
                  {delayText(member)}
                </Button>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
