import {
  CheckCircleRounded,
  DeleteOutlineRounded,
  RefreshRounded,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BasePage } from '@/components/base'
import { useProfiles } from '@/hooks/use-profiles'
import { useAppRefreshers } from '@/providers/app-data-context'
import { deleteProfile, importProfile, updateProfile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useProfileLoadingCache } from '@/store/app-store-context'
import { isValidUrl } from '@/utils/network'

const ProfilePage = () => {
  const { t } = useTranslation()
  const { profiles, patchProfiles, mutateProfiles, error } = useProfiles()
  const { refreshAll } = useAppRefreshers()
  const updating = useProfileLoadingCache()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<IProfileItem | null>(null)
  const items =
    profiles?.items?.filter(
      (item) => item.type === 'remote' || item.type === 'local',
    ) ?? []
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await operation()
      await mutateProfiles()
      await refreshAll()
    } catch (cause) {
      showNotice.error(cause)
    } finally {
      setBusy(false)
    }
  }
  const activate = (uid: string) =>
    run(async () => {
      const outcome = await patchProfiles({ current: uid })
      if (outcome.status !== 'valid')
        throw new Error(
          outcome.status === 'busy'
            ? t('settings.minimal.busy')
            : t('settings.minimal.activationFailed'),
        )
    })
  const add = () =>
    run(async () => {
      await mutate(() => importProfile(url.trim()), {
        id: 'import-profile',
        errorNotice: false,
      })
      setUrl('')
    })
  return (
    <BasePage title={t('settings.minimal.subscriptionsTitle')}>
      <Stack spacing={1.5}>
        <Typography color="text.secondary" variant="body2">
          {t('settings.minimal.subscriptionsHint')}
        </Typography>
        <Box
          component="form"
          className="essential-card"
          onSubmit={(event) => {
            event.preventDefault()
            if (isValidUrl(url.trim()) && !busy) void add()
          }}
          sx={{ bgcolor: 'background.paper', p: 2 }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              size="small"
              type="url"
              fullWidth
              label={t('settings.minimal.subscriptionUrl')}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={busy}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !isValidUrl(url.trim())}
              sx={{ minWidth: 90 }}
            >
              {t('settings.minimal.import')}
            </Button>
          </Stack>
        </Box>
        {error && (
          <Alert severity="warning">{t('settings.minimal.readError')}</Alert>
        )}
        {busy && <LinearProgress />}
        {!items.length && (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            {t('settings.minimal.noSubscription')}
          </Box>
        )}
        {items.map((profile) => {
          const active = profiles?.current === profile.uid
          const loading = busy || updating.has(profile.uid)
          return (
            <Box
              key={profile.uid}
              className="essential-card profile-row"
              data-active={active}
              sx={{ bgcolor: 'background.paper', p: 2 }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 650,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {profile.name ?? profile.uid}
                    </Typography>
                    {active && (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        icon={<CheckCircleRounded />}
                        label={t('settings.minimal.active')}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {profile.updated
                      ? new Date(profile.updated * 1000).toLocaleString()
                      : t('settings.minimal.notUpdated')}
                  </Typography>
                  {profile.extra && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {(
                        (profile.extra.upload + profile.extra.download) /
                        1073741824
                      ).toFixed(1)}{' '}
                      / {(profile.extra.total / 1073741824).toFixed(1)} GB
                      {profile.extra.expire > 0
                        ? ` · ${t('settings.minimal.expires')} ${new Date(profile.extra.expire * 1000).toLocaleDateString()}`
                        : ''}
                    </Typography>
                  )}
                </Box>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: 'center' }}
                >
                  {profile.type === 'remote' && (
                    <IconButton
                      aria-label={`${t('settings.minimal.refresh')} ${profile.name ?? ''}`}
                      disabled={loading}
                      onClick={() =>
                        run(() =>
                          mutate(() => updateProfile(profile.uid), {
                            id: `update-profile:${profile.uid}`,
                            errorNotice: false,
                          }),
                        )
                      }
                    >
                      {updating.has(profile.uid) ? (
                        <CircularProgress size={20} />
                      ) : (
                        <RefreshRounded />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    aria-label={`${t('settings.minimal.delete')} ${profile.name ?? ''}`}
                    disabled={loading}
                    onClick={() => setDeleting(profile)}
                  >
                    <DeleteOutlineRounded />
                  </IconButton>
                  <Button
                    variant={active ? 'text' : 'outlined'}
                    disabled={active || loading}
                    onClick={() => activate(profile.uid)}
                  >
                    {active
                      ? t('settings.minimal.active')
                      : t('settings.minimal.use')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )
        })}
      </Stack>
      <Dialog
        open={Boolean(deleting)}
        onClose={() => {
          if (!busy) setDeleting(null)
        }}
      >
        <DialogTitle>{t('settings.minimal.deleteSubscription')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('settings.minimal.deleteHint', {
              name: deleting?.name ?? deleting?.uid,
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeleting(null)}>
            {t('shared.actions.cancel')}
          </Button>
          <Button
            disabled={busy}
            color="error"
            onClick={() => {
              if (!deleting) return
              void run(async () => {
                await mutate(() => deleteProfile(deleting.uid), {
                  id: `delete-profile:${deleting.uid}`,
                  errorNotice: false,
                })
                setDeleting(null)
              })
            }}
          >
            {t('settings.minimal.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </BasePage>
  )
}

export default ProfilePage
