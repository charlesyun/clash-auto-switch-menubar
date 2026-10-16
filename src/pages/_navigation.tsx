import {
  DnsOutlined,
  SettingsOutlined,
  WifiOutlined,
} from '@mui/icons-material'
import type { ComponentType, ReactNode } from 'react'

import { navigationItems } from './_navigation-meta'
import ProfilePage from './profiles'
import ProxyPage from './proxies'
import SettingPage from './settings'

type NavigationItem = {
  label: (typeof navigationItems)[keyof typeof navigationItems]['label']
  path: string
  icon: ReactNode
  Component: ComponentType
}

export const navItems: NavigationItem[] = [
  { ...navigationItems.proxies, icon: <WifiOutlined />, Component: ProxyPage },
  {
    ...navigationItems.profiles,
    icon: <DnsOutlined />,
    Component: ProfilePage,
  },
  {
    ...navigationItems.settings,
    icon: <SettingsOutlined />,
    Component: SettingPage,
  },
]
