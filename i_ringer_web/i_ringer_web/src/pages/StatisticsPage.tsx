import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  CircularProgress
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { useGlobalContext } from '../contexts/GlobalContext'
import apiClient from '../api/client'

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
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
    transition: theme.transitions.create(['left', 'width', 'background-color'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  })
)

const StatsCard = styled(Paper)<{ isDarkMode?: boolean }>(({ theme, isDarkMode }) => ({
  borderRadius: '20px',
  padding: theme.spacing(3),
  backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
  height: '100%',
}))

const MiniStatCard = styled(Paper)<{ isDarkMode?: boolean }>(({ theme, isDarkMode }) => ({
  borderRadius: '20px',
  padding: theme.spacing(2.5),
  backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '140px',
}))

const GradientCard = styled(Paper)(({ theme }) => ({
  borderRadius: '20px',
  padding: theme.spacing(3),
  background: colors.gradients.blue,
  boxShadow: '0px 4px 12px rgba(90, 178, 255, 0.3)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  minHeight: '100px',
}))

const StatisticsPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const { hospitals, wards, rooms, loadHospitals, loadWards, loadRooms } = useGlobalContext()

  // Get user role from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const userHospitalId = userInfo.hospital_id

  const [hospitalFilter, setHospitalFilter] = useState(userRole === 'admin' && userHospitalId ? userHospitalId.toString() : '')
  const [wardFilter, setWardFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [localWards, setLocalWards] = useState<any[]>([])
  const [localRooms, setLocalRooms] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('daily')

  // 오늘 기준 7일 전 날짜 계산
  const getInitialDates = () => {
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)

    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return {
      start: formatDate(sevenDaysAgo),
      end: formatDate(today)
    }
  }

  const initialDates = getInitialDates()
  const [startDate, setStartDate] = useState(initialDates.start)
  const [endDate, setEndDate] = useState(initialDates.end)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [statisticsData, setStatisticsData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const hasDrawer = userRole !== 'nurse'

  // 드롭다운 옵션 변환
  const hospitalOptions: DropdownOption[] = hospitals.map(h => ({ id: h.id, label: h.name }))
  const wardOptions: DropdownOption[] = localWards.map(w => ({ id: w.id, label: w.name }))
  const roomOptions: DropdownOption[] = localRooms.map(r => ({ id: r.id, label: r.room_number }))

  // Load hospitals on mount and remove HTML loader
  useEffect(() => {
    // GlobalContext 데이터 로딩
    loadHospitals()
    loadWards()
    loadRooms()

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

  // Filter wards when hospital changes
  useEffect(() => {
    if (hospitalFilter && hospitalFilter !== '') {
      const filtered = wards.filter(w => w.hospital_id === parseInt(hospitalFilter))
      setLocalWards(filtered)
      setWardFilter('')
      setRoomFilter('')
      setLocalRooms([])
    } else {
      setLocalWards([])
      setWardFilter('')
      setRoomFilter('')
      setLocalRooms([])
    }
  }, [hospitalFilter, wards])

  // Filter rooms when ward changes
  useEffect(() => {
    if (wardFilter && wardFilter !== '') {
      const filtered = rooms.filter(r => r.ward_id === parseInt(wardFilter))
      setLocalRooms(filtered)
      setRoomFilter('')
    } else {
      setLocalRooms([])
      setRoomFilter('')
    }
  }, [wardFilter, rooms])

  // Fetch statistics data
  const fetchStatistics = async () => {
    setIsLoading(true)
    try {
      const params: any = {
        start_date: startDate,
        end_date: endDate,
        hospital_id: hospitalFilter && hospitalFilter !== '' ? parseInt(hospitalFilter) : null,
        granularity: selectedPeriod
      }

      if (wardFilter && wardFilter !== '') {
        params.ward_id = parseInt(wardFilter)
      }

      if (roomFilter && roomFilter !== '') {
        params.room_id = parseInt(roomFilter)
      }

      // console.log('[STATISTICS] Fetching data with params:', params)

      const response = await apiClient.get('/statistics/all/dashboard', { params })

      // console.log('[STATISTICS] API Response:', response.data)
      setStatisticsData(response.data)
    } catch (error) {
      console.error('[STATISTICS] Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch statistics when filters or dates change
  useEffect(() => {
    fetchStatistics()
  }, [hospitalFilter, wardFilter, roomFilter, startDate, endDate, selectedPeriod])

  // 차트 데이터 - API 응답에서 가져오기
  const alarmTypeData = statisticsData?.alarmFrequency?.map((item: any) => ({
    name: item.type.toUpperCase(),
    value: item.count,
    color: item.type === 'slow' ? '#5AB2FF' : item.type === 'fast' ? '#FFB800' : (item.type === 'almost_done' || item.type === 'done') ? '#7FD957' : item.type === 'disconnected' ? '#94a3b8' : '#FF6B6B'
  })) || []

  const alarmResponseData = statisticsData?.alarmResponseTime?.map((item: any) => {
    // 날짜 포맷 처리
    let formattedDate = ''
    if (selectedPeriod === 'daily') {
      // 일별: "월/일" 형식 (예: 1/31)
      const date = new Date(item.period)
      formattedDate = `${date.getMonth() + 1}/${date.getDate()}`
    } else if (selectedPeriod === 'weekly') {
      // 주별: "월 주차" 형식 (예: 10월 4주)
      // period 형식: "2025-10-4" (연도-월-주차)
      const parts = item.period.split('-')
      const month = parseInt(parts[1])
      const week = parseInt(parts[2])
      formattedDate = `${month}월 ${week}주`
    } else if (selectedPeriod === 'monthly') {
      // 월별: "월" 형식 (예: 1월)
      const monthNum = new Date(item.period).getMonth() + 1
      formattedDate = `${monthNum}월`
    } else if (selectedPeriod === 'yearly') {
      // 연별: "년도" 형식 (예: 2025년)
      const year = new Date(item.period).getFullYear()
      formattedDate = `${year}년`
    }

    return {
      date: formattedDate,
      최저: parseFloat((item.minResponseTime / 60).toFixed(1)), // 초를 분으로 변환, 소수점 1자리
      평균: parseFloat((item.avgResponseTime / 60).toFixed(1)),
      최고: parseFloat((item.maxResponseTime / 60).toFixed(1))
    }
  }) || []

  const dailyInfusionData = statisticsData?.periodicalInfusionTotal?.map((item: any) => {
    const now = new Date()
    const itemDate = new Date(item.period)
    let isCurrent = false

    if (selectedPeriod === 'daily') {
      // 일별: 오늘 날짜와 비교 (한국 시간 기준)
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      isCurrent = item.period === today
    } else if (selectedPeriod === 'weekly') {
      // 주별: 서버에서 온 "2025-10-5" 형식과 현재 주 비교
      // 월의 1일부터 7일 단위로 주차 계산 (1-7일=1주, 8-14일=2주, ...)
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      const currentDate = now.getDate()

      // 현재 주차 계산: 날짜를 7로 나눈 값을 올림
      const currentWeekOfMonth = Math.ceil(currentDate / 7)

      const currentYearWeek = `${currentYear}-${currentMonth}-${currentWeekOfMonth}`
      isCurrent = item.period === currentYearWeek
    } else if (selectedPeriod === 'monthly') {
      // 월별: 현재 월과 비교
      const itemDate = new Date(item.period)
      isCurrent = itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth()
    } else if (selectedPeriod === 'yearly') {
      // 연별: 현재 년도와 비교
      const itemDate = new Date(item.period)
      isCurrent = itemDate.getFullYear() === now.getFullYear()
    }

    return {
      date: item.period,
      value: item.totalVolume,
      isCurrent
    }
  }) || []

  const infusionTypeData = (() => {
    const data = statisticsData?.infusionTypeDistribution?.map((item: any, index: number) => ({
      name: item.type,
      value: item.percentage,
      color: ['#FFB800', '#7FD957', '#FF6B6B', '#B045DE', '#00C49F', '#FFBB28', '#FF8042'][index % 7]
    })) || []

    // 퍼센트 높은 순으로 정렬
    data.sort((a: any, b: any) => b.value - a.value)

    // 가장 큰 값 찾아서 gradients.blue 색상 적용
    if (data.length > 0) {
      data[0] = { ...data[0], isMax: true }
    }
    return data
  })()

  const batteryData = (() => {
    const data = statisticsData?.batteryDistribution?.map((item: any, index: number) => ({
      name: item.range,
      value: item.percentage,
      color: ['#FFB800', '#7FD957', '#FF6B6B', '#B045DE'][index % 4]
    })) || []

    // 배터리 범위 순서대로 정렬 (0-20, 21-50, 51-80, 81-100)
    data.sort((a: any, b: any) => {
      const getRangeStart = (range: string) => {
        const match = range.match(/^(\d+)/)
        return match ? parseInt(match[1]) : 0
      }
      return getRangeStart(a.name) - getRangeStart(b.name)
    })

    // 가장 큰 값 찾아서 gradients.blue 색상 적용
    const maxValue = Math.max(...data.map((item: any) => item.value))
    data.forEach((item: any) => {
      if (item.value === maxValue) {
        item.isMax = true
      }
    })
    return data
  })()

  const deviceUsageData = statisticsData?.deviceUsageTime?.map((item: any) => {
    const totalMinutes = Math.max(item.totalHours * 60, 0) // 시간을 분으로 변환, 음수는 0으로 처리
    const displayTime = `${Math.floor(totalMinutes)}` // 숫자만 표시

    return {
      name: item.deviceName,
      time: totalMinutes, // 분 단위로 저장
      displayTime: displayTime
    }
  }) || []

  // KPI 카드 데이터
  const kpiCards = statisticsData?.kpiCards || {
    totalDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    totalInfusions: 0
  }

  // 수액 투여 요약 데이터
  const infusionSummary = statisticsData?.infusionSummary || {
    totalVolume: 0,
    averageDurationMinutes: 0
  }

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  // 기간별 제목 매핑
  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case 'daily':
        return '일별'
      case 'weekly':
        return '주별'
      case 'monthly':
        return '월별'
      case 'yearly':
        return '연별'
      default:
        return '일별'
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
        {/* 필터 섹션 - 고정 영역 */}
        <Box sx={{
          paddingTop: `${headerHeight + 24 + 16}px`,
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingBottom: '0px',
          backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          flexShrink: 0
        }}>
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {hospitals.length > 0 ? (
              <CustomDropdown
                options={hospitalOptions}
                value={hospitalFilter}
                onChange={(value) => setHospitalFilter(value as string)}
                placeholder="전체 병원"
                showAllOption={true}
                allOptionLabel="전체 병원"
                isDarkMode={isDarkMode}
                disabled={userRole === 'admin'}
              />
            ) : (
              <Box sx={{
                width: 180,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                borderRadius: '12px'
              }}>
                <CircularProgress size={20} sx={{ color: colors.mainColor.blue }} />
              </Box>
            )}

            <CustomDropdown
              options={wardOptions}
              value={wardFilter}
              onChange={(value) => setWardFilter(value as string)}
              placeholder="전체 병동"
              showAllOption={true}
              allOptionLabel="전체 병동"
              isDarkMode={isDarkMode}
              disabled={!hospitalFilter || hospitalFilter === ''}
            />

            <CustomDropdown
              options={roomOptions}
              value={roomFilter}
              onChange={(value) => setRoomFilter(value as string)}
              placeholder="전체 병실"
              showAllOption={true}
              allOptionLabel="전체 병실"
              isDarkMode={isDarkMode}
              disabled={!wardFilter || wardFilter === ''}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{
              display: 'flex',
              gap: 0.5,
              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
              borderRadius: '12px',
              padding: '6px',
              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)'
            }}>
              {['일', '주', '월', '연'].map((period, index) => (
                <Button
                  key={period}
                  onClick={() => setSelectedPeriod(['daily', 'weekly', 'monthly', 'yearly'][index])}
                  sx={{
                    minWidth: '40px',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    bgcolor: selectedPeriod === ['daily', 'weekly', 'monthly', 'yearly'][index] ? colors.mainColor.blue : 'transparent',
                    color: selectedPeriod === ['daily', 'weekly', 'monthly', 'yearly'][index] ? 'white' : (isDarkMode ? colors.gray.gray400 : colors.gray.gray600),
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: 'none',
                    padding: 0,
                    '&:hover': {
                      bgcolor: selectedPeriod === ['daily', 'weekly', 'monthly', 'yearly'][index] ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray800 : colors.gray.gray100),
                      boxShadow: 'none'
                    }
                  }}
                >
                  {period}
                </Button>
              ))}
            </Box>

            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
              bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
              borderRadius: '12px',
              padding: '10px 16px',
              boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative' }}>
                <TextField
                  id="start-date-picker"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{
                    colorScheme: isDarkMode ? 'dark' : 'light',
                    '& .MuiInputBase-root': {
                      height: '28px',
                      bgcolor: 'transparent',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900,
                      width: 'fit-content',
                    },
                    '& .MuiInputBase-input': {
                      padding: 0,
                      height: '28px',
                      width: '110px',
                      '&::-webkit-calendar-picker-indicator': {
                        position: 'absolute',
                        right: '-24px',
                        opacity: 0,
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px'
                      }
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    },
                  }}
                />
                <Box
                  component="label"
                  htmlFor="start-date-picker"
                  sx={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box component="img" src="/icons/ic_calendar.svg" sx={{ width: 18, height: 18, pointerEvents: 'none', filter: isDarkMode ? 'brightness(0) saturate(100%) invert(32%) sepia(6%) saturate(634%) hue-rotate(201deg) brightness(94%) contrast(88%)' : 'none' }} />
                </Box>
              </Box>

              <Typography sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: '16px', fontWeight: 400 }}>-</Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative' }}>
                <TextField
                  id="end-date-picker"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{
                    colorScheme: isDarkMode ? 'dark' : 'light',
                    '& .MuiInputBase-root': {
                      height: '28px',
                      bgcolor: 'transparent',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900,
                      width: 'fit-content',
                    },
                    '& .MuiInputBase-input': {
                      padding: 0,
                      height: '28px',
                      width: '110px',
                      '&::-webkit-calendar-picker-indicator': {
                        position: 'absolute',
                        right: '-24px',
                        opacity: 0,
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px'
                      }
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      border: 'none',
                    },
                  }}
                />
                <Box
                  component="label"
                  htmlFor="end-date-picker"
                  sx={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box component="img" src="/icons/ic_calendar.svg" sx={{ width: 18, height: 18, pointerEvents: 'none', filter: isDarkMode ? 'brightness(0) saturate(100%) invert(32%) sepia(6%) saturate(634%) hue-rotate(201deg) brightness(94%) contrast(88%)' : 'none' }} />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
        </Box>

        {/* 차트 영역 - 스크롤 가능 */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          paddingLeft: '24px',
          paddingRight: '24px',
          paddingBottom: '16px',
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
          {/* 상위 통계 카드 4개 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
          <MiniStatCard isDarkMode={isDarkMode} sx={{ flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                bgcolor: `${colors.mainColor.blue}1A`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box component="img" src="/icons/ic_iv_bag_blue.svg" sx={{ width: 40, height: 40 }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
              {isLoading ? (
                <CircularProgress size={38} sx={{ color: colors.mainColor.blue }} />
              ) : (
                <Typography sx={{ fontSize: '38px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900, lineHeight: 1 }}>{kpiCards.totalDevices}</Typography>
              )}
              <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>총 등록 기기 수</Typography>
            </Box>
          </MiniStatCard>

          <MiniStatCard isDarkMode={isDarkMode} sx={{ flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                bgcolor: `${colors.mainColor.green}1A`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box component="img" src="/icons/ic_check_circle.svg" sx={{ width: 40, height: 40, filter: 'brightness(0) saturate(100%) invert(65%) sepia(51%) saturate(441%) hue-rotate(76deg) brightness(93%) contrast(89%)' }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
              {isLoading ? (
                <CircularProgress size={38} sx={{ color: colors.mainColor.green }} />
              ) : (
                <Typography sx={{ fontSize: '38px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900, lineHeight: 1 }}>{kpiCards.activeDevices}</Typography>
              )}
              <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>활성 기기</Typography>
            </Box>
          </MiniStatCard>

          <MiniStatCard isDarkMode={isDarkMode} sx={{ flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                bgcolor: 'rgba(255, 77, 79, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box component="img" src="/icons/ic_warning.svg" sx={{ width: 40, height: 40 }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
              {isLoading ? (
                <CircularProgress size={38} sx={{ color: colors.mainColor.red }} />
              ) : (
                <Typography sx={{ fontSize: '38px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900, lineHeight: 1 }}>{kpiCards.inactiveDevices}</Typography>
              )}
              <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>비활성 기기</Typography>
            </Box>
          </MiniStatCard>

          <MiniStatCard isDarkMode={isDarkMode} sx={{ flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                bgcolor: 'rgba(176, 69, 222, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box component="img" src="/icons/ic_cloud_monitoring.svg" sx={{ width: 40, height: 40 }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
              {isLoading ? (
                <CircularProgress size={38} sx={{ color: '#B045DE' }} />
              ) : (
                <Typography sx={{ fontSize: '38px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900, lineHeight: 1 }}>{kpiCards.totalInfusions}</Typography>
              )}
              <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>총 모니터링 수액 수</Typography>
            </Box>
          </MiniStatCard>
        </Box>

        {/* 메인 차트 그리드 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 첫 번째 행: 알람 유형별 발생 빈도 | 알람 반응 시간 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 3 }}>
              <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
                알림 유형별 발생 빈도
              </Typography>
              <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
                알림 반응 시간
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 3 }}>
              <StatsCard isDarkMode={isDarkMode} sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 4, minHeight: '300px' }}>
                {alarmTypeData.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
                  </Box>
                ) : (
                  (() => {
                    const maxValue = Math.max(...alarmTypeData.map((d: any) => d.value))
                    return alarmTypeData.map((item: any, index: number) => {
                      const isMax = item.value === maxValue
                      return (
                        <Box key={index} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography sx={{ fontSize: '18px', fontWeight: 500, color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500 }}>
                            {item.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: `${Math.min((item.value / maxValue) * 100, 70)}%`,
                              height: '48px',
                              background: isMax
                                ? colors.gradients.blue
                                : (isDarkMode ? colors.gray.gray700 : colors.gray.gray200),
                              borderRadius: '14px',
                              transition: 'width 0.3s ease',
                              minWidth: '80px',
                              boxShadow: isMax ? '0px 8px 24px rgba(124, 202, 241, 0.6)' : 'none'
                            }} />
                            <Typography sx={{
                              fontSize: isMax ? '26px' : '18px',
                              fontWeight: isMax ? 700 : 500,
                              color: isMax ? colors.mainColor.blue : (isDarkMode ? colors.gray.gray400 : colors.gray.gray500),
                              minWidth: 'fit-content',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              {item.value}회
                            </Typography>
                          </Box>
                        </Box>
                      )
                    })
                  })()
                )}
              </StatsCard>

              <StatsCard isDarkMode={isDarkMode} sx={{ display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                {alarmResponseData.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 16, height: 16, bgcolor: '#FFB800', borderRadius: '4px' }} />
                        <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>최저</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 16, height: 16, bgcolor: '#009EE6', borderRadius: '4px' }} />
                        <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>평균</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 16, height: 16, bgcolor: '#8ECE4B', borderRadius: '4px' }} />
                        <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}>최고</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alarmResponseData} barGap={4} margin={{ top: 25, right: 10, left: 10, bottom: 10 }}>
                          <XAxis
                            dataKey="date"
                            stroke={colors.gray.gray400}
                            tick={{ fill: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: 16 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                          />
                          <YAxis
                            stroke={colors.gray.gray400}
                            tick={{ fill: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: 16 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => value === 0 ? '0 분' : `${value}`}
                          />
                          <Tooltip
                            cursor={{ fill: isDarkMode ? colors.gray.gray900 : 'rgba(0, 0, 0, 0.05)' }}
                            contentStyle={{
                              backgroundColor: isDarkMode ? colors.gray.gray800 : 'white',
                              border: `1px solid ${isDarkMode ? colors.gray.gray700 : '#E8E8E8'}`,
                              borderRadius: '8px',
                              boxShadow: isDarkMode ? '0px 4px 16px rgba(0, 0, 0, 0.4)' : '0px 2px 8px rgba(0, 0, 0, 0.1)'
                            }}
                            labelStyle={{ color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900, fontWeight: 600 }}
                            itemStyle={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600 }}
                          />
                          <Bar
                            dataKey="최저"
                            fill="#FFB800"
                            radius={[8, 8, 8, 8]}
                            label={{ position: 'top', fill: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: 14, offset: 8, formatter: (value: any) => (typeof value === 'number' && value > 0) ? value.toFixed(1) : '' }}
                            activeBar={isDarkMode ? { fill: '#FFB800', stroke: colors.gray.gray800, strokeWidth: 3 } : { fill: '#FFD966' }}
                          />
                          <Bar
                            dataKey="평균"
                            fill="#009EE6"
                            radius={[8, 8, 8, 8]}
                            label={{ position: 'top', fill: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: 14, offset: 8, formatter: (value: any) => (typeof value === 'number' && value > 0) ? value.toFixed(1) : '' }}
                            activeBar={isDarkMode ? { fill: '#009EE6', stroke: colors.gray.gray800, strokeWidth: 3 } : { fill: '#33B3F0' }}
                          />
                          <Bar
                            dataKey="최고"
                            fill="#8ECE4B"
                            radius={[8, 8, 8, 8]}
                            label={{ position: 'top', fill: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, fontSize: 14, offset: 8, formatter: (value: any) => (typeof value === 'number' && value > 0) ? value.toFixed(1) : '' }}
                            activeBar={isDarkMode ? { fill: '#8ECE4B', stroke: colors.gray.gray800, strokeWidth: 3 } : { fill: '#A3DD6F' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </>
                )}
              </StatsCard>
            </Box>
          </Box>

          {/* 두 번째 행: 총 수액 투여량 + 평균 투여 시간 | 일별 투여 총량 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 3, minHeight: '400px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <GradientCard sx={{ flex: 1 }}>
                <Box
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '16px',
                    bgcolor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box component="img" src="/icons/ic_iv_bag_blue.svg" sx={{ width: 40, height: 40 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '38px', fontWeight: 700 }}>{infusionSummary.totalVolume.toLocaleString()} ml</Typography>
                  <Typography sx={{ fontSize: '16px', fontWeight: 500, opacity: 0.9 }}>총 수액 투여량</Typography>
                </Box>
              </GradientCard>

              <GradientCard sx={{ flex: 1 }}>
                <Box
                  sx={{
                    width: 70,
                    height: 70,
                    borderRadius: '16px',
                    bgcolor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box component="img" src="/icons/ic_time_blue.svg" sx={{ width: 40, height: 40 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '38px', fontWeight: 700 }}>{Math.round(infusionSummary.averageDurationMinutes)}분</Typography>
                  <Typography sx={{ fontSize: '16px', fontWeight: 500, opacity: 0.9 }}>평균 투여 시간</Typography>
                </Box>
              </GradientCard>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
                {getPeriodLabel()} 투여 총량
              </Typography>
              <StatsCard isDarkMode={isDarkMode} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 4, py: 4, minHeight: '280px' }}>
                {dailyInfusionData.length === 0 ? (
                  <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
                ) : (
                  <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 2, height: '280px' }}>
                    {(() => {
                      const maxValue = Math.max(...dailyInfusionData.map((d: any) => d.value), 1)
                      const maxHeight = 240 // 막대의 최대 높이 (px)

                      return dailyInfusionData.map((item: any, index: number) => {
                      const heightPx = Math.max((item.value / maxValue) * maxHeight, 30)

                      // 날짜 포맷 처리
                      let formattedDate = ''
                      if (selectedPeriod === 'daily') {
                        // 일별: "월/일" 형식 (예: 1/31)
                        formattedDate = item.date.split('-').slice(1).join('/')
                      } else if (selectedPeriod === 'weekly') {
                        // 주별: "월 주차" 형식 (예: 10월 4주)
                        // item.date 형식: "2025-10-4" (연도-월-주차)
                        const parts = item.date.split('-')
                        const month = parseInt(parts[1])
                        const week = parseInt(parts[2])
                        formattedDate = `${month}월 ${week}주`
                      } else if (selectedPeriod === 'monthly') {
                        // 월별: "월" 형식 (예: 1월)
                        const monthNum = new Date(item.date).getMonth() + 1
                        formattedDate = `${monthNum}월`
                      } else if (selectedPeriod === 'yearly') {
                        // 연별: "년도" 형식 (예: 2025년)
                        const year = new Date(item.date).getFullYear()
                        formattedDate = `${year}년`
                      }

                      return (
                        <Box key={index} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <Typography sx={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.value}
                          </Typography>
                          <Box
                            sx={{
                              width: '100%',
                              maxWidth: '60px',
                              height: `${heightPx}px`,
                              background: item.isCurrent ? colors.gradients.blue : (isDarkMode ? colors.gray.gray700 : colors.gray.gray200),
                              borderRadius: '20px',
                              transition: 'all 0.3s ease',
                            }}
                          />
                          <Typography sx={{
                            fontSize: item.isCurrent ? '18px' : '16px',
                            fontWeight: item.isCurrent ? 700 : 500,
                            color: item.isCurrent ? (isDarkMode ? colors.gray.gray200 : colors.gray.gray800) : (isDarkMode ? colors.gray.gray400 : colors.gray.gray500),
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {formattedDate}
                          </Typography>
                        </Box>
                      )
                      })
                    })()}
                  </Box>
                )}
              </StatsCard>
            </Box>
          </Box>

          {/* 세 번째 행: 수액 종류별 투여량 | 배터리 잔량 분포 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
                수액 종류별 투여량
              </Typography>
              <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
                배터리 잔량 분포
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              <StatsCard isDarkMode={isDarkMode} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '250px' }}>
                {infusionTypeData.length === 0 ? (
                  <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
                ) : (
                  <>
                    <Box sx={{ width: '50%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <defs>
                            <linearGradient id="blueGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#7CCAF1" />
                              <stop offset="100%" stopColor="#0058E6" />
                            </linearGradient>
                          </defs>
                          <Pie
                            data={infusionTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            dataKey="value"
                            paddingAngle={2}
                            cornerRadius={4}
                          >
                            {infusionTypeData.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.isMax ? 'url(#blueGradient)' : entry.color}
                                stroke={entry.isMax ? 'url(#blueGradient)' : entry.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box sx={{
                      width: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      pr: 2,
                      maxHeight: '250px',
                      overflowY: 'auto',
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
                      // 라이트 모드 스크롤바 스타일
                      ...(!isDarkMode && {
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                          backgroundColor: '#ffffff',
                          borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: colors.gray.gray200,
                          borderRadius: '4px',
                          '&:hover': {
                            backgroundColor: colors.gray.gray300,
                          },
                        },
                      }),
                    }}>
                      {infusionTypeData.map((entry: any, index: number) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                            <Box sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: entry.isMax ? colors.gradients.blue : entry.color,
                              flexShrink: 0
                            }} />
                            <Typography sx={{
                              fontSize: entry.isMax ? '18px' : '14px',
                              color: entry.isMax ? (isDarkMode ? colors.gray.gray200 : colors.gray.gray700) : (isDarkMode ? colors.gray.gray400 : colors.gray.gray700),
                              fontWeight: entry.isMax ? 700 : 400
                            }}>{entry.name}</Typography>
                          </Box>
                          <Typography sx={{
                            fontSize: entry.isMax ? '18px' : '14px',
                            color: entry.isMax ? (isDarkMode ? colors.gray.gray200 : colors.gray.gray500) : (isDarkMode ? colors.gray.gray400 : colors.gray.gray500),
                            fontWeight: entry.isMax ? 700 : 500,
                            flexShrink: 0
                          }}>{entry.value}%</Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </StatsCard>

              <StatsCard isDarkMode={isDarkMode} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '250px' }}>
                {batteryData.length === 0 ? (
                  <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
                ) : (
                  <>
                    <Box sx={{ width: '50%', height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <defs>
                            <linearGradient id="blueGradient2" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#7CCAF1" />
                              <stop offset="100%" stopColor="#0058E6" />
                            </linearGradient>
                          </defs>
                          <Pie
                            data={batteryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            dataKey="value"
                            paddingAngle={2}
                            cornerRadius={4}
                          >
                            {batteryData.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.isMax ? 'url(#blueGradient2)' : entry.color}
                                stroke={entry.isMax ? 'url(#blueGradient2)' : entry.color}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Box sx={{
                      width: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      pr: 2,
                      maxHeight: '250px',
                      overflowY: 'auto',
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
                      // 라이트 모드 스크롤바 스타일
                      ...(!isDarkMode && {
                        '&::-webkit-scrollbar': {
                          width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                          backgroundColor: '#ffffff',
                          borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: colors.gray.gray200,
                          borderRadius: '4px',
                          '&:hover': {
                            backgroundColor: colors.gray.gray300,
                          },
                        },
                      }),
                    }}>
                      {batteryData.map((entry: any, index: number) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                            <Box sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: entry.isMax ? colors.gradients.blue : entry.color,
                              flexShrink: 0
                            }} />
                            <Typography sx={{
                              fontSize: entry.isMax ? '18px' : '14px',
                              color: entry.isMax ? (isDarkMode ? colors.gray.gray200 : colors.gray.gray700) : (isDarkMode ? colors.gray.gray400 : colors.gray.gray700),
                              fontWeight: entry.isMax ? 700 : 400
                            }}>{entry.name}</Typography>
                          </Box>
                          <Typography sx={{
                            fontSize: entry.isMax ? '18px' : '14px',
                            color: entry.isMax ? (isDarkMode ? colors.gray.gray200 : colors.gray.gray500) : (isDarkMode ? colors.gray.gray400 : colors.gray.gray500),
                            fontWeight: entry.isMax ? 700 : 500,
                            flexShrink: 0
                          }}>{entry.value}%</Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}
              </StatsCard>
            </Box>
          </Box>

          {/* 네 번째 행: 기기별 사용 시간 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography sx={{ fontSize: '26px', fontWeight: 500, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
              기기별 사용 시간
            </Typography>
            <StatsCard isDarkMode={isDarkMode} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 4, py: 4, minHeight: '300px' }}>
              {deviceUsageData.length === 0 ? (
                <Typography sx={{ fontSize: '16px', color: colors.gray.gray500 }}>데이터가 없습니다</Typography>
              ) : (
                <Box sx={{ width: '100%', display: 'flex', gap: 3, height: '300px' }}>
                  {/* Y축 눈금 */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 3, minWidth: '50px' }}>
                    {(() => {
                      const maxValue = Math.max(...deviceUsageData.map((d: any) => d.time), 1)
                      const ticks = []
                      const tickCount = 5

                      for (let i = tickCount - 1; i >= 0; i--) {
                        const value = (maxValue / (tickCount - 1)) * i // value는 이제 분 단위
                        let label = ''

                        if (i === 0) {
                          label = '0분'
                        } else {
                          const minutes = Math.floor(value)
                          label = `${minutes}`
                        }

                        ticks.push(
                          <Typography key={i} sx={{ fontSize: '14px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, textAlign: 'right' }}>
                            {label}
                          </Typography>
                        )
                      }
                      return ticks
                    })()}
                  </Box>

                  {/* 막대 차트 영역 */}
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 3 }}>
                  {(() => {
                    const maxValue = Math.max(...deviceUsageData.map((d: any) => d.time), 1)
                    const maxHeight = 240 // 막대의 최대 높이 (px)

                    return deviceUsageData.map((item: any, index: number) => {
                      const heightPx = Math.max((item.time / maxValue) * maxHeight, 30)

                      // mainColor.blue 기준 투명도로 차이 표현 (0.3 ~ 1.0 범위를 더 넓게)
                      const opacity = 0.2 + (index / Math.max(deviceUsageData.length - 1, 1)) * 0.8 // 0.2 ~ 1.0

                      // RGB 값 추출 및 투명도 적용 (#009EE6)
                      const r = parseInt('00', 16)
                      const g = parseInt('9E', 16)
                      const b = parseInt('E6', 16)

                      const barColor = `rgba(${r}, ${g}, ${b}, ${opacity})`

                      return (
                        <Box key={index} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <Typography sx={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray700,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.displayTime}
                          </Typography>
                          <Box
                            sx={{
                              width: '100%',
                              maxWidth: '80px',
                              height: `${heightPx}px`,
                              background: barColor,
                              borderRadius: '20px',
                              transition: 'all 0.3s ease',
                            }}
                          />
                          <Typography sx={{
                            fontSize: '14px',
                            fontWeight: 400,
                            color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                          }}>
                            {item.name}
                          </Typography>
                        </Box>
                      )
                    })
                  })()}
                </Box>
              </Box>
              )}
            </StatsCard>
          </Box>
        </Box>
        </Box>
      </MainContent>
    </Box>
  )
}

export default StatisticsPage
