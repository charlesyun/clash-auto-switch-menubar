import { DownloadRounded, RestoreRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppRefreshers } from '@/providers/app-data-context'
import {
  createLocalBackup,
  exportLocalBackup,
  importLocalBackup,
  listLocalBackup,
  restoreLocalBackup,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useQuery } from '@/services/query-client'

export const LocalBackup = () => {
  const { t } = useTranslation()
  const { data: backups, refetch } = useQuery({
    queryKey: ['listLocalBackup'],
    queryFn: listLocalBackup,
  })
  const { refreshAll } = useAppRefreshers()
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await mutate(action, { id: 'local-backup' })
      await refetch()
      await refreshAll()
    } catch {
      /* The shared intent funnel presents the failure. */
    } finally {
      setBusy(false)
    }
  }
  const restore = async (source: string) => {
    if (
      !(await ask(t('settings.minimal.restoreHint'), {
        title: t('settings.minimal.restoreBackup'),
        kind: 'warning',
      }))
    )
      return
    await run(() => restoreLocalBackup(source))
  }
  return (
    <Box sx={{ p: 2.5 }}>
      <Typography sx={{ fontWeight: 650, mb: 1.5 }}>
        {t('settings.minimal.backup')}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          disabled={busy}
          onClick={() => run(createLocalBackup)}
        >
          {t('settings.minimal.createBackup')}
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            try {
              const path = await open({
                multiple: false,
                filters: [{ name: 'ZIP', extensions: ['zip'] }],
              })
              if (typeof path === 'string')
                await run(() => importLocalBackup(path))
            } catch (error) {
              showNotice.error(error)
            }
          }}
        >
          {t('settings.minimal.importBackup')}
        </Button>
        {busy && <CircularProgress size={20} />}
      </Stack>
      {backups?.map((backup) => (
        <Stack
          key={backup.filename}
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1,
            borderTop: 1,
            borderColor: 'divider',
            py: 0.75,
          }}
        >
          <Typography
            variant="body2"
            sx={{ flex: 1, overflowWrap: 'anywhere' }}
          >
            {backup.filename}
          </Typography>
          <IconButton
            aria-label={`${t('settings.minimal.exportBackup')} ${backup.filename}`}
            disabled={busy}
            onClick={async () => {
              try {
                const path = await save({
                  defaultPath: backup.filename,
                  filters: [{ name: 'ZIP', extensions: ['zip'] }],
                })
                if (path)
                  await run(() => exportLocalBackup(backup.filename, path))
              } catch (error) {
                showNotice.error(error)
              }
            }}
          >
            <DownloadRounded />
          </IconButton>
          <IconButton
            aria-label={`${t('settings.minimal.restoreBackup')} ${backup.filename}`}
            disabled={busy}
            onClick={() => restore(backup.filename)}
          >
            <RestoreRounded />
          </IconButton>
        </Stack>
      ))}
    </Box>
  )
}
