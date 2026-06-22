import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, TextField, Button, Typography, Paper, InputAdornment, IconButton, Alert, CircularProgress } from '@mui/material'
import { Visibility, VisibilityOff, LightMode, DarkMode, Launch } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { dataProvider } from '../providers/dataProvider'
import { useTheme } from '../contexts/ThemeContext'
import { colors } from '../styles/colors'

const PageContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ theme, isDarkMode = false }) => ({
  minHeight: '100vh',
  height: '100vh',
  width: '100vw',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: isDarkMode ? colors.gray.gray900 : 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
  margin: 0,
  padding: 0,
  position: 'fixed',
  top: 0,
  left: 0,
  overflow: 'hidden',
  transition: 'background-color 0.3s ease',
}))

const LoginCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ theme, isDarkMode = false }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  background: isDarkMode ? colors.gray.gray1000 : '#ffffff',
  borderRadius: '20px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  width: '100%',
  maxWidth: '420px',
  marginTop: theme.spacing(3),
  transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
}))

const StyledTextField = styled(TextField, {
  shouldForwardProp: (prop) => prop !== 'isDarkMode',
})<{ isDarkMode?: boolean }>(({ theme, isDarkMode = false }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: isDarkMode ? colors.gray.gray900 : colors.gray.gray100,
    border: 'none',
    height: '45px',
    '& fieldset': {
      border: 'none !important',
      outline: 'none !important',
    },
    '&:hover fieldset': {
      border: 'none !important',
      outline: 'none !important',
    },
    '&.Mui-focused fieldset': {
      border: 'none !important',
      outline: 'none !important',
    },
    '& input': {
      backgroundColor: 'transparent !important',
      borderRadius: '12px',
      padding: '0 12px',
      fontSize: '16px',
      color: isDarkMode ? colors.gray.gray100 : '#424242',
      height: '100%',
      '&::placeholder': {
        color: isDarkMode ? colors.gray.gray600 : '#9e9e9e',
        opacity: 1,
        fontSize: '16px',
      },
      '&:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 1000px ${isDarkMode ? colors.gray.gray900 : colors.gray.gray100} inset !important`,
        backgroundColor: `${isDarkMode ? colors.gray.gray900 : colors.gray.gray100} !important`,
        WebkitTextFillColor: isDarkMode ? colors.gray.gray100 : '#424242',
        border: 'none !important',
        outline: 'none !important',
      },
      '&:-webkit-autofill:hover': {
        WebkitBoxShadow: `0 0 0 1000px ${isDarkMode ? colors.gray.gray900 : colors.gray.gray100} inset !important`,
        border: 'none !important',
        outline: 'none !important',
      },
      '&:-webkit-autofill:focus': {
        WebkitBoxShadow: `0 0 0 1000px ${isDarkMode ? colors.gray.gray900 : colors.gray.gray100} inset !important`,
        border: 'none !important',
        outline: 'none !important',
      },
      '&:-webkit-autofill:active': {
        WebkitBoxShadow: `0 0 0 1000px ${isDarkMode ? colors.gray.gray900 : colors.gray.gray100} inset !important`,
        border: 'none !important',
        outline: 'none !important',
      },
    },
  },
  '& .MuiInputLabel-root': {
    display: 'none',
  },
}))

const LoginButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(6),
  height: '45px',
  background: colors.gradients.blue,
  borderRadius: '32px',
  fontSize: '16px',
  fontWeight: '600',
  textTransform: 'none',
  color: '#ffffff',
  border: 'none',
  boxShadow: '0 0 20px rgba(124, 202, 241, 0.6), 0 0 40px rgba(0, 88, 230, 0.4)',
  '&:hover': {
    background: colors.gradients.blue,
    transform: 'scale(1.02)',
    boxShadow: '0 0 30px rgba(124, 202, 241, 0.7), 0 0 50px rgba(0, 88, 230, 0.5)',
    opacity: 0.95,
  },
  '&:disabled': {
    backgroundColor: '#e0e0e0',
    color: '#9e9e9e',
    boxShadow: 'none',
  },
  transition: 'all 0.3s ease',
}))

