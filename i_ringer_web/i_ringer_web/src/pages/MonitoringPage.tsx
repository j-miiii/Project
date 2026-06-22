import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Box,
  Typography,
  Modal
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { keyframes } from '@emotion/react'
import MonitoringHeader from '../components/MonitoringHeader'
import Sidebar from '../components/Sidebar'
import SettingsModal, { SettingsData } from '../components/SettingsModal'
import AddPatientModal from '../components/AddPatientModal'
import AddInfusionModal from '../components/AddInfusionModal'
import PatientQRModal from '../components/PatientQRModal'
// NotificationToast 제거 → MQTT notification은 알림 모달로 직접 표시
import { useGlobalContext } from '../contexts/GlobalContext'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { useMqtt } from '../contexts/MqttContext'
import { dataProvider } from '../providers/dataProvider'
import { getAlertTypeLabel, getAlertCategory, getAlertCategoryColor, alertCategoryColors, AlertCategory } from '../utils/statusUtils'

const drawerWidth = 240
const headerHeight = 56

// 블링크 애니메이션 keyframes (모듈 레벨에 정의해서 항상 CSS에 주입)
const criticalBlinkKf = keyframes`
  0%, 100% { background-color: #FECACA; box-shadow: inset 0 0 0 2px #EF4444; }
  50% { background-color: #FFFFFF; box-shadow: inset 0 0 0 1px #FCA5A5; }
`
const cautionBlinkKf = keyframes`
  0%, 100% { background-color: #FEF08A; box-shadow: inset 0 0 0 2px #EAB308; }
  50% { background-color: #FFFFFF; box-shadow: inset 0 0 0 1px #FDE047; }
`
const systemErrorBlinkKf = keyframes`
  0%, 100% { background-color: #BFDBFE; box-shadow: inset 0 0 0 2px #3B82F6; }
  50% { background-color: #FFFFFF; box-shadow: inset 0 0 0 1px #93C5FD; }
`
const segBlinkKf = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
`

// 수액 type → code 매핑
// infusion name → code 매핑 (서버에서 동적으로 로드)
let infusionNameToCodeMap: Record<string, string> = {}
// infusion code → name 매핑 (코드로 한글이름 조회용)
let infusionCodeToNameMap: Record<string, string> = {}

const getInfusionCode = (code: string | null | undefined, type: string | null | undefined): string => {
  if (code) return code
  if (!type) return ''
  return type
}

/** "한글이름 (코드)" 형식으로 반환. 코드나 이름이 없으면 가능한 값만 반환 */
const getInfusionLabel = (code: string | null | undefined, type: string | null | undefined): string => {
  if (code) {
    const name = infusionCodeToNameMap[code]
    if (name) return `${name} (${code})`
    return code
  }
  if (!type) return ''
  return type
}

const isInfusionUnmatched = (code: string | null | undefined, type: string | null | undefined): boolean => {
  if (code) return false
  if (!type) return false
  return true
}


const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasDrawer' && prop !== 'drawerCollapsed' && prop !== 'isDarkMode',
})<{ hasDrawer?: boolean, drawerCollapsed?: boolean, isDarkMode?: boolean }>(({ theme, hasDrawer = true, drawerCollapsed = false, isDarkMode = false }) => ({
  position: 'fixed',
  top: 0,
  left: hasDrawer ? (drawerCollapsed ? 0 : `${drawerWidth}px`) : 0,
  right: 0,
  bottom: 0,
  paddingTop: `${headerHeight}px`,
  paddingBottom: 0,
  backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
  transition: theme.transitions.create(['left', 'width', 'background-color'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}))

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
  alert_category: string | null
  status: string | null
  is_active: boolean | null
  started_at: string | null
  stopped_at: string | null
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
    gender?: string | null
    age?: number | null
  } | null
  assignments: Assignment[]
}

interface NurseData {
  id: number
  nickname: string
  name: string | null
  employee_number: string | null
  profile_image: string | null
}

interface RoomData {
  room_id: number
  room_number: string
  nurse?: NurseData | null
  nurses?: NurseData[]
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

const MonitoringPage: React.FC = () => {
  const { isDarkMode } = useTheme()
  const { isConnected, subscribe, unsubscribe, lastMessage } = useMqtt()
  // localStorage에서 초기값 읽기 (다른 사용자의 선택 값 검증)
  const [selectedHospital, setSelectedHospital] = useState<string>(() => {
    const saved = localStorage.getItem('monitoring_hospital')
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')

    // admin/nurse 역할이고 저장된 병원이 자신의 병원이 아니면 초기화
    if ((userInfo.role === 'admin' || userInfo.role === 'nurse') && saved &&
        saved !== String(userInfo.hospital_id)) {
      localStorage.removeItem('monitoring_hospital')
      localStorage.removeItem('monitoring_ward')
      localStorage.removeItem('monitoring_rooms')
      return ''
    }
    // nurse는 자신의 hospital_id로 바로 설정
    if (userInfo.role === 'nurse' && userInfo.hospital_id) {
      return String(userInfo.hospital_id)
    }
    return saved || ''
  })
  const [selectedWard, setSelectedWard] = useState<string>(() => {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
    // nurse는 자신의 ward_id로 바로 설정
    if (userInfo.role === 'nurse' && userInfo.ward_id) {
      return String(userInfo.ward_id)
    }
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
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([])
  const [settingsVersion, setSettingsVersion] = useState(0) // 설정 변경 시 리렌더링 트리거
  const [wardSettings, setWardSettings] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('ward_setting') || 'null') } catch { return null }
  })
  const wardSettingsRef = React.useRef<any>(wardSettings)
  const [alertModalData, setAlertModalData] = useState<{
    open: boolean
    alertType: string
    alertCategory: AlertCategory | null
    roomNumber: string
    bedNumber: string
    patientName: string
    patientInfo: string
    infusionType: string
    infusionPercentage: number
    infusionCurrentVolume: number
  } | null>(null)

  const [addPatientModal, setAddPatientModal] = useState<{
    open: boolean; bedId: number; bedNumber: string; roomNumber: string
  } | null>(null)

  const [addInfusionModal, setAddInfusionModal] = useState<{
    open: boolean; patientId: number; patientName: string;
    bedId: number; bedNumber: string; roomNumber: string;
    currentAssignmentCount: number
  } | null>(null)

  const [qrModalData, setQrModalData] = useState<{
    wardName: string
    roomNumber: string
    bedNumber: string
    patientInfo: { id: number; name: string; chart_number: string; gender?: string | null; age?: number | null }
    bedId: number
    assignment?: { id: number; infusion_type: string; infusion_total_volume: number; infusion_gtt: number | null; infusion_cchr?: number | null } | null
    allAssignmentIds?: number[]
  } | null>(null)

  // 투여완료 확인 모달
  const [completeModal, setCompleteModal] = useState<{
    assignmentId: number
    roomNumber: string
    bedNumber: string
    patientName: string
    infusionType: string
    infusionTotalVolume: number
    infusionCurrentVolume: number
    infusionGtt: number | null
    infusionCchr?: number | null
    infusionPercentage: number
  } | null>(null)
  const [completeLoading, setCompleteLoading] = useState(false)


  // 알림 모달 5초 카운트다운 후 자동 닫기
  const [alertCountdown, setAlertCountdown] = useState(5)
  const alertStartTimeRef = React.useRef<number>(0)

  useEffect(() => {
    if (!alertModalData) {
      setAlertCountdown(5)
      return
    }

    alertStartTimeRef.current = Date.now()
    setAlertCountdown(5)

    const interval = setInterval(() => {
      const elapsed = Date.now() - alertStartTimeRef.current
      const remaining = Math.max(0, 5000 - elapsed)
      const secondsLeft = Math.ceil(remaining / 1000)

      if (remaining <= 0) {
        clearInterval(interval)
        setAlertModalData(null)
        return
      }

      setAlertCountdown(secondsLeft)
    }, 100)

    return () => clearInterval(interval)
  }, [alertModalData])

  // STOP, SLOW, FAST 알림 타이머 관리 (bedId -> timer ID)
  const alertTimersRef = React.useRef<Map<number, NodeJS.Timeout>>(new Map())

  // 데이터 로드 전 받은 notification을 저장 (bedId -> alertType)
  const pendingAlertsRef = React.useRef<Map<number, string>>(new Map())

  // 초기 마운트 여부 추적 (localStorage 복원 vs 사용자 선택 구분)
  const isInitialMountRef = React.useRef(true)

  // 프로그레스 바 단조증가 클램프: 동일 assignment 내에서 % 하락 방지
  const maxPercentageRef = React.useRef<Map<number, number>>(new Map())

  // 알림 모달 중복 방지: 실제 표시된 알림만 추적 (폴링 데이터와 분리)
  // key: "bedId_assignmentId", value: 마지막 표시된 alert_type (UPPERCASED)
  const shownAlertsRef = React.useRef<Map<string, string>>(new Map())

  // MQTT에서 alert_type이 설정된 assignment 추적 (폴링 시 보존용)
  // key: assignmentId, value: alert_type (null이면 클리어됨)
  const mqttAlertRef = React.useRef<Map<number, string | null>>(new Map())

  // MQTT notification 핸들러에서 monitoringData 최신값 접근용 ref
  const monitoringDataRef = React.useRef(monitoringData)
  monitoringDataRef.current = monitoringData

  // wardSettings ref 동기화
  React.useEffect(() => { wardSettingsRef.current = wardSettings }, [wardSettings])

  // 서버에서 infusions 목록 로드 (name → code 매핑)
  useEffect(() => {
    const loadInfusions = async () => {
      try {
        const res = await dataProvider.getList<{ id: number; code: string; name: string }>('infusions', { limit: 100, filter: { is_active: 1 }, order: 'display_order:asc' })
        if (res.data && Array.isArray(res.data)) {
          const nameToCode: Record<string, string> = {}
          const codeToName: Record<string, string> = {}
          res.data.forEach((item) => {
            nameToCode[item.name] = item.code
            codeToName[item.code] = item.name
          })
          infusionNameToCodeMap = nameToCode
          infusionCodeToNameMap = codeToName
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

  // % 정규화: Math.ceil + 단조증가 클램프 (동일 assignment 내 하락 방지)
  const normalizePercentage = (assignmentId: number, rawPercentage: number): number => {
    const rounded = Math.min(100, Math.max(0, Math.floor(rawPercentage)))
    const prev = maxPercentageRef.current.get(assignmentId)
    if (prev !== undefined && rounded < prev) {
      // 10%p 이상 하락 시 수액 교체로 판단 → 캐시 리셋
      if (prev - rounded > 10) {
        maxPercentageRef.current.set(assignmentId, rounded)
        return rounded
      }
      // 소폭 변동은 이전 최대값 유지
      return prev
    }
    maxPercentageRef.current.set(assignmentId, rounded)
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
            infusion_percentage: normalizePercentage(assignment.id, assignment.infusion_percentage)
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



      if (result.success && result.data) {
        // 이전 데이터에서 환자 정보 보존 (투여완료 후 assignment가 사라져도 환자는 유지)
        const preservePatientInfo = (newData: WardData[], prevData: WardData[]): WardData[] => {
          // 이전 데이터의 bed별 환자 정보 맵
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
                // 새 데이터에 환자 정보가 없지만 이전에 있었으면 보존
                // 단, assignment가 모두 해제된 경우(전체 종료)에는 보존하지 않음
                const hasActiveAssignments = bed.assignments && bed.assignments.length > 0
                if (!bed.patient_info && prevPatientMap.has(bed.bed_id) && hasActiveAssignments) {
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

            // MQTT에서 설정된 alert_type 보존: 서버 폴링 데이터에 alert_type이 아직 반영 안 됐을 때
            const merged = normalized.map(ward => ({
              ...ward,
              rooms: ward.rooms.map(room => ({
                ...room,
                beds: room.beds.map(bed => ({
                  ...bed,
                  assignments: bed.assignments?.map(a => {
                    const mqttAlert = mqttAlertRef.current.get(a.id)
                    // MQTT에서 alert를 설정했는데 서버에는 아직 반영 안 된 경우 → MQTT 값 보존
                    if (mqttAlert !== undefined && !a.alert_type && mqttAlert) {
                      return { ...a, alert_type: mqttAlert }
                    }
                    // 서버에 alert_type이 있으면 MQTT ref 동기화 후 서버 값 사용
                    if (a.alert_type) {
                      mqttAlertRef.current.set(a.id, a.alert_type)
                    } else if (mqttAlert === null) {
                      // MQTT에서 명시적으로 null로 클리어 → ref 정리
                      mqttAlertRef.current.delete(a.id)
                    }
                    return a
                  })
                }))
              }))
            }))

            // 서버 폴링 완료 후 mqttAlertRef 클리어 (서버 데이터가 최신 source of truth)
            mqttAlertRef.current.clear()

            const prevJson = JSON.stringify(prevData)
            const newJson = JSON.stringify(merged)
            if (prevJson === newJson) {
              return prevData // 변경 없으면 이전 데이터 유지 (리렌더링 방지)
            }
            return merged
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

  // 투여완료 처리 (수액만 클리어, 환자-침상 연결 유지)
  const handleCompleteInfusion = async () => {
    if (!completeModal) return
    setCompleteLoading(true)
    try {
      await dataProvider.clearInfusion(completeModal.assignmentId)
      setCompleteModal(null)
      loadMonitoringData(true)
    } catch (error) {
      console.error('투여완료 처리 실패:', error)
      alert('투여완료 처리에 실패했습니다.')
    } finally {
      setCompleteLoading(false)
    }
  }

  // Load monitoring data when filters change
  useEffect(() => {
    if (!selectedHospital) return
    // super_admin이 아닌 경우, selectedWard가 설정될 때까지 로드하지 않음 (전체 병동 데이터 표시 방지)
    if (userRole !== 'super_admin' && (!selectedWard || selectedWard === '')) return
    loadMonitoringData()
  }, [selectedHospital, selectedWard, selectedRoom, loadMonitoringData])

  // 15초 간격 자동 새로고침
  useEffect(() => {
    if (!selectedHospital) return
    // super_admin이 아닌 경우, selectedWard가 설정될 때까지 새로고침 시작하지 않음
    if (userRole !== 'super_admin' && (!selectedWard || selectedWard === '')) return

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
  }, [selectedHospital, selectedWard, userRole, loadMonitoringData])

  // MQTT 구독 관리: monitoringData가 변경될 때마다 현재 표시 중인 bed들을 구독
  useEffect(() => {
    if (!isConnected || monitoringData.length === 0) {
      return
    }

    // 현재 표시 중인 모든 bed_id 추출 (중복 제거)
    const bedIdSet = new Set<number>()
    monitoringData.forEach(ward => {
      ward.rooms.forEach(room => {
        room.beds.forEach(bed => {
          bedIdSet.add(bed.bed_id)
        })
      })
    })
    const currentBedIds = Array.from(bedIdSet)

    // 토픽 목록 생성
    const newTopics = currentBedIds.map(bedId => `bed/${bedId}/assignment/update`)
    const newTopicsSet = new Set(newTopics)
    const oldTopicsSet = new Set(subscribedTopics)

    // 변경사항이 없으면 skip
    if (newTopics.length === subscribedTopics.length &&
        newTopics.every(topic => oldTopicsSet.has(topic))) {
      return
    }

    console.log(`🔄 MQTT 토픽 구독 업데이트: ${currentBedIds.length}개 bed`, newTopics)

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

  // 알림 사운드 재생
  const notiAudioRef = useRef<HTMLAudioElement | null>(null)
  const playNotiSound = useCallback((category?: string) => {
    try {
      const settingStr = localStorage.getItem('user_setting')
      let volume = 100
      if (settingStr) {
        const s = JSON.parse(settingStr)
        if (category === 'critical') volume = s.critical_sound_volume ?? 100
        else if (category === 'caution') volume = s.caution_sound_volume ?? 100
        else if (category === 'system_error') volume = s.system_error_sound_volume ?? 100
      }

      if (!notiAudioRef.current) {
        notiAudioRef.current = new Audio('/sounds/iringer_noti_sound.mp3')
      }
      notiAudioRef.current.volume = Math.min(1, Math.max(0, volume / 100))
      notiAudioRef.current.currentTime = 0
      notiAudioRef.current.play().catch(() => {})
    } catch {}
  }, [])

  const isSoundEnabledForAlert = useCallback((alertType: string | null): boolean => {
    if (!alertType) return false
    try {
      const settingStr = localStorage.getItem('user_setting')
      if (!settingStr) return true
      const s = JSON.parse(settingStr)
      const cat = getAlertCategory(alertType.toUpperCase())
      if (cat === 'critical') return s.critical_sound_enabled !== undefined ? !!s.critical_sound_enabled : true
      if (cat === 'caution') return s.caution_sound_enabled !== undefined ? !!s.caution_sound_enabled : true
      if (cat === 'system_error') return s.system_error_sound_enabled !== undefined ? !!s.system_error_sound_enabled : true
      return false
    } catch { return true }
  }, [])

  // MQTT 메시지 수신 시 해당 bed 데이터 업데이트
  useEffect(() => {
    if (!lastMessage || !lastMessage.topic) {
      return
    }

    console.log('🔔 [MQTT] 메시지 수신:', {
      topic: lastMessage.topic,
      data: lastMessage.data,
      timestamp: lastMessage.timestamp
    })

    // 1. bed assignment update 토픽 처리: "bed/{bed_id}/assignment/update"
    const assignmentTopicMatch = lastMessage.topic.match(/^bed\/(\d+)\/assignment\/update$/)
    if (assignmentTopicMatch) {
      const bedId = parseInt(assignmentTopicMatch[1])
      const messageData = lastMessage.data

      console.log(`🔔 [BED ${bedId}] MQTT Update:`, {
        percentage: messageData.infusion_percentage,
        volume: messageData.infusion_current_volume,
        alert: messageData.alert_type
      })

      // 새 알림이 발생했으면 사운드 재생 + 알림 모달 표시
      if (messageData.alert_type) {
        const alertUpper = messageData.alert_type.toUpperCase()
        // user_setting에서 카테고리별 알림 활성화 여부 확인
        const checkCategoryAlertEnabled = (t: string) => {
          const settingStr = localStorage.getItem('user_setting')
          if (!settingStr) return false
          try {
            const s = JSON.parse(settingStr)
            const cat = getAlertCategory(t)
            if (cat === 'critical') return !!s.critical_alert_enabled
            if (cat === 'caution') return !!s.caution_alert_enabled
            if (cat === 'system_error') return !!s.system_error_alert_enabled
            return false
          } catch { return false }
        }
        const checkCategorySoundEnabled = (t: string) => {
          const settingStr = localStorage.getItem('user_setting')
          if (!settingStr) return false
          try {
            const s = JSON.parse(settingStr)
            const cat = getAlertCategory(t)
            if (cat === 'critical') return !!s.critical_sound_enabled
            if (cat === 'caution') return !!s.caution_sound_enabled
            if (cat === 'system_error') return !!s.system_error_sound_enabled
            return false
          } catch { return false }
        }
        if (['SLOW','STOP','FAST','DONE','ALMOST_DONE'].includes(alertUpper)) {
          // assignment별 알림 키 생성 (ref 기반 중복 방지 - 폴링 데이터와 독립)
          const alertKey = messageData.assignment_id
            ? `${bedId}_${messageData.assignment_id}`
            : `${bedId}_device_${messageData.device_id || 0}`
          const lastShownAlert = shownAlertsRef.current.get(alertKey)

          if (lastShownAlert !== alertUpper) {
            // 표시된 알림 기록 업데이트
            shownAlertsRef.current.set(alertKey, alertUpper)

            // 사운드 재생 (카테고리 소리 토글 확인)
            if (checkCategorySoundEnabled(alertUpper)) {
              playNotiSound(getAlertCategory(alertUpper) || undefined)
            }

            // 알림 모달 표시 (카테고리 알림 토글이 꺼져있으면 모달 안 띄움)
            if (!checkCategoryAlertEnabled(alertUpper)) {
              // 모달 표시 안함 - 데이터 업데이트만 진행
            } else {
            // 현재 monitoringData에서 침상/환자 정보 찾기
            const currentData = monitoringDataRef.current
            let foundBed: BedData | null = null
            let foundRoom: RoomData | null = null
            for (const ward of currentData) {
              for (const room of ward.rooms) {
                for (const bed of room.beds) {
                  if (bed.bed_id === bedId) {
                    foundBed = bed
                    foundRoom = room
                    break
                  }
                }
                if (foundBed) break
              }
              if (foundBed) break
            }

            if (foundBed && foundRoom) {
              // 대상 assignment 찾기 (assignment_id 또는 device_id로 매칭)
              const assignment = messageData.assignment_id
                ? foundBed.assignments?.find(a => a.id === messageData.assignment_id)
                : messageData.device_id
                  ? foundBed.assignments?.find(a => a.device_id === messageData.device_id)
                  : foundBed.assignments?.[0]
              const fallbackAssignment = assignment || foundBed.assignments?.[0]
              const category = getAlertCategory(alertUpper)
              console.log('🚨 [ALERT MODAL] 알림 모달 표시:', {
                bed_id: bedId,
                alert: alertUpper,
                category,
                room: foundRoom.room_number,
                patient: foundBed.patient_info?.name,
              })
              setAlertModalData({
                open: true,
                alertType: alertUpper,
                alertCategory: category,
                roomNumber: foundRoom.room_number,
                bedNumber: foundBed.bed_number,
                patientName: foundBed.patient_info?.name || '---',
                patientInfo: foundBed.patient_info
                  ? `${foundBed.patient_info.gender || '-'}/${foundBed.patient_info.age || '-'}`
                  : '',
                infusionType: getInfusionCode(fallbackAssignment?.infusion_code, messageData.infusion_type || fallbackAssignment?.infusion_type),
                infusionPercentage: messageData.infusion_percentage ?? fallbackAssignment?.infusion_percentage ?? 0,
                infusionCurrentVolume: messageData.infusion_current_volume ?? fallbackAssignment?.infusion_current_volume ?? 0,
              })
            }
            } // checkCategoryAlertEnabled
          }
        }
      }

      // alert_type이 클리어된 경우 알림 기록 초기화 (동일 알림 재발생 시 다시 표시)
      if (messageData.alert_type === null || messageData.alert_type === '') {
        const clearKey = messageData.assignment_id
          ? `${bedId}_${messageData.assignment_id}`
          : `${bedId}_device_${messageData.device_id || 0}`
        shownAlertsRef.current.delete(clearKey)
      }

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
                        // assignment_id로 매칭, 없으면 device_id로 매칭
                        const isTarget = messageData.assignment_id
                          ? a.id === messageData.assignment_id
                          : (messageData.device_id && a.device_id === messageData.device_id)
                        if (!isTarget) return a
                        // MQTT에서 alert_type 변경 시 추적 (폴링 데이터 병합 시 보존용)
                        if (messageData.alert_type !== undefined) {
                          mqttAlertRef.current.set(a.id, messageData.alert_type)
                        }
                        return {
                          ...a,
                          infusion_percentage: messageData.infusion_percentage != null
                            ? normalizePercentage(a.id, messageData.infusion_percentage)
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
      console.log('🔄 [ASSIGNMENT REFRESH] 새로운 assignment 추가됨!', {
        topic: lastMessage.topic,
        data: messageData,
        hospital: selectedHospital,
        ward: selectedWard,
      })

      // 모니터링 데이터 다시 로드 (silent 모드로 로딩 깜빡임 방지)
      loadMonitoringData(true)
      console.log('  ✅ loadMonitoringData(true) 호출 완료')
      return
    }

    // 3. user notification 토픽 처리 → 알림 모달로 표시
    const notificationTopicMatch = lastMessage.topic.match(/\/notification$/)
    if (notificationTopicMatch) {
      const notificationData = lastMessage.data
      const alertType = notificationData.type?.toUpperCase()
      console.log('🚨 [NOTIFICATION] 알림 수신:', {
        alertType,
        bed_id: notificationData.bed_id,
        data: notificationData,
      })

      if (!alertType || !['SLOW', 'STOP', 'FAST', 'DONE', 'ALMOST_DONE'].includes(alertType)) {
        console.log('  ⏩ 무시됨 - 알림 타입 미해당')
        return
      }

      const bedId = notificationData.bed_id
      if (!bedId) return

      // monitoringDataRef에서 해당 침상 정보 찾기 (ref 사용으로 의존성 제거)
      const currentData = monitoringDataRef.current
      let foundBed: BedData | null = null
      let foundRoom: RoomData | null = null

      for (const ward of currentData) {
        for (const room of ward.rooms) {
          for (const bed of room.beds) {
            if (bed.bed_id === bedId) {
              foundBed = bed
              foundRoom = room
              break
            }
          }
          if (foundBed) break
        }
        if (foundBed) break
      }

      if (foundBed && foundRoom) {
        // 카테고리 알림 토글 확인
        const notiCategory = getAlertCategory(alertType)
        const notiSettingStr = localStorage.getItem('user_setting')
        let notiAlertOn = true
        if (notiSettingStr) {
          try {
            const ns = JSON.parse(notiSettingStr)
            if (notiCategory === 'critical') notiAlertOn = !!ns.critical_alert_enabled
            else if (notiCategory === 'caution') notiAlertOn = !!ns.caution_alert_enabled
            else if (notiCategory === 'system_error') notiAlertOn = !!ns.system_error_alert_enabled
          } catch {}
        }

        if (notiAlertOn) {
          const alertAssignment = foundBed.assignments?.find(a => a.alert_type?.toUpperCase() === alertType) || foundBed.assignments?.[0]

          // notification 채널도 ref 기반 중복 방지 (bed update 핸들러와 동일 키 사용)
          const notiAlertKey = `${bedId}_${alertAssignment?.id || 0}`
          const lastNotiShown = shownAlertsRef.current.get(notiAlertKey)
          if (lastNotiShown !== alertType) {
            shownAlertsRef.current.set(notiAlertKey, alertType)

          const alertProgress = Math.min(100, Math.max(0, Math.floor(alertAssignment?.infusion_percentage || 0)))

          // 사운드 재생
          if (isSoundEnabledForAlert(alertType)) {
            playNotiSound(notiCategory || undefined)
          }

          setAlertModalData({
            open: true,
            alertType: alertType,
            alertCategory: getAlertCategory(alertType),
            roomNumber: foundRoom.room_number,
            bedNumber: foundBed.bed_number,
            patientName: foundBed.patient_info?.name || '환자',
            patientInfo: foundBed.patient_info
              ? (foundBed.patient_info.gender && foundBed.patient_info.age
                ? `${foundBed.patient_info.gender}/${foundBed.patient_info.age}`
                : foundBed.patient_info.chart_number || '')
              : '',
            infusionType: getInfusionCode(alertAssignment?.infusion_code, alertAssignment?.infusion_type),
            infusionPercentage: alertProgress,
            infusionCurrentVolume: Math.round(alertAssignment?.infusion_current_volume || 0),
          })
          } // lastNotiShown !== alertType
        }
      }
      return
    }

  }, [lastMessage, loadMonitoringData])

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

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
          // state에 없으면 서버에서 조회
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

  // 모든 병실 데이터를 flat하게 변환 (병동 내 전체 병실 표시)
  const allRooms: { room: RoomData; ward: WardData }[] = []
  monitoringData?.forEach(ward => {
    ward.rooms?.forEach(room => {
      allRooms.push({ room, ward })
    })
  })

  // ── 더미 데이터: 실제 병실 침대에 더미 환자/수액 데이터 주입 ──
  const USE_DUMMY = false // true로 변경하면 더미 데이터 표시

  const dummyPatients = [
    { name: '김민수', gender: 'M', age: 67 },
    { name: '이영희', gender: 'F', age: 45 },
    { name: '박준형', gender: 'M', age: 32 },
    { name: '최수진', gender: 'F', age: 58 },
    { name: '정민호', gender: 'M', age: 71 },
    { name: '한지은', gender: 'F', age: 39 },
    { name: '오세훈', gender: 'M', age: 55 },
    { name: '강다인', gender: 'F', age: 28 },
    { name: '윤서연', gender: 'F', age: 42 },
    { name: '임재혁', gender: 'M', age: 63 },
    { name: '송하늘', gender: 'F', age: 35 },
    { name: '배진우', gender: 'M', age: 48 },
    { name: '조은비', gender: 'F', age: 29 },
    { name: '황동현', gender: 'M', age: 74 },
    { name: '권나영', gender: 'F', age: 51 },
    { name: '서태호', gender: 'M', age: 44 },
    { name: '문정아', gender: 'F', age: 36 },
    { name: '신우진', gender: 'M', age: 60 },
    { name: '유미래', gender: 'F', age: 33 },
    { name: '장건호', gender: 'M', age: 56 },
    { name: '노현주', gender: 'F', age: 41 },
    { name: '안성빈', gender: 'M', age: 69 },
    { name: '전수아', gender: 'F', age: 27 },
    { name: '고민석', gender: 'M', age: 52 },
    { name: '차예린', gender: 'F', age: 38 },
    { name: '백승호', gender: 'M', age: 65 },
    { name: '홍지수', gender: 'F', age: 46 },
    { name: '탁현우', gender: 'M', age: 31 },
    { name: '남채원', gender: 'F', age: 54 },
    { name: '피수현', gender: 'M', age: 43 },
    { name: '구하은', gender: 'F', age: 37 },
    { name: '양준서', gender: 'M', age: 72 },
    { name: '류다은', gender: 'F', age: 26 },
    { name: '공태영', gender: 'M', age: 59 },
    { name: '진소율', gender: 'F', age: 34 },
    { name: '빈재윤', gender: 'M', age: 66 },
  ]

  const dummyNurses = ['김서연', '박지민', '이하은', '최유진', '정다은', '한소희', '오민지', '강예린', '윤채원', '서지우', '문수빈', '신나영']
  const dummyInfusionTypes = ['NS', 'D5W', 'RL', 'HS', 'D10W', 'NS/2']
  const dummyAlertPresets: { alert_type: string | null; alert_category: string | null }[] = [
    { alert_type: 'STOP', alert_category: 'critical' },
    { alert_type: 'DONE', alert_category: 'critical' },
    { alert_type: 'FAST', alert_category: 'critical' },
    { alert_type: 'SLOW', alert_category: 'caution' },
    { alert_type: 'ALMOST_DONE', alert_category: 'caution' },
    { alert_type: 'DISCONNECTED', alert_category: 'system_error' },
    { alert_type: null, alert_category: null }, // 정상
    { alert_type: null, alert_category: null },
    { alert_type: null, alert_category: null },
    { alert_type: null, alert_category: null },
  ]

  const injectDummyData = (rooms: { room: RoomData; ward: WardData }[]): { room: RoomData; ward: WardData }[] => {
    let patientIdx = 0
    let assignmentId = 9000

    return rooms.map(({ room, ward }) => {
      const newBeds = room.beds.map((bed) => {
        // 이미 assignment가 있으면 그대로
        if (bed.assignments && bed.assignments.length > 0) return bed

        // 빈 침대 중 일부(80%)에 환자 배정
        if (Math.random() > 0.8) return bed

        const patient = dummyPatients[patientIdx % dummyPatients.length]
        patientIdx++

        // 수액 1~3개 랜덤 배정
        const numAssignments = Math.floor(Math.random() * 3) + 1
        const assignments = Array.from({ length: numAssignments }).map((_, i) => {
          const alertPreset = dummyAlertPresets[Math.floor(Math.random() * dummyAlertPresets.length)]
          const totalVol = [250, 500, 1000][Math.floor(Math.random() * 3)]
          const pct = Math.floor(Math.random() * 95) + 5
          assignmentId++
          return {
            id: assignmentId,
            patient_id: patientIdx,
            bed_id: bed.bed_id,
            device_id: assignmentId,
            infusion_type: dummyInfusionTypes[Math.floor(Math.random() * dummyInfusionTypes.length)],
            infusion_total_volume: totalVol,
            infusion_current_volume: Math.round(totalVol * pct / 100),
            infusion_gtt: [20, 30, 40, 60][Math.floor(Math.random() * 4)],
            infusion_cchr: [100, 150, 200, 300][Math.floor(Math.random() * 4)],
            infusion_percentage: pct,
            alert_type: i === 0 ? alertPreset.alert_type : null, // 첫 수액에만 알림
            alert_category: i === 0 ? alertPreset.alert_category : null,
            status: 'active' as const,
            is_active: true,
            started_at: null,
            stopped_at: null,
            assigned_at: '',
            released_at: null,
            last_measured_weight: null,
            last_measured_time: null,
            created_at: '',
            updated_at: '',
            device: null,
          }
        })

        return {
          ...bed,
          bed_status: 'occupied',
          patient_info: { id: patientIdx, name: patient.name, chart_number: `C${String(patientIdx).padStart(3, '0')}`, gender: patient.gender, age: patient.age },
          assignments,
        }
      })

      return { room: { ...room, beds: newBeds }, ward }
    })
  }

  // useRef로 더미 데이터 캐싱 (렌더링마다 랜덤이 바뀌지 않게)
  const dummyCache = useRef<{ key: number; data: { room: RoomData; ward: WardData }[] } | null>(null)
  const displayRooms = useMemo(() => {
    if (USE_DUMMY && allRooms.length > 0) {
      if (dummyCache.current && dummyCache.current.key === allRooms.length) {
        return dummyCache.current.data
      }
      const injected = injectDummyData(allRooms)
      dummyCache.current = { key: allRooms.length, data: injected }
      return injected
    }
    return allRooms
  }, [allRooms, USE_DUMMY])

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100, position: 'relative' }}>
      {hasDrawer && !sidebarCollapsed && (
        <Sidebar
          userRole={userRole}
          collapsed={false}
          onToggleCollapse={handleToggleSidebar}
        />
      )}

      <MonitoringHeader
        wardName={localWards.find(w => w.id.toString() === selectedWard)?.name || '전체 병동'}
        monitoringData={monitoringData}
        sidebarCollapsed={sidebarCollapsed}
        hasDrawer={hasDrawer}
        onOpenSettings={() => setShowSettingsModal(true)}
        onToggleSidebar={handleToggleSidebar}
      />

      <MainContent hasDrawer={hasDrawer} drawerCollapsed={sidebarCollapsed} isDarkMode={isDarkMode}>
        {/* Room Grid - 4열 테이블 레이아웃 */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <Typography sx={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600 }}>데이터를 불러오는 중...</Typography>
          </Box>
        ) : displayRooms.length > 0 ? (
          <Box sx={{
            flexGrow: 1,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              flex: 1,
              minHeight: 0,
            }}>
              {displayRooms.map(({ room, ward }, roomIdx) => {
                // 병실 내 가장 심각한 알림 카테고리 계산
                let roomAlertCategory: AlertCategory | null = null
                room.beds?.forEach(bed => {
                  bed.assignments?.forEach(assignment => {
                    const at = assignment.alert_type?.toUpperCase()
                    if (at) {
                      const cat = getAlertCategory(at)
                      if (cat === 'critical') roomAlertCategory = 'critical'
                      else if (cat === 'caution' && roomAlertCategory !== 'critical') roomAlertCategory = 'caution'
                      else if (cat === 'system_error' && !roomAlertCategory) roomAlertCategory = 'system_error'
                    }
                  })
                })

                // 병실 배경/테두리 색상
                const roomBgColor = roomAlertCategory === 'critical' ? '#FECACA'
                  : roomAlertCategory === 'caution' ? '#FEF08A'
                  : roomAlertCategory === 'system_error' ? '#BFDBFE'
                  : (isDarkMode ? colors.gray.gray900 : '#F8FAFC')
                const roomBorderColor = roomAlertCategory === 'critical' ? '#EF4444'
                  : roomAlertCategory === 'caution' ? '#EAB308'
                  : roomAlertCategory === 'system_error' ? '#3B82F6'
                  : null

                return (
                  <Box key={room.room_id} sx={{
                    border: roomAlertCategory && roomBorderColor
                      ? `2px solid ${roomBorderColor}`
                      : '1px solid #E5E7EB',
                    borderRadius: 0,
                    boxShadow: 'none',
                    backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                  }}>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      {/* 병실 헤더 */}
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        px: 1.5, py: 1,
                        bgcolor: isDarkMode ? colors.gray.gray900 : roomBgColor,
                        borderBottom: `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}`,
                        flexShrink: 0,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography sx={{ fontSize: '16px', fontWeight: 900, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray800 }}>
                            {room.room_number}
                          </Typography>
                          <Typography sx={{ fontSize: '12px', fontWeight: 900, color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500 }}>
                            호
                          </Typography>
                        </Box>
                        {room.nurse ? (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 0.5,
                            bgcolor: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            borderRadius: '2px',
                            px: 0.75,
                            py: 0.125,
                          }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                              {room.nurse.name || room.nurse.nickname}
                            </Typography>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#64748B', lineHeight: 1.3 }}>
                              간호사
                            </Typography>
                          </Box>
                        ) : (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 0.5,
                            bgcolor: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            borderRadius: '2px',
                            px: 0.75,
                            py: 0.125,
                          }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#94A3B8', lineHeight: 1.3 }}>
                              미배정
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {/* 침대 리스트 - 항상 6행 표시 */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        {(() => {
                          // bed_id 기준으로 중복 병합 (수액이 여러 개면 API가 bed를 중복 반환할 수 있음)
                          const bedMap = new Map<number, BedData>()
                          ;(room.beds || []).forEach(bed => {
                            const existing = bedMap.get(bed.bed_id)
                            if (existing) {
                              // 같은 bed_id → assignments만 병합
                              const existingIds = new Set(existing.assignments?.map(a => a.id) || [])
                              const newAssignments = (bed.assignments || []).filter(a => !existingIds.has(a.id))
                              existing.assignments = [...(existing.assignments || []), ...newAssignments]
                              if (!existing.patient_info && bed.patient_info) {
                                existing.patient_info = bed.patient_info
                              }
                            } else {
                              bedMap.set(bed.bed_id, { ...bed, assignments: [...(bed.assignments || [])] })
                            }
                          })
                          const sortedBeds = Array.from(bedMap.values()).sort((a, b) => {
                            const aNum = parseInt(a.bed_number) || 0
                            const bNum = parseInt(b.bed_number) || 0
                            return aNum - bNum
                          })
                          // 항상 6줄 표시: 실제 침대 + 빈 행
                          const MAX_BEDS = 6
                          const paddedBeds: (BedData | null)[] = [
                            ...sortedBeds,
                            ...Array(Math.max(0, MAX_BEDS - sortedBeds.length)).fill(null),
                          ]
                          return paddedBeds.map((bed, bedIdx) => {
                          // 빈 침상 행
                          if (!bed) {
                            const emptyBedNumber = bedIdx + 1
                            return (
                              <Box
                                key={`empty-bed-${bedIdx}`}
                                onClick={() => {
                                  setAddPatientModal({
                                    open: true,
                                    bedId: 0,
                                    bedNumber: String(emptyBedNumber),
                                    roomNumber: room.room_number,
                                  })
                                }}
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(60px, 0.7fr) 1fr 1fr 1fr',
                                  flex: 1,
                                  minHeight: 0,
                                  bgcolor: '#F8FAFC',
                                  borderBottom: bedIdx < MAX_BEDS - 1
                                    ? `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}`
                                    : 'none',
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: '#EFF6FF',
                                  },
                                }}
                              >
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  px: 0.75,
                                  py: 0.5,
                                  gridColumn: '1 / -1',
                                }}>
                                  <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#CBD5E1', lineHeight: 1.2 }}>
                                    {emptyBedNumber}
                                  </Typography>
                                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', lineHeight: 1.3 }}>
                                    빈 침상
                                  </Typography>
                                </Box>
                              </Box>
                            )
                          }

                          // 빈 수액 필터링 + 투여완료(released_at) 제외
                          const validAssignments = bed.assignments?.filter(a =>
                            (a.infusion_total_volume > 0 || a.infusion_type) && !a.released_at
                          ) || []
                          const hasPatient = !!bed.patient_info
                          const hasInfusion = validAssignments.length > 0

                          // 침대 내 가장 심각한 알림
                          let bedAlertCategory: AlertCategory | null = null
                          let bedAlertType: string | null = null
                          validAssignments.forEach(a => {
                            const at = a.alert_type?.toUpperCase()
                            if (at) {
                              const cat = getAlertCategory(at)
                              if (cat === 'critical') { bedAlertCategory = 'critical'; bedAlertType = at }
                              else if (cat === 'caution' && bedAlertCategory !== 'critical') { bedAlertCategory = 'caution'; bedAlertType = at }
                              else if (cat === 'system_error' && !bedAlertCategory) { bedAlertCategory = 'system_error'; bedAlertType = at }
                            }
                          })

                          const bedCategoryColors = bedAlertCategory ? alertCategoryColors[bedAlertCategory as AlertCategory] : null
                          const bedAlertColor = bedCategoryColors?.text || null
                          const bedAlertBgColor = bedCategoryColors?.bg || null

                          // 서버에서 alert를 보냈으면 카드에 무조건 표시 (서버가 ward설정 기반으로 이미 필터링함)
                          const hasBedAlert = hasInfusion && bedAlertType &&
                            ['SLOW','STOP','FAST','DONE','ALMOST_DONE','DISCONNECTED'].includes(bedAlertType)

                          // 알림 카테고리별 카드 색상 (병상: bg/border, 텍스트)
                          const alertCardColors: Record<string, { text: string; border: string; bg: string }> = {
                            critical: { text: '#DC2626', border: '#FCA5A5', bg: '#FEF2F2' },
                            caution: { text: '#CA8A04', border: '#FDE047', bg: '#FEF9C3' },
                            system_error: { text: '#2563EB', border: '#93C5FD', bg: '#EFF6FF' },
                          }
                          const bedCardColors = bedAlertCategory ? alertCardColors[bedAlertCategory as AlertCategory] : null

                          // 수액 슬롯 3개 (빈 슬롯 포함)
                          const assignmentSlots = [0, 1, 2].map(i => validAssignments[i] || null)

                          return (
                            <Box
                              key={bed.bed_id}
                              onClick={() => {
                                // 빈 침상 클릭 → 환자 추가 모달
                                if (!hasPatient) {
                                  setAddPatientModal({
                                    open: true,
                                    bedId: bed.bed_id,
                                    bedNumber: bed.bed_number,
                                    roomNumber: room.room_number,
                                  })
                                  return
                                }
                                // 알림 있는 침상 클릭 → 알림 모달
                                if (hasBedAlert && bedAlertType) {
                                  const firstAlertAssignment = validAssignments.find(a => a.alert_type?.toUpperCase() === bedAlertType)
                                  const alertProgress = Math.min(100, Math.max(0, Math.floor(firstAlertAssignment?.infusion_percentage || 0)))
                                  setAlertModalData({
                                    open: true,
                                    alertType: bedAlertType,
                                    alertCategory: bedAlertCategory,
                                    roomNumber: room.room_number,
                                    bedNumber: bed.bed_number,
                                    patientName: bed.patient_info?.name || '환자',
                                    patientInfo: bed.patient_info
                                      ? (bed.patient_info.gender && bed.patient_info.age
                                        ? `${bed.patient_info.gender}/${bed.patient_info.age}`
                                        : bed.patient_info.chart_number || '')
                                      : '',
                                    infusionType: getInfusionCode(firstAlertAssignment?.infusion_code, firstAlertAssignment?.infusion_type),
                                    infusionPercentage: alertProgress,
                                    infusionCurrentVolume: Math.round(firstAlertAssignment?.infusion_current_volume || 0),
                                  })
                                  return
                                }
                                // 알림 없고 환자 있는 침상 클릭 → 환자 QR 모달
                                if (bed.patient_info) {
                                  setQrModalData({
                                    wardName: ward.ward_name,
                                    roomNumber: room.room_number,
                                    bedNumber: bed.bed_number,
                                    patientInfo: bed.patient_info,
                                    bedId: bed.bed_id,
                                    assignment: null,
                                    allAssignmentIds: bed.assignments?.map(a => a.id) || [],
                                  })
                                }
                              }}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(60px, 0.7fr) 1fr 1fr 1fr',
                                flex: 1,
                                minHeight: 0,
                                cursor: 'pointer',
                                bgcolor: hasBedAlert && bedCardColors ? bedCardColors.bg : (!hasPatient ? '#F8FAFC' : 'transparent'),
                                ...(hasBedAlert && bedAlertCategory === 'critical' ? {
                                  border: '1px solid #FCA5A5',
                                } : {
                                  borderBottom: bedIdx < MAX_BEDS - 1
                                    ? `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}`
                                    : 'none',
                                }),
                                transition: 'background-color 0.2s',
                                '&:hover': hasBedAlert ? {
                                  bgcolor: bedCardColors ? bedCardColors.bg : (isDarkMode ? colors.gray.gray900 : '#F9FAFB'),
                                } : {
                                  bgcolor: isDarkMode ? colors.gray.gray800 : '#EFF6FF',
                                },
                              }}
                            >
                              {/* 1열: 침대번호 + 환자정보 (빈 침상이면 전체 span) */}
                              <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 0.75,
                                py: 0.5,
                                ...(!hasPatient
                                  ? { gridColumn: '1 / -1' }
                                  : { borderRight: `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}` }
                                ),
                                minWidth: 0,
                                overflow: 'hidden',
                              }}>
                                <Typography sx={{
                                  fontSize: '16px',
                                  fontWeight: 800,
                                  color: hasBedAlert && bedAlertCategory === 'critical' ? '#EF4444'
                                    : hasBedAlert && bedAlertCategory === 'caution' ? '#EAB308'
                                    : hasBedAlert && bedAlertCategory === 'system_error' ? '#3B82F6'
                                    : !hasPatient ? '#CBD5E1'
                                    : (isDarkMode ? colors.gray.gray200 : colors.gray.gray700),
                                  flexShrink: 0,
                                  lineHeight: 1.2,
                                }}>
                                  {bed.bed_number}
                                </Typography>

                                {hasPatient ? (
                                  <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                    <Typography sx={{
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      lineHeight: 1.3,
                                    }}>
                                      {bed.patient_info!.name}
                                    </Typography>
                                    <Typography sx={{
                                      fontSize: '11px',
                                      color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500,
                                      lineHeight: 1.2,
                                    }}>
                                      {bed.patient_info!.gender && bed.patient_info!.age
                                        ? `${bed.patient_info!.gender}/${bed.patient_info!.age}`
                                        : '-/-'}
                                    </Typography>
                                  </Box>
                                ) : !hasPatient ? (
                                  <Typography sx={{
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: '#94A3B8',
                                    lineHeight: 1.3,
                                  }}>
                                    빈 침상
                                  </Typography>
                                ) : (
                                  <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                    <Typography sx={{
                                      fontSize: '15px',
                                      fontWeight: 700,
                                      color: isDarkMode ? colors.gray.gray500 : colors.gray.gray400,
                                      lineHeight: 1.3,
                                    }}>
                                      ---
                                    </Typography>
                                    <Typography sx={{
                                      fontSize: '11px',
                                      color: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                                      lineHeight: 1.2,
                                    }}>
                                      -/-
                                    </Typography>
                                  </Box>
                                )}
                              </Box>

                              {/* 2~4열: 수액 슬롯 3개 (빈 침상이면 렌더링 안함 - gridColumn span 처리) */}
                              {hasPatient && (() => {
                                // 설정에서 표시 모드 읽기
                                const settingStr = localStorage.getItem('user_setting')
                                let volumeMode: 'percentage' | 'ml' = 'percentage'
                                if (settingStr) {
                                  try {
                                    const s = JSON.parse(settingStr)
                                    if (s.volume_display_mode === 'ml') volumeMode = 'ml'
                                  } catch {}
                                }

                                return assignmentSlots.map((assignment, slotIdx) => {
                                  if (!assignment) {
                                    const canAddInfusion = bed.patient_info && validAssignments.length < 3
                                    return (
                                      <Box
                                        key={`empty-${slotIdx}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (canAddInfusion) {
                                            setAddInfusionModal({
                                              open: true,
                                              patientId: bed.patient_info!.id,
                                              patientName: bed.patient_info!.name,
                                              bedId: bed.bed_id,
                                              bedNumber: bed.bed_number,
                                              roomNumber: room.room_number,
                                              currentAssignmentCount: validAssignments.length,
                                            })
                                          }
                                        }}
                                        sx={{
                                          borderRight: slotIdx < 2 ? `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}` : 'none',
                                          ...(canAddInfusion ? {
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: '#EFF6FF' },
                                          } : {}),
                                        }}
                                      />
                                    )
                                  }

                                  const progress = Math.min(100, Math.max(0, Math.floor(assignment.infusion_percentage || 0)))
                                  const filledSegments = Math.floor(progress / 10)
                                  const aAlertType = assignment.alert_type?.toUpperCase()
                                  const aCategory = getAlertCategory(aAlertType || '')
                                  const aCardColors = aCategory ? alertCardColors[aCategory] : null
                                  const hasAssignmentAlert = aAlertType &&
                                    ['SLOW','STOP','FAST','DONE','ALMOST_DONE','DISCONNECTED'].includes(aAlertType)

                                  const filledColor = hasAssignmentAlert && aCardColors
                                    ? aCardColors.text
                                    : '#64748B'
                                  const emptyColor = isDarkMode ? colors.gray.gray700 : '#D5DAE0'

                                  const valueText = volumeMode === 'ml'
                                    ? `${Math.round(assignment.infusion_current_volume || 0)}ml`
                                    : `${progress}%`

                                  const isDeviceConnected = !!(assignment.device || assignment.device_id)

                                  return (
                                    <Box key={assignment.id || slotIdx} onClick={(e) => {
                                      e.stopPropagation()
                                      if (!bed.patient_info) return
                                      if (isDeviceConnected) {
                                        // 기기 연결됨 → 투여완료 확인 모달
                                        setCompleteModal({
                                          assignmentId: assignment.id,
                                          roomNumber: room.room_number,
                                          bedNumber: bed.bed_number,
                                          patientName: bed.patient_info.name,
                                          infusionType: getInfusionLabel(assignment.infusion_code, assignment.infusion_type) || 'NS',
                                          infusionTotalVolume: assignment.infusion_total_volume || 0,
                                          infusionCurrentVolume: assignment.infusion_current_volume || 0,
                                          infusionGtt: assignment.infusion_gtt,
                                          infusionCchr: assignment.infusion_cchr,
                                          infusionPercentage: assignment.infusion_percentage || 0,
                                        })
                                      } else {
                                        // 기기 미연결 → QR 모달 (삭제 버튼 포함)
                                        setQrModalData({
                                          wardName: ward.ward_name,
                                          roomNumber: room.room_number,
                                          bedNumber: bed.bed_number,
                                          patientInfo: bed.patient_info,
                                          bedId: bed.bed_id,
                                          assignment: {
                                            id: assignment.id,
                                            infusion_type: getInfusionCode(assignment.infusion_code, assignment.infusion_type) || assignment.infusion_type,
                                            infusion_total_volume: assignment.infusion_total_volume,
                                            infusion_gtt: assignment.infusion_gtt,
                                            infusion_cchr: assignment.infusion_cchr,
                                          },
                                        })
                                      }
                                    }} sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.75,
                                      px: 1,
                                      py: 0.5,
                                      borderRight: slotIdx < 2 ? `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}` : 'none',
                                      overflow: 'hidden',
                                      cursor: 'pointer',
                                      ...(hasAssignmentAlert && aCardColors ? (
                                        aCategory === 'critical' ? {
                                          animation: `${criticalBlinkKf} 1.5s ease-in-out infinite`,
                                        } : aCategory === 'caution' ? {
                                          animation: `${cautionBlinkKf} 1.5s ease-in-out infinite`,
                                        } : {
                                          animation: `${systemErrorBlinkKf} 1.5s ease-in-out infinite`,
                                        }
                                      ) : {}),
                                    }}>
                                      {/* 좌: 10칸 세그먼트 프로그레스 바 */}
                                      <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column-reverse',
                                        gap: '1px',
                                        flexShrink: 0,
                                        alignSelf: 'stretch',
                                        justifyContent: 'center',
                                      }}>
                                        {Array.from({ length: 10 }).map((_, segIdx) => (
                                          <Box key={segIdx} sx={{
                                            width: 14,
                                            height: 3,
                                            borderRadius: '1px',
                                            bgcolor: segIdx < filledSegments ? filledColor : emptyColor,
                                            transition: 'background-color 0.3s ease',
                                            ...(segIdx < filledSegments && hasAssignmentAlert && aCategory ? {
                                              animation: `${segBlinkKf} 1.5s ease-in-out infinite`,
                                            } : {}),
                                          }} />
                                        ))}
                                      </Box>

                                      {/* 가운데: 수액종류 + 투입량 */}
                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                        <Typography sx={{
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          lineHeight: 1.3,
                                          minHeight: '15.6px',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: '100%',
                                          color: hasAssignmentAlert && aCardColors ? aCardColors.text : (isDarkMode ? colors.gray.gray100 : colors.gray.gray800),
                                        }}>
                                          {isInfusionUnmatched(assignment.infusion_code, assignment.infusion_type)
                                            ? <span style={{ color: hasAssignmentAlert && aCardColors ? aCardColors.text : '#F59E0B' }}>(매칭안됨)</span>
                                            : getInfusionCode(assignment.infusion_code, assignment.infusion_type)}
                                        </Typography>
                                        <Typography sx={{
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          lineHeight: 1.3,
                                          color: hasAssignmentAlert && aCardColors ? aCardColors.text
                                            : progress >= 90 ? '#64748B'
                                            : (isDarkMode ? colors.gray.gray300 : colors.gray.gray600),
                                        }}>
                                          {valueText}
                                        </Typography>
                                      </Box>

                                      {/* 우: 알림 뱃지 or 미연결 뱃지 */}
                                      {hasAssignmentAlert && aAlertType && aCardColors ? (
                                        <Box sx={{
                                          px: 0.5,
                                          py: 0.25,
                                          borderRadius: '3px',
                                          bgcolor: aCardColors.bg,
                                          border: `1px solid ${aCardColors.text}`,
                                          flexShrink: 0,
                                          alignSelf: 'center',
                                        }}>
                                          <Typography sx={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: aCardColors.text,
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                          }}>
                                            {getAlertTypeLabel(aAlertType)}
                                          </Typography>
                                        </Box>
                                      ) : !isDeviceConnected ? (
                                        <Box sx={{
                                          px: 0.5,
                                          py: 0.25,
                                          borderRadius: '3px',
                                          bgcolor: isDarkMode ? 'rgba(100,116,139,0.2)' : '#F1F5F9',
                                          border: `1px solid ${isDarkMode ? '#475569' : '#CBD5E1'}`,
                                          flexShrink: 0,
                                          alignSelf: 'center',
                                        }}>
                                          <Typography sx={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: isDarkMode ? '#94A3B8' : '#94A3B8',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                          }}>
                                            미연결
                                          </Typography>
                                        </Box>
                                      ) : null}
                                    </Box>
                                  )
                                })
                              })()}
                            </Box>
                          )
                        })
                        })()}
                      </Box>
                    </Box>
                  </Box>
                )
              })}
              {/* 12칸 고정: 병실이 부족하면 빈 셀로 채우기 */}
              {Array.from({ length: Math.max(0, 12 - displayRooms.length) }).map((_, i) => (
                <Box key={`empty-room-${i}`} sx={{
                  border: `1px solid ${isDarkMode ? colors.gray.gray800 : '#E5E7EB'}`,
                  bgcolor: isDarkMode ? colors.gray.gray900 : '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }} />
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ color: isDarkMode ? colors.gray.gray300 : colors.gray.gray600, mb: 1 }}>
              데이터가 없습니다
            </Typography>
            <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500 }}>
              병원, 병동을 선택해주세요
            </Typography>
          </Box>
        )}

        {/* 설정 모달 */}
        <SettingsModal
          open={showSettingsModal}
          onClose={handleCloseSettingsModal}
          onConfirm={handleConfirmSettings}
        />

        {/* 알림 모달 (alert_category별) */}
        {alertModalData && (
          <Modal
            open={alertModalData.open}
            onClose={() => setAlertModalData(null)}
            slotProps={{
              backdrop: {
                sx: { backgroundColor: 'rgba(0, 0, 0, 0.2)' },
              },
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '@keyframes countdownCircle': {
                from: { strokeDashoffset: 0 },
                to: { strokeDashoffset: 2 * Math.PI * 14 },
              },
            }}
          >
            <Box sx={{
              bgcolor: 'white',
              borderRadius: '20px',
              overflow: 'hidden',
              minWidth: 480,
              maxWidth: 560,
              boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.16)',
              outline: 'none',
            }}>
              {/* 알림 헤더 배너 */}
              <Box sx={{
                bgcolor: alertModalData.alertCategory === 'critical'
                  ? alertCategoryColors.critical.border
                  : alertModalData.alertCategory === 'caution'
                  ? alertCategoryColors.caution.border
                  : alertCategoryColors.system_error.border,
                py: 2,
                px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <Typography sx={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'white',
                }}>
                  {alertModalData.alertCategory === 'critical' ? '위급 알림'
                    : alertModalData.alertCategory === 'caution' ? '주의 알림'
                    : '시스템 오류 알림'}
                </Typography>

                {/* 우측 원형 카운트다운 타이머 */}
                <Box sx={{
                  position: 'absolute',
                  right: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                }}>
                  <svg width={36} height={36} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                    <circle cx={18} cy={18} r={14} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={3} />
                    <circle
                      key={alertCountdown}
                      cx={18} cy={18} r={14} fill="none"
                      stroke="white" strokeWidth={3}
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 14}
                      strokeDashoffset={0}
                      style={{
                        animation: 'countdownCircle 1s linear forwards',
                      }}
                    />
                  </svg>
                  <Typography sx={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'white',
                    position: 'relative',
                    zIndex: 1,
                    lineHeight: 1,
                  }}>
                    {alertCountdown}
                  </Typography>
                </Box>
              </Box>

              {/* 알림 내용 */}
              <Box sx={{ p: 3 }}>
                <Box sx={{
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  p: 2.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  {/* 좌측: 병실/환자 정보 */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontSize: '28px', fontWeight: 900, color: colors.gray.gray900 }}>
                        {alertModalData.roomNumber}
                      </Typography>
                      <Typography sx={{ fontSize: '18px', fontWeight: 900, color: colors.gray.gray900 }}>
                        호
                      </Typography>
                      <Typography sx={{ fontSize: '24px', fontWeight: 900, color: colors.gray.gray900, ml: 0.5 }}>
                        {alertModalData.bedNumber}번 침상
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '22px', fontWeight: 800, color: colors.gray.gray900 }}>
                        {alertModalData.patientName}
                      </Typography>
                      {alertModalData.patientInfo && (
                        <Typography sx={{ fontSize: '14px', fontWeight: 400, color: '#64748B' }}>
                          {alertModalData.patientInfo}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* 우측: 수액 상태 카드 (3열: 프로그레스바 | 수액종류+투입량 | 알림뱃지) */}
                  <Box sx={{ width: 24 }} />
                  {(() => {
                    const modalAlertColors = alertModalData.alertCategory === 'critical'
                      ? alertCategoryColors.critical
                      : alertModalData.alertCategory === 'caution'
                      ? alertCategoryColors.caution
                      : alertCategoryColors.system_error
                    const filledSegments = Math.floor((alertModalData.infusionPercentage || 0) / 10)

                    // 모니터링 페이지와 동일한 표시 모드 사용
                    const modalSettingStr = localStorage.getItem('user_setting')
                    let modalVolumeMode: 'percentage' | 'ml' = 'percentage'
                    if (modalSettingStr) {
                      try {
                        const ms = JSON.parse(modalSettingStr)
                        if (ms.volume_display_mode === 'ml') modalVolumeMode = 'ml'
                      } catch {}
                    }
                    const modalValueText = modalVolumeMode === 'ml'
                      ? `${Math.round(alertModalData.infusionCurrentVolume || 0)}ml`
                      : `${Math.round(alertModalData.infusionPercentage || 0)}%`

                    return (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: `${modalAlertColors.bg}`,
                        border: `1px solid ${modalAlertColors.border}`,
                        borderRadius: '8px',
                        px: 1.5,
                        py: 1,
                      }}>
                        {/* 좌: 10칸 세그먼트 프로그레스 바 */}
                        <Box sx={{
                          display: 'flex',
                          flexDirection: 'column-reverse',
                          gap: '2px',
                          flexShrink: 0,
                        }}>
                          {Array.from({ length: 10 }).map((_, segIdx) => (
                            <Box key={segIdx} sx={{
                              width: 16,
                              height: 4,
                              borderRadius: '1px',
                              bgcolor: segIdx < filledSegments ? modalAlertColors.text : '#D5DAE0',
                            }} />
                          ))}
                        </Box>

                        {/* 가운데: 수액종류 + 투입량 */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: modalAlertColors.text, lineHeight: 1.3 }}>
                            {alertModalData.infusionType || 'NS'}
                          </Typography>
                          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: modalAlertColors.text, lineHeight: 1.3 }}>
                            {modalValueText}
                          </Typography>
                        </Box>

                        {/* 우: 알림 뱃지 */}
                        <Box sx={{
                          px: 0.75,
                          py: 0.375,
                          borderRadius: '4px',
                          bgcolor: modalAlertColors.bg,
                          border: `1px solid ${modalAlertColors.border}`,
                          flexShrink: 0,
                        }}>
                          <Typography sx={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: modalAlertColors.text,
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                          }}>
                            {getAlertTypeLabel(alertModalData.alertType)}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  })()}
                </Box>
              </Box>
            </Box>
          </Modal>
        )}

        {/* 환자 추가 모달 */}
        {addPatientModal && (
          <AddPatientModal
            open={addPatientModal.open}
            onClose={() => setAddPatientModal(null)}
            bedId={addPatientModal.bedId}
            bedNumber={addPatientModal.bedNumber}
            roomNumber={addPatientModal.roomNumber}
            onSuccess={() => loadMonitoringData()}
          />
        )}

        {/* 수액 추가 모달 */}
        {addInfusionModal && (
          <AddInfusionModal
            open={addInfusionModal.open}
            onClose={() => setAddInfusionModal(null)}
            patientId={addInfusionModal.patientId}
            patientName={addInfusionModal.patientName}
            bedId={addInfusionModal.bedId}
            bedNumber={addInfusionModal.bedNumber}
            roomNumber={addInfusionModal.roomNumber}
            currentAssignmentCount={addInfusionModal.currentAssignmentCount}
            onSuccess={() => loadMonitoringData()}
          />
        )}

        {/* 환자/수액 QR 모달 */}
        {qrModalData && (
          <PatientQRModal
            open={true}
            onClose={() => setQrModalData(null)}
            wardName={qrModalData.wardName}
            roomNumber={qrModalData.roomNumber}
            bedNumber={qrModalData.bedNumber}
            patientInfo={qrModalData.patientInfo}
            bedId={qrModalData.bedId}
            assignment={qrModalData.assignment}
            onDelete={qrModalData.assignment ? async (assignmentId: number) => {
              try {
                // 수액 삭제: 전용 엔드포인트로 수액 필드만 클리어 (환자-침상 연결 유지)
                await dataProvider.clearInfusion(assignmentId)
                setQrModalData(null)
                loadMonitoringData(true)
              } catch (error) {
                console.error('수액 삭제 실패:', error)
                alert('수액 삭제에 실패했습니다.')
              }
            } : undefined}
            onDeletePatient={!qrModalData.assignment ? async () => {
              try {
                // 환자 삭제: 서버에서 자동 생성된 빈 assignment 해제
                if (qrModalData.allAssignmentIds && qrModalData.allAssignmentIds.length > 0) {
                  for (const aid of qrModalData.allAssignmentIds) {
                    await dataProvider.releaseAssignment(aid)
                  }
                }
                // 로컬 상태에서 즉시 환자 제거 (preservePatientInfo 우회)
                const deletedBedId = qrModalData.bedId
                setMonitoringData(prev => prev.map(ward => ({
                  ...ward,
                  rooms: ward.rooms.map(room => ({
                    ...room,
                    beds: room.beds.map(bed =>
                      bed.bed_id === deletedBedId
                        ? { ...bed, patient_info: null, assignments: [] }
                        : bed
                    )
                  }))
                })))
                setQrModalData(null)
                loadMonitoringData(true)
              } catch (error) {
                console.error('환자 삭제 실패:', error)
                alert('환자 삭제에 실패했습니다.')
              }
            } : undefined}
          />
        )}

        {/* 투여완료 확인 모달 */}
        {completeModal && (
          <Modal
            open={true}
            onClose={() => !completeLoading && setCompleteModal(null)}
            slotProps={{
              backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.3)' } },
            }}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Box sx={{
              bgcolor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              minWidth: 360,
              maxWidth: 420,
              boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.16)',
              outline: 'none',
            }}>
              {/* 헤더 */}
              <Box sx={{
                bgcolor: '#3B82F6',
                py: 2,
                px: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
                  투여완료
                </Typography>
              </Box>

              {/* 내용 */}
              <Box sx={{ p: 3 }}>
                <Box sx={{
                  bgcolor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  p: 2.5,
                  mb: 2.5,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                    <Typography sx={{ fontSize: '20px', fontWeight: 900, color: colors.gray.gray900 }}>
                      {completeModal.roomNumber}
                    </Typography>
                    <Typography sx={{ fontSize: '13px', fontWeight: 900, color: colors.gray.gray500 }}>
                      호
                    </Typography>
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#64748B', ml: 0.5 }}>
                      {completeModal.bedNumber}번 침상
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, color: colors.gray.gray800, mb: 1.5 }}>
                    {completeModal.patientName}
                  </Typography>

                  {/* 수액 상세 정보 */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>수액 종류</Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.gray.gray800 }}>
                        {completeModal.infusionType}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>전체 수액량</Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.gray.gray800 }}>
                        {completeModal.infusionTotalVolume}ml
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>투여량</Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.gray.gray800 }}>
                        {Math.round(completeModal.infusionCurrentVolume)}ml ({completeModal.infusionPercentage}%)
                      </Typography>
                    </Box>
                    {completeModal.infusionCchr && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '13px', color: '#94A3B8' }}>처방속도</Typography>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: colors.gray.gray800 }}>
                          {Math.round(completeModal.infusionCchr)} cc/hr
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Typography sx={{ fontSize: '14px', color: '#64748B', textAlign: 'center', mb: 2 }}>
                  해당 수액의 투여를 완료하시겠습니까?
                </Typography>

                {/* 버튼 */}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    onClick={() => !completeLoading && setCompleteModal(null)}
                    sx={{
                      flex: 1,
                      py: 1.25,
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      bgcolor: 'white',
                      textAlign: 'center',
                      cursor: completeLoading ? 'not-allowed' : 'pointer',
                      opacity: completeLoading ? 0.5 : 1,
                      '&:hover': { bgcolor: '#F8FAFC' },
                    }}
                  >
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#64748B' }}>
                      취소
                    </Typography>
                  </Box>
                  <Box
                    onClick={handleCompleteInfusion}
                    sx={{
                      flex: 1,
                      py: 1.25,
                      borderRadius: '10px',
                      bgcolor: completeLoading ? '#93C5FD' : '#3B82F6',
                      textAlign: 'center',
                      cursor: completeLoading ? 'not-allowed' : 'pointer',
                      '&:hover': { bgcolor: completeLoading ? '#93C5FD' : '#2563EB' },
                    }}
                  >
                    <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>
                      {completeLoading ? '처리중...' : '투여완료'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Modal>
        )}

      </MainContent>

      {/* Toast 알림 제거 → notification 토픽은 알림 모달로 직접 표시 */}
    </Box>
  )
}

export default MonitoringPage