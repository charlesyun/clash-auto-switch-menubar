import { PublicRounded, RefreshRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BasePage } from '@/components/base'
import { NodeList } from '@/components/proxy/node-list'
import { visibleGroups } from '@/components/proxy/node-list-model'
import SettingAutoSwitch from '@/components/setting/setting-auto-switch'
import ProxyControlSwitches from '@/components/shared/proxy-control-switches'
import { useProfiles } from '@/hooks/use-profiles'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { patchClashMode } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'

const ProxyPage = () => {
  const { t } = useTranslation()
  const { current } = useProfiles()
  const { proxyView, isProxyViewError } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy, refreshClashConfig } = useAppRefreshers()
  const [changingMode, setChangingMode] = useState(false)
  const mode = clashConfig?.mode ?? 'rule'
  const group = visibleGroups(proxyView, mode)[0]
  let selected = group?.now
  const visited = new Set<string>()
  while (selected && !visited.has(selected)) {
    visited.add(selected)
    const nested = proxyView?.groups.find((item) => item.name === selected)
    if (!nested?.now) break
    selected = nested.now
  }
  const changeMode = async (next: string) => {
    setChangingMode(true)
    try {
      await mutate(() => patchClashMode(next), {
        id: 'patch-clash-mode',
        errorNotice: false,
      })
      await Promise.all([refreshClashConfig(), refreshProxy()])
    } catch (error) {
      showNotice.error(error)
    } finally {
      setChangingMode(false)
    }
  }
  return (
    <BasePage
      title={t('settings.minimal.proxyTitle')}
      header={
        <Stack direction="row" spacing={1}>
          <IconButton
            aria-label={t('settings.minimal.refresh')}
            onClick={() => {
              void refreshProxy()
            }}
          >
            <RefreshRounded />
          </IconButton>
          <Select
            size="small"
            value={mode}
            disabled={changingMode}
            onChange={(event) => changeMode(event.target.value)}
            inputProps={{ 'aria-label': t('settings.minimal.mode') }}
          >
            <MenuItem value="rule">{t('settings.minimal.rule')}</MenuItem>
            <MenuItem value="global">{t('settings.minimal.global')}</MenuItem>
            <MenuItem value="direct">{t('settings.minimal.direct')}</MenuItem>
          </Select>
        </Stack>
      }
    >
      <Stack spacing={2.5}>
        {isProxyViewError && (
          <Alert severity="warning">{t('settings.minimal.readError')}</Alert>
        )}
        <Box
          className="essential-card"
          sx={{ bgcolor: 'background.paper', p: 2.5 }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2.5}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', mb: 1.5 }}
              >
                <PublicRounded color="primary" />
                <Typography color="text.secondary" variant="body2">
                  {t('settings.minimal.currentNode')}
                </Typography>
              </Stack>
              <Typography
                sx={{
                  fontWeight: 650,
                  fontSize: 22,
                  overflowWrap: 'anywhere',
                  letterSpacing: '-0.02em',
                }}
              >
                {mode === 'direct'
                  ? t('settings.minimal.direct')
                  : (selected ?? t('settings.minimal.noSelection'))}
              </Typography>
              <Chip
                sx={{ mt: 1.5 }}
                size="small"
                label={current?.name ?? t('settings.minimal.noSubscription')}
                variant="outlined"
              />
            </Box>
            <Box sx={{ minWidth: { md: 230 } }}>
              <ProxyControlSwitches onError={showNotice.error} noRightPadding />
              <ProxyControlSwitches
                label={t('settings.sections.system.toggles.tunMode')}
                onError={showNotice.error}
                noRightPadding
              />
            </Box>
          </Stack>
        </Box>
        <Box
          className="essential-card"
          sx={{ bgcolor: 'background.paper', px: 1, pb: 1 }}
        >
          <SettingAutoSwitch mode="controls" />
        </Box>
        <NodeList />
      </Stack>
    </BasePage>
  )
}

export default ProxyPage
