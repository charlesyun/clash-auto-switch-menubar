import {
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BasePage, type DialogRef, Switch } from '@/components/base'
import { LocalBackup } from '@/components/setting/local-backup'
import { ClashPortViewer } from '@/components/setting/mods/clash-port-viewer'
import {
  SettingItem,
  SettingList,
} from '@/components/setting/mods/setting-comp'
import SettingAutoSwitch from '@/components/setting/setting-auto-switch'
import SettingSystem from '@/components/setting/setting-system'
import { useVerge } from '@/hooks/use-verge'
import {
  entry_lightweight_mode,
  openLogsDir,
  restartCore,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { isValidLatencyTestUrl } from '@/utils/network'

const SettingPage = () => {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const [busy, setBusy] = useState(false)
  const [testUrl, setTestUrl] = useState<string | null>(null)
  const [timeoutInput, setTimeoutInput] = useState<string | null>(null)
  const portRef = useRef<DialogRef>(null)
  const url =
    testUrl ??
    verge?.default_latency_test ??
    'https://www.gstatic.com/generate_204'
  const timeoutValue =
    timeoutInput ?? String(verge?.default_latency_timeout ?? 10000)
  const save = async (patch: Partial<IVergeConfig>) => {
    setBusy(true)
    try {
      await patchVerge(patch)
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  }
  const card = { bgcolor: 'background.paper' }
  return (
    <BasePage title={t('settings.minimal.settingsTitle')}>
      <Stack spacing={2.5}>
        <Typography color="text.secondary" variant="body2">
          {t('settings.minimal.settingsHint')}
        </Typography>
        <Box className="essential-card" sx={card}>
          <SettingSystem onError={showNotice.error} />
        </Box>
        <Box className="essential-card" sx={{ ...card, px: 1, pb: 1 }}>
          <SettingAutoSwitch />
        </Box>
        <Box className="essential-card" sx={card}>
          <SettingList title={t('settings.minimal.preferences')}>
            <SettingItem label={t('settings.minimal.appearance')}>
              <Select
                size="small"
                value={verge?.theme_mode ?? 'system'}
                disabled={busy}
                inputProps={{ 'aria-label': t('settings.minimal.appearance') }}
                onChange={(event) =>
                  save({
                    theme_mode: event.target
                      .value as IVergeConfig['theme_mode'],
                  })
                }
              >
                <MenuItem value="system">
                  {t('settings.minimal.systemTheme')}
                </MenuItem>
                <MenuItem value="light">
                  {t('settings.minimal.lightTheme')}
                </MenuItem>
                <MenuItem value="dark">
                  {t('settings.minimal.darkTheme')}
                </MenuItem>
              </Select>
            </SettingItem>
            <SettingItem label={t('settings.minimal.language')}>
              <Select
                size="small"
                value={verge?.language === 'en' ? 'en' : 'zh'}
                disabled={busy}
                inputProps={{ 'aria-label': t('settings.minimal.language') }}
                onChange={(event) => save({ language: event.target.value })}
              >
                <MenuItem value="zh">简体中文</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </SettingItem>
            <SettingItem label={t('settings.minimal.closeConnections')}>
              <Switch
                checked={verge?.auto_close_connection ?? false}
                disabled={busy}
                onChange={(_, checked) =>
                  save({ auto_close_connection: checked })
                }
                slotProps={{
                  input: {
                    'aria-label': t('settings.minimal.closeConnections'),
                  },
                }}
              />
            </SettingItem>
            <SettingItem
              label={t('settings.minimal.ports')}
              onClick={() => portRef.current?.open()}
            />
          </SettingList>
          <ClashPortViewer ref={portRef} />
        </Box>
        <Box className="essential-card" sx={{ ...card, p: 2.5 }}>
          <Typography sx={{ fontWeight: 650, mb: 2 }}>
            {t('settings.minimal.latencySettings')}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t('settings.minimal.testUrl')}
              value={url}
              size="small"
              onChange={(event) => setTestUrl(event.target.value)}
            />
            <Stack direction="row" sx={{ gap: 1.5 }}>
              <TextField
                label={t('settings.minimal.testTimeout')}
                value={timeoutValue}
                type="number"
                size="small"
                slotProps={{ htmlInput: { min: 1000, max: 30000, step: 1000 } }}
                onChange={(event) => setTimeoutInput(event.target.value)}
              />
              <Button
                variant="outlined"
                disabled={
                  busy ||
                  !isValidLatencyTestUrl(url) ||
                  !/^\d+$/.test(timeoutValue) ||
                  Number(timeoutValue) < 1000 ||
                  Number(timeoutValue) > 30000
                }
                onClick={() =>
                  save({
                    default_latency_test: url,
                    default_latency_timeout: Number(timeoutValue),
                  })
                }
              >
                {t('shared.actions.save')}
              </Button>
            </Stack>
          </Stack>
        </Box>
        <Box className="essential-card" sx={card}>
          <LocalBackup />
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => {
              void mutate(restartCore, { id: 'restart-core' }).catch(() => {})
            }}
          >
            {t('settings.minimal.restartCore')}
          </Button>
          <Button
            onClick={() => {
              void mutate(entry_lightweight_mode, {
                id: 'entry-lightweight-mode',
              }).catch(() => {})
            }}
          >
            {t('settings.minimal.lightweight')}
          </Button>
          <Button
            onClick={() => {
              void openLogsDir()
            }}
          >
            {t('settings.minimal.openLogs')}
          </Button>
        </Stack>
      </Stack>
    </BasePage>
  )
}

export default SettingPage
