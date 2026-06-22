import React, { useState } from 'react'
import { Box, Toolbar } from '@mui/material'
import Header from './Header'
import Sidebar from './Sidebar'
import { colors } from '../styles/colors'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <Header sidebarCollapsed={sidebarCollapsed} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: colors.gray.gray100,
          minHeight: '100vh'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  )
}

export default Layout