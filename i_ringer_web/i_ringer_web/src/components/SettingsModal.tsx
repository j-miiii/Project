import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, Modal, TextField, IconButton, CircularProgress, Slider } from '@mui/material'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { dataProvider } from '../providers/dataProvider'
import { alertCategoryColors } from '../utils/statusUtils'

const ToggleButton = ({ enabled, onClick, disabled = false, activeColor = '#009EE6', inactiveColor = '#CBD5E1' }: { enabled: boolean, onClick: () => void, disabled?: boolean, activeColor?: string, inactiveColor?: string }) => (
  <Box
    onClick={() => !disabled && onClick()}
    sx={{
      width: 44,
      height: 24,
      borderRadius: '12px',
      bgcolor: enabled ? activeColor : inactiveColor,
      position: 'relative',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
    }}
  >
    <Box sx={{
      width: 18,
      height: 18,
      borderRadius: '50%',
      bgcolor: 'white',
      position: 'absolute',
      top: 3,
      left: enabled ? 23 : 3,
      transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </Box>
)

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (settings: SettingsData) => void
}

export interface SettingsData {
  fastAlert: {
    enabled: boolean
    calculation: string
  }
  slowAlert: {
    enabled: boolean
    calculation: string
  }
  fastSlowCchr: number
  completionAlert: {
    enabled: boolean
    threshold: number
  }
  stopAlert: {
    enabled: boolean
  }
  alertColor: string
  alertDisplayTime: number
  // 신규: alert_category별 알림/소리 토글
  criticalAlertEnabled: boolean
  criticalSoundEnabled: boolean
  cautionAlertEnabled: boolean
  cautionSoundEnabled: boolean
  systemErrorAlertEnabled: boolean
  systemErrorSoundEnabled: boolean
  // 카테고리별 소리 볼륨 (0~100)
  criticalSoundVolume: number
  cautionSoundVolume: number
  systemErrorSoundVolume: number
  // 수액량 표시 모드
  volumeDisplayMode: 'percentage' | 'ml'
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  onConfirm
}) => {
  const { isDarkMode } = useTheme()

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')
  const userRole = userInfo.role || 'super_admin'
  const isSuperAdmin = userRole === 'super_admin'
  const isNurse = userRole === 'nurse'

  const disableTextFields = isSuperAdmin || isNurse
  const disableToggles = isSuperAdmin

  const getDefaultSettings = (): SettingsData => ({
    fastAlert: { enabled: false, calculation: '50' },
    slowAlert: { enabled: false, calculation: '50' },
    fastSlowCchr: 200,
    completionAlert: { enabled: true, threshold: 95 },
    stopAlert: { enabled: true },
    alertColor: colors.mainColor.blue,
    alertDisplayTime: 5,
    criticalAlertEnabled: true,
    criticalSoundEnabled: true,
    cautionAlertEnabled: true,
    cautionSoundEnabled: true,
    systemErrorAlertEnabled: true,
    systemErrorSoundEnabled: true,
    criticalSoundVolume: 100,
    cautionSoundVolume: 100,
    systemErrorSoundVolume: 100,
    volumeDisplayMode: 'percentage',
  })

  const [settings, setSettings] = useState<SettingsData>(getDefaultSettings())
  const [loading, setLoading] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // 볼륨 슬라이더 놓았을 때 미리듣기
  const playPreviewSound = (volume: number) => {
    try {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio('/sounds/iringer_noti_sound.mp3')
      }
      previewAudioRef.current.volume = Math.min(1, Math.max(0, volume / 100))
      previewAudioRef.current.currentTime = 0
      previewAudioRef.current.play().catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (open) {
      loadSettingsFromServer()
    }
  }, [open])

  const loadSettingsFromServer = async () => {
    setLoading(true)
    try {
      const userId = userInfo.user_id || userInfo.id
      if (!userId) {
        setSettings(getDefaultSettings())
        return
      }

      // user_settings 로드 (UI 관련)
      const response = await dataProvider.getList('user_settings', {
        page: 1,
        limit: 1,
        where: `user_id:${userId}`
      })

      // ward_settings 로드 (threshold 관련) - userInfo.ward_id로 서버 조회
      let wardData: any = null
      try {
        const wardId = userInfo.ward_id
        if (wardId) {
          const wardResponse = await dataProvider.getList('ward_settings', {
            page: 1,
            limit: 1,
            where: `ward_id:${wardId}`
          })
          if (wardResponse.data && wardResponse.data.length > 0) {
            wardData = wardResponse.data[0]
          }
        }
      } catch {}

      if (response.data && response.data.length > 0) {
        const s = response.data[0] as any
        // localStorage 폴백 (서버 DB에 볼륨 컬럼 추가 전까지)
        let localVolumes = { critical_sound_volume: 100, caution_sound_volume: 100, system_error_sound_volume: 100 }
        try {
          const ls = JSON.parse(localStorage.getItem('user_setting') || '{}')
          if (ls.critical_sound_volume !== undefined) localVolumes.critical_sound_volume = ls.critical_sound_volume
          if (ls.caution_sound_volume !== undefined) localVolumes.caution_sound_volume = ls.caution_sound_volume
          if (ls.system_error_sound_volume !== undefined) localVolumes.system_error_sound_volume = ls.system_error_sound_volume
        } catch {}

        // threshold는 ward_settings에서, 나머지는 user_settings에서
        const w = wardData || {}
        setSettings({
          fastAlert: { enabled: !!(w.fast_enabled ?? s.fast_enabled), calculation: String(w.fast_threshold ?? s.fast_threshold ?? 50) },
          slowAlert: { enabled: !!(w.slow_enabled ?? s.slow_enabled), calculation: String(w.slow_threshold ?? s.slow_threshold ?? 50) },
          fastSlowCchr: w.default_cchr ?? s.default_cchr ?? 200,
          completionAlert: { enabled: !!(w.complete_enabled ?? s.complete_enabled), threshold: w.complete_threshold ?? s.complete_threshold ?? 95 },
          stopAlert: { enabled: !!(w.stop_enabled ?? s.stop_enabled) },
          alertColor: s.alert_color || colors.mainColor.blue,
          alertDisplayTime: s.alert_display_time || 5,
          criticalAlertEnabled: s.critical_alert_enabled !== undefined ? !!s.critical_alert_enabled : true,
          criticalSoundEnabled: s.critical_sound_enabled !== undefined ? !!s.critical_sound_enabled : true,
          cautionAlertEnabled: s.caution_alert_enabled !== undefined ? !!s.caution_alert_enabled : true,
          cautionSoundEnabled: s.caution_sound_enabled !== undefined ? !!s.caution_sound_enabled : true,
          systemErrorAlertEnabled: s.system_error_alert_enabled !== undefined ? !!s.system_error_alert_enabled : true,
          systemErrorSoundEnabled: s.system_error_sound_enabled !== undefined ? !!s.system_error_sound_enabled : true,
          criticalSoundVolume: s.critical_sound_volume ?? localVolumes.critical_sound_volume,
          cautionSoundVolume: s.caution_sound_volume ?? localVolumes.caution_sound_volume,
          systemErrorSoundVolume: s.system_error_sound_volume ?? localVolumes.system_error_sound_volume,
          volumeDisplayMode: s.volume_display_mode || 'percentage',
        })
      } else {
        // user_settings가 없어도 ward_settings는 반영
        if (wardData) {
          const w = wardData
          setSettings({
            ...getDefaultSettings(),
            fastAlert: { enabled: !!w.fast_enabled, calculation: String(w.fast_threshold || 50) },
            slowAlert: { enabled: !!w.slow_enabled, calculation: String(w.slow_threshold || 50) },
            fastSlowCchr: w.default_cchr || 200,
            completionAlert: { enabled: !!w.complete_enabled, threshold: w.complete_threshold || 95 },
            stopAlert: { enabled: !!w.stop_enabled },
          })
        } else {
          setSettings(getDefaultSettings())
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      setSettings(getDefaultSettings())
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    onConfirm(settings)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{
        bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
        borderRadius: '20px',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
        minWidth: 720,
        maxWidth: 780,
        maxHeight: '90vh',
        overflow: 'auto',
        outline: 'none',
      }}>
        {/* 헤더 */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          bgcolor: '#1E293B',
          borderRadius: '20px 20px 0 0',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src="/icons/ic_web_setting.svg" sx={{ width: 16, height: 16 }} />
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>
              환경 설정
            </Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'} ({__BUILD_DATE__})
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ p: 0.5 }}>
            <Box component="img" src="/icons/ic_web_close.svg" sx={{ width: 13, height: 13 }} />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300, p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            {/* 알림 설정 (카테고리별 통합) */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 1.5, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900 }}>
                알림 설정
              </Typography>
              <Box sx={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #E2E8F0',
              }}>
                {/* 위급 */}
                <Box sx={{ bgcolor: 'rgba(254, 242, 242, 0.3)' }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2, pt: 1.5, pb: 1,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        px: 1.5, py: 0.5, borderRadius: '8px',
                        bgcolor: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        minWidth: 70, textAlign: 'center',
                      }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>위급</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.3 }}>
                        빠름 · 정지 · 완료
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>알림</Typography>
                        <ToggleButton
                          enabled={settings.criticalAlertEnabled}
                          onClick={() => {
                            const newVal = !settings.criticalAlertEnabled
                            setSettings({
                              ...settings,
                              criticalAlertEnabled: newVal,
                              fastAlert: { ...settings.fastAlert, enabled: newVal },
                              stopAlert: { ...settings.stopAlert, enabled: newVal },
                            })
                          }}
                          activeColor="#EF4444"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>소리</Typography>
                        <ToggleButton
                          enabled={settings.criticalSoundEnabled}
                          onClick={() => setSettings({ ...settings, criticalSoundEnabled: !settings.criticalSoundEnabled })}
                          activeColor="#EF4444"
                        />
                      </Box>
                    </Box>
                  </Box>
                  {/* 위급 > 소리 볼륨 */}
                  <Box sx={{ px: 2, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5, opacity: settings.criticalSoundEnabled ? 1 : 0.35 }}>
                    {settings.criticalSoundEnabled
                      ? <VolumeUpIcon sx={{ fontSize: 18, color: '#EF4444' }} />
                      : <VolumeOffIcon sx={{ fontSize: 18, color: '#CBD5E1' }} />
                    }
                    <Slider
                      value={settings.criticalSoundVolume}
                      onChange={(_, v) => settings.criticalSoundEnabled && setSettings({ ...settings, criticalSoundVolume: v as number })}
                      onChangeCommitted={(_, v) => settings.criticalSoundEnabled && playPreviewSound(v as number)}
                      disabled={!settings.criticalSoundEnabled}
                      min={0} max={100}
                      sx={{
                        flex: 1, height: 4,
                        color: settings.criticalSoundEnabled ? '#EF4444' : '#CBD5E1',
                        '& .MuiSlider-thumb': { width: 14, height: 14, bgcolor: 'white', border: `2px solid ${settings.criticalSoundEnabled ? '#EF4444' : '#CBD5E1'}` },
                        '& .MuiSlider-track': { border: 'none' },
                        '& .MuiSlider-rail': { bgcolor: settings.criticalSoundEnabled ? '#FECACA' : '#E2E8F0' },
                        '&.Mui-disabled': { color: '#CBD5E1' },
                      }}
                    />
                    <Typography sx={{ fontSize: '11px', color: '#94A3B8', minWidth: 28, textAlign: 'right' }}>
                      {settings.criticalSoundVolume}%
                    </Typography>
                  </Box>
                  {/* 위급 > 알림 기준 */}
                  <Box sx={{ px: 2, pb: 1.5, opacity: settings.criticalAlertEnabled ? 1 : 0.35 }}>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.7)',
                      border: '1px solid #FCA5A5',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', minWidth: 32 }}>빠름</Typography>
                      <Box sx={{
                        bgcolor: 'white',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        px: 1, py: 0.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}>
                        <TextField
                          value={settings.fastAlert.calculation}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            setSettings({ ...settings, fastAlert: { ...settings.fastAlert, calculation: val } })
                          }}
                          disabled={!settings.criticalAlertEnabled}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{
                            width: 32,
                            '& input': { fontSize: '16px', fontWeight: 700, textAlign: 'center', color: '#1E293B', p: 0 }
                          }}
                        />
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#64748B' }}>%</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8', ml: 'auto' }}>이상 빠를 시</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ height: '1px', bgcolor: '#F1F5F9' }} />

                {/* 주의 */}
                <Box sx={{ bgcolor: 'rgba(254, 252, 232, 0.3)' }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2, pt: 1.5, pb: 1,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        px: 1.5, py: 0.5, borderRadius: '8px',
                        bgcolor: '#FEF9C3',
                        border: '1px solid #FDE047',
                        minWidth: 70, textAlign: 'center',
                      }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#CA8A04' }}>주의</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.3 }}>
                        느림 · 완료 임박
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>알림</Typography>
                        <ToggleButton
                          enabled={settings.cautionAlertEnabled}
                          onClick={() => {
                            const newVal = !settings.cautionAlertEnabled
                            setSettings({
                              ...settings,
                              cautionAlertEnabled: newVal,
                              slowAlert: { ...settings.slowAlert, enabled: newVal },
                              completionAlert: { ...settings.completionAlert, enabled: newVal },
                            })
                          }}
                          activeColor="#EAB308"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>소리</Typography>
                        <ToggleButton
                          enabled={settings.cautionSoundEnabled}
                          onClick={() => setSettings({ ...settings, cautionSoundEnabled: !settings.cautionSoundEnabled })}
                          activeColor="#EAB308"
                        />
                      </Box>
                    </Box>
                  </Box>
                  {/* 주의 > 소리 볼륨 */}
                  <Box sx={{ px: 2, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5, opacity: settings.cautionSoundEnabled ? 1 : 0.35 }}>
                    {settings.cautionSoundEnabled
                      ? <VolumeUpIcon sx={{ fontSize: 18, color: '#EAB308' }} />
                      : <VolumeOffIcon sx={{ fontSize: 18, color: '#CBD5E1' }} />
                    }
                    <Slider
                      value={settings.cautionSoundVolume}
                      onChange={(_, v) => settings.cautionSoundEnabled && setSettings({ ...settings, cautionSoundVolume: v as number })}
                      onChangeCommitted={(_, v) => settings.cautionSoundEnabled && playPreviewSound(v as number)}
                      disabled={!settings.cautionSoundEnabled}
                      min={0} max={100}
                      sx={{
                        flex: 1, height: 4,
                        color: settings.cautionSoundEnabled ? '#EAB308' : '#CBD5E1',
                        '& .MuiSlider-thumb': { width: 14, height: 14, bgcolor: 'white', border: `2px solid ${settings.cautionSoundEnabled ? '#EAB308' : '#CBD5E1'}` },
                        '& .MuiSlider-track': { border: 'none' },
                        '& .MuiSlider-rail': { bgcolor: settings.cautionSoundEnabled ? '#FEF08A' : '#E2E8F0' },
                        '&.Mui-disabled': { color: '#CBD5E1' },
                      }}
                    />
                    <Typography sx={{ fontSize: '11px', color: '#94A3B8', minWidth: 28, textAlign: 'right' }}>
                      {settings.cautionSoundVolume}%
                    </Typography>
                  </Box>
                  {/* 주의 > 알림 기준 */}
                  <Box sx={{ px: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, opacity: settings.cautionAlertEnabled ? 1 : 0.35 }}>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.7)',
                      border: '1px solid #FDE047',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#CA8A04', minWidth: 52 }}>느림</Typography>
                      <Box sx={{
                        bgcolor: 'white',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        px: 1, py: 0.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}>
                        <TextField
                          value={settings.slowAlert.calculation}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            setSettings({ ...settings, slowAlert: { ...settings.slowAlert, calculation: val } })
                          }}
                          disabled={!settings.cautionAlertEnabled}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{
                            width: 32,
                            '& input': { fontSize: '16px', fontWeight: 700, textAlign: 'center', color: '#1E293B', p: 0 }
                          }}
                        />
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#64748B' }}>%</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8', ml: 'auto' }}>이상 느릴 시</Typography>
                    </Box>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.7)',
                      border: '1px solid #FDE047',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#CA8A04', minWidth: 52 }}>완료 임박</Typography>
                      <Box sx={{
                        bgcolor: 'white',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        px: 1, py: 0.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}>
                        <TextField
                          value={settings.completionAlert.threshold}
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0
                            setSettings({ ...settings, completionAlert: { ...settings.completionAlert, threshold: Math.min(100, val) } })
                          }}
                          disabled={!settings.cautionAlertEnabled}
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{
                            width: 32,
                            '& input': { fontSize: '16px', fontWeight: 700, textAlign: 'center', color: '#1E293B', p: 0 }
                          }}
                        />
                        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#64748B' }}>%</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8', ml: 'auto' }}>도달 시 알림</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ height: '1px', bgcolor: '#F1F5F9' }} />

                {/* 시스템 오류 */}
                <Box sx={{ bgcolor: 'rgba(239, 246, 255, 0.3)' }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 2, pt: 1.5, pb: 1,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        px: 1.5, py: 0.5, borderRadius: '8px',
                        bgcolor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        minWidth: 70, textAlign: 'center',
                      }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#1E40AF' }}>시스템 오류</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.3 }}>
                        연결 끊김
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>알림</Typography>
                        <ToggleButton
                          enabled={settings.systemErrorAlertEnabled}
                          onClick={() => setSettings({ ...settings, systemErrorAlertEnabled: !settings.systemErrorAlertEnabled })}
                          activeColor="#2563EB"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>소리</Typography>
                        <ToggleButton
                          enabled={settings.systemErrorSoundEnabled}
                          onClick={() => setSettings({ ...settings, systemErrorSoundEnabled: !settings.systemErrorSoundEnabled })}
                          activeColor="#2563EB"
                        />
                      </Box>
                    </Box>
                  </Box>
                  {/* 시스템 오류 > 소리 볼륨 */}
                  <Box sx={{ px: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, opacity: settings.systemErrorSoundEnabled ? 1 : 0.35 }}>
                    {settings.systemErrorSoundEnabled
                      ? <VolumeUpIcon sx={{ fontSize: 18, color: '#2563EB' }} />
                      : <VolumeOffIcon sx={{ fontSize: 18, color: '#CBD5E1' }} />
                    }
                    <Slider
                      value={settings.systemErrorSoundVolume}
                      onChange={(_, v) => settings.systemErrorSoundEnabled && setSettings({ ...settings, systemErrorSoundVolume: v as number })}
                      onChangeCommitted={(_, v) => settings.systemErrorSoundEnabled && playPreviewSound(v as number)}
                      disabled={!settings.systemErrorSoundEnabled}
                      min={0} max={100}
                      sx={{
                        flex: 1, height: 4,
                        color: settings.systemErrorSoundEnabled ? '#2563EB' : '#CBD5E1',
                        '& .MuiSlider-thumb': { width: 14, height: 14, bgcolor: 'white', border: `2px solid ${settings.systemErrorSoundEnabled ? '#2563EB' : '#CBD5E1'}` },
                        '& .MuiSlider-track': { border: 'none' },
                        '& .MuiSlider-rail': { bgcolor: settings.systemErrorSoundEnabled ? '#BFDBFE' : '#E2E8F0' },
                        '&.Mui-disabled': { color: '#CBD5E1' },
                      }}
                    />
                    <Typography sx={{ fontSize: '11px', color: '#94A3B8', minWidth: 28, textAlign: 'right' }}>
                      {settings.systemErrorSoundVolume}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>
                  * 빠름/느림: 처방 속도 대비 설정 비율 이상 차이 시 알림
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#94A3B8' }}>
                  * 완료 임박: 설정한 투여량(%) 도달 시 알림 발생
                </Typography>
              </Box>
            </Box>

            {/* 하단: 수액량 표시 + 미리보기 (상하 구조) */}
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 1.5, color: '#1E293B' }}>
                수액량 표시 설정
              </Typography>
                <Box sx={{
                  display: 'flex',
                  gap: 0,
                  bgcolor: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  p: '4px',
                }}>
                  <Button
                    onClick={() => setSettings({ ...settings, volumeDisplayMode: 'percentage' })}
                    sx={{
                      flex: 1,
                      height: 44,
                      borderRadius: settings.volumeDisplayMode === 'percentage' ? '12px' : 0,
                      textTransform: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      bgcolor: settings.volumeDisplayMode === 'percentage' ? 'white' : 'transparent',
                      color: settings.volumeDisplayMode === 'percentage' ? '#1E293B' : '#94A3B8',
                      border: settings.volumeDisplayMode === 'percentage' ? '1px solid #E2E8F0' : '1px solid transparent',
                      boxShadow: settings.volumeDisplayMode === 'percentage' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      '&:hover': {
                        bgcolor: settings.volumeDisplayMode === 'percentage' ? 'white' : 'rgba(0,0,0,0.02)',
                      }
                    }}
                  >
                    투여량 (%)
                  </Button>
                  <Button
                    onClick={() => setSettings({ ...settings, volumeDisplayMode: 'ml' })}
                    sx={{
                      flex: 1,
                      height: 44,
                      borderRadius: settings.volumeDisplayMode === 'ml' ? '12px' : 0,
                      textTransform: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                      bgcolor: settings.volumeDisplayMode === 'ml' ? 'white' : 'transparent',
                      color: settings.volumeDisplayMode === 'ml' ? '#1E293B' : '#94A3B8',
                      border: settings.volumeDisplayMode === 'ml' ? '1px solid #E2E8F0' : '1px solid transparent',
                      boxShadow: settings.volumeDisplayMode === 'ml' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      '&:hover': {
                        bgcolor: settings.volumeDisplayMode === 'ml' ? 'white' : 'rgba(0,0,0,0.02)',
                      }
                    }}
                  >
                    투여량 (ml)
                  </Button>
                </Box>

              {/* 카드 미리보기 */}
              <Box sx={{
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                mt: 2,
              }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#94A3B8' }}>
                  카드 미리보기
                </Typography>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.5,
                  bgcolor: 'white',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}>
                  <Box sx={{
                    width: 14,
                    height: 52,
                    borderRadius: '3px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    overflow: 'hidden',
                  }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Box key={i} sx={{
                        flex: 1,
                        borderRadius: '1.5px',
                        bgcolor: i >= 6 ? '#64748B' : '#E2E8F0',
                      }} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 48 }}>
                    <Box sx={{ height: 22, mb: 0.5 }} />
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', lineHeight: 1.3 }}>
                      NS
                    </Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', lineHeight: 1.3 }}>
                      {settings.volumeDisplayMode === 'percentage' ? '40%' : '400ml'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* 버튼 */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 2,
              borderTop: '1px solid #E2E8F0',
              bgcolor: '#F8FAFC',
              borderRadius: '0 0 20px 20px',
              mx: -3, mb: -3, mt: 0,
              px: 3, py: 2,
            }}>
              <Button
                onClick={onClose}
                sx={{
                  minWidth: 'auto',
                  height: 36,
                  bgcolor: 'transparent',
                  color: '#64748B',
                  fontSize: '14px', fontWeight: 600, textTransform: 'none', boxShadow: 'none',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', boxShadow: 'none' },
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                sx={{
                  minWidth: 58,
                  width: 58,
                  height: 36, borderRadius: '10px',
                  bgcolor: '#1E293B',
                  color: 'white',
                  fontSize: '14px', fontWeight: 600, textTransform: 'none', boxShadow: 'none',
                  '&:hover': { bgcolor: '#334155', boxShadow: 'none' },
                }}
              >
                저장
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  )
}

export default SettingsModal
