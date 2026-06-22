import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'

// 루트 경로 리다이렉트 컴포넌트 (로딩 없이 즉시 리다이렉트)
function RootRedirect() {
  const token = localStorage.getItem('auth_token')
  const user = localStorage.getItem('user_info')
  const isAuthenticated = !!(token && user)

  return <Navigate to={isAuthenticated ? '/monitoring' : '/login'} replace />
}
import './App.css'
import LoginPage from './pages/LoginPage'
import MonitoringPage from './pages/MonitoringPage'
import AdminMonitoringPage from './pages/AdminMonitoringPage'

// 역할별 모니터링 페이지 분기
function MonitoringRouter() {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const role = userInfo.role || 'super_admin'
  return role === 'nurse' ? <MonitoringPage /> : <AdminMonitoringPage />
}
import DevicesPage from './pages/DevicesPage'
import MqttPage from './pages/MqttPage'
import UsersPage from './pages/UsersPage'
import StatisticsPage from './pages/StatisticsPage'
import HospitalPage from './pages/HospitalPage'
import ProfileEditPage from './pages/ProfileEditPage'
import PrivateRoute from './components/PrivateRoute'
import { GlobalProvider } from './contexts/GlobalContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { MqttProvider } from './contexts/MqttContext'
// NotificationToastContainer 제거 → MonitoringPage에서 알림 모달로 직접 표시

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const user = localStorage.getItem('user_info')
    const isAuthenticated = !!(token && user)

    // 로그인 상태에서 브라우저 접근 시 user_id 콘솔 출력
    if (isAuthenticated && user) {
      try {
        const userInfo = JSON.parse(user)
        const userId = userInfo.user_id || userInfo.id
        // console.log('✅ 브라우저 접근/새로고침 - 로그인 상태 확인 - user_id:', userId)
        // console.log('📡 MQTT 토픽 구독 예정:')
        // console.log(`  - user/${userId}/notification`)
        // console.log(`  - user/${userId}/assignment/refresh`)
      } catch (error) {
        console.error('Failed to parse user_info:', error)
      }
    }
  }, [location.pathname, navigate])

  // BroadcastChannel로 다른 탭/창의 로그아웃 및 새 로그인 감지
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return
    }

    const authChannel = new BroadcastChannel('auth_channel')

    authChannel.onmessage = (event) => {
      // 로그아웃 이벤트 처리
      if (event.data.type === 'logout') {
        // console.log('🔔 Logout event received from another tab/window')

        // localStorage 정리
        localStorage.removeItem('auth_token')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user_info')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_name')
        localStorage.removeItem('hospital_id')
        localStorage.removeItem('ward_id')
        localStorage.removeItem('user_setting')
        localStorage.removeItem('ward_setting')
        localStorage.removeItem('isAuthenticated')
        localStorage.removeItem('session_id')
        // 모니터링 관련 선택 값 정리 (다른 사용자 로그인 시 이전 선택 유지 방지)
        localStorage.removeItem('monitoring_hospital')
        localStorage.removeItem('monitoring_ward')
        localStorage.removeItem('monitoring_rooms')
        localStorage.removeItem('monitoring_bedsPerRow')

        // 로그아웃 이벤트 발생 (MQTT 구독 해제 등)
        window.dispatchEvent(new Event('logout'))

        // 로그인 페이지로 이동
        navigate('/login')
      }

      // 로그인 페이지에서는 new_login 이벤트 무시
      if (location.pathname === '/login' && event.data.type === 'new_login') {
        return
      }

      // 새 로그인 감지 - Single Session 구현
      if (event.data.type === 'new_login') {
        const currentSessionId = localStorage.getItem('session_id')
        const newSessionId = event.data.sessionId

        // 현재 세션과 새 로그인 세션이 다르면 강제 로그아웃
        if (currentSessionId && currentSessionId !== newSessionId) {
          // console.log('🚨 New login detected from another location - forcing logout')

          // localStorage 정리
          localStorage.removeItem('auth_token')
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user_info')
          localStorage.removeItem('user_id')
          localStorage.removeItem('user_email')
          localStorage.removeItem('user_role')
          localStorage.removeItem('user_name')
          localStorage.removeItem('hospital_id')
          localStorage.removeItem('ward_id')
          localStorage.removeItem('user_setting')
          localStorage.removeItem('isAuthenticated')
          localStorage.removeItem('session_id')
          // 모니터링 관련 선택 값 정리 (다른 사용자 로그인 시 이전 선택 유지 방지)
          localStorage.removeItem('monitoring_hospital')
          localStorage.removeItem('monitoring_ward')
          localStorage.removeItem('monitoring_rooms')
          localStorage.removeItem('monitoring_bedsPerRow')

          // 로그아웃 이벤트 발생
          window.dispatchEvent(new Event('logout'))

          // 알림 후 로그인 페이지로 이동
          alert('다른 위치에서 로그인하여 현재 세션이 종료되었습니다.')
          navigate('/login')
        }
      }
    }

    return () => {
      authChannel.close()
    }
  }, [navigate, location.pathname])

  // localStorage 변화 감지 (다른 탭에서 localStorage가 삭제된 경우)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // auth_token이나 user_info가 삭제되었는지 확인
      if ((e.key === 'auth_token' || e.key === 'user_info' || e.key === 'isAuthenticated') && e.newValue === null) {
        // console.log('🚨 Auth data removed from localStorage - forcing logout')

        // 모든 인증 관련 데이터 정리
        localStorage.removeItem('auth_token')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user_info')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_name')
        localStorage.removeItem('hospital_id')
        localStorage.removeItem('ward_id')
        localStorage.removeItem('user_setting')
        localStorage.removeItem('ward_setting')
        localStorage.removeItem('isAuthenticated')
        // 모니터링 관련 선택 값 정리 (다른 사용자 로그인 시 이전 선택 유지 방지)
        localStorage.removeItem('monitoring_hospital')
        localStorage.removeItem('monitoring_ward')
        localStorage.removeItem('monitoring_rooms')
        localStorage.removeItem('monitoring_bedsPerRow')

        // 로그아웃 이벤트 발생
        window.dispatchEvent(new Event('logout'))

        // 로그인 페이지로 강제 이동
        if (location.pathname !== '/login') {
          navigate('/login')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [location.pathname, navigate])
  
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="/monitoring" element={
        <PrivateRoute>
          <MonitoringRouter />
        </PrivateRoute>
      } />
      <Route path="/devices" element={
        <PrivateRoute>
          <DevicesPage />
        </PrivateRoute>
      } />
      <Route path="/mqtt" element={
        <PrivateRoute>
          <MqttPage />
        </PrivateRoute>
      } />
      <Route path="/device-mqtt" element={
        <PrivateRoute>
          <MqttPage />
        </PrivateRoute>
      } />
      <Route path="/users" element={
        <PrivateRoute>
          <UsersPage />
        </PrivateRoute>
      } />
      <Route path="/statistics" element={
        <PrivateRoute>
          <StatisticsPage />
        </PrivateRoute>
      } />
      <Route path="/hospital" element={
        <PrivateRoute>
          <HospitalPage />
        </PrivateRoute>
      } />
      <Route path="/profile/edit" element={
        <PrivateRoute>
          <ProfileEditPage />
        </PrivateRoute>
      } />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <MqttProvider>
          <GlobalProvider>
            <AppContent />
          </GlobalProvider>
        </MqttProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App