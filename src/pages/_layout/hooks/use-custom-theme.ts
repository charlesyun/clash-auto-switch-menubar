import { alpha, createTheme } from '@mui/material'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect, useMemo } from 'react'

import { useVerge } from '@/hooks/use-verge'
import { useSetThemeMode, useThemeMode } from '@/services/states'

export const useCustomTheme = () => {
  const { verge } = useVerge()
  const mode = useThemeMode()
  const setMode = useSetThemeMode()
  const themeMode = verge?.theme_mode ?? 'system'
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      setMode(
        themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode,
      )
    }
    sync()
    media.addEventListener('change', sync)
    void appWindow
      .setTheme(themeMode === 'system' ? null : themeMode)
      .catch(console.error)
    return () => media.removeEventListener('change', sync)
  }, [themeMode, setMode])
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: mode === 'light' ? '#2867d8' : '#8aafff' },
          success: { main: mode === 'light' ? '#24815b' : '#66c6a0' },
          background: {
            default: mode === 'light' ? '#f5f6f8' : '#16181d',
            paper: mode === 'light' ? '#ffffff' : '#20232b',
          },
          text: {
            primary: mode === 'light' ? '#202734' : '#edf0f7',
            secondary: mode === 'light' ? '#747d8c' : '#9ba4b5',
          },
          divider: mode === 'light' ? '#e9ecf1' : '#333845',
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { borderRadius: 10, minHeight: 36 } },
          },
          MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                '&.Mui-selected': {
                  backgroundColor: alpha(
                    mode === 'light' ? '#2867d8' : '#8aafff',
                    0.09,
                  ),
                },
              },
            },
          },
        },
      }),
    [mode],
  )
  useEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = mode
    root.style.setProperty(
      '--background-color',
      theme.palette.background.default,
    )
    root.style.setProperty('--divider-color', theme.palette.divider)
    root.style.setProperty('--primary-main', theme.palette.primary.main)
    root.style.setProperty(
      '--scroller-color',
      alpha(theme.palette.text.secondary, 0.25),
    )
    root.style.setProperty('--window-border-color', theme.palette.divider)
  }, [theme, mode])
  return { theme }
}
