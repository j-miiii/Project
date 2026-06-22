import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

const drawerWidth = 240
const drawerWidthCollapsed = 64

interface StyledDrawerProps {
  collapsed?: boolean
}

const StyledDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'collapsed' && prop !== 'isDarkMode',
})<StyledDrawerProps & { isDarkMode?: boolean }>(({ theme, collapsed, isDarkMode }) => ({
  width: collapsed ? drawerWidthCollapsed : drawerWidth,
  flexShrink: 0,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  '& .MuiDrawer-paper': {
    width: collapsed ? drawerWidthCollapsed : drawerWidth,
    boxSizing: 'border-box',
    backgroundColor: isDarkMode ? colors.gray.gray900 : 'white',
    borderRight: `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray300}`,
    transition: theme.transitions.create(['width', 'background-color'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
  },
}))

const StyledListItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'collapsed' && prop !== 'isDarkMode',
})<{ active: boolean, collapsed?: boolean, isDarkMode?: boolean }>(({ active, collapsed, isDarkMode }) => ({
  margin: collapsed ? '4px 8px' : '4px 12px',
  borderRadius: '8px',
  backgroundColor: active ? 'rgba(0, 158, 230, 0.1)' : 'transparent',
  color: active ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray200 : colors.gray.gray800),
  minHeight: 48,
  justifyContent: collapsed ? 'center' : 'initial',
  px: 2.5,
  position: 'relative',
  borderLeft: active ? `4px solid ${colors.mainColor.blue}` : '4px solid transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(0, 158, 230, 0.1)' : (isDarkMode ? colors.gray.gray800 : colors.gray.gray100),
  },
  '& .MuiListItemIcon-root': {
    minWidth: 0,
    marginRight: collapsed ? 0 : '16px',
    justifyContent: 'center',
    '& img': {
      filter: active
        ? 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(176deg) brightness(98%) contrast(101%)'
        : isDarkMode
          ? 'brightness(0) saturate(100%) invert(92%) sepia(0%) saturate(1384%) hue-rotate(185deg) brightness(92%) contrast(91%)'
          : 'brightness(0) saturate(100%) invert(17%) sepia(8%) saturate(1016%) hue-rotate(202deg) brightness(95%) contrast(94%)',
    },
  },
  '& .MuiListItemText-primary': {
    fontWeight: active ? 700 : 500,
    fontSize: '18px',
    color: active ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray200 : colors.gray.gray800),
  },
}))

const ToggleButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ theme, isDarkMode }) => ({
  position: 'absolute',
  bottom: 16,
  left: '12px',
  right: '12px',
  width: 'calc(100% - 24px)',
  backgroundColor: isDarkMode ? colors.gray.gray900 : 'var(--bg-primary)',
  border: isDarkMode ? `1px solid ${colors.gray.gray600}` : '1px solid var(--border-color)',
  borderRadius: '4px',
  height: '32px',
  color: isDarkMode ? colors.gray.gray400 : 'inherit',
  '&:hover': {
    backgroundColor: isDarkMode ? colors.gray.gray800 : 'var(--bg-tertiary)',
  },
}))

interface MenuItem {
  text: string
  icon: React.ReactElement
  path: string
  roles?: string[]
}

interface SidebarProps {
  userRole?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
  userRole = 'super_admin',
  collapsed = false,
  onToggleCollapse
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDarkMode } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(collapsed)
  
  const menuItems: MenuItem[] = [
    {
      text: '모니터링',
      icon: <Box component="img" src="/icons/ic_iv_bag.svg" alt="monitoring" sx={{ width: 20, height: 20 }} />,
      path: '/monitoring',
      roles: ['super_admin', 'admin', 'nurse']
    },
    {
      text: '기기관리',
      icon: <Box component="img" src="/icons/ic_device.svg" alt="devices" sx={{ width: 20, height: 20 }} />,
      path: '/devices',
      roles: ['super_admin', 'admin']
    },
    {
      text: '사용자관리',
      icon: <Box component="img" src="/icons/ic_user.svg" alt="users" sx={{ width: 20, height: 20 }} />,
      path: '/users',
      roles: ['super_admin', 'admin']
    },
    {
      text: '통계',
      icon: <Box component="img" src="/icons/ic_dashboard.svg" alt="statistics" sx={{ width: 20, height: 20 }} />,
      path: '/statistics',
      roles: ['super_admin', 'admin']
    },
    {
      text: '병원/병동/병실',
      icon: <Box component="img" src="/icons/ic_hospital.svg" alt="hospital" sx={{ width: 20, height: 20 }} />,
      path: '/hospital',
      roles: ['super_admin', 'admin']
    },
  ]
  
  // 간호사는 사이드바 없음
  if (userRole === 'nurse') {
    return null
  }
  
  // userRole이 없거나 알 수 없는 경우 기본값으로 모든 메뉴 표시
  const filteredMenuItems = menuItems.filter(item => {
    if (!userRole || userRole === '') {
      return true // userRole이 없으면 모든 메뉴 표시
    }
    if (!item.roles) return true
    return item.roles.includes(userRole)
  })
  
  const handleNavigate = (path: string) => {
    navigate(path)
  }
  
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
    if (onToggleCollapse) {
      onToggleCollapse()
    }
  }
  
  return (
    <StyledDrawer
      variant="permanent"
      anchor="left"
      collapsed={isCollapsed}
      isDarkMode={isDarkMode}
    >
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        mt: 1,
        mb: 0
      }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Logo"
          sx={{
            width: isCollapsed ? '48px' : '200px',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </Box>
      <Box sx={{ overflow: 'auto', mt: 0, position: 'relative', height: '100vh' }}>
        <List>
          {filteredMenuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              {isCollapsed ? (
                <Tooltip title={item.text} placement="right">
                  <StyledListItemButton
                    active={location.pathname === item.path}
                    collapsed={isCollapsed}
                    isDarkMode={isDarkMode}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                  </StyledListItemButton>
                </Tooltip>
              ) : (
                <StyledListItemButton
                  active={location.pathname === item.path}
                  collapsed={isCollapsed}
                  isDarkMode={isDarkMode}
                  onClick={() => handleNavigate(item.path)}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </StyledListItemButton>
              )}
            </ListItem>
          ))}
        </List>

        {/* Version Info */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 56,
            left: 0,
            right: 0,
            textAlign: 'center',
            padding: '8px 12px',
            fontSize: '12px',
            color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
            opacity: isCollapsed ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          v {import.meta.env.VITE_APP_VERSION || '1.0.0'}
        </Box>

        <ToggleButton onClick={handleToggleCollapse} size="small" isDarkMode={isDarkMode}>
          {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </ToggleButton>
      </Box>
    </StyledDrawer>
  )
}

export default Sidebar