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
import AddDeviceModal from '../components/AddDeviceModal'
import DeleteDeviceModal from '../components/DeleteDeviceModal'
import DeviceQRCodeModal from '../components/DeviceQRCodeModal'
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown'
import SearchInput from '../components/SearchInput'
import { dataProvider } from '../providers/dataProvider'
import { useGlobalContext } from '../contexts/GlobalContext'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import * as XLSX from 'xlsx'

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
  borderRadius: '24px',
  boxShadow: 'none',
  border: 'none',
  backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  overflow: 'hidden',
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

interface Device {
  id: number
  device_code: string
  device_name: string
  serial_number: string
  firmware_version?: string
  battery_level?: number
  battery_percent?: number
  is_connected: boolean
  network_status?: string
  last_connected?: string
  last_udpate_at?: string
  hospital_id?: number
  ward_id?: number
  room_id?: number
  bed_id?: number
  bed_number?: string
  created_at?: string
  updated_at?: string
  // API에서 반환하는 관계 객체들
  bed?: {
    id: number
    bed_number: string
    room?: {
      id: number
      name: string
      room_number?: string
    }
  }
  room_number?: string
  room?: {
    id: number
    name: string
    room_number?: string
  }
  ward?: {
    id: number
    name: string
  }
  hospital?: {
    id: number
    name: string
  }
}

const DevicesPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const [searchTerm, setSearchTerm] = useState('')
  const [hospitalFilter, setHospitalFilter] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [page, setPage] = useState(1)
  const [devices, setDevices] = useState<Device[]>([])
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editDeviceData, setEditDeviceData] = useState<{ id: number; device_name: string; serial_number: string; firmware_version: string; hospital_id: string; ward_id: string } | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isQRMode, setIsQRMode] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState<number[]>([])
  const [qrModalOpen, setQRModalOpen] = useState(false)

  // Get user role from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const hasDrawer = userRole !== 'nurse'

  // Get global context
  const { hospitals, wards, rooms, loadHospitals, loadWards, loadRooms } = useGlobalContext()

  // Filter wards based on selected hospital
  const filteredWards = hospitalFilter
    ? wards.filter(w => w.hospital_id === parseInt(hospitalFilter))
    : wards

  // Filter rooms based on selected ward
  const filteredRooms = wardFilter
    ? rooms.filter(r => r.ward_id === parseInt(wardFilter))
    : rooms

  // 드롭다운 옵션 변환
  const hospitalOptions: DropdownOption[] = [
    ...hospitals.map(h => ({ id: h.id, label: h.name })),
    { id: 'unregistered', label: '미등록' } // hospital_id가 null인 기기
  ]
  const wardOptions: DropdownOption[] = filteredWards.map(w => ({ id: w.id, label: w.name }))
  const roomOptions: DropdownOption[] = filteredRooms.map(r => ({ id: r.id, label: r.room_number }))

  // Load devices on mount and remove HTML loader
  useEffect(() => {
    // GlobalContext 데이터 로딩
    loadHospitals()
    loadWards()
    loadRooms()

    loadDevices()

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

  // Set user's hospital/ward on mount
  useEffect(() => {
    if (userRole !== 'super_admin' && userInfo.hospital_id && !hospitalFilter) {
      setHospitalFilter(userInfo.hospital_id.toString())
    }
  }, [userRole, userInfo.hospital_id])

  useEffect(() => {
    if (userRole !== 'super_admin' && userInfo.ward_id && filteredWards.length > 0 && !wardFilter) {
      setWardFilter(userInfo.ward_id.toString())
    }
  }, [userRole, userInfo.ward_id, filteredWards])

  // Apply filters whenever devices or filter values change
  useEffect(() => {
    applyFilters()
    // 검색이나 필터가 변경되면 첫 페이지로 이동
    setPage(1)
  }, [devices, searchTerm, hospitalFilter, wardFilter, roomFilter])

  const loadDevices = async () => {
    setLoading(true)
    try {
      let allDevices: Device[] = []
      let currentPage = 1
      let hasMore = true

      // admin/nurse인 경우 병원 ID로 필터링
      const whereCondition: Record<string, any> = {}
      if (userRole !== 'super_admin' && userInfo.hospital_id) {
        whereCondition.hospital_id = userInfo.hospital_id
      }

      // console.log('==== Loading Devices ====')
      // console.log('User Role:', userRole)
      // console.log('Where Condition:', whereCondition)

      while (hasMore) {
        // console.log(`Fetching page ${currentPage}...`)
        const response = await dataProvider.getList('devices', {
          page: currentPage,
          limit: 100,
          where: whereCondition,
          order: 'id:desc'
        })

        // console.log(`Page ${currentPage} response:`, response)
        // console.log(`Page ${currentPage} pagination info:`, response.pagination)

        if (response.data && Array.isArray(response.data)) {
          allDevices = [...allDevices, ...response.data as Device[]]
          // console.log(`Page ${currentPage}: received ${response.data.length} devices, total so far: ${allDevices.length}`)

          // 더 이상 데이터가 없으면 중단
          if (response.data.length === 0) {
            hasMore = false
          } else if (response.pagination && response.pagination.total) {
            // total이 있으면 그것으로 판단
            // console.log(`Total from API: ${response.pagination.total}`)
            if (allDevices.length >= response.pagination.total) {
              hasMore = false
            } else {
              currentPage++
            }
          } else if (response.data.length < 100) {
            // 받은 데이터가 100개 미만이면 마지막 페이지
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

      // console.log(`Total devices loaded: ${allDevices.length}`)
      setDevices(allDevices)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...devices]

    // Search filter (대소문자 구분)
    if (searchTerm) {
      filtered = filtered.filter(device =>
        (device.device_name && device.device_name.includes(searchTerm)) ||
        (device.serial_number && device.serial_number.includes(searchTerm))
      )
    }

    // Hospital filter - super_admin만 프론트엔드에서 필터링 (admin/nurse는 이미 API에서 필터됨)
    if (hospitalFilter && userRole === 'super_admin') {
      if (hospitalFilter === 'unregistered') {
        // '미등록' 선택 시: hospital_id가 null인 기기만 표시
        filtered = filtered.filter(device => {
          const hospitalId = device.hospital?.id || device.hospital_id
          return hospitalId === null || hospitalId === undefined
        })
      } else {
        // 특정 병원 선택 시: 해당 병원의 기기만 표시
        filtered = filtered.filter(device => {
          const hospitalId = device.hospital?.id || device.hospital_id
          return hospitalId === parseInt(hospitalFilter)
        })
      }
    }

    // Ward filter - 병동 필터링 (위치 기반)
    if (wardFilter) {
      filtered = filtered.filter(device => {
        const wardId = device.ward?.id || device.ward_id
        return wardId === parseInt(wardFilter)
      })
    }

    // Room filter - 병실 필터링 (위치 기반)
    if (roomFilter) {
      filtered = filtered.filter(device => {
        const roomId = device.room?.id || device.room_id
        return roomId === parseInt(roomFilter)
      })
    }

    setFilteredDevices(filtered)
  }

  const getLocationString = (device: Device) => {
    const bedNumber = device.bed_number || device.bed?.bed_number
    const roomId = device.room_id || device.room?.id || device.bed?.room?.id

    if (!roomId) return '-'

    const room = rooms.find(r => r.id === roomId)
    if (room) {
      return bedNumber ? `${room.room_number}-${bedNumber}` : room.room_number
    }

    // rooms 목록에 없는 경우 서버에서 받은 room_number 사용
    const roomName = device.room_number || device.bed?.room?.name
    if (roomName) {
      return bedNumber ? `${roomName}-${bedNumber}` : roomName
    }

    return '-'
  }

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
  }

  const getBatteryIcon = (batteryPercent?: number, isDark?: boolean) => {
    const suffix = isDark ? '_dark.svg' : '.svg'

    if (batteryPercent === undefined || batteryPercent === null) return `/icons/ic_battery${suffix}`

    if (batteryPercent === 0) return `/icons/ic_battery${suffix}`
    if (batteryPercent >= 1 && batteryPercent <= 24) return `/icons/ic_battery_1${suffix}`
    if (batteryPercent >= 25 && batteryPercent <= 50) return `/icons/ic_battery_2${suffix}`
    if (batteryPercent >= 51 && batteryPercent <= 74) return `/icons/ic_battery_3${suffix}`
    if (batteryPercent >= 75 && batteryPercent <= 100) return `/icons/ic_battery_4${suffix}`

    return `/icons/ic_battery${suffix}`
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'

    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  const handleOpenDeleteModal = (device: Device) => {
    setDeviceToDelete(device)
    setDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false)
    setDeviceToDelete(null)
    setDeleteError(null)
    setDeleteLoading(false)
  }

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return
    setDeleteLoading(true)

    try {
      await dataProvider.delete('devices', deviceToDelete.id)
      loadDevices()
      handleCloseDeleteModal()
    } catch (error: any) {
      console.error('Failed to delete device:', error)
      const message = error?.message || error?.response?.message || '기기 삭제에 실패했습니다.'
      setDeleteError(message)
      setDeleteLoading(false)
    }
  }

  const handleForceDelete = async () => {
    if (!deviceToDelete) return
    setDeleteLoading(true)
    setDeleteError(null)

    try {
      // 1. 해당 기기에 연결된 active assignment 조회
      const res = await dataProvider.getList<{ id: number; released_at: string | null }>('patient_bed_assignments', {
        where: `device_id:${deviceToDelete.id}`,
        limit: 100,
      })

      const assignments = (res.data || []).filter(a => !a.released_at)

      // 2. 각 assignment의 수액-기기 연결 해제 (clear-infusion)
      for (const assignment of assignments) {
        try {
          await dataProvider.clearInfusion(assignment.id)
        } catch (e) {
          console.error(`Failed to clear infusion for assignment ${assignment.id}:`, e)
          // clear-infusion 실패 시 직접 device_id null 업데이트 시도
          try {
            await dataProvider.update('patient_bed_assignments', assignment.id, { device_id: null })
          } catch (e2) {
            console.error(`Failed to disconnect assignment ${assignment.id}:`, e2)
          }
        }
      }

      // 3. 기기의 bed_id 초기화 (서버 삭제 검증 통과를 위해)
      try {
        await dataProvider.update('devices', deviceToDelete.id, { bed_id: null, room_id: null })
      } catch (e) {
        console.error('Failed to clear device bed_id:', e)
      }

      // 4. 기기 삭제 재시도
      await dataProvider.delete('devices', deviceToDelete.id)
      loadDevices()
      handleCloseDeleteModal()
    } catch (error: any) {
      console.error('Failed to force delete device:', error)
      const message = error?.message || error?.response?.message || '강제 삭제에 실패했습니다.'
      setDeleteError(message)
      setDeleteLoading(false)
    }
  }

  const handleAddDevice = async (data: { device_name: string; serial_number: string; firmware_version: string; hospital_id: string; ward_id: string }) => {
    try {
      if (editDeviceData) {
        // 수정
        const updateData: any = {
          device_name: data.device_name,
          serial_number: data.serial_number,
          firmware_version: data.firmware_version,
          hospital_id: data.hospital_id && data.hospital_id !== '' ? parseInt(data.hospital_id) : null,
          ward_id: data.ward_id && data.ward_id !== '' ? parseInt(data.ward_id) : null
        }

        await dataProvider.update('devices', editDeviceData.id, updateData)
      } else {
        // 추가 - network_status를 offline으로 설정
        const deviceData: any = {
          device_name: data.device_name,
          serial_number: data.serial_number,
          firmware_version: data.firmware_version,
          hospital_id: data.hospital_id && data.hospital_id !== '' ? parseInt(data.hospital_id) : null,
          ward_id: data.ward_id && data.ward_id !== '' ? parseInt(data.ward_id) : null,
          network_status: 'offline'
        }

        await dataProvider.create('devices', deviceData)
      }
      loadDevices()
      handleCloseModal()
    } catch (error: any) {
      console.error('Failed to add/update device:', error)
      const message = error?.message || error?.response?.message || '기기 저장에 실패했습니다.'
      alert(message)
    }
  }

  const handleEditDevice = (device: Device) => {
    setEditDeviceData({
      id: device.id,
      device_name: device.device_name || '',
      serial_number: device.serial_number || '',
      firmware_version: device.firmware_version || '',
      hospital_id: device.hospital_id?.toString() || device.hospital?.id?.toString() || '',
      ward_id: device.ward_id?.toString() || device.ward?.id?.toString() || ''
    })
    setAddModalOpen(true)
  }

  const handleCloseModal = () => {
    setAddModalOpen(false)
    setEditDeviceData(null)
  }

  const handleExportToExcel = () => {
    // 엑셀로 출력할 데이터 준비
    const excelData = filteredDevices.map(device => ({
      '기기명': device.device_name || '-',
      '시리얼 넘버': device.serial_number || '-',
      '네트워크': device.network_status === 'offline' ? '오프라인' : '온라인',
      '배터리 (%)': device.network_status === 'offline'
        ? '-'
        : (device.battery_percent !== undefined && device.battery_percent !== null ? device.battery_percent : '-'),
      '최종 업데이트': formatDateTime(device.last_udpate_at),
      '펌웨어': device.firmware_version || '-',
      '위치': getLocationString(device)
    }))

    // 워크시트 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData)

    // 워크북 생성
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '기기 목록')

    // 파일명 생성 (기기목록_YYYYMMDD_HHMM.xlsx)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const filename = `기기목록_${year}${month}${day}_${hours}${minutes}.xlsx`

    // 파일 다운로드
    XLSX.writeFile(workbook, filename)
  }

  const handleQRCode = () => {
    if (!isQRMode) {
      // 첫 클릭: QR 모드 활성화
      setIsQRMode(true)
      setSelectedDevices([])
    } else if (selectedDevices.length > 0) {
      // 기기 선택 후 클릭: QR 코드 모달 표시
      setQRModalOpen(true)
    } else {
      // 0개 선택된 상태에서 다시 클릭: QR 모드 해제
      setIsQRMode(false)
    }
  }

  const handleDeviceSelect = (deviceId: number) => {
    if (isQRMode) {
      if (selectedDevices.includes(deviceId)) {
        setSelectedDevices(selectedDevices.filter(id => id !== deviceId))
      } else {
        setSelectedDevices([...selectedDevices, deviceId])
      }
    }
  }

  const handleCloseQRModal = () => {
    setQRModalOpen(false)
  }

  // QR 모드 취소
  const handleCancelQRMode = () => {
    setIsQRMode(false)
    setSelectedDevices([])
  }

  // ESC 키로 QR 모드 취소
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isQRMode) {
        handleCancelQRMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isQRMode])

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
            placeholder="기기명 또는 시리얼 넘버 검색"
            isDarkMode={isDarkMode}
            minWidth={300}
          />

          <CustomDropdown
            options={hospitalOptions}
            value={hospitalFilter}
            onChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value
              setHospitalFilter(v || '')
              setWardFilter('')
              setRoomFilter('')
            }}
            placeholder="전체 병원"
            showAllOption={true}
            allOptionLabel="전체 병원"
            disabled={userRole !== 'super_admin'}
            isDarkMode={isDarkMode}
          />

          <CustomDropdown
            options={wardOptions}
            value={wardFilter}
            onChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value
              setWardFilter(v || '')
              setRoomFilter('')
            }}
            placeholder="전체 병동"
            showAllOption={true}
            allOptionLabel="전체 병동"
            disabled={!hospitalFilter || hospitalFilter === 'unregistered' || (userRole !== 'super_admin' && !!userInfo.ward_id)}
            isDarkMode={isDarkMode}
          />

          <CustomDropdown
            options={roomOptions}
            value={roomFilter}
            onChange={(value) => {
              const v = Array.isArray(value) ? value[0] : value
              setRoomFilter(v || '')
            }}
            placeholder="전체 병실"
            showAllOption={true}
            allOptionLabel="전체 병실"
            disabled={!wardFilter}
            isDarkMode={isDarkMode}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={
              <Box
                component="img"
                src="/icons/ic_qr_code.svg"
                sx={{
                  width: 18,
                  height: 18,
                  filter: isQRMode
                    ? 'brightness(0) saturate(100%) invert(79%) sepia(13%) saturate(1426%) hue-rotate(42deg) brightness(94%) contrast(86%)'
                    : 'none'
                }}
              />
            }
            onClick={handleQRCode}
            sx={{
              background: isQRMode
                ? 'rgba(142, 206, 75, 0.16)'
                : colors.mainColor.green,
              color: isQRMode ? colors.mainColor.green : 'white',
              border: isQRMode ? `1px solid ${colors.mainColor.green}` : 'none',
              borderRadius: '20px',
              fontSize: '14px',
              height: 40,
              px: 2,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: isQRMode
                ? '0px 0px 14px 0px rgba(142, 206, 75, 0.5)'
                : 'none',
              '&:hover': {
                background: isQRMode
                  ? 'rgba(142, 206, 75, 0.16)'
                  : colors.mainColor.green,
                opacity: isQRMode ? 1 : 0.9,
                boxShadow: isQRMode
                  ? '0px 0px 14px 0px rgba(142, 206, 75, 0.5)'
                  : 'none',
              }
            }}
          >
            {isQRMode
              ? `기기 QR 인쇄 (${selectedDevices.length}개 선택됨)`
              : 'QR 코드'}
          </Button>

          {/* QR 모드 취소 버튼 */}
          {isQRMode && (
            <Button
              variant="outlined"
              onClick={handleCancelQRMode}
              sx={{
                minWidth: 'auto',
                height: 40,
                borderRadius: '20px',
                px: 2,
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'none',
                color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600,
                borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                '&:hover': {
                  borderColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray500,
                  bgcolor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                }
              }}
            >
              취소
            </Button>
          )}

          <Button
            variant="contained"
            onClick={handleExportToExcel}
            startIcon={
              <Box
                component="img"
                src="/icons/ic_file_excel.svg"
                sx={{
                  width: 20,
                  height: 20
                }}
              />
            }
            sx={{
              bgcolor: colors.mainColor.blue,
              color: 'white',
              borderRadius: '20px',
              fontSize: '14px',
              height: 40,
              px: 2,
              textTransform: 'none',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.blue,
                opacity: 0.9,
                boxShadow: 'none',
              }
            }}
          >
            엑셀 출력
          </Button>
          <Button
            variant="contained"
            onClick={() => setAddModalOpen(true)}
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
            추가하기
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
          <StyledTableContainer isDarkMode={isDarkMode}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={8} sx={{ padding: 0, border: 'none' }}>
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
                    {isQRMode && <Box sx={{ width: 40, flexShrink: 0 }}></Box>}
                    <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>기기명</Box>
                    <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>시리얼 넘버</Box>
                    <Box sx={{ flex: 0.5, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>네트워크</Box>
                    <Box sx={{ flex: 0.8, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>배터리</Box>
                    <Box sx={{ flex: 1.5, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>최종 업데이트</Box>
                    <Box sx={{ flex: 0.6, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>펌웨어</Box>
                    <Box sx={{ flex: 1, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>위치</Box>
                    <Box sx={{ flex: 1.5, textAlign: 'center', color: isDarkMode ? colors.gray.gray400 : 'inherit' }}>관리</Box>
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" sx={{ py: 3 }}>
                      데이터를 불러오는 중...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" sx={{ py: 3 }}>
                      데이터가 없습니다
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.slice((page - 1) * 10, page * 10).map((device, index) => (
                  <TableRow key={device.id}>
                    <TableCell colSpan={8} sx={{ padding: 0, border: 'none' }}>
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        mx: 2,
                        my: 0,
                        borderBottom: index < filteredDevices.slice((page - 1) * 10, page * 10).length - 1 ? `1px solid ${isDarkMode ? colors.gray.gray800 : colors.gray.gray200}` : 'none',
                        cursor: isQRMode ? 'pointer' : 'default',
                      }}
                      onClick={() => isQRMode && handleDeviceSelect(device.id)}
                      >
                        {isQRMode && (
                          <Box sx={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box
                              component="img"
                              src={selectedDevices.includes(device.id)
                                ? "/icons/ic_green_check_on.svg"
                                : (isDarkMode ? "/icons/ic_green_check_off_dark.svg" : "/icons/ic_green_check_off.svg")
                              }
                              sx={{
                                width: 20,
                                height: 20
                              }}
                            />
                          </Box>
                        )}
                        <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800, fontFamily: 'monospace', fontWeight: 600 }}>{device.device_name || '-'}</Box>
                        <Box sx={{ flex: 1, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800, fontFamily: 'monospace', fontWeight: 600 }}>{device.serial_number || '-'}</Box>
                        <Box sx={{ flex: 0.5, textAlign: 'center' }}>
                          <Box
                            component="img"
                            src={device.network_status === 'offline' ? "/icons/ic_wifi.svg" : "/icons/ic_wifi_3.svg"}
                            sx={{
                              width: 20,
                              height: 20,
                              filter: isDarkMode
                                ? (device.network_status === 'offline'
                                  ? 'brightness(0) saturate(100%) invert(47%) sepia(0%) saturate(0%) hue-rotate(207deg) brightness(92%) contrast(87%)' // gray600
                                  : 'brightness(0) saturate(100%) invert(79%) sepia(6%) saturate(258%) hue-rotate(177deg) brightness(94%) contrast(87%)') // gray300
                                : 'none'
                            }}
                          />
                        </Box>
                        <Box sx={{ flex: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800 }}>
                          <Box
                            component="img"
                            src={device.network_status === 'offline'
                              ? (isDarkMode ? '/icons/ic_battery_dark.svg' : '/icons/ic_battery.svg')
                              : getBatteryIcon(device.battery_percent, isDarkMode)
                            }
                            sx={{ width: 20, height: 20 }}
                          />
                          <Typography sx={{
                            fontSize: '18px',
                            color: device.network_status === 'offline'
                              ? (isDarkMode ? colors.gray.gray300 : colors.gray.gray800)
                              : ((device.battery_percent === undefined || device.battery_percent === null || device.battery_percent <= 24)
                                ? colors.mainColor.red
                                : (isDarkMode ? colors.gray.gray300 : colors.gray.gray800))
                          }}>
                            {device.network_status === 'offline'
                              ? '-'
                              : (device.battery_percent !== undefined && device.battery_percent !== null ? `${device.battery_percent}%` : '-')
                            }
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1.5, textAlign: 'center', color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800 }}>
                          {formatDateTime(device.last_udpate_at)}
                        </Box>
                        <Box sx={{ flex: 0.6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <Box sx={{
                            bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray200,
                            borderRadius: '32px',
                            px: 2,
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Typography sx={{
                              fontSize: '16px',
                              fontWeight: 700,
                              color: isDarkMode ? colors.gray.gray400 : colors.gray.gray800
                            }}>
                              {device.firmware_version || '-'}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: 'center', color: isDarkMode ? colors.gray.gray300 : colors.gray.gray800 }}>{getLocationString(device)}</Box>
                        <Box sx={{ flex: 1.5, display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => window.open(`/device-mqtt?deviceId=${device.id}`, '_blank', 'width=1200,height=800')}
                            sx={{
                              minWidth: 'auto',
                              height: '37px',
                              px: 2,
                              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                              borderColor: colors.mainColor.blue,
                              color: colors.mainColor.blue,
                              borderRadius: '32px',
                              fontSize: '18px',
                              textTransform: 'none',
                              '&:hover': {
                                bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
                                borderColor: colors.mainColor.blue,
                              }
                            }}
                          >
                            MQTT
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleEditDevice(device)}
                            sx={{
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
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenDeleteModal(device)}
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
              총 {filteredDevices.length}개 중 {Math.min((page - 1) * 10 + 1, filteredDevices.length)}-{Math.min(page * 10, filteredDevices.length)}개 표시
            </Typography>
            <Pagination
              count={Math.ceil(filteredDevices.length / 10)}
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

        {/* Add/Edit Device Modal */}
        <AddDeviceModal
          open={addModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleAddDevice}
          editMode={!!editDeviceData}
          initialData={editDeviceData || undefined}
          hospitals={hospitals}
          wards={wards}
          userRole={userRole}
          currentUserHospitalId={userInfo.hospital_id}
        />

        {/* Delete Device Modal */}
        <DeleteDeviceModal
          open={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
          onForceDelete={handleForceDelete}
          device={deviceToDelete}
          error={deleteError}
          loading={deleteLoading}
        />

        {/* Device QR Code Modal */}
        <DeviceQRCodeModal
          open={qrModalOpen}
          onClose={handleCloseQRModal}
          selectedDevices={selectedDevices.map(deviceId => {
            const device = devices.find(d => d.id === deviceId)
            return {
              serialNumber: device?.serial_number || '',
              deviceName: device?.device_name || ''
            }
          })}
        />
      </MainContent>
    </Box>
  )
}

export default DevicesPage
