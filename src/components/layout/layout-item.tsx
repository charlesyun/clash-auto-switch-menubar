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
        sx={{ borderRadius: 1, py: 0.75, px: 1.25, minHeight: 38 }}
      >
        <ListItemIcon
          sx={{
            minWidth: 28,
            color: match ? 'primary.main' : 'text.secondary',
            '& svg': { fontSize: 18 },
          }}
        >
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={children}
          slotProps={{
            primary: { sx: { fontSize: 12, fontWeight: match ? 650 : 500 } },
          }}
        />
      </ListItemButton>
    </ListItem>
  )
}
