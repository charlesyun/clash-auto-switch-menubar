import { createBrowserRouter, Navigate } from 'react-router'

import Layout from './_layout'
import { navItems } from './_navigation'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      ...navItems.map((item) => ({
        path: item.path,
        Component: item.Component,
      })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
