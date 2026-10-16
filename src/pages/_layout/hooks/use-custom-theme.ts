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
  const theme = useMemo(() => {
    const dark = mode === 'dark'
    const accent = dark ? '#71d5b5' : '#20765f'
    return createTheme({
      palette: {
        mode,
        primary: { main: accent, contrastText: dark ? '#102b23' : '#ffffff' },
        secondary: { main: dark ? '#9ca9a0' : '#6c786f' },
        success: { main: accent },
        background: {
          default: dark ? '#141817' : '#f2f3ef',
          paper: dark ? '#1c211f' : '#fdfefb',
        },
        text: {
          primary: dark ? '#edf1ec' : '#242d27',
          secondary: dark ? '#9ca9a0' : '#6c786f',
        },
        divider: dark ? '#303a33' : '#e0e6dd',
        action: {
          selected: alpha(accent, dark ? 0.12 : 0.08),
          hover: alpha(accent, 0.045),
        },
      },
      shape: { borderRadius: 8 },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        body1: { fontSize: 13, lineHeight: 1.6 },
        body2: { fontSize: 12, lineHeight: 1.6 },
        button: { textTransform: 'none', fontSize: 12, fontWeight: 600 },
        caption: { fontSize: 11 },
      },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: 7, minHeight: 32, padding: '5px 12px' },
            outlined: { borderColor: dark ? '#3b4a40' : '#d5ded3' },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: { borderRadius: 7, padding: 7, '& svg': { fontSize: 18 } },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 7,
              fontSize: 12,
              background: dark ? '#171d19' : '#f8faf6',
              '& fieldset': { borderColor: dark ? '#364139' : '#dce4d8' },
            },
            input: { padding: '9px 12px' },
          },
        },
        MuiInputLabel: { styleOverrides: { root: { fontSize: 12 } } },
        MuiSelect: {
          styleOverrides: { select: { minHeight: '0 !important' } },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 5,
              height: 23,
              fontSize: 10,
              fontWeight: 500,
            },
            icon: { fontSize: 14 },
          },
        },
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiDialog: {
          styleOverrides: {
            paper: {
              border: `1px solid ${dark ? '#364139' : '#e0e6dd'}`,
              borderRadius: 12,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              '&.Mui-selected': {
                backgroundColor: alpha(accent, dark ? 0.12 : 0.08),
                '&:hover': { backgroundColor: alpha(accent, 0.13) },
              },
            },
          },
        },
        MuiButtonBase: {
          styleOverrides: {
            root: {
              '&.Mui-focusVisible': {
                outline: `2px solid ${accent}`,
                outlineOffset: -2,
              },
            },
          },
        },
      },
    })
  }, [mode])
  useEffect(() => {
    const root = document.documentElement
    root.style.colorScheme = mode
    root.style.setProperty(
      '--background-color',
      theme.palette.background.default,
    )
    root.style.setProperty('--divider-color', theme.palette.divider)
    root.style.setProperty('--surface-color', theme.palette.background.paper)
    root.style.setProperty('--text-primary', theme.palette.text.primary)
    root.style.setProperty('--text-secondary', theme.palette.text.secondary)
    root.style.setProperty('--primary-main', theme.palette.primary.main)
    root.style.setProperty(
      '--scroller-color',
      alpha(theme.palette.text.secondary, 0.25),
    )
    root.style.setProperty('--window-border-color', theme.palette.divider)
  }, [theme, mode])
  return { theme }
}