const LoginPage: React.FC = () => {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { isDarkMode, toggleTheme } = useTheme()

  // 이미 로그인된 상태면 모니터링 페이지로 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const userInfo = localStorage.getItem('user_info')
    if (token && userInfo) {
      navigate('/monitoring', { replace: true })
    }
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await dataProvider.login({
        auth_id: userId,
        password: password
      })

      if (response.token) {
        // 새 세션 ID 생성 (타임스탬프 + 랜덤값)
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

        // localStorage에 토큰 및 세션 정보 저장
        dataProvider.setTokens(response)
        localStorage.setItem('isAuthenticated', 'true')
        localStorage.setItem('session_id', sessionId)

        // 로그인 시 user_id 확인
        const loggedInUserId = response.user?.id || userId
        // console.log('🔑 로그인 완료 - user_id:', loggedInUserId)
        // console.log('📡 MQTT 토픽 구독 예정:')
        // console.log(`  - user/${loggedInUserId}/notification`)
        // console.log(`  - user/${loggedInUserId}/assignment/refresh`)

        // user_settings 가져오기
        try {
          const userSettingsResponse = await dataProvider.getList('user_settings', {
            page: 1,
            limit: 1,
            where: { user_id: loggedInUserId }
          })

          if (userSettingsResponse.data && userSettingsResponse.data.length > 0) {
            const userSetting = userSettingsResponse.data[0] as any

            // localStorage에 user_setting 저장 (UI 관련 설정만)
            const uiSettings = {
              alert_color: userSetting.alert_color || '#FF6B6B',
              alert_display_time: userSetting.alert_display_time || 5,
              volume_display_mode: userSetting.volume_display_mode || 'percentage',
              critical_alert_enabled: userSetting.critical_alert_enabled !== undefined ? userSetting.critical_alert_enabled : 1,
              critical_sound_enabled: userSetting.critical_sound_enabled !== undefined ? userSetting.critical_sound_enabled : 1,
              caution_alert_enabled: userSetting.caution_alert_enabled !== undefined ? userSetting.caution_alert_enabled : 1,
              caution_sound_enabled: userSetting.caution_sound_enabled !== undefined ? userSetting.caution_sound_enabled : 1,
              system_error_alert_enabled: userSetting.system_error_alert_enabled !== undefined ? userSetting.system_error_alert_enabled : 1,
              system_error_sound_enabled: userSetting.system_error_sound_enabled !== undefined ? userSetting.system_error_sound_enabled : 1,
              critical_sound_volume: userSetting.critical_sound_volume ?? 100,
              caution_sound_volume: userSetting.caution_sound_volume ?? 100,
              system_error_sound_volume: userSetting.system_error_sound_volume ?? 100,
            }
            localStorage.setItem('user_setting', JSON.stringify(uiSettings))
          }
        } catch (error) {
          console.error('❌ 사용자 설정 로드 실패:', error)
        }

        // 페이지 이동 먼저 실행 (현재 탭이 이벤트를 받기 전에 navigate 완료)
        navigate('/')

        // BroadcastChannel로 다른 탭에 새 로그인 알림 (약간의 딜레이)
        setTimeout(() => {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const authChannel = new BroadcastChannel('auth_channel')
            authChannel.postMessage({
              type: 'new_login',
              sessionId: sessionId,
              userId: response.user?.id || userId,
              timestamp: Date.now()
            })
            authChannel.close()
          }
        }, 100)
      } else {
        setError('로그인에 실패했습니다. 토큰을 받지 못했습니다.')
      }
    } catch (err: any) {
      console.error('Login error:', err)

      // API에서 반환된 메시지 추출
      const message = err.response?.data?.message || err.message || ''

      // 계정 잠금 관련 메시지 처리
      if (message.includes('잠겼습니다') || message.includes('잠겨있습니다')) {
        // "비밀번호 5회 오류로 계정이 잠겼습니다. 관리자에게 문의하세요."
        // "계정이 잠겨있습니다. 관리자에게 문의하세요."
        setError(message)
      } else if (message.includes('회 남음')) {
        // "아이디 또는 비밀번호가 일치하지 않습니다. (X회 남음)" → 간단하게 표시
        setError('아이디 또는 비밀번호가 일치하지 않습니다.')
      } else if (err.status === 401) {
        // 일반적인 401 에러 또는 메시지가 있는 경우
        setError(message || '아이디 또는 비밀번호가 올바르지 않습니다.')
      } else if (message) {
        setError(message)
      } else {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword)
  }

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  return (
    <PageContainer isDarkMode={isDarkMode}>
      {/* Theme Toggle Button - Top Right */}
      <IconButton
        onClick={toggleTheme}
        sx={{
          position: 'absolute',
          top: 24,
          right: 24,
          color: isDarkMode ? colors.gray.gray100 : '#757575',
          backgroundColor: isDarkMode ? colors.gray.gray600 : '#ffffff',
          border: isDarkMode ? 'none' : '1px solid #e0e0e0',
          borderRadius: '12px',
          width: '48px',
          height: '48px',
          boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
          '&:hover': {
            backgroundColor: isDarkMode ? colors.gray.gray500 : '#f5f5f5',
            boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
          },
        }}
      >
        {isDarkMode ? <DarkMode /> : <LightMode />}
      </IconButton>

      {/* Login Form - White box */}
      <LoginCard elevation={0} isDarkMode={isDarkMode}>
        {/* Logo and Title */}
        <Box sx={{ textAlign: 'left', mb: 4 }}>
          <Box
            component="img"
            src="/app_logo.png"
            alt="iRinger Logo"
            sx={{
              width: '80px',
              height: '80px',
              borderRadius: '8px',
              mb: 3,
            }}
          />
          <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold', color: isDarkMode ? colors.gray.gray100 : '#424242', fontSize: '24px', mb: 1 }}>
            iRinger Login2
          </Typography>
          <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray400 : '#757575', fontSize: '16px' }}>
            Hospital Monitoring System
          </Typography>
        </Box>
        <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray200 : '#424242', mb: 0.5, fontWeight: 'normal', fontSize: '18px' }}>
            User ID
          </Typography>
          <StyledTextField
            margin="none"
            required
            fullWidth
            id="userId"
            placeholder="Enter your ID"
            name="userId"
            autoComplete="username"
            autoFocus
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            isDarkMode={isDarkMode}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      component="img"
                      src="/icons/ic_user_alt.svg"
                      alt="user icon"
                      sx={{
                        width: 24,
                        height: 24,
                        opacity: isDarkMode ? 0.6 : 1.0,
                        filter: isDarkMode ? 'brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'
                      }}
                    />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: 3 }}
          />

          <Typography variant="body2" sx={{ color: isDarkMode ? colors.gray.gray200 : '#424242', mb: 0.5, fontWeight: 'normal', fontSize: '18px' }}>
            Password
          </Typography>
          <StyledTextField
            margin="none"
            required
            fullWidth
            name="password"
            placeholder="Enter your password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            isDarkMode={isDarkMode}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      component="img"
                      src="/icons/ic_password.svg"
                      alt="password icon"
                      sx={{
                        width: 24,
                        height: 24,
                        opacity: isDarkMode ? 0.6 : 1.0,
                        filter: isDarkMode ? 'brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'
                      }}
                    />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                      edge="end"
                      size="small"
                    >
                      <Box
                        component="img"
                        src="/icons/ic_eye.svg"
                        alt="eye icon"
                        sx={{
                          width: 20,
                          height: 20,
                          filter: isDarkMode
                            ? 'brightness(0) saturate(100%) invert(45%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)'
                            : 'brightness(0) saturate(100%) invert(84%) sepia(3%) saturate(485%) hue-rotate(177deg) brightness(92%) contrast(87%)'
                        }}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          
          <LoginButton
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            startIcon={
              !loading ? (
                <Box
                  component="img"
                  src="/icons/ic_login.svg"
                  alt="login icon"
                  sx={{ width: 20, height: 20 }}
                />
              ) : null
            }
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: '#ffffff' }} />
            ) : (
              'Login'
            )}
          </LoginButton>

          {/* iRinger.im Link Button */}
          <Button
            fullWidth
            variant="outlined"
            href="https://iringer.im"
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<Launch sx={{ fontSize: '18px' }} />}
            sx={{
              mt: 2,
              height: '45px',
              borderRadius: '32px',
              fontSize: '16px',
              fontWeight: '600',
              textTransform: 'none',
              color: colors.mainColor.blue,
              borderColor: colors.mainColor.blue,
              backgroundColor: 'transparent',
              '&:hover': {
                borderColor: colors.mainColor.blue,
                backgroundColor: isDarkMode ? 'rgba(0, 158, 230, 0.1)' : 'rgba(0, 158, 230, 0.05)',
              },
            }}
          >
            iRinger 홈페이지 방문
          </Button>
        </Box>

        {/* Security Text and Copyright */}
        <Box sx={{ textAlign: 'left', mt: 4 }}>
          <Typography variant="caption" sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 , display: 'flex', alignItems: 'center', mb: 1, fontSize: '12px', lineHeight: 1 }}>
            <Box
              component="img"
              src="/icons/ic_shield.svg"
              alt="shield icon"
              sx={{
                width: 12,
                height: 12,
                mr: 0.5,
                display: 'flex',
                filter: isDarkMode ? 'brightness(0) saturate(100%) invert(35%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'
              }}
            />
            Secure hospital staff access only
          </Typography>
          <Typography variant="caption" sx={{ color: isDarkMode ? colors.gray.gray600 : colors.gray.gray400 , display: 'block', fontSize: '12px' }}>
            © 2025 iRinger Hospital Monitoring System
          </Typography>
        </Box>
      </LoginCard>
    </PageContainer>
  )
}

export default LoginPage