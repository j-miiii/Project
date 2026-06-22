import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
  PaginationItem
} from '@mui/material'
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import AddUserModal from '../components/AddUserModal'
import DeleteUserModal from '../components/DeleteUserModal'
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown'
import SearchInput from '../components/SearchInput'
import { dataProvider } from '../providers/dataProvider'
import { useGlobalContext } from '../contexts/GlobalContext'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

const drawerWidth = 240
const drawerWidthCollapsed = 64
const headerHeight = 64

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasDrawer' && prop !== 'drawerCollapsed' && prop !== 'isDarkMode',
})<{ hasDrawer?: boolean; drawerCollapsed?: boolean; isDarkMode?: boolean }>(
  ({ theme, hasDrawer = true, drawerCollapsed = false, isDarkMode = false }) => ({
    position: 'fixed',
    top: 0,
    left: hasDrawer ? (drawerCollapsed ? `${drawerWidthCollapsed}px` : `${drawerWidth}px`) : 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    paddingTop: `${headerHeight + 24 + 16}px`,
    paddingBottom: '16px',
    backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
    transition: theme.transitions.create(['left', 'width', 'background-color'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    display: 'flex',
    flexDirection: 'column',
  })
)

const StyledTableContainer = styled(TableContainer, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ isDarkMode = false }) => ({
  boxShadow: 'none',
  border: 'none',
  backgroundColor: 'transparent',
  '& .MuiTableHead-root': {
    backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  },
  '& .MuiTableCell-head': {
    fontWeight: 600,
    fontSize: '18px',
    color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600,
    borderBottom: 'none',
    paddingTop: '16px',
    paddingBottom: '16px',
    backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  },
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: '70px',
    backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  },
  '& .MuiTableBody-root .MuiTableRow-root:hover': {
    backgroundColor: isDarkMode ? colors.gray.gray1000 : colors.gray.gray100,
  },
  '& .MuiTableCell-body': {
    fontSize: '18px',
    color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600,
    borderBottom: 'none',
    backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  },
}))

interface User {
  id: number
  username: string
  password: string
  role: 'super_admin' | 'admin' | 'nurse'
  nickname: string
  hospital_id?: number
  ward_id?: number
  room_id?: number
  created_at?: string
  updated_at?: string
  auth_id?: string
  hospital_info?: {
    hospital_id: number
    hospital_name: string
  }
  ward_info?: {
    ward_id: number
    ward_name: string
  }
  is_locked?: boolean
  failure_count?: number
  emr_user_key?: string
  emr_group_code?: string
  emr_group_desc?: string
  dept_code?: string
  employee_number?: string
}

const UsersPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [hospitalFilter, setHospitalFilter] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [initialFormData, setInitialFormData] = useState({
    role: 'nurse' as 'super_admin' | 'admin' | 'nurse',
    nickname: '',
    username: '',
    password: '',
    hospital_id: '',
    ward_id: '',
    emr_user_key: '',
    emr_group_code: '',
    emr_group_desc: '',
    dept_code: '',
    employee_number: '',
  })

  // Get user role from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const hasDrawer = userRole !== 'nurse'

  // Get global context
  const { hospitals, wards, rooms, loadHospitals, loadWards, loadRooms } = useGlobalContext()

  // Debug wards data
  useEffect(() => {
    // console.log('UsersPage - hospitals:', hospitals)
    // console.log('UsersPage - wards:', wards)
    // console.log('UsersPage - wards count:', wards.length)
  }, [hospitals, wards])

  // Load users on mount and remove HTML loader
  useEffect(() => {
    // GlobalContext 데이터 로딩
    loadHospitals()
    loadWards()
    loadRooms()

    loadUsers()

    // HTML 초기 로더 제거
    setTimeout(() => {
      const loader = document.getElementById('initial-loader')
      if (loader) {
        loader.classList.add('initial-loader--fade-out')
        setTimeout(() => {
          loader.remove()
        }, 300)
      }
    }, 500)
  }, [])

  // Set user's hospital on mount and handle initialization
  useEffect(() => {
    if (hospitals.length > 0) {
      if (userRole !== 'super_admin' && userInfo.hospital_id && !hospitalFilter) {
        setHospitalFilter(userInfo.hospital_id.toString())
      }
      // 약간의 지연 후 초기화 완료 (자동 선택이 보이는 것 방지)
      setTimeout(() => {
        setInitializing(false)
      }, 100)
    }
  }, [userRole, userInfo.hospital_id, hospitals])

  // Apply filters whenever users or filter values change
  useEffect(() => {
    applyFilters()
    // 검색이나 필터가 변경되면 첫 페이지로 이동
    setPage(1)
  }, [users, searchTerm, roleFilter, hospitalFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      let allUsers: User[] = []
      let currentPage = 1
      let hasMore = true

      // console.log('==== Loading Users ====')

      while (hasMore) {
        // console.log(`Fetching page ${currentPage}...`)
        const response = await dataProvider.getList('users', {
          page: currentPage,
          limit: 10
        })

        // console.log(`Page ${currentPage} response:`, response)
        // console.log(`Page ${currentPage} pagination info:`, response.pagination)

        if (response.data && Array.isArray(response.data)) {
          allUsers = [...allUsers, ...response.data as User[]]
          // console.log(`Page ${currentPage}: received ${response.data.length} users, total so far: ${allUsers.length}`)

          // 더 이상 데이터가 없으면 중단
          if (response.data.length === 0) {
            hasMore = false
          } else if (response.pagination && response.pagination.total) {
            // total이 있으면 그것으로 판단
            // console.log(`Total from API: ${response.pagination.total}`)
            if (allUsers.length >= response.pagination.total) {
              hasMore = false
            } else {
              currentPage++
            }
          } else if (response.data.length < 10) {
            // 받은 데이터가 10개 미만이면 마지막 페이지
            hasMore = false
          } else {
            // 계속 다음 페이지 시도 (최대 50페이지까지만)
            if (currentPage < 50) {
              currentPage++
            } else {
              hasMore = false
            }
          }
        } else {
          hasMore = false
        }
      }

      // console.log(`Total users loaded: ${allUsers.length}`)
      setUsers(allUsers)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...users]

    // Search filter - 이름(nickname), auth_id, username으로 검색
    if (searchTerm) {
      filtered = filtered.filter(user =>
        (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.auth_id && user.auth_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Role filter
    if (roleFilter) {
      const roleMap: { [key: string]: string } = {
        '최고관리자': 'super_admin',
        '병원관리자': 'admin',
        '간호사': 'nurse'
      }
      filtered = filtered.filter(user => user.role === roleMap[roleFilter])
    }

    // Hospital filter
    if (hospitalFilter) {
      filtered = filtered.filter(user => user.hospital_id === parseInt(hospitalFilter))
    }

    setFilteredUsers(filtered)
  }

  // Dropdown options - filter role options based on user role
  const roleOptions: DropdownOption[] = userRole === 'super_admin'
    ? [
        { id: '최고관리자', label: '최고관리자' },
        { id: '병원관리자', label: '병원관리자' },
        { id: '간호사', label: '간호사' }
      ]
    : [
        { id: '병원관리자', label: '병원관리자' },
        { id: '간호사', label: '간호사' }
      ]

  const hospitalOptions: DropdownOption[] = hospitals.map(h => ({ id: h.id, label: h.name }))



  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'super_admin': return colors.mainColor.deepGreen
      case 'admin': return colors.mainColor.blue
      case 'nurse': return colors.mainColor.blue
      default: return '#757575'
    }
  }

  const getRoleBackgroundOpacity = (role: string) => {
    switch(role) {
      case 'super_admin': return '20'
      case 'admin': return '20'
      case 'nurse': return '20'
      default: return '20'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'super_admin': return '최고관리자'
      case 'admin': return '병원관리자'
      case 'nurse': return '간호사'
      default: return role
    }
  }

  const getLocationString = (user: User) => {
    if (user.role === 'super_admin') {
      return '전체 병원'
    }

    const parts = []

    // Use hospital_info from API response if available
    if (user.hospital_info) {
      parts.push(user.hospital_info.hospital_name)
    } else if (user.hospital_id) {
      const hospital = hospitals.find(h => h.id === user.hospital_id)
      if (hospital) parts.push(hospital.name)
    }

    // Use ward_info from API response if available
    if (user.ward_info) {
      parts.push(user.ward_info.ward_name)
    } else if (user.ward_id) {
      const ward = wards.find(w => w.id === user.ward_id)
      if (ward) parts.push(ward.name)
    }

    return parts.length > 0 ? parts.join('   /   ') : '-'
  }

  const handleOpenModal = (user?: User) => {
    // console.log('==== UsersPage handleOpenModal ====')
    // console.log('user:', user)

    if (user) {
      // console.log('Edit mode - user data:')
      // console.log('  role:', user.role)
      // console.log('  nickname:', user.nickname)
      // console.log('  username:', user.username)
      // console.log('  auth_id:', user.auth_id)
      // console.log('  hospital_id:', user.hospital_id)
      // console.log('  ward_id:', user.ward_id)

      const formData = {
        role: user.role,
        nickname: user.nickname,
        username: user.auth_id || user.username,  // auth_id 우선 사용
        password: '',
        hospital_id: user.hospital_id?.toString() || '',
        ward_id: user.ward_id?.toString() || '',
        emr_user_key: user.emr_user_key || '',
        emr_group_code: user.emr_group_code || '',
        emr_group_desc: user.emr_group_desc || '',
        dept_code: user.dept_code || '',
        employee_number: user.employee_number || '',
      }

      // console.log('Setting initialFormData:', formData)
      setEditingUser(user)
      setInitialFormData(formData)
    } else {
      // console.log('Add mode - creating new user')
      setEditingUser(null)
      setInitialFormData({
        role: 'nurse',
        nickname: '',
        username: '',
        password: '',
        hospital_id: '',
        ward_id: '',
        emr_user_key: '',
        emr_group_code: '',
        emr_group_desc: '',
        dept_code: '',
        employee_number: '',
      })
    }
    setOpenModal(true)
  }

  const handleCloseModal = () => {
    setOpenModal(false)
    setEditingUser(null)
  }

  const handleSubmit = async (formData: any) => {
    try {
      const userData = {
        ...formData,
        auth_id: formData.username.replace(/\s/g, ''),  // username 필드를 auth_id로 전달하고 모든 공백 제거
        password: formData.password ? formData.password.replace(/\s/g, '') : formData.password,  // 비밀번호 모든 공백 제거
        hospital_id: formData.hospital_id ? parseInt(formData.hospital_id) : undefined,
        ward_id: formData.ward_id ? parseInt(formData.ward_id) : undefined
      }

      // username 필드 제거 (auth_id만 사용)
      delete userData.username

      // 수정 모드에서 비밀번호가 비어있으면 필드 제거 (변경하지 않음)
      if (editingUser && !userData.password) {
        delete userData.password
      }

      // 수정 모드: 변경되지 않은 필드 제거
      if (editingUser) {
        if (userData.employee_number === (editingUser.employee_number || '')) {
          delete userData.employee_number
        }
        if (userData.emr_user_key === (editingUser.emr_user_key || '')) {
          delete userData.emr_user_key
        }
        if (userData.emr_group_code === (editingUser.emr_group_code || '')) {
          delete userData.emr_group_code
        }
        if (userData.emr_group_desc === (editingUser.emr_group_desc || '')) {
          delete userData.emr_group_desc
        }
        if (userData.dept_code === (editingUser.dept_code || '')) {
          delete userData.dept_code
        }
      }

      if (editingUser) {
        await dataProvider.update('users', editingUser.id, userData)
      } else {
        await dataProvider.create('users', userData)
      }

      loadUsers()
      handleCloseModal()
    } catch (error: any) {
      console.error('Failed to save user:', error)
      const message = error?.message || error?.response?.message || '사용자 저장에 실패했습니다.'
      alert(message)
    }
  }

  const handleOpenDeleteModal = (user: User) => {
    setUserToDelete(user)
    setDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false)
    setUserToDelete(null)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return

    try {
      await dataProvider.delete('users', userToDelete.id)
      loadUsers()
      handleCloseDeleteModal()
    } catch (error: any) {
      console.error('Failed to delete user:', error)
      const message = error?.message || error?.response?.message || '사용자 삭제에 실패했습니다.'
      alert(message)
    }
  }

  const handleUnlockAccount = async (userId: number) => {
    try {
      await dataProvider.unlockAccount(userId)
      alert('계정 잠금이 해제되었습니다.')
      loadUsers() // 사용자 목록 새로고침
    } catch (error: any) {
      console.error('Failed to unlock account:', error)
      const message = error?.message || error?.response?.message || '계정 잠금 해제에 실패했습니다.'
      alert(message)
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100 }}>
      {hasDrawer && (
        <Sidebar
          userRole={userRole}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      )}

      <Header sidebarCollapsed={sidebarCollapsed} hasDrawer={hasDrawer} />

      <MainContent hasDrawer={hasDrawer} drawerCollapsed={sidebarCollapsed} isDarkMode={isDarkMode}>
        {/* Header with filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, paddingLeft: '24px', paddingRight: '24px' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="이름, ID 검색"
            isDarkMode={isDarkMode}
            minWidth={300}
          />

          <CustomDropdown
            options={roleOptions}
            value={roleFilter}
            onChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value
              setRoleFilter(v || '')
            }}
            placeholder="전체 유형"
            showAllOption={true}
            allOptionLabel="전체 유형"
            loading={initializing}
            isDarkMode={isDarkMode}
          />

          <CustomDropdown
            options={hospitalOptions}
            value={hospitalFilter}
            onChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value
              setHospitalFilter(v || '')
            }}
            placeholder="전체 병원"
            showAllOption={true}
            allOptionLabel="전체 병원"
            disabled={userRole !== 'super_admin'}
            loading={initializing}
            isDarkMode={isDarkMode}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={
              <Box
                component="img"
                src="/icons/ic_plus_fill.svg"
                sx={{
                  width: 14,
                  height: 14
                }}
              />
            }
            onClick={() => handleOpenModal()}
            sx={{
              bgcolor: isDarkMode ? colors.gray.gray600 : 'black',
              color: 'white',
              borderRadius: '20px',
              fontSize: '14px',
              height: 40,
              px: 2,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: isDarkMode ? colors.gray.gray500 : 'black',
                boxShadow: 'none',
              }
            }}
          >
            사용자 추가
          </Button>
        </Box>

        {/* Table - Scrollable Area */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          paddingLeft: '24px',
          paddingRight: '24px',
          minHeight: 0,
          // 다크 모드 스크롤바 스타일
          ...(isDarkMode && {
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: colors.gray.gray900,
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: colors.gray.gray1000,
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: colors.gray.gray800,
              },
            },
          }),
        }}>
          <Box
            sx={{
              backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
              borderRadius: '24px',
              overflow: 'hidden',
            }}
          >
          <StyledTableContainer isDarkMode={isDarkMode}>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={5} sx={{ padding: 0, border: 'none' }}>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 2,
                    borderRadius: '32px',
                    bgcolor: isDarkMode ? colors.gray.gray900 : colors.gray.gray200,
                    mx: 2,
                    mt: 1,
                    mb: 0,
                  }}>
                    <Box sx={{ flex: 0.8, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>유형</Box>
                    <Box sx={{ flex: 0.8, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>이름</Box>
                    <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>사용자 ID</Box>
                    <Box sx={{ flex: 1.4, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>사용 위치</Box>
                    <Box sx={{ flex: 1, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>관리</Box>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" sx={{ py: 3 }}>
                      데이터를 불러오는 중...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" sx={{ py: 3 }}>
                      데이터가 없습니다
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.slice((page - 1) * 10, page * 10).map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell colSpan={5} sx={{ padding: 0, border: 'none' }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        mx: 2,
                        my: 0,
                        borderBottom: index < filteredUsers.slice((page - 1) * 10, page * 10).length - 1 ? `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray200}` : 'none',
                      }}>
                        <Box sx={{ flex: 0.8 }}>
                          <Box sx={{
                            display: 'inline-block',
                            px: 0.8,
                            py: 0.8,
                            borderRadius: '8px',
                            bgcolor: `${getRoleColor(user.role)}${getRoleBackgroundOpacity(user.role)}`,
                            color: getRoleColor(user.role),
                            fontSize: '18px',
                            fontWeight: 600
                          }}>
                            {getRoleDisplayName(user.role)}
                          </Box>
                        </Box>
                        <Box sx={{ flex: 0.8, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.nickname}
                          {user.is_locked && (
                            <Box
                              component="img"
                              src="/icons/ic_lock.svg"
                              alt="locked"
                              sx={{
                                width: 16,
                                height: 16,
                                filter: isDarkMode
                                  ? 'brightness(0) saturate(100%) invert(92%) sepia(0%) saturate(1384%) hue-rotate(185deg) brightness(92%) contrast(91%)'
                                  : 'none'
                              }}
                            />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.auth_id || user.username}
                          {user.is_locked && (
                            <Box
                              component="img"
                              src="/icons/ic_lock.svg"
                              alt="locked"
                              sx={{
                                width: 16,
                                height: 16,
                                filter: isDarkMode
                                  ? 'brightness(0) saturate(100%) invert(92%) sepia(0%) saturate(1384%) hue-rotate(185deg) brightness(92%) contrast(91%)'
                                  : 'none'
                              }}
                            />
                          )}
                        </Box>
                        <Box sx={{ flex: 1.4, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800 }}>{getLocationString(user)}</Box>
                        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
                      {userRole === 'super_admin' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleUnlockAccount(user.id)}
                          disabled={!user.is_locked}
                          sx={{
                            mr: 1,
                            minWidth: 'auto',
                            height: '37px',
                            px: 2,
                            bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                            borderColor: user.is_locked
                              ? colors.mainColor.blue
                              : (isDarkMode ? colors.gray.gray600 : colors.gray.gray300),
                            color: user.is_locked
                              ? colors.mainColor.blue
                              : (isDarkMode ? colors.gray.gray600 : colors.gray.gray300),
                            borderRadius: '32px',
                            fontSize: '18px',
                            textTransform: 'none',
                            '&:hover': {
                              bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                              borderColor: user.is_locked ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray600 : colors.gray.gray300),
                            },
                            '&.Mui-disabled': {
                              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                              borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray300,
                              color: isDarkMode ? colors.gray.gray600 : colors.gray.gray300,
                            }
                          }}
                        >
                          잠금 해제
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenModal(user)}
                        sx={{
                          mr: 1,
                          minWidth: 'auto',
                          height: '37px',
                          px: 2,
                          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                          borderColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray300,
                          color: isDarkMode ? colors.gray.gray100 : colors.gray.gray600,
                          borderRadius: '32px',
                          fontSize: '18px',
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                            borderColor: isDarkMode ? colors.gray.gray400 : colors.gray.gray300,
                          }
                        }}
                      >
                        수정
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenDeleteModal(user)}
                        sx={{
                          minWidth: 'auto',
                          height: '37px',
                          px: 2,
                          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                          borderColor: colors.mainColor.red,
                          color: colors.mainColor.red,
                          borderRadius: '32px',
                          fontSize: '18px',
                          textTransform: 'none',
                          '&:hover': {
                            bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                            borderColor: colors.mainColor.red,
                          }
                        }}
                      >
                        삭제
                      </Button>
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 4, py: 2 }}>
            <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600, fontSize: '18px' }}>
              총 {filteredUsers.length}명 중 {Math.min((page - 1) * 10 + 1, filteredUsers.length)}-{Math.min(page * 10, filteredUsers.length)}명 표시
            </Typography>
            <Pagination
              count={Math.ceil(filteredUsers.length / 10)}
              page={page}
              onChange={handlePageChange}
              sx={{
                '& .MuiPaginationItem-root': {
                  fontSize: '18px',
                  color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600,
                  borderRadius: '50%',
                  minWidth: '40px',
                  height: '40px',
                  border: `1px solid ${isDarkMode ? colors.gray.gray600 : colors.gray.gray300}`,
                  '&.Mui-selected': {
                    bgcolor: colors.mainColor.blue,
                    color: 'white',
                    fontWeight: 600,
                    borderRadius: '50%',
                    border: `1px solid ${colors.mainColor.blue}`,
                    '&:hover': {
                      bgcolor: colors.mainColor.blue,
                    },
                  },
                  '&:hover': {
                    bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray200,
                  },
                },
              }}
              renderItem={(item) => (
                <PaginationItem
                  slots={{
                    first: FirstPageIcon,
                    previous: NavigateBeforeIcon,
                    next: NavigateNextIcon,
                    last: LastPageIcon,
                  }}
                  {...item}
                />
              )}
              showFirstButton
              showLastButton
            />
          </Box>
          </StyledTableContainer>
          </Box>
        </Box>

        {/* User Modal */}
        <AddUserModal
          open={openModal}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          editMode={!!editingUser}
          initialData={initialFormData}
          hospitals={hospitals}
          wards={wards}
          userRole={userRole}
          currentUserHospitalId={userInfo.hospital_id}
        />

        {/* Delete User Modal */}
        <DeleteUserModal
          open={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
          user={userToDelete}
        />
      </MainContent>
    </Box>
  )
}

export default UsersPage