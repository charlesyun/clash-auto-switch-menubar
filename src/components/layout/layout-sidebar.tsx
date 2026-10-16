import { BoltRounded } from '@mui/icons-material'
import { Box, Chip, List, Typography } from '@mui/material'
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
        <Box>
          <Typography sx={{ fontWeight: 750 }}>Verge</Typography>
          <Typography variant="caption" color="text.secondary">
            ESSENTIAL
          </Typography>
        </Box>
      </Box>
      <List className="the-menu">
        {navItems.map((item) => (
          <LayoutItem key={item.path} to={item.path} icon={item.icon}>
            {t(item.label)}
          </LayoutItem>
        ))}
      </List>
      <Box className="sidebar-footer">
        <Chip
          size="small"
          color={ready ? 'success' : 'default'}
          variant="outlined"
          label={
            ready
              ? t('settings.minimal.coreReady')
              : t('settings.minimal.coreStopped')
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          v{version} · Essential
        </Typography>
      </Box>
    </aside>
  )
}
