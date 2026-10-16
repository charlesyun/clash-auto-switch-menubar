import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import type { ReactNode } from 'react'
import { useMatch, useNavigate } from 'react-router'

export const LayoutItem = ({
  to,
  children,
  icon,
}: {
  to: string
  children: string
  icon: ReactNode
}) => {
  const match = useMatch({ path: to, end: true })
  const navigate = useNavigate()
  return (
    <ListItem disablePadding sx={{ mb: 0.5 }}>
      <ListItemButton
        selected={Boolean(match)}
        aria-current={match ? 'page' : undefined}
        onClick={() => navigate(to)}
        sx={{ borderRadius: 2.5, py: 1.2 }}
      >
        <ListItemIcon
          sx={{
            minWidth: 36,
            color: match ? 'primary.main' : 'text.secondary',
          }}
        >
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={children}
          slotProps={{
            primary: { sx: { fontSize: 14, fontWeight: match ? 650 : 500 } },
          }}
        />
      </ListItemButton>
    </ListItem>
  )
}
