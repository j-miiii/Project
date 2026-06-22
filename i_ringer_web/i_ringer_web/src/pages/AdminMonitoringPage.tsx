import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Button,
  Paper
} from '@mui/material'
import {
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown'
import CompleteInfusionModal from '../components/CompleteInfusionModal'
import QRCodeModal from '../components/QRCodeModal'
import SettingsModal, { SettingsData } from '../components/SettingsModal'
// NotificationToast는 NotificationToastContainer에서 전역으로 처리
import { useGlobalContext } from '../contexts/GlobalContext'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { useMqtt } from '../contexts/MqttContext'
import { dataProvider } from '../providers/dataProvider'
import { getAlertTypeLabel } from '../utils/statusUtils'

const drawerWidth = 240
const drawerWidthCollapsed = 64
const headerHeight = 64

let infusionNameToCodeMap: Record<string, string> = {}

const getInfusionCode = (code: string | null | undefined, type: string | null | undefined): string => {
  if (code) return code
  if (!type) return ''
  return infusionNameToCodeMap[type] || type
}


const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasDrawer' && prop !== 'drawerCollapsed' && prop !== 'isDarkMode',
})<{ hasDrawer?: boolean, drawerCollapsed?: boolean, isDarkMode?: boolean }>(({ theme, hasDrawer = true, drawerCollapsed = false, isDarkMode = false }) => ({
  position: 'fixed',
  top: 0,
  left: hasDrawer ? (drawerCollapsed ? `${drawerWidthCollapsed}px` : `${drawerWidth}px`) : 0,
  right: 0,
  bottom: 0,
  paddingTop: `${headerHeight + 24 + 16}px`,
  paddingBottom: '16px',
  backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
  transition: theme.transitions.create(['left', 'width', 'background-color'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}))

// StyledCard component removed - not used

const BedCard = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== 'selected' &&
    prop !== 'completed' &&
    prop !== 'warning' &&
    prop !== 'isDarkMode' &&
    prop !== 'isSelectMode' &&
    prop !== 'isQRMode' &&
    prop !== 'canInteract' &&
    prop !== 'highProgress' &&
    prop !== 'criticalAlert' &&
    prop !== 'alertColor'
})<{
  selected?: boolean
  completed?: boolean
  warning?: boolean
  isDarkMode?: boolean
  isSelectMode?: boolean
  isQRMode?: boolean
  canInteract?: boolean
  highProgress?: boolean
  criticalAlert?: boolean
  alertColor?: string
}>(({ theme, selected, completed, warning, isDarkMode, isSelectMode, isQRMode, canInteract = true, highProgress = false, criticalAlert = false, alertColor = colors.mainColor.red }) => {
  // 그래디언트 보더를 사용할지 여부 (criticalAlert나 warning일 때는 사용 안함)
  const hasGradientBorder = !criticalAlert && !warning && (completed || highProgress) && !(isSelectMode && canInteract)

  // warning와 criticalAlert 모두 사용자 설정 색상 사용
  const effectiveAlertColor = alertColor

  // 기본 배경색
  const baseBgColor = (warning || criticalAlert)
    ? `${effectiveAlertColor}0F` // warning 및 criticalAlert: 사용자 설정 색상 + 6% 투명도
    : (isSelectMode && canInteract)
    ? (isDarkMode ? colors.gray.gray1000 : 'white')
    : !canInteract // 빈 값 (assignment 없음)
    ? (isDarkMode ? colors.gray.gray900 : colors.gray.gray100)
    : isDarkMode
    ? colors.gray.gray800
    : colors.gray.gray100

  return {
    padding: theme.spacing(2),
    borderRadius: '16px',
    border: (isSelectMode && canInteract)
      ? selected
        ? isQRMode
          ? `3px solid ${colors.mainColor.green}`
          : `3px solid ${colors.mainColor.blue}`
        : `1px solid ${isDarkMode ? colors.gray.gray1000 : colors.gray.gray300}`
      : (warning || criticalAlert)
      ? `1px solid ${effectiveAlertColor}` // warning 및 criticalAlert: 사용자 설정 색상
      : hasGradientBorder
      ? `1px solid transparent`
      : 'none',
    // 그래디언트 보더: blue overlay, 기본 배경색, 그래디언트 (3개 레이어)
    backgroundImage: hasGradientBorder
      ? `linear-gradient(rgba(0, 158, 230, 0.06), rgba(0, 158, 230, 0.06)), linear-gradient(${isDarkMode ? colors.gray.gray800 : colors.gray.gray100}, ${isDarkMode ? colors.gray.gray800 : colors.gray.gray100}), ${colors.gradients.blue}`
      : 'none',
    backgroundOrigin: hasGradientBorder ? 'border-box, border-box, border-box' : undefined,
    backgroundClip: hasGradientBorder ? 'padding-box, padding-box, border-box' : undefined,
    // 그래디언트 보더를 사용할 때는 backgroundColor 설정 안 함
    backgroundColor: hasGradientBorder ? undefined : baseBgColor,
    cursor: 'pointer',
    transition: 'all 0.2s, background-color 0.3s ease',
    height: '70px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: (isSelectMode && canInteract)
      ? selected
        ? isQRMode
          ? '0px 0px 14px 0px rgba(142, 206, 75, 0.5), inset 0px 0px 15px 0px rgba(142, 206, 75, 0.5)'
          : '0px 0px 14px 0px rgba(0, 158, 230, 0.5), inset 0px 0px 15px 0px rgba(0, 158, 230, 0.5)'
        : isDarkMode
          ? `0px 0px 12px ${colors.gray.gray500}`
          : '0px 0px 12px rgba(0, 0, 0, 0.08)'
      : 'none',
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
      borderColor: canInteract && !warning && (isSelectMode ? (selected ? undefined : (isQRMode ? colors.mainColor.green : colors.mainColor.blue)) : undefined),
      border: canInteract && !warning && (isSelectMode ? (selected ? undefined : `2px solid ${isQRMode ? colors.mainColor.green : colors.mainColor.blue}`) : undefined),
      '& .hover-overlay': {
        opacity: canInteract && !isSelectMode ? 0.9 : 0, // warning 조건 제거 - 기기 미연결 상태에서도 호버 표시
      }
    },
    '&:focus': {
      outline: 'none'
    }
  }
})

interface Ward {
  id: number
  name: string
  hospital_id: number
}

interface Room {
  id: number
  room_number: string
  ward_id: number
}

interface Assignment {
  id: number
  patient_id: number | null
  bed_id: number
  device_id: number | null
  infusion_type: string
  infusion_code?: string | null
  infusion_total_volume: number
  infusion_current_volume: number
  infusion_gtt: number | null
  infusion_cchr?: number | null
  infusion_percentage: number
  alert_type: string | null
  assigned_at: string
  released_at: string | null
  last_measured_weight: number | null
  last_measured_time: string | null
  created_at: string
  updated_at: string
  device: {
    id: number
    device_name: string
    serial_number: string
    status: string
    batteryLevel: number
    firmware_version: string
    last_udpate_at: string
  } | null
}

interface BedData {
  bed_id: number
  bed_number: string
  bed_status: string
  patient_info?: {
    id: number
    name: string
    chart_number: string
  } | null
  assignments: Assignment[]
}

interface RoomData {
  room_id: number
  room_number: string
  beds: BedData[]
}

interface WardData {
  ward_id: number
  ward_name: string
  rooms: RoomData[]
}

interface MonitoringResponse {
  success: boolean
  hospital_id: number
  hospital_name: string
  data: WardData[]
  timestamp: string
}

const AdminMonitoringPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const { isConnected, subscribe, unsubscribe, lastMessage } = useMqtt()
  // localStorage에서 초기값 읽기 (다른 사용자의 선택 값 검증)
  const [selectedHospital, setSelectedHospital] = useState<string>(() => {
    const saved = localStorage.getItem('monitoring_hospital')
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')

    // admin 역할이고 저장된 병원이 자신의 병원이 아니면 초기화
    if (userInfo.role === 'admin' && saved &&
        saved !== String(userInfo.hospital_id)) {
      localStorage.removeItem('monitoring_hospital')
      localStorage.removeItem('monitoring_ward')
      localStorage.removeItem('monitoring_rooms')
      return ''
    }
    return saved || ''
  })
  const [selectedWard, setSelectedWard] = useState<string>(() => {
    return localStorage.getItem('monitoring_ward') || ''
  })
  const [selectedRoom, setSelectedRoom] = useState<string[]>(() => {
    const saved = localStorage.getItem('monitoring_rooms')
    try {
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [monitoringData, setMonitoringData] = useState<WardData[]>([])
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [isQRMode, setIsQRMode] = useState(false)
  const [bedsPerRow, setBedsPerRow] = useState(() => {
    const saved = localStorage.getItem('monitoring_bedsPerRow')
    return saved ? parseInt(saved, 10) : 4
  })
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([])
  const [settingsVersion, setSettingsVersion] = useState(0) // 설정 변경 시 리렌더링 트리거
  const [wardSettings, setWardSettings] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('ward_setting') || 'null') } catch { return null }
  })
  const wardSettingsRef = useRef<any>(wardSettings)

  // STOP, SLOW, FAST 알림 타이머 관리 (bedId -> timer ID)
  const alertTimersRef = React.useRef<Map<number, NodeJS.Timeout>>(new Map())

  // 데이터 로드 전 받은 notification을 저장 (bedId -> alertType)
  const pendingAlertsRef = React.useRef<Map<number, string>>(new Map())

  // 초기 마운트 여부 추적 (localStorage 복원 vs 사용자 선택 구분)
  const isInitialMountRef = React.useRef(true)

  // 프로그레스 바 단조증가 클램프: 동일 assignment 내에서 % 하락 방지
  const maxPercentageRef = React.useRef<Map<number, { assignmentId: number, percentage: number }>>(new Map())

  // wardSettings ref 동기화
  React.useEffect(() => { wardSettingsRef.current = wardSettings }, [wardSettings])

  // 서버에서 infusions 목록 로드 (name → code 매핑)
  useEffect(() => {
    const loadInfusions = async () => {
      try {
        const res = await dataProvider.getList<{ id: number; code: string; name: string }>('infusions', { limit: 100, filter: { is_active: 1 }, order: 'display_order:asc' })
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {}
          res.data.forEach((item) => { map[item.name] = item.code })
          infusionNameToCodeMap = map
        }
      } catch (error) {
        console.error('Failed to load infusions:', error)
      }
    }
    loadInfusions()
  }, [])

  // 서버에서 ward_settings 로드
  const loadWardSettings = useCallback(async () => {
    try {
      const ui = JSON.parse(localStorage.getItem('user_info') || '{}')
      const wardId = ui.ward_id
      if (!wardId) return
      const res = await dataProvider.getList('ward_settings', {
        page: 1,
        limit: 1,
        where: `ward_id:${wardId}`
      })
      if (res.data && res.data.length > 0) {
        setWardSettings(res.data[0])
        localStorage.setItem('ward_setting', JSON.stringify(res.data[0]))
      }
    } catch (error) {
      console.error('Failed to load ward settings:', error)
    }
  }, [])

  // 컴포넌트 마운트 시 ward_settings 로드
  useEffect(() => { loadWardSettings() }, [loadWardSettings])

  // Get user role from localStorage
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const hasDrawer = userRole !== 'nurse'

  // Get global context
  const { hospitals, wards, rooms, loadHospitals, loadWards, loadRooms } = useGlobalContext()
  const [localWards, setLocalWards] = useState<Ward[]>([])
  const [localRooms, setLocalRooms] = useState<Room[]>([])

  // 드롭다운 옵션 변환
  const hospitalOptions: DropdownOption[] = hospitals.map(h => ({ id: h.id, label: h.name }))
  const wardOptions: DropdownOption[] = localWards.map(w => ({ id: w.id, label: w.name }))
  const roomOptions: DropdownOption[] = localRooms.map(r => ({ id: r.id, label: r.room_number }))

  // localStorage에 선택값 저장
  useEffect(() => {
    if (selectedHospital) {
      localStorage.setItem('monitoring_hospital', selectedHospital)
      // Header에 병원 선택 변경 알림
      window.dispatchEvent(new Event('monitoring_hospital_changed'))
    }
  }, [selectedHospital])

  useEffect(() => {
    localStorage.setItem('monitoring_ward', selectedWard)
  }, [selectedWard])

  useEffect(() => {
    localStorage.setItem('monitoring_rooms', JSON.stringify(selectedRoom))
  }, [selectedRoom])

  useEffect(() => {
    localStorage.setItem('monitoring_bedsPerRow', bedsPerRow.toString())
  }, [bedsPerRow])

  // Load hospitals on mount and set user's hospital/ward
  useEffect(() => {
    if (hospitals.length === 0) {
      loadHospitals()
    } else if (hospitals.length > 0 && !selectedHospital) {
      // super_admin이 아닌 경우 사용자의 hospital_id로 자동 선택
      if (userRole !== 'super_admin' && userInfo.hospital_id) {
        setSelectedHospital(userInfo.hospital_id.toString())
      } else {
        // super_admin은 첫번째 병원 자동 선택
        setSelectedHospital(hospitals[0].id.toString())
      }
    }
  }, [hospitals, userRole, userInfo.hospital_id])

  // Load wards and set user's ward
  useEffect(() => {
    if (localWards.length > 0 && !selectedWard && userRole !== 'super_admin' && userInfo.ward_id) {
      // super_admin이 아니고 ward_id가 있으면 자동 선택
      setSelectedWard(userInfo.ward_id.toString())
    }
  }, [localWards, userRole, userInfo.ward_id])

  // Load wards when hospital changes
  useEffect(() => {
    if (selectedHospital && selectedHospital !== '') {
      const filtered = wards.filter(w => w.hospital_id === parseInt(selectedHospital))
      setLocalWards(filtered)

      // 초기 마운트가 아닐 때만 병동/병실 초기화 (사용자가 직접 병원을 변경한 경우)
      if (!isInitialMountRef.current) {
        setSelectedWard('')
        setSelectedRoom([])
        setLocalRooms([])
      }
    } else {
      setLocalWards([])
      setLocalRooms([])
    }
  }, [selectedHospital, wards])

  // Load rooms when ward changes
  useEffect(() => {
    if (selectedWard && selectedWard !== '') {
      const filtered = rooms.filter(r => r.ward_id === parseInt(selectedWard))
      setLocalRooms(filtered)

      // 초기 마운트가 아닐 때만 병실 초기화 (사용자가 직접 병동을 변경한 경우)
      if (!isInitialMountRef.current) {
        setSelectedRoom([])
      }
    } else {
      setLocalRooms([])
    }
  }, [selectedWard, rooms])

  // Load all wards and rooms on mount
  useEffect(() => {
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

    // 초기 마운트 플래그 해제 (데이터 로드 후)
    setTimeout(() => {
      isInitialMountRef.current = false
    }, 1000)

    // Cleanup: 컴포넌트 unmount 시 모든 타이머 정리
    return () => {
      alertTimersRef.current.forEach(timer => clearTimeout(timer))
      alertTimersRef.current.clear()
    }
  }, [])

  // % 정규화: Math.round + 단조증가 클램프 (동일 assignment 내 하락 방지)
  const normalizePercentage = (bedId: number, assignmentId: number, rawPercentage: number): number => {
    const rounded = Math.min(100, Math.max(0, Math.ceil(rawPercentage)))
    const prev = maxPercentageRef.current.get(bedId)

    if (prev && prev.assignmentId === assignmentId) {
      // 동일 assignment: 이전 최대값 이하로 떨어지지 않음
      const clamped = Math.max(prev.percentage, rounded)
      maxPercentageRef.current.set(bedId, { assignmentId, percentage: clamped })
      return clamped
    }
    // 새 assignment 또는 첫 데이터: 초기화
    maxPercentageRef.current.set(bedId, { assignmentId, percentage: rounded })
    return rounded
  }

  // API 응답 데이터 전체에 % 정규화 적용
  const normalizeMonitoringData = (data: WardData[]): WardData[] => {
    return data.map(ward => ({
      ...ward,
      rooms: ward.rooms.map(room => ({
        ...room,
        beds: room.beds.map(bed => ({
          ...bed,
          assignments: bed.assignments?.map(assignment => ({
            ...assignment,
            infusion_percentage: normalizePercentage(bed.bed_id, assignment.id, assignment.infusion_percentage)
          })) || []
        }))
      }))
    }))
  }

  const loadMonitoringData = useCallback(async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true)
    }
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://iringer.kr/api'
      let url = `${API_BASE_URL}/monitoring/data/list?hospital_id=${selectedHospital}`
      if (selectedWard && selectedWard !== '') {
        url += `&ward_id=${selectedWard}`
      }
      if (selectedRoom && selectedRoom.length > 0) {
        // 다중 선택된 병실들을 쿼리 파라미터로 추가
        selectedRoom.forEach(roomId => {
          url += `&room_id=${roomId}`
        })
      }

      const response = await fetch(url)
      const result: MonitoringResponse = await response.json()
      // console.log('Monitoring API response:', result)

      if (result.success && result.data) {
        // 이전 데이터에서 환자 정보 보존 (투여완료 후 assignment가 사라져도 환자는 유지)
        const preservePatientInfo = (newData: WardData[], prevData: WardData[]): WardData[] => {
          const prevPatientMap = new Map<number, BedData['patient_info']>()
          prevData.forEach(ward => {
            ward.rooms.forEach(room => {
              room.beds.forEach(bed => {
                if (bed.patient_info) {
                  prevPatientMap.set(bed.bed_id, bed.patient_info)
                }
              })
            })
          })

          return newData.map(ward => ({
            ...ward,
            rooms: ward.rooms.map(room => ({
              ...room,
              beds: room.beds.map(bed => {
                if (!bed.patient_info && prevPatientMap.has(bed.bed_id)) {
                  return { ...bed, patient_info: prevPatientMap.get(bed.bed_id)! }
                }
                return bed
              })
            }))
          }))
        }

        // silent 모드일 때는 변경된 데이터만 업데이트
        if (silent) {
          setMonitoringData(prevData => {
            const normalized = preservePatientInfo(normalizeMonitoringData(result.data), prevData)
            const prevJson = JSON.stringify(prevData)
            const newJson = JSON.stringify(normalized)
            if (prevJson === newJson) {
              return prevData // 변경 없으면 이전 데이터 유지 (리렌더링 방지)
            }
            return normalized
          })
        } else {
          setMonitoringData(normalizeMonitoringData(result.data))
        }

        // 데이터 로드 완료 후 pending된 alerts 처리
        if (pendingAlertsRef.current.size > 0) {
          // console.log(`🔄 Processing ${pendingAlertsRef.current.size} pending alerts`)

          pendingAlertsRef.current.forEach((alertType, bedId) => {
            // console.log(`🔄 [BED ${bedId}] Processing pending alert: ${alertType}`)

            // wardSettingsRef에서 threshold 설정 가져오기
            const ws = wardSettingsRef.current
            let completeEnabled = ws?.complete_enabled || 0
            let completeThreshold = ws?.complete_threshold || 95

            // alert_type 업데이트 (로드된 데이터로)
            setMonitoringData(prevData => {
              let bedFound = false

              // threshold 체크
              if (completeEnabled === 1) {
                let currentPercentage = 0
                let shouldProcessAlert = false

                prevData.forEach(ward => {
                  ward.rooms.forEach(room => {
                    room.beds.forEach(bed => {
                      if (bed.bed_id === bedId && bed.assignments && bed.assignments.length > 0) {
                        bedFound = true
                        currentPercentage = bed.assignments[0].infusion_percentage || 0
                        shouldProcessAlert = currentPercentage < completeThreshold
                      }
                    })
                  })
                })

                if (!bedFound) {
                  // console.log(`⚠️ [BED ${bedId}] Bed not found after data load`)
                  return prevData
                }

                if (!shouldProcessAlert) {
                  // console.log(`🚫 [BED ${bedId}] Pending alert ignored - percentage ${currentPercentage} >= threshold ${completeThreshold}`)
                  return prevData
                }
              }

              // alert_type 업데이트
              return prevData.map(ward => ({
                ...ward,
                rooms: ward.rooms.map(room => ({
                  ...room,
                  beds: room.beds.map(bed => {
                    if (bed.bed_id === bedId && bed.assignments && bed.assignments.length > 0) {
                      return {
                        ...bed,
                        assignments: bed.assignments.map(a =>
                          (a.device_id || a.device) ? { ...a, alert_type: alertType } : a
                        )
                      }
                    }
                    return bed
                  })
                }))
              }))
            })

          })

          // pending queue 비우기
          pendingAlertsRef.current.clear()
          // console.log('✅ All pending alerts processed')
        }
      } else {
        // console.error('Invalid monitoring data format:', result)
        setMonitoringData([])
      }
    } catch (error) {
      // console.error('Failed to load monitoring data:', error)
      if (!silent) {
        setMonitoringData([])
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [selectedHospital, selectedWard, selectedRoom])

  // Load monitoring data when filters change
  useEffect(() => {
    if (selectedHospital) {
      loadMonitoringData()
    }
  }, [selectedHospital, selectedWard, selectedRoom, loadMonitoringData])

  // 15초 간격 자동 새로고침
  useEffect(() => {
    if (!selectedHospital) {
      return
    }

    // console.log('🟢 [Auto Refresh] 자동 새로고침 시작')

    // 15초(15000ms) 간격으로 데이터 새로고침 (silent 모드로 깜빡임 방지)
    const refreshInterval = setInterval(() => {
      // console.log('🔄 [Auto Refresh] 15초 자동 새로고침 실행')
      loadMonitoringData(true)
    }, 15000)

    // 컴포넌트 언마운트 시 interval 정리
    return () => {
      // console.log('🛑 [Auto Refresh] 자동 새로고침 중지')
      clearInterval(refreshInterval)
    }
  }, [selectedHospital, loadMonitoringData])

  // MQTT 구독 관리: monitoringData가 변경될 때마다 현재 표시 중인 bed들을 구독
  useEffect(() => {
    if (!isConnected || monitoringData.length === 0) {
      return
    }

    // 현재 표시 중인 모든 bed_id 추출
    const currentBedIds: number[] = []
    monitoringData.forEach(ward => {
      ward.rooms.forEach(room => {
        room.beds.forEach(bed => {
          currentBedIds.push(bed.bed_id)
        })
      })
    })

    // 토픽 목록 생성
    const newTopics = currentBedIds.map(bedId => `bed/${bedId}/assignment/update`)
    const newTopicsSet = new Set(newTopics)
    const oldTopicsSet = new Set(subscribedTopics)

    // 변경사항이 없으면 skip
    if (newTopics.length === subscribedTopics.length &&
        newTopics.every(topic => oldTopicsSet.has(topic))) {
      return
    }

    // console.log(`🔄 Updating MQTT subscriptions for ${currentBedIds.length} beds`)

    // 기존 구독 해제
    subscribedTopics.forEach(topic => {
      if (!newTopicsSet.has(topic)) {
        unsubscribe(topic)
      }
    })

    // 새로운 구독 추가
    newTopics.forEach(topic => {
      if (!oldTopicsSet.has(topic)) {
        subscribe(topic)
      }
    })

    // 구독 목록 업데이트
    setSubscribedTopics(newTopics)
  }, [monitoringData, isConnected])

  // MQTT 메시지 수신 시 해당 bed 데이터 업데이트
  useEffect(() => {
    if (!lastMessage || !lastMessage.topic) {
      return
    }

    // console.log('🔔 [MQTT] 메시지 수신:', {
    //   topic: lastMessage.topic,
    //   data: lastMessage.data,
    //   timestamp: lastMessage.timestamp
    // })

    // 1. bed assignment update 토픽 처리: "bed/{bed_id}/assignment/update"
    const assignmentTopicMatch = lastMessage.topic.match(/^bed\/(\d+)\/assignment\/update$/)
    if (assignmentTopicMatch) {
      const bedId = parseInt(assignmentTopicMatch[1])
      const messageData = lastMessage.data

      // console.log(`🔔 [BED ${bedId}] MQTT Update:`, {
      //   percentage: messageData.infusion_percentage,
      //   volume: messageData.infusion_current_volume,
      //   alert: messageData.alert_type
      // })

      // monitoringData에서 해당 bed를 찾아서 업데이트
      setMonitoringData(prevData => {
        return prevData.map(ward => {
          return {
            ...ward,
            rooms: ward.rooms.map(room => {
              return {
                ...room,
                beds: room.beds.map(bed => {
                  if (bed.bed_id === bedId) {
                    // assignment가 있으면 해당 assignment만 업데이트 (다른 수액은 유지)
                    if (bed.assignments && bed.assignments.length > 0) {
                      const updatedAssignments = bed.assignments.map(a => {
                        const isTarget = messageData.assignment_id
                          ? a.id === messageData.assignment_id
                          : (messageData.device_id && a.device_id === messageData.device_id)
                        if (!isTarget) return a
                        return {
                          ...a,
                          infusion_percentage: messageData.infusion_percentage != null
                            ? normalizePercentage(bedId, a.id, messageData.infusion_percentage)
                            : a.infusion_percentage,
                          infusion_current_volume: messageData.infusion_current_volume ?? a.infusion_current_volume,
                          alert_type: messageData.alert_type !== undefined ? messageData.alert_type : a.alert_type,
                          ...(messageData.device_id !== undefined ? { device_id: messageData.device_id } : {}),
                          ...(messageData.device !== undefined ? { device: messageData.device } : {}),
                        }
                      })
                      return { ...bed, assignments: updatedAssignments }
                    }
                  }
                  return bed
                })
              }
            })
          }
        })
      })
      return
    }

    // 2. user assignment refresh 토픽 처리: "user/{user_id}/assignment/refresh" - 데이터 새로고침
    const assignmentRefreshTopicMatch = lastMessage.topic.match(/^user\/\d+\/assignment\/refresh$/)
    if (assignmentRefreshTopicMatch) {
      const messageData = lastMessage.data
      // console.log('🔄 [ASSIGNMENT REFRESH] 새로운 assignment 추가됨!')
      // console.log('  - Topic:', lastMessage.topic)
      // console.log('  - Data:', messageData)
      // console.log('  - 현재 선택된 Hospital:', selectedHospital)
      // console.log('  - 현재 선택된 Ward:', selectedWard)
      // console.log('  - 현재 선택된 Room:', selectedRoom)
      // console.log('  ➡️ loadMonitoringData() 호출 시작...')

      // 모니터링 데이터 다시 로드 (silent 모드로 로딩 깜빡임 방지)
      loadMonitoringData(true)
      // console.log('  ✅ loadMonitoringData(true) 호출 완료')
      return
    }

    // 3. user notification 토픽 처리 → MonitoringPage에서 알림 모달로 표시

  }, [lastMessage, loadMonitoringData])

  const [selectedBeds, setSelectedBeds] = useState<string[]>([])

  const handleBedSelect = (bedId: string) => {
    if (isMultiSelectMode || isQRMode) {
      // 다중 선택 모드
      if (selectedBeds.includes(bedId)) {
        setSelectedBeds(selectedBeds.filter(id => id !== bedId))
      } else {
        setSelectedBeds([...selectedBeds, bedId])
      }
    } else {
      // 일반 모드: 해당 병상만 선택하고 투여 완료 모달 열기
      setSelectedBeds([bedId])
      setShowCompleteModal(true)
    }
  }

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handleCompleteInfusion = () => {
    if (!isMultiSelectMode) {
      // 첫 클릭: 다중 선택 모드 활성화
      setIsMultiSelectMode(true)
      setIsQRMode(false)
      setSelectedBeds([])
    } else if (selectedBeds.length > 0) {
      // 병상 선택 후 클릭: 모달 호출
      setShowCompleteModal(true)
    } else {
      // 0명 선택된 상태에서 다시 클릭: 다중 선택 모드 해제
      setIsMultiSelectMode(false)
    }
  }

  const handleQRCode = () => {
    if (!isQRMode) {
      // 첫 클릭: QR 모드 활성화
      setIsQRMode(true)
      setIsMultiSelectMode(false)
      setSelectedBeds([])
    } else if (selectedBeds.length > 0) {
      // 병상 선택 후 클릭: QR 코드 모달 표시
      setShowQRModal(true)
    } else {
      // 0명 선택된 상태에서 다시 클릭: QR 모드 해제
      setIsQRMode(false)
    }
  }

  const handleConfirmComplete = async () => {
    // 선택된 bed들의 assignment_id 추출 및 bed 정보 매핑
    const assignmentData = selectedBeds.map(bedId => {
      const [, bedNumber] = bedId.split('-')
      const bedData = allBeds.find(b => b.bed.bed_id === parseInt(bedNumber))
      const assignment = bedData?.bed.assignments?.[0]
      return {
        assignment_id: assignment?.id,
        bedInfo: {
          roomNumber: bedData?.room.room_number || '',
          bedNumber: bedData?.bed.bed_number || ''
        }
      }
    }).filter(item => item.assignment_id !== undefined)

    const assignmentIds = assignmentData.map(item => item.assignment_id!)

    try {
      // Bulk release API 호출
      const response = await dataProvider.bulkReleaseAssignments(assignmentIds)
      // console.log('Bulk release response:', response)

      // 투여 완료 후 모니터링 데이터 새로고침
      await loadMonitoringData()
    } catch (error: any) {
      console.error('Bulk release failed:', error)
    }

    setShowCompleteModal(false)
    setSelectedBeds([])
    setIsMultiSelectMode(false)
  }

  const handleCloseCompleteModal = () => {
    setShowCompleteModal(false)
  }

  const handleCloseQRModal = () => {
    setShowQRModal(false)
  }

  // 다중선택 모드 취소
  const handleCancelMultiSelectMode = () => {
    setIsMultiSelectMode(false)
    setIsQRMode(false)
    setSelectedBeds([])
  }

  // ESC 키로 다중선택 모드 취소
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (isMultiSelectMode || isQRMode)) {
        handleCancelMultiSelectMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMultiSelectMode, isQRMode])

  const handleConfirmSettings = async (settings: SettingsData) => {
    try {
      const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
      const userId = userInfo.user_id || userInfo.id

      if (!userId) {
        console.error('User ID not found')
        return
      }

      // user_settings API 데이터 (UI 관련만)
      const userSettingData = {
        alert_color: settings.alertColor,
        alert_display_time: settings.alertDisplayTime,
        critical_alert_enabled: settings.criticalAlertEnabled ? 1 : 0,
        critical_sound_enabled: settings.criticalSoundEnabled ? 1 : 0,
        caution_alert_enabled: settings.cautionAlertEnabled ? 1 : 0,
        caution_sound_enabled: settings.cautionSoundEnabled ? 1 : 0,
        system_error_alert_enabled: settings.systemErrorAlertEnabled ? 1 : 0,
        system_error_sound_enabled: settings.systemErrorSoundEnabled ? 1 : 0,
        critical_sound_volume: settings.criticalSoundVolume,
        caution_sound_volume: settings.cautionSoundVolume,
        system_error_sound_volume: settings.systemErrorSoundVolume,
        volume_display_mode: settings.volumeDisplayMode,
      }

      // user_settings 저장
      const response = await dataProvider.getList('user_settings', {
        page: 1,
        limit: 1,
        where: `user_id:${userId}`
      })

      if (response.data && response.data.length > 0) {
        const existingSetting = response.data[0] as any
        await dataProvider.update('user_settings', existingSetting.id, userSettingData)
      } else {
        await dataProvider.create('user_settings', {
          user_id: userId,
          ...userSettingData
        })
      }

      // ward_settings 저장 (threshold 관련) - 서버에서 id 조회 후 PUT
      const wardId = userInfo.ward_id
      if (wardId) {
        const wardSettingData = {
          fast_enabled: settings.fastAlert.enabled ? 1 : 0,
          fast_threshold: parseInt(settings.fastAlert.calculation) || 50,
          slow_enabled: settings.slowAlert.enabled ? 1 : 0,
          slow_threshold: parseInt(settings.slowAlert.calculation) || 50,
          default_cchr: settings.fastSlowCchr,
          complete_enabled: settings.completionAlert.enabled ? 1 : 0,
          complete_threshold: settings.completionAlert.threshold,
          stop_enabled: settings.stopAlert.enabled ? 1 : 0,
        }

        if (wardSettingsRef.current?.id) {
          await dataProvider.update('ward_settings', wardSettingsRef.current.id, wardSettingData)
        } else {
          const wardRes = await dataProvider.getList('ward_settings', {
            page: 1, limit: 1, where: `ward_id:${wardId}`
          })
          if (wardRes.data && wardRes.data.length > 0) {
            const ws = wardRes.data[0] as any
            await dataProvider.update('ward_settings', ws.id, wardSettingData)
          }
        }

        // state 갱신
        await loadWardSettings()
      }

      // user_setting localStorage 업데이트 (MQTT 핸들러에서 즉시 참조)
      localStorage.setItem('user_setting', JSON.stringify({
        alert_color: settings.alertColor,
        alert_display_time: settings.alertDisplayTime,
        volume_display_mode: settings.volumeDisplayMode,
        critical_alert_enabled: settings.criticalAlertEnabled ? 1 : 0,
        critical_sound_enabled: settings.criticalSoundEnabled ? 1 : 0,
        caution_alert_enabled: settings.cautionAlertEnabled ? 1 : 0,
        caution_sound_enabled: settings.cautionSoundEnabled ? 1 : 0,
        system_error_alert_enabled: settings.systemErrorAlertEnabled ? 1 : 0,
        system_error_sound_enabled: settings.systemErrorSoundEnabled ? 1 : 0,
        critical_sound_volume: settings.criticalSoundVolume,
        caution_sound_volume: settings.cautionSoundVolume,
        system_error_sound_volume: settings.systemErrorSoundVolume,
      }))

      // 설정 모달 닫기 (새로고침 없이 상태만 업데이트)
      setShowSettingsModal(false)

      // 설정 변경 트리거 - 병상 카드 리렌더링
      setSettingsVersion(prev => prev + 1)

      // 데이터 다시 불러오기 (현재 필터 유지한 채로)
      loadMonitoringData()
    } catch (error) {
      console.error('설정 저장 실패:', error)
    }
  }

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false)
  }

  const handleGenerateData = async () => {
    if (!selectedHospital) {
      alert('병원을 선택해주세요.')
      return
    }

    try {
      const hospital_id = parseInt(selectedHospital)
      const ward_id = selectedWard && selectedWard !== '' ? parseInt(selectedWard) : null

      // console.log('🚀 가상 데이터 생성 요청:', {
      //   hospital_id,
      //   ward_id,
      //   selectedHospital,
      //   selectedWard
      // })

      const response = await dataProvider.generateMonitoringData(hospital_id, ward_id)

      // console.log('📦 가상 데이터 생성 응답:', response)

      // success 필드로 성공 여부 확인
      if (response.success === false) {
        // 서버가 success: false를 반환한 경우
        if (response.statusCode === 409) {
          alert('가상 데이터 생성 실패\n\n모든 침대가 이미 사용 중입니다.\n먼저 투여 완료 처리를 하거나 기존 데이터를 정리해주세요.')
        } else {
          alert(`가상 데이터 생성 실패\n\n${response.message || '알 수 없는 오류'}`)
        }
        return
      }

      // 성공 메시지 표시
      // console.log('✅ 가상 데이터 생성 성공:', response)
      alert('가상 데이터 생성 완료!')

      // 데이터 새로고침
      await loadMonitoringData()
    } catch (error: any) {
      console.error('❌ 가상 데이터 생성 실패:', {
        error,
        message: error.message,
        status: error.status,
        statusCode: error.statusCode,
        response: error.response,
        fullError: error
      })

      // 상세한 에러 메시지 표시
      let errorMessage = '가상 데이터 생성에 실패했습니다.\n\n'

      if (error.status === 404) {
        errorMessage += '병원 또는 병동을 찾을 수 없습니다.\n'
        errorMessage += `병원 ID: ${selectedHospital}\n`
        if (selectedWard) errorMessage += `병동 ID: ${selectedWard}\n`
      } else if (error.status === 400) {
        errorMessage += '잘못된 요청입니다.\n'
        errorMessage += error.message || error.response?.message || ''
      } else if (error.status === 500) {
        errorMessage += '서버 오류가 발생했습니다.\n'
        errorMessage += error.message || error.response?.message || ''
      } else {
        errorMessage += error.message || error.response?.message || '알 수 없는 오류'
      }

      alert(errorMessage)
    }
  }

  // 모든 침대 데이터를 flat하게 변환
  const allBeds: { room: RoomData; bed: BedData; wardName: string }[] = []
  monitoringData?.forEach(ward => {
    ward.rooms?.forEach(room => {
      room.beds?.forEach(bed => {
        allBeds.push({ room, bed, wardName: ward.ward_name })
      })
    })
  })

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100, position: 'relative' }}>
      {hasDrawer && (
        <Sidebar
          userRole={userRole}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      )}

      <Header sidebarCollapsed={sidebarCollapsed} hasDrawer={hasDrawer} onOpenSettings={() => setShowSettingsModal(true)} />

      <MainContent hasDrawer={hasDrawer} drawerCollapsed={sidebarCollapsed} isDarkMode={isDarkMode}>
        {/* Controls */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, paddingLeft: '24px', paddingRight: '24px' }}>
          {/* 병원 드롭다운 - 모든 role에서 표시 */}
          <CustomDropdown
            options={hospitalOptions}
            value={selectedHospital}
            onChange={(value) => setSelectedHospital(value as string)}
            placeholder="병원 선택"
            disabled={userRole !== 'super_admin'} // super_admin이 아니면 비활성화
            isDarkMode={isDarkMode}
          />

          {/* 병동 드롭다운 */}
          <CustomDropdown
            options={wardOptions}
            value={selectedWard}
            onChange={(value) => setSelectedWard(value as string)}
            placeholder="전체 병동"
            showAllOption={true}
            allOptionLabel="전체 병동"
            disabled={!selectedHospital || (userRole !== 'super_admin' && !!userInfo.ward_id)} // ward_id가 있으면 비활성화
            isDarkMode={isDarkMode}
          />
          
          {/* 병실 드롭다운 */}
          <CustomDropdown
            options={roomOptions}
            value={selectedRoom}
            onChange={(value) => setSelectedRoom(value as string[])}
            placeholder="전체 병실"
            showAllOption={true}
            allOptionLabel="전체 병실"
            disabled={!selectedWard}
            isDarkMode={isDarkMode}
            multiSelect={true}
          />
          <Box sx={{ flexGrow: 1 }} />

          {userRole === 'super_admin' && (
            <Button
              variant="contained"
              startIcon={
                <Box
                  component="img"
                  src="/icons/ic_plus_fill.svg"
                  sx={{ width: 18, height: 18 }}
                />
              }
              onClick={handleGenerateData}
              disabled={isMultiSelectMode || isQRMode || !selectedHospital}
              sx={{
                bgcolor: isDarkMode ? colors.gray.gray1000 : colors.gray.gray600,
                color: 'white',
                textTransform: 'none',
                height: 40,
                borderRadius: '20px',
                px: 2,
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: isDarkMode ? colors.gray.gray900 : colors.gray.gray700,
                  boxShadow: 'none',
                },
                '&:disabled': {
                  bgcolor: isDarkMode ? colors.gray.gray1000 : '#2C2C3C',
                  color: 'white',
                  opacity: isDarkMode ? 0.5 : 0.2,
                }
              }}
            >
              가상 데이터 생성
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={
              <Box
                component="img"
                src="/icons/ic_check_circle.svg"
                sx={{
                  width: 18,
                  height: 18,
                  filter: isMultiSelectMode
                    ? 'brightness(0) saturate(100%) invert(39%) sepia(92%) saturate(2537%) hue-rotate(198deg) brightness(96%) contrast(101%)'
                    : 'none'
                }}
              />
            }
            onClick={handleCompleteInfusion}
            disabled={isQRMode}
            sx={{
              background: isMultiSelectMode
                ? 'rgba(0, 158, 230, 0.16)'
                : 'linear-gradient(to right, #7CCAF1, #0058E6)',
              color: isMultiSelectMode ? colors.mainColor.blue : 'white',
              border: isMultiSelectMode ? `1px solid ${colors.mainColor.blue}` : 'none',
              textTransform: 'none',
              height: 40,
              borderRadius: '20px',
              px: 2,
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: isMultiSelectMode
                ? '0px 0px 14px 0px rgba(0, 158, 230, 0.5)'
                : 'none',
              '&:hover': {
                background: isMultiSelectMode
                  ? 'rgba(0, 158, 230, 0.16)'
                  : 'linear-gradient(to right, #7CCAF1, #0058E6)',
                opacity: isMultiSelectMode ? 1 : 0.9,
                boxShadow: isMultiSelectMode
                  ? '0px 0px 14px 0px rgba(0, 158, 230, 0.5)'
                  : 'none',
              },
              '&:disabled': {
                background: 'linear-gradient(to right, #7CCAF1, #0058E6)',
                color: 'white',
                opacity: 0.2,
              }
            }}
          >
            {isMultiSelectMode
              ? `투여 완료 (${selectedBeds.length}명 선택됨)`
              : '투여 완료'}
          </Button>

          {/* 투여완료 모드 취소 버튼 */}
          {isMultiSelectMode && (
            <Button
              variant="outlined"
              onClick={handleCancelMultiSelectMode}
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
            disabled={isMultiSelectMode}
            sx={{
              background: isQRMode
                ? 'rgba(142, 206, 75, 0.16)'
                : colors.mainColor.green,
              color: isQRMode ? colors.mainColor.green : 'white',
              border: isQRMode ? `1px solid ${colors.mainColor.green}` : 'none',
              textTransform: 'none',
              height: 40,
              borderRadius: '20px',
              px: 2,
              fontSize: '14px',
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
              },
              '&:disabled': {
                bgcolor: colors.mainColor.green,
                color: 'white',
                opacity: 0.3,
              }
            }}
          >
            {isQRMode
              ? `병상 QR 인쇄 (${selectedBeds.length}명 선택됨)`
              : 'QR 코드'}
          </Button>

          {/* QR 모드 취소 버튼 */}
          {isQRMode && (
            <Button
              variant="outlined"
              onClick={handleCancelMultiSelectMode}
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

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            ml: 2,
            bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
            borderRadius: '20px',
            px: 2.5,
            py: 0.5,
            height: 40
          }}>
            <Typography variant="body2" sx={{
              color: isDarkMode ? colors.gray.gray300 : colors.gray.gray700,
              fontSize: '14px',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}>
              한 줄 개수
            </Typography>
            <Button
              variant="text"
              size="small"
              onClick={() => setBedsPerRow(Math.max(3, bedsPerRow - 1))}
              disabled={bedsPerRow <= 3}
              sx={{
                minWidth: 28,
                height: 28,
                p: 0,
                borderRadius: '50%',
                bgcolor: isDarkMode ? colors.gray.gray500 : 'transparent',
                color: isDarkMode ? 'white' : colors.gray.gray600,
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray200,
                  boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.15)',
                },
                '&:disabled': {
                  bgcolor: isDarkMode ? colors.gray.gray700 : 'transparent',
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray400,
                  boxShadow: 'none'
                }
              }}
            >
              <RemoveIcon sx={{ fontSize: 20 }} />
            </Button>
            <Typography variant="body1" sx={{
              minWidth: 24,
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '16px',
              color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800
            }}>
              {bedsPerRow}
            </Typography>
            <Button
              variant="text"
              size="small"
              onClick={() => setBedsPerRow(Math.min(7, bedsPerRow + 1))}
              disabled={bedsPerRow >= 7}
              sx={{
                minWidth: 28,
                height: 28,
                p: 0,
                borderRadius: '50%',
                bgcolor: isDarkMode ? colors.gray.gray500 : 'transparent',
                color: isDarkMode ? 'white' : colors.gray.gray600,
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                '&:hover': {
                  bgcolor: isDarkMode ? colors.gray.gray600 : colors.gray.gray200,
                  boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.15)',
                },
                '&:disabled': {
                  bgcolor: isDarkMode ? colors.gray.gray700 : 'transparent',
                  color: isDarkMode ? colors.gray.gray400 : colors.gray.gray400,
                  boxShadow: 'none'
                }
              }}
            >
              <AddIcon sx={{ fontSize: 20 }} />
            </Button>
          </Box>
        </Box>

        {/* Beds Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, paddingLeft: '24px', paddingRight: '24px' }}>
            <Typography>데이터를 불러오는 중...</Typography>
          </Box>
        ) : allBeds.length > 0 ? (
          <Box sx={{
            flexGrow: 1,
            overflow: 'auto',
            minHeight: 0,
            paddingLeft: '24px',
            paddingRight: '24px',
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
            {/* 병실별로 그룹화 */}
            {monitoringData.map(ward => {
              // 병동 내 최대 병상 수 계산
              const maxBedsInWard = Math.max(...ward.rooms.map(room => room.beds?.length || 0))
              // 동적 높이 계산: 기본 여백(73px) + 병상(70px * n) + gap(16px * (n-1))
              const dynamicMinHeight = maxBedsInWard > 0 ? 73 + 70 * maxBedsInWard + 16 * (maxBedsInWard - 1) : 200

              return (
              <Box key={ward.ward_id} sx={{ mb: 4 }}>
                <Typography sx={{
                  fontSize: '24px',
                  fontWeight: 700,
                  mb: 2,
                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800
                }}>
                  {ward.ward_name}
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${bedsPerRow}, 1fr)`, gap: 3 }}>
                  {ward.rooms.map(room => (
                    <Box key={room.room_id} sx={{
                      backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                      borderRadius: '16px',
                      padding: 3,
                      minHeight: dynamicMinHeight,
                      boxShadow: isDarkMode ? 'none' : '0px 2px 8px rgba(0, 0, 0, 0.04)'
                    }}>
                      <Typography sx={{
                        fontSize: '24px',
                        fontWeight: 700,
                        mb: 1.5,
                        color: isDarkMode ? colors.gray.gray200 : colors.gray.gray700
                      }}>
                        {room.room_number}
                      </Typography>
                      <Box sx={{
                        width: 'calc(100% + 48px)',
                        height: '1px',
                        backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray200,
                        mb: 1.5,
                        ml: -3,
                        mr: -3
                      }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {room.beds?.sort((a, b) => {
                          const aHasAssignment = a.assignments?.length > 0
                          const bHasAssignment = b.assignments?.length > 0
                          if (aHasAssignment && !bHasAssignment) return -1
                          if (!aHasAssignment && bHasAssignment) return 1
                          return 0
                        }).map(bed => {
                        const bedId = `${room.room_id}-${bed.bed_id}`
                        const isSelected = selectedBeds.includes(bedId)
                        const hasAssignment = bed.assignments?.length > 0
                        const assignment = hasAssignment ? bed.assignments[0] : null
                        const isCompleted = assignment?.infusion_percentage === 100
                        // assignment는 있지만 device가 null이면 기기 미연결
                        const hasWarning = hasAssignment && assignment && assignment.device === null
                        const progress = Math.min(100, Math.max(0, Math.ceil(assignment?.infusion_percentage || 0)))
                        const alertType = assignment?.alert_type?.toUpperCase()
                        // alert_type이 disconnected인 경우
                        const isDisconnectedAlert = hasAssignment && assignment && alertType === 'DISCONNECTED'

                        // alert_color 확인 (user_setting에서)
                        const userSettingStr = localStorage.getItem('user_setting')
                        let alertColor = colors.mainColor.red // 기본 색상 - 항상 빨간색으로 시작
                        if (userSettingStr) {
                          try {
                            const userSetting = JSON.parse(userSettingStr)
                            if (userSetting.alert_color) {
                              if (typeof userSetting.alert_color === 'string' && userSetting.alert_color.startsWith('#')) {
                                alertColor = userSetting.alert_color
                              } else {
                                alertColor = colors.mainColor.red
                              }
                            }
                          } catch (error) {
                            console.error('Failed to parse user_setting:', error)
                          }
                        }

                        // threshold 설정 (wardSettings state에서)
                        const wsCard = wardSettings
                        let completeThreshold = wsCard?.complete_threshold || 95
                        let fastEnabled = wsCard?.fast_enabled !== undefined ? wsCard.fast_enabled : 1
                        let slowEnabled = wsCard?.slow_enabled !== undefined ? wsCard.slow_enabled : 1
                        let stopEnabled = wsCard?.stop_enabled !== undefined ? wsCard.stop_enabled : 1
                        let completeEnabled = wsCard?.complete_enabled !== undefined ? wsCard.complete_enabled : 1

                        // critical alert: 설정값에 따라 조건부로 표시
                        const isAlertEnabled = (type: string | undefined) => {
                          if (!type) return false
                          switch (type) {
                            case 'FAST':
                              return fastEnabled === 1
                            case 'SLOW':
                              return slowEnabled === 1
                            case 'STOP':
                              return stopEnabled === 1
                            case 'END':
                              return completeEnabled === 1
                            default:
                              return false
                          }
                        }

                        const hasCriticalAlert = hasAssignment && assignment && alertType &&
                          ['SLOW', 'STOP', 'FAST', 'END'].includes(alertType) &&
                          isAlertEnabled(alertType)

                        // 디버깅: alert 상태 확인
                        // if (hasCriticalAlert) {
                        //   console.log(`🔍 Critical Alert - Bed: ${bed.bed_id}, Type: ${alertType}, Color: ${alertColor}, HasWarning: ${hasWarning}`)
                        // }

                        // assignment만 있으면 선택 가능 (기기 미연결도 가능)
                        const canInteract = hasAssignment

                        return (
                          <BedCard
                            key={bed.bed_id}
                            selected={isSelected}
                            completed={isCompleted}
                            warning={hasWarning || isDisconnectedAlert || false}
                            isDarkMode={isDarkMode}
                            isSelectMode={isMultiSelectMode || isQRMode}
                            isQRMode={isQRMode}
                            canInteract={canInteract || false}
                            highProgress={progress >= completeThreshold && !isCompleted && completeEnabled === 1}
                            criticalAlert={hasCriticalAlert || false}
                            alertColor={alertColor}
                            onClick={() => {
                              if (canInteract) {
                                handleBedSelect(bedId)
                              }
                            }}
                          >
                            {/* Hover 오버레이 - 투여 완료! - assignment가 있을 때 */}
                            {hasAssignment && !isMultiSelectMode && !isQRMode && (
                              <Box
                                className="hover-overlay"
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  background: 'linear-gradient(to right, #7CCAF1, #0058E6)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '16px',
                                  opacity: 0,
                                  transition: 'opacity 0.2s ease',
                                  pointerEvents: 'none',
                                  zIndex: 10,
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: 'white',
                                  }}
                                >
                                  투여 완료!
                                </Typography>
                              </Box>
                            )}

                            {/* assignments가 없으면 아무것도 표시 안함 */}
                            {!hasAssignment ? null : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {/* 좌측 체크박스 또는 아이콘 */}
                                <Box sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  bgcolor: (isMultiSelectMode || isQRMode)
                                    ? 'transparent'
                                    : (hasWarning || isDisconnectedAlert)
                                    ? `${alertColor}1A` // 기기 미연결 및 알림: 사용자 설정 색상 + 10% 투명도
                                    : hasCriticalAlert
                                    ? `${alertColor}1A` // 알림: 사용자 설정 색상 + 10% 투명도
                                    : `${colors.mainColor.blue}1A`,
                                  border: (isMultiSelectMode || isQRMode)
                                    ? 'none'
                                    : (hasWarning || isDisconnectedAlert)
                                    ? `1px solid ${alertColor}` // 기기 미연결 및 알림: 사용자 설정 색상
                                    : hasCriticalAlert
                                    ? `1px solid ${alertColor}` // 알림: 사용자 설정 색상
                                    : `1px solid ${colors.mainColor.lightBlue}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {(isMultiSelectMode || isQRMode) ? (
                                    <Box
                                      component="img"
                                      src={isSelected
                                        ? isQRMode ? "/icons/ic_green_check_on.svg" : "/icons/ic_blue_check_on.svg"
                                        : isQRMode
                                          ? (isDarkMode ? "/icons/ic_green_check_off_dark.svg" : "/icons/ic_green_check_off.svg")
                                          : (isDarkMode ? "/icons/ic_green_check_off_dark.svg" : "/icons/ic_blue_check_off.svg")
                                      }
                                      sx={{
                                        width: 26,
                                        height: 26
                                      }}
                                    />
                                  ) : (
                                    <Box
                                      sx={{
                                        width: 20,
                                        height: 20,
                                        // 기기 미연결 및 알림: 사용자 설정 색상, 기본: 파란색
                                        // mask 방식으로 아이콘 형태 유지하며 색상 변경
                                        WebkitMaskImage: 'url(/icons/ic_bed.svg)',
                                        WebkitMaskSize: 'contain',
                                        WebkitMaskRepeat: 'no-repeat',
                                        WebkitMaskPosition: 'center',
                                        maskImage: 'url(/icons/ic_bed.svg)',
                                        maskSize: 'contain',
                                        maskRepeat: 'no-repeat',
                                        maskPosition: 'center',
                                        backgroundColor: (hasWarning || isDisconnectedAlert) ? alertColor : hasCriticalAlert ? alertColor : colors.mainColor.blue,
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* 우측 컨텐츠 */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, flexGrow: 1 }}>
                                  {/* 상단: 병실-병상 이름 */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.25 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                      {/* Critical Alert 및 DISCONNECTED 뱃지 표시 */}
                                      {(hasCriticalAlert || isDisconnectedAlert) && alertType && (
                                        <Box sx={{
                                          px: 1,
                                          py: 0.5,
                                          borderRadius: '6px',
                                          bgcolor: `${alertColor}24`, // 사용자 설정 알림 색상 + 14% 투명도
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}>
                                          <Typography sx={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: alertColor, // 사용자 설정 알림 색상
                                            lineHeight: 1
                                          }}>
                                            {getAlertTypeLabel(alertType)}
                                          </Typography>
                                        </Box>
                                      )}
                                      <Typography sx={{
                                        fontSize: '18px',
                                        fontWeight: 500,
                                        color: (hasWarning || isDisconnectedAlert) ? alertColor : hasCriticalAlert ? alertColor : (isDarkMode ? colors.gray.gray100 : colors.gray.gray800) // 기기 미연결 및 알림: 사용자 설정 색상
                                      }}>
                                        {room.room_number}-{bed.bed_number}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  {/* 하단: 프로그레스 바 또는 기기 미연결 */}
                                  {(hasWarning && !isDisconnectedAlert) ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Box
                                        sx={{
                                          width: 20,
                                          height: 20,
                                          WebkitMaskImage: 'url(/icons/ic_warning.svg)',
                                          WebkitMaskSize: 'contain',
                                          WebkitMaskRepeat: 'no-repeat',
                                          WebkitMaskPosition: 'center',
                                          maskImage: 'url(/icons/ic_warning.svg)',
                                          maskSize: 'contain',
                                          maskRepeat: 'no-repeat',
                                          maskPosition: 'center',
                                          backgroundColor: alertColor, // 사용자 설정 알림 색상
                                        }}
                                      />
                                      <Typography sx={{
                                        fontSize: '16px',
                                        fontWeight: 500,
                                        color: alertColor // 사용자 설정 알림 색상
                                      }}>
                                        기기 미연결
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                      <Box sx={{
                                        flexGrow: 1,
                                        height: 16,
                                        borderRadius: 8,
                                        backgroundColor: (hasCriticalAlert && alertType === 'END')
                                          ? 'white'
                                          : (isDarkMode ? colors.gray.gray700 : colors.gray.gray300),
                                        position: 'relative',
                                        overflow: 'hidden'
                                      }}>
                                        <Box sx={{
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          height: '100%',
                                          width: `${progress}%`,
                                          background: isDisconnectedAlert
                                            ? alertColor // DISCONNECTED: 사용자 설정 알림 색상
                                            : hasCriticalAlert
                                            ? (alertType === 'END'
                                              ? `linear-gradient(to right, ${alertColor}80, ${alertColor})` // END: 연한색에서 진한색으로
                                              : alertColor) // SLOW/STOP/FAST: 단색
                                            : `linear-gradient(to right, ${colors.mainColor.lightBlue} 0%, ${colors.mainColor.lightBlue} 50%, #0058E6 100%)`,
                                          borderRadius: 8,
                                          transition: 'width 0.4s ease'
                                        }} />
                                      </Box>
                                      <Typography sx={{
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        ...(isDisconnectedAlert ? {
                                          // DISCONNECTED: 사용자 설정 알림 색상
                                          color: alertColor
                                        } : hasCriticalAlert ? (
                                          alertType === 'END' ? {
                                            // END: 그라데이션 텍스트
                                            background: `linear-gradient(to right, ${alertColor}80, ${alertColor})`,
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text'
                                          } : {
                                            // SLOW/STOP/FAST: 단색
                                            color: alertColor
                                          }
                                        ) : progress >= 90 ? {
                                          background: `linear-gradient(to right, ${colors.mainColor.lightBlue}, #0058E6)`,
                                          WebkitBackgroundClip: 'text',
                                          WebkitTextFillColor: 'transparent',
                                          backgroundClip: 'text'
                                        } : {
                                          color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600
                                        }),
                                        minWidth: '45px',
                                        textAlign: 'right'
                                      }}>
                                        {progress}%
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            )}
                          </BedCard>
                        )
                        })}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
              )
            })}
          </Box>
        ) : (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
            flexDirection: 'column',
            paddingLeft: '24px',
            paddingRight: '24px'
          }}>
            <Typography variant="h6" sx={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600, mb: 1 }}>
              데이터가 없습니다
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500 }}>
              병원, 병동을 선택해주세요
            </Typography>
          </Box>
        )}

        {/* 투여 완료 확인 모달 */}
        <CompleteInfusionModal
          open={showCompleteModal}
          onClose={handleCloseCompleteModal}
          onConfirm={handleConfirmComplete}
          selectedBeds={selectedBeds.map(bedId => {
            const [, bedNumber] = bedId.split('-')
            const room = allBeds.find(b => b.bed.bed_id === parseInt(bedNumber))
            return {
              roomNumber: room?.room.room_number || '',
              bedNumber: room?.bed.bed_number || ''
            }
          })}
        />

        {/* QR 코드 모달 */}
        <QRCodeModal
          open={showQRModal}
          onClose={handleCloseQRModal}
          selectedBeds={selectedBeds.map(bedId => {
            const [, bedNumber] = bedId.split('-')
            const bedData = allBeds.find(b => b.bed.bed_id === parseInt(bedNumber))
            const wardData = monitoringData.find(w => w.ward_name === bedData?.wardName)
            const hospital = hospitals.find(h => h.id.toString() === selectedHospital)
            return {
              hospitalId: hospital?.id || 0,
              hospitalName: hospital?.name || '',
              wardId: wardData?.ward_id || 0,
              wardName: bedData?.wardName || '',
              roomId: bedData?.room.room_id || 0,
              roomNumber: bedData?.room.room_number || '',
              bedId: bedData?.bed.bed_id || 0,
              bedNumber: bedData?.bed.bed_number || '',
              infusionGtt: bedData?.bed.assignments?.[0]?.infusion_gtt ?? 60,
              infusionCchr: bedData?.bed.assignments?.[0]?.infusion_cchr ?? 0,
              infusionType: getInfusionCode(bedData?.bed.assignments?.[0]?.infusion_code, bedData?.bed.assignments?.[0]?.infusion_type),
              infusionTotalVolume: bedData?.bed.assignments?.[0]?.infusion_total_volume || 0,
              chartNumber: bedData?.bed.patient_info?.chart_number || ''
            }
          })}
        />

        {/* 설정 모달 */}
        <SettingsModal
          open={showSettingsModal}
          onClose={handleCloseSettingsModal}
          onConfirm={handleConfirmSettings}
        />
      </MainContent>

      {/* Toast 알림은 NotificationToastContainer에서 전역으로 처리 */}
    </Box>
  )
}

export default AdminMonitoringPage