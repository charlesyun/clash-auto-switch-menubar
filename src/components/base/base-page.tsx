import { Typography } from '@mui/material'
import type { CSSProperties, ReactNode } from 'react'

import { BaseErrorBoundary } from './base-error-boundary'

export const BasePage = ({
  title,
  header,
  contentStyle,
  children,
}: {
  title?: ReactNode
  header?: ReactNode
  contentStyle?: CSSProperties
  children?: ReactNode
  full?: boolean
}) => (
  <BaseErrorBoundary>
    <div className="base-page">
      <header data-tauri-drag-region="true">
        <Typography
          component="h1"
          data-tauri-drag-region="true"
          sx={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.025em' }}
        >
          {title}
        </Typography>
        {header}
      </header>
      <div className="base-container">
        <section>
          <div className="base-content" style={contentStyle}>
            {children}
          </div>
        </section>
      </div>
    </div>
  </BaseErrorBoundary>
)
