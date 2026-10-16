import { BoltRounded } from '@mui/icons-material'
import { Box, List, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useSystemState } from '@/hooks/use-system-state'
import { navItems } from '@/pages/_navigation'
import { version } from '@root/package.json'

import { LayoutItem } from './layout-item'

export const LayoutSidebar = () => {
  const { t } = useTranslation()
  const { runState } = useSystemState()
  const ready = runState.mode !== 'NotRunning'
  return (
    <aside
      className="layout-content__left"
      aria-label={t('settings.minimal.navigation')}
    >
      <Box className="app-brand" data-tauri-drag-region="true">
        <Box className="app-mark">
          <BoltRounded />
        </Box>
        <Typography
          sx={{ fontWeight: 650, fontSize: 13, letterSpacing: '-0.02em' }}
        >
          Clash Verge
        </Typography>
      </Box>
      <List className="the-menu">
        {navItems.map((item) => (
          <LayoutItem key={item.path} to={item.path} icon={item.icon}>
            {t(
              item.path === '/'
                ? 'settings.minimal.proxyTitle'
                : item.path === '/profile'
                  ? 'settings.minimal.subscriptionsTitle'
                  : 'settings.minimal.settingsTitle',
            )}
          </LayoutItem>
        ))}
      </List>
      <Box className="sidebar-footer">
        <Box
          role="status"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.75 }}
        >
          <Box
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: ready ? 'success.main' : 'text.disabled',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {ready
              ? t('settings.minimal.coreReady')
              : t('settings.minimal.coreStopped')}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          v{version}
        </Typography>
      </Box>
    </aside>
  )
}
