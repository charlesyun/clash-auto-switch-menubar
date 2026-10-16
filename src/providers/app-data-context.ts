import { Context, createContext, use } from 'react'
import { BaseConfig } from 'tauri-plugin-mihomo-api'

import type { ProxyViewV1 } from '@/types/proxy-view'

export interface ProxiesContextType {
  proxyView: ProxyViewV1 | undefined
  isProxyViewPending: boolean
  isProxyViewError: boolean
}

export interface ClashConfigContextType {
  clashConfig: BaseConfig | undefined
  isClashConfigPending: boolean
}

export interface SystemContextType {
  sysproxy: any
  runningMode?: string
  isRunningModePending: boolean
  systemProxyAddress: string
}

export interface CoreDataStatusContextType {
  isCoreDataPending: boolean
}

export interface RefreshersContextType {
  refreshProxy: () => Promise<unknown>
  refreshClashConfig: () => Promise<unknown>
  refreshSysproxy: () => Promise<unknown>
  refreshAll: () => Promise<unknown>
}

export const ProxiesContext = createContext<ProxiesContextType | null>(null)
export const ClashConfigContext = createContext<ClashConfigContextType | null>(
  null,
)
export const SystemContext = createContext<SystemContextType | null>(null)
export const CoreDataStatusContext =
  createContext<CoreDataStatusContextType | null>(null)
export const RefreshersContext = createContext<RefreshersContextType | null>(
  null,
)

const useCtx = <T>(ctx: Context<T | null>, hookName: string): T => {
  const v = use(ctx)
  if (!v) throw new Error(`${hookName} must be used within AppDataProvider`)
  return v
}

export const useProxiesData = (): ProxiesContextType =>
  useCtx(ProxiesContext, 'useProxiesData')

export const useClashConfigData = (): ClashConfigContextType =>
  useCtx(ClashConfigContext, 'useClashConfigData')

export const useSystemData = (): SystemContextType =>
  useCtx(SystemContext, 'useSystemData')

export const useAppRefreshers = (): RefreshersContextType =>
  useCtx(RefreshersContext, 'useAppRefreshers')

export const useCoreDataStatus = (): CoreDataStatusContextType =>
  useCtx(CoreDataStatusContext, 'useCoreDataStatus')
