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
  Paper,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress
} from '@mui/material'
import {
  Add as AddIcon
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown'
import SearchInput from '../components/SearchInput'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { dataProvider } from '../providers/dataProvider'
import { Hospital, Ward, Room, User } from '../types/models'
import AddHospitalModal from '../components/AddHospitalModal'
import AddWardModal from '../components/AddWardModal'
import AddRoomModal from '../components/AddRoomModal'

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

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ isDarkMode = false }) => ({
  borderRadius: '24px',
  boxShadow: 'none',
  border: 'none',
  backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  transition: 'background-color 0.3s ease',
}))

interface HospitalWithHierarchy extends Hospital {
  wards?: WardWithRooms[]
}

interface WardWithRooms extends Ward {
  rooms?: Room[]
}

const HospitalPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('전체 병원')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null)
  const [selectedWard, setSelectedWard] = useState<number | null>(null)
  const [hospitals, setHospitals] = useState<HospitalWithHierarchy[]>([])
  const [loading, setLoading] = useState(true)
  const [hospitalModalOpen, setHospitalModalOpen] = useState(false)
  const [wardModalOpen, setWardModalOpen] = useState(false)
  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editHospitalData, setEditHospitalData] = useState<{ id: number; name: string } | null>(null)
  const [editWardData, setEditWardData] = useState<{ id: number; name: string; hospitalId: number } | null>(null)
  const [editRoomData, setEditRoomData] = useState<{ id: number; name: string; bedCount: number; hospitalId: number; wardId: number; nurseId?: number } | null>(null)
  const [nurses, setNurses] = useState<User[]>([])

  // Get user role and hospital from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const userHospitalId = userInfo.hospital_id
  const hasDrawer = userRole !== 'nurse'

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        setLoading(true)
        const data = await dataProvider.getHospitalHierarchy()
        setHospitals(data)

        // 간호사 목록 조회
        try {
          const nurseRes = await dataProvider.getList<User>('users', { where: { role: 'nurse' }, limit: 1000 })
          const nurseList = nurseRes.items || nurseRes.data || []
          setNurses(nurseList)
        } catch (e) {
          console.error('Failed to fetch nurses:', e)
        }

        // admin은 자신의 병원으로 고정
        if (userRole === 'admin' && userHospitalId) {
          const userHospital = data.find((h: HospitalWithHierarchy) => h.id === userHospitalId)
          if (userHospital) {
            setSelectedHospital(userHospitalId)
            setViewMode(userHospital.name)
          }
        } else {
          // super_admin은 첫 번째 병원 선택
          if (data && data.length > 0) {
            setSelectedHospital(data[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch hospital hierarchy:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHierarchy()

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

  // viewMode가 변경되면 selectedHospital 재설정
  useEffect(() => {
    if (hospitals.length === 0) return

    const filteredByDropdown = (viewMode === '전체 병원' || viewMode === '')
      ? hospitals
      : hospitals.filter(h => h.name === viewMode)

    // 현재 선택된 병원이 필터링된 목록에 없으면 첫 번째 병원 선택
    if (filteredByDropdown.length > 0) {
      const isSelectedInFiltered = filteredByDropdown.some(h => h.id === selectedHospital)
      if (!isSelectedInFiltered) {
        setSelectedHospital(filteredByDropdown[0].id)
        setSelectedWard(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])



  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handleHospitalClick = (hospitalId: number) => {
    setSelectedHospital(hospitalId)
    setSelectedWard(null)
  }

  const handleWardClick = (wardId: number) => {
    setSelectedWard(wardId)
  }

  const handleAddHospital = async (hospitalName: string, hospitalId?: number) => {
    try {
      if (hospitalId) {
        await dataProvider.update('hospitals', hospitalId, { name: hospitalName })
      } else {
        await dataProvider.create('hospitals', { name: hospitalName })
      }
      const data = await dataProvider.getHospitalHierarchy()
      setHospitals(data)
      setEditHospitalData(null)
    } catch (error: any) {
      console.error('Failed to add/update hospital:', error)
      const message = error?.message || error?.response?.message || '병원 저장에 실패했습니다.'
      alert(message)
    }
  }

  const handleAddWard = async (hospitalId: number, wardName: string, wardId?: number) => {
    try {
      if (wardId) {
        await dataProvider.update('wards', wardId, { hospital_id: hospitalId, name: wardName })
      } else {
        await dataProvider.create('wards', { hospital_id: hospitalId, name: wardName })
      }
      const data = await dataProvider.getHospitalHierarchy()
      setHospitals(data)
      setEditWardData(null)
    } catch (error: any) {
      console.error('Failed to add/update ward:', error)
      const message = error?.message || error?.response?.message || '병동 저장에 실패했습니다.'
      alert(message)
    }
  }

  const handleAddRoom = async (hospitalId: number, wardId: number, roomName: string, bedCount: string, roomId?: number, nurseId?: number) => {
    try {
      const parsedBedCount = Math.min(6, Math.max(1, parseInt(bedCount) || 1))

      // 신규 추가 시 병동당 병실 12개 제한
      if (!roomId) {
        const wardData = hospitals.find(h => h.id === hospitalId)
          ?.wards?.find((w: any) => w.id === wardId)
        if (wardData && (wardData as any).rooms?.length >= 12) {
          alert('병동당 병실은 최대 12개까지 추가할 수 있습니다.')
          return
        }
      }

      let targetRoomId = roomId
      if (roomId) {
        await dataProvider.update('rooms', roomId, {
          ward_id: wardId,
          name: roomName,
          bed_count: parsedBedCount
        })
      } else {
        const created = await dataProvider.create<any>('rooms', {
          ward_id: wardId,
          name: roomName,
          bed_count: parsedBedCount
        })
        targetRoomId = created.id
      }

      // 간호사 배정 처리
      if (targetRoomId) {
        try {
          // 기존 활성 배정 조회
          const existingRes = await dataProvider.getList<any>('nurse_room_assignments', {
            where: { room_id: targetRoomId, is_active: 1 }
          })
          const allAssignments = existingRes.items || existingRes.data || []
          const existingAssignments = allAssignments.filter((a: any) => a.is_active === true || a.is_active === 1)

          // 기존 배정 해제
          for (const assignment of existingAssignments) {
            await dataProvider.update('nurse_room_assignments', assignment.id, {
              is_active: false,
              released_at: new Date().toISOString()
            })
          }

          // 새 간호사 배정
          if (nurseId) {
            await dataProvider.create('nurse_room_assignments', {
              user_id: nurseId,
              room_id: targetRoomId,
              is_active: true,
              assigned_at: new Date().toISOString()
            })
          }
        } catch (e) {
          console.error('Failed to update nurse assignment:', e)
        }
      }

      const data = await dataProvider.getHospitalHierarchy()
      setHospitals(data)
      setEditRoomData(null)
    } catch (error: any) {
      console.error('Failed to add/update room:', error)
      const message = error?.message || error?.response?.message || '병실 저장에 실패했습니다.'
      alert(message)
    }
  }

  const handleEditHospital = (hospital: HospitalWithHierarchy) => {
    setEditHospitalData({ id: hospital.id, name: hospital.name || '' })
    setHospitalModalOpen(true)
  }

  const handleEditWard = (ward: Ward, hospitalId: number) => {
    setEditWardData({ id: ward.id, name: ward.name || '', hospitalId })
    setWardModalOpen(true)
  }

  const handleEditRoom = async (room: Room, hospitalId: number, wardId: number) => {
    let nurseId: number | undefined
    try {
      const assignRes = await dataProvider.getList<any>('nurse_room_assignments', {
        where: { room_id: room.id, is_active: 1 }
      })
      const assignments = assignRes.items || assignRes.data || []
      const activeAssignment = assignments.find((a: any) => a.is_active === true || a.is_active === 1)
      if (activeAssignment) {
        nurseId = activeAssignment.user_id
      }
    } catch (e) {
      console.error('Failed to fetch nurse assignment:', e)
    }
    setEditRoomData({
      id: room.id,
      name: room.name || '',
      bedCount: room.bed_count || 0,
      hospitalId,
      wardId,
      nurseId
    })
    setRoomModalOpen(true)
  }

  const handleCloseHospitalModal = () => {
    setHospitalModalOpen(false)
    setEditHospitalData(null)
  }

  const handleCloseWardModal = () => {
    setWardModalOpen(false)
    setEditWardData(null)
  }

  const handleCloseRoomModal = () => {
    setRoomModalOpen(false)
    setEditRoomData(null)
  }

  const handleDeleteHospital = async (hospitalId: number) => {
    if (window.confirm('정말로 이 병원을 삭제하시겠습니까?')) {
      try {
        await dataProvider.delete('hospitals', hospitalId)
        const data = await dataProvider.getHospitalHierarchy()
        setHospitals(data)
        if (selectedHospital === hospitalId) {
          setSelectedHospital(null)
          setSelectedWard(null)
        }
      } catch (error: any) {
        console.error('Failed to delete hospital:', error)
        const message = error?.message || error?.response?.message || '병원 삭제에 실패했습니다.'
        alert(message)
      }
    }
  }

  const handleDeleteWard = async (wardId: number) => {
    if (window.confirm('정말로 이 병동을 삭제하시겠습니까?')) {
      try {
        await dataProvider.delete('wards', wardId)
        const data = await dataProvider.getHospitalHierarchy()
        setHospitals(data)
        if (selectedWard === wardId) {
          setSelectedWard(null)
        }
      } catch (error: any) {
        console.error('Failed to delete ward:', error)
        const message = error?.message || error?.response?.message || '병동 삭제에 실패했습니다.'
        alert(message)
      }
    }
  }

  const handleDeleteRoom = async (roomId: number) => {
    if (window.confirm('정말로 이 병실을 삭제하시겠습니까?')) {
      try {
        await dataProvider.delete('rooms', roomId)
        const data = await dataProvider.getHospitalHierarchy()
        setHospitals(data)
      } catch (error: any) {
        console.error('Failed to delete room:', error)
        const message = error?.message || error?.response?.message || '병실 삭제에 실패했습니다.'
        alert(message)
      }
    }
  }

  // 드롭다운 필터링
  const filteredByDropdown = (viewMode === '전체 병원' || viewMode === '')
    ? hospitals
    : hospitals.filter(h => h.name === viewMode)

  // 검색어 필터링
  const searchFiltered = filteredByDropdown.filter(hospital => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()

    // 병원 이름 검색
    if (hospital.name?.toLowerCase().includes(searchLower)) return true

    // 병동 이름 검색
    const hasMatchingWard = hospital.wards?.some(ward =>
      ward.name?.toLowerCase().includes(searchLower)
    )
    if (hasMatchingWard) return true

    // 병실 이름 검색
    const hasMatchingRoom = hospital.wards?.some(ward =>
      ward.rooms?.some(room => room.name?.toLowerCase().includes(searchLower))
    )
    if (hasMatchingRoom) return true

    return false
  })

  const selectedHospitalData = searchFiltered.find(h => h.id === selectedHospital)
  const filteredWards = selectedHospitalData?.wards || []

  const selectedWardData = filteredWards.find(w => w.id === selectedWard)
  const filteredRooms = selectedWardData?.rooms || []

  // Dropdown options
  const hospitalOptions: DropdownOption[] = hospitals.map(h => ({ id: h.name || '', label: h.name || '' }))

  // 디버깅용
  // console.log('viewMode:', viewMode)
  // console.log('hospitals.length:', hospitals.length)
  // console.log('filteredByDropdown.length:', filteredByDropdown.length)
  // console.log('searchTerm:', searchTerm)
  // console.log('searchFiltered.length:', searchFiltered.length)
  // console.log('searchFiltered:', searchFiltered.map(h => ({ id: h.id, name: h.name })))
  // console.log('selectedHospital:', selectedHospital)
  // console.log('selectedWard:', selectedWard)
  // console.log('selectedWardData:', selectedWardData)
  // console.log('filteredRooms:', filteredRooms)

  if (loading) {
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        </MainContent>
      </Box>
    )
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
        {/* Header with search and filter */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, paddingLeft: '24px', paddingRight: '24px' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="병원/병동/병실 이름 검색"
            isDarkMode={isDarkMode}
            flex="0 0 calc(25% - 8px)"
          />

          <CustomDropdown
            options={hospitalOptions}
            value={viewMode}
            onChange={(value) => setViewMode(Array.isArray(value) ? value[0] : value)}
            placeholder="전체 병원"
            showAllOption={true}
            allOptionLabel="전체 병원"
            isDarkMode={isDarkMode}
            disabled={userRole === 'admin'}
          />
        </Box>

        {/* Three column layout - Scrollable Area */}
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, alignItems: 'start' }}>
          {/* 병원 목록 */}
          <StyledCard isDarkMode={isDarkMode}>
            <CardHeader
              title="병원 목록"
              action={
                userRole !== 'admin' && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setHospitalModalOpen(true)}
                    startIcon={
                      <Box
                        component="img"
                        src="/icons/ic_plus.svg"
                        sx={{
                          width: 20,
                          height: 20,
                          filter: 'invert(35%) sepia(92%) saturate(2537%) hue-rotate(198deg) brightness(96%) contrast(101%)'
                        }}
                      />
                    }
                    sx={{
                      bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                      borderColor: colors.mainColor.blue,
                      color: colors.mainColor.blue,
                      borderRadius: '32px',
                      fontSize: '18px',
                      height: '37px',
                      px: 2,
                      textTransform: 'none',
                      boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                      '& .MuiButton-startIcon': {
                        marginRight: '2px',
                      },
                      '&:hover': {
                        bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                        borderColor: colors.mainColor.blue,
                        boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                      }
                    }}
                  >
                    병원 추가
                  </Button>
                )
              }
              sx={{
                borderBottom: `1px solid ${isDarkMode ? colors.gray.gray900 : colors.gray.gray200}`,
                display: 'flex',
                alignItems: 'center',
                height: '72px',
                px: 3,
                '& .MuiCardHeader-content': {
                  flex: 1,
                },
                '& .MuiCardHeader-action': {
                  margin: 0,
                  alignSelf: 'center',
                },
                '& .MuiCardHeader-title': {
                  fontSize: '18px',
                  fontWeight: 500,
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray800,
                },
              }}
            />
            <CardContent sx={{
              maxHeight: '600px',
              overflowY: 'auto',
              px: 3,
              py: 0,
              pt: 0,
              // 다크 모드 스크롤바 스타일
              ...(isDarkMode && {
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: colors.gray.gray1000,
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: colors.gray.gray600,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: colors.gray.gray500,
                  },
                },
              }),
            }}>
              <List>
                {searchFiltered.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    검색 결과가 없습니다
                  </Box>
                ) : (
                  searchFiltered.map((hospital, index) => (
                    <ListItem
                      key={hospital.id}
                      disablePadding
                    >
                      <ListItemButton
                        selected={selectedHospital === hospital.id}
                        onClick={() => handleHospitalClick(hospital.id)}
                        sx={{
                          borderRadius: '24px',
                          height: '70px',
                          borderLeft: selectedHospital === hospital.id ? `4px solid ${colors.mainColor.blue}` : '4px solid transparent',
                          borderBottom: index < searchFiltered.length - 1 ? `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray200}` : 'none',
                          '&.Mui-selected': {
                            backgroundColor: `${colors.mainColor.blue}14`,
                            '&:hover': {
                              backgroundColor: `${colors.mainColor.blue}1F`,
                            },
                          },
                          '&:hover': {
                            backgroundColor: 'var(--bg-secondary)',
                          },
                        }}
                      >
                        {selectedHospital === hospital.id && (
                          <Box
                            sx={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: colors.mainColor.blue,
                              mr: 1.5,
                            }}
                          />
                        )}
                        <ListItemText
                          primary={hospital.name}
                          primaryTypographyProps={{
                            fontSize: '18px',
                            color: selectedHospital === hospital.id ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray300 : colors.gray.gray600),
                            fontWeight: selectedHospital === hospital.id ? 'bold' : 'normal'
                          }}
                        />
                        {userRole === 'super_admin' && (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditHospital(hospital)
                              }}
                              sx={{
                                mr: 1,
                                minWidth: 'auto',
                                height: '37px',
                                px: 1.5,
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
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteHospital(hospital.id)
                              }}
                              sx={{
                                minWidth: 'auto',
                                height: '37px',
                                px: 1.5,
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
                          </>
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </StyledCard>

          {/* 병동 목록 */}
          <StyledCard isDarkMode={isDarkMode}>
            <CardHeader
              title="병동 목록"
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setWardModalOpen(true)}
                  startIcon={
                    <Box
                      component="img"
                      src="/icons/ic_plus.svg"
                      sx={{
                        width: 20,
                        height: 20,
                        filter: selectedHospital
                          ? 'invert(35%) sepia(92%) saturate(2537%) hue-rotate(198deg) brightness(96%) contrast(101%)'
                          : 'invert(80%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(85%)'
                      }}
                    />
                  }
                  disabled={!selectedHospital}
                  sx={{
                    bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                    borderColor: colors.mainColor.blue,
                    color: colors.mainColor.blue,
                    borderRadius: '32px',
                    fontSize: '18px',
                    height: '37px',
                    px: 2,
                    textTransform: 'none',
                    boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                    '& .MuiButton-startIcon': {
                      marginRight: '2px',
                    },
                    '&:hover': {
                      bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                      borderColor: colors.mainColor.blue,
                      boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                    },
                    '&:disabled': {
                      bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                      borderColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray300,
                      color: isDarkMode ? colors.gray.gray700 : colors.gray.gray400,
                      boxShadow: 'none',
                      opacity: isDarkMode ? 0.5 : 1,
                    }
                  }}
                >
                  병동 추가
                </Button>
              }
              sx={{
                borderBottom: `1px solid ${isDarkMode ? colors.gray.gray900 : colors.gray.gray200}`,
                display: 'flex',
                alignItems: 'center',
                height: '72px',
                px: 3,
                '& .MuiCardHeader-content': {
                  flex: 1,
                },
                '& .MuiCardHeader-action': {
                  margin: 0,
                  alignSelf: 'center',
                },
                '& .MuiCardHeader-title': {
                  fontSize: '18px',
                  fontWeight: 500,
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray800,
                },
              }}
            />
            <CardContent sx={{
              maxHeight: '600px',
              overflowY: 'auto',
              px: 3,
              py: 0,
              pt: 0,
              // 다크 모드 스크롤바 스타일
              ...(isDarkMode && {
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: colors.gray.gray1000,
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: colors.gray.gray600,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: colors.gray.gray500,
                  },
                },
              }),
            }}>
              {filteredWards.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  {!selectedHospital ? '병원을 선택하세요' : '병동이 없습니다'}
                </Box>
              ) : (
                <List>
                  {filteredWards.map((ward, index) => (
                    <ListItem
                      key={ward.id}
                      disablePadding
                    >
                      <ListItemButton
                        selected={selectedWard === ward.id}
                        onClick={() => handleWardClick(ward.id)}
                        sx={{
                          borderRadius: '24px',
                          height: '70px',
                          borderLeft: selectedWard === ward.id ? `4px solid ${colors.mainColor.blue}` : '4px solid transparent',
                          borderBottom: index < filteredWards.length - 1 ? `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray200}` : 'none',
                          '&.Mui-selected': {
                            backgroundColor: `${colors.mainColor.blue}14`,
                            '&:hover': {
                              backgroundColor: `${colors.mainColor.blue}1F`,
                            },
                          },
                          '&:hover': {
                            backgroundColor: 'var(--bg-secondary)',
                          },
                        }}
                      >
                        {selectedWard === ward.id && (
                          <Box
                            sx={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: colors.mainColor.blue,
                              mr: 1.5,
                            }}
                          />
                        )}
                        <ListItemText
                          primary={ward.name}
                          primaryTypographyProps={{
                            fontSize: '18px',
                            color: selectedWard === ward.id ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray300 : colors.gray.gray600),
                            fontWeight: selectedWard === ward.id ? 'bold' : 'normal'
                          }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditWard(ward, selectedHospital!)
                          }}
                          sx={{
                            mr: 1,
                            minWidth: 'auto',
                            height: '37px',
                            px: 1.5,
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
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteWard(ward.id)
                          }}
                          sx={{
                            minWidth: 'auto',
                            height: '37px',
                            px: 1.5,
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
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </StyledCard>

          {/* 병실 목록 */}
          <StyledCard isDarkMode={isDarkMode}>
            <CardHeader
              title="병실 목록"
              action={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setRoomModalOpen(true)}
                  startIcon={
                    <Box
                      component="img"
                      src="/icons/ic_plus.svg"
                      sx={{
                        width: 20,
                        height: 20,
                        filter: selectedWard
                          ? 'invert(35%) sepia(92%) saturate(2537%) hue-rotate(198deg) brightness(96%) contrast(101%)'
                          : 'invert(80%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(85%)'
                      }}
                    />
                  }
                  disabled={!selectedWard || filteredRooms.length >= 12}
                  sx={{
                    bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                    borderColor: colors.mainColor.blue,
                    color: colors.mainColor.blue,
                    borderRadius: '32px',
                    fontSize: '18px',
                    height: '37px',
                    px: 2,
                    textTransform: 'none',
                    boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                    '& .MuiButton-startIcon': {
                      marginRight: '2px',
                    },
                    '&:hover': {
                      bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                      borderColor: colors.mainColor.blue,
                      boxShadow: `0px 0px 12px ${colors.mainColor.blue}20`,
                    },
                    '&:disabled': {
                      bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                      borderColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray300,
                      color: isDarkMode ? colors.gray.gray700 : colors.gray.gray400,
                      boxShadow: 'none',
                      opacity: isDarkMode ? 0.5 : 1,
                    }
                  }}
                >
                  병실 추가 ({filteredRooms.length}/12)
                </Button>
              }
              sx={{
                borderBottom: `1px solid ${isDarkMode ? colors.gray.gray900 : colors.gray.gray200}`,
                display: 'flex',
                alignItems: 'center',
                height: '72px',
                px: 3,
                '& .MuiCardHeader-content': {
                  flex: 1,
                },
                '& .MuiCardHeader-action': {
                  margin: 0,
                  alignSelf: 'center',
                },
                '& .MuiCardHeader-title': {
                  fontSize: '18px',
                  fontWeight: 500,
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray800,
                },
              }}
            />
            <CardContent sx={{
              maxHeight: '600px',
              overflowY: 'auto',
              px: 3,
              py: 0,
              pt: 0,
              // 다크 모드 스크롤바 스타일
              ...(isDarkMode && {
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: colors.gray.gray1000,
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: colors.gray.gray600,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: colors.gray.gray500,
                  },
                },
              }),
            }}>
              {filteredRooms.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  {!selectedWard ? '병동을 선택하세요' : '병실이 없습니다'}
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {filteredRooms.map((room, index) => (
                        <TableRow
                          key={room.id}
                          hover
                          sx={{
                            height: '70px',
                            '& td': {
                              borderBottom: index < filteredRooms.length - 1 ? `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray200}` : 'none'
                            }
                          }}
                        >
                          <TableCell sx={{ fontSize: '18px', color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600 }}>{room.name}</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleEditRoom(room, selectedHospital!, selectedWard!)}
                              sx={{
                                mr: 1,
                                minWidth: 'auto',
                                height: '37px',
                                px: 1.5,
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
                              onClick={() => handleDeleteRoom(room.id)}
                              sx={{
                                minWidth: 'auto',
                                height: '37px',
                                px: 1.5,
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </StyledCard>
          </Box>
        </Box>

        {/* Modals */}
        <AddHospitalModal
          open={hospitalModalOpen}
          onClose={handleCloseHospitalModal}
          onSubmit={handleAddHospital}
          editMode={!!editHospitalData}
          initialName={editHospitalData?.name}
          hospitalId={editHospitalData?.id}
        />

        <AddWardModal
          open={wardModalOpen}
          onClose={handleCloseWardModal}
          onSubmit={handleAddWard}
          hospitals={hospitals}
          selectedHospitalId={editWardData?.hospitalId || selectedHospital || undefined}
          editMode={!!editWardData}
          initialName={editWardData?.name}
          wardId={editWardData?.id}
          disableHospitalSelect={userRole === 'admin'}
        />

        <AddRoomModal
          open={roomModalOpen}
          onClose={handleCloseRoomModal}
          onSubmit={handleAddRoom}
          hospitals={hospitals}
          nurses={nurses.filter(n => {
            const nurseHospitalId = n.hospital_id ? Number(n.hospital_id) : null
            const currentHospitalId = editRoomData?.hospitalId || selectedHospital
            return !nurseHospitalId || nurseHospitalId === currentHospitalId
          })}
          selectedHospitalId={editRoomData?.hospitalId || selectedHospital || undefined}
          selectedWardId={editRoomData?.wardId || selectedWard || undefined}
          selectedNurseId={editRoomData?.nurseId}
          editMode={!!editRoomData}
          initialRoomName={editRoomData?.name}
          initialBedCount={editRoomData?.bedCount.toString()}
          roomId={editRoomData?.id}
          disableHospitalSelect={userRole === 'admin'}
        />
      </MainContent>
    </Box>
  )
}

export default HospitalPage