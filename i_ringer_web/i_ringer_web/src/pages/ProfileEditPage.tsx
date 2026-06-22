import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { dataProvider } from '../providers/dataProvider'

interface Ward {
  id: number
  name: string
  hospital_id: number
}

interface Hospital {
  id: number
  name: string
}

const ProfileEditPage: React.FC = () => {
  const navigate = useNavigate()
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}')

  const [name, setName] = useState(userInfo.nickname || userInfo.name || '')
  const [hospitalName, setHospitalName] = useState('')
  const [wardId, setWardId] = useState<number | string>(userInfo.ward_id || '')
  const [employeeNumber] = useState(userInfo.employee_number || '')
  const [wards, setWards] = useState<Ward[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 병원 이름 로드
      if (userInfo.hospital_id) {
        try {
          const hospital = await dataProvider.getOne<Hospital>('hospitals', userInfo.hospital_id)
          setHospitalName((hospital as any).name || '')
        } catch {
          setHospitalName('')
        }
      }

      // 병동 목록 로드
      if (userInfo.hospital_id) {
        const wardResponse = await dataProvider.getList<Ward>('wards', {
          where: { hospital_id: userInfo.hospital_id },
          limit: 100,
        })
        setWards(wardResponse.data || [])
      }
    } catch (error) {
      console.error('Failed to load profile data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const updateData: any = {
        nickname: name.trim(),
      }
      if (wardId) {
        updateData.ward_id = Number(wardId)
      }

      await dataProvider.update('users', userInfo.id || userInfo.user_id, updateData)

      // localStorage 업데이트
      const updatedUserInfo = {
        ...userInfo,
        nickname: name.trim(),
        name: name.trim(),
        ward_id: wardId ? Number(wardId) : userInfo.ward_id,
      }
      localStorage.setItem('user_info', JSON.stringify(updatedUserInfo))
      localStorage.setItem('user_name', name.trim())
      if (wardId) {
        localStorage.setItem('ward_id', String(wardId))
      }

      navigate(-1)
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('프로필 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        bgcolor: '#F8FAFC',
      }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      bgcolor: '#F8FAFC',
    }}>
      {/* 헤더 */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        height: 56,
        px: 1,
        bgcolor: '#1E293B',
        flexShrink: 0,
      }}>
        <Box
          onClick={() => navigate(-1)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            p: 1,
            borderRadius: '8px',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <ChevronLeftIcon sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Typography sx={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'white',
          ml: 0.5,
        }}>
          프로필 수정
        </Typography>
      </Box>

      {/* 본문 */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Box sx={{
          maxWidth: 480,
          width: '100%',
          mx: 'auto',
          p: 3,
          pt: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {/* 이름 */}
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', mb: 1 }}>
              이름
            </Typography>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="이름을 입력해주세요"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: 'white',
                  '& fieldset': { borderColor: '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#CBD5E1' },
                  '&.Mui-focused fieldset': { borderColor: '#94A3B8' },
                },
                '& input': {
                  fontSize: '15px',
                  color: '#1E293B',
                  py: 1.5,
                  px: 2,
                },
              }}
            />
          </Box>

          {/* 소속 병원 (보기만 가능) */}
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', mb: 1 }}>
              소속 병원
            </Typography>
            <TextField
              value={hospitalName || '-'}
              fullWidth
              variant="outlined"
              disabled
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#F1F5F9',
                  '& fieldset': { borderColor: '#E2E8F0' },
                },
                '& input': {
                  fontSize: '15px',
                  color: '#94A3B8',
                  py: 1.5,
                  px: 2,
                  WebkitTextFillColor: '#94A3B8',
                },
              }}
            />
          </Box>

          {/* 소속 병동 */}
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', mb: 1 }}>
              소속 병동
            </Typography>
            <Select
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              fullWidth
              displayEmpty
              sx={{
                borderRadius: '12px',
                bgcolor: 'white',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E2E8F0' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                '& .MuiSelect-select': {
                  fontSize: '15px',
                  color: '#1E293B',
                  py: 1.5,
                  px: 2,
                },
              }}
            >
              <MenuItem value="" disabled>
                <Typography sx={{ color: '#94A3B8', fontSize: '15px' }}>병동을 선택해주세요</Typography>
              </MenuItem>
              {wards.map((ward) => (
                <MenuItem key={ward.id} value={ward.id}>
                  {ward.name}
                </MenuItem>
              ))}
            </Select>
          </Box>

          {/* 사번 (수정 불가) */}
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', mb: 1 }}>
              사번 (수정 불가)
            </Typography>
            <TextField
              value={employeeNumber || '-'}
              fullWidth
              variant="outlined"
              disabled
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#F1F5F9',
                  '& fieldset': { borderColor: '#E2E8F0' },
                },
                '& input': {
                  fontSize: '15px',
                  color: '#94A3B8',
                  py: 1.5,
                  px: 2,
                  WebkitTextFillColor: '#94A3B8',
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* 하단 저장 버튼 */}
      <Box sx={{
        p: 2,
        px: 3,
        borderTop: '1px solid #E2E8F0',
        bgcolor: 'white',
        flexShrink: 0,
      }}>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          fullWidth
          sx={{
            maxWidth: 480,
            mx: 'auto',
            display: 'block',
            height: 52,
            borderRadius: '14px',
            bgcolor: '#1E293B',
            color: 'white',
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { bgcolor: '#334155' },
            '&.Mui-disabled': { bgcolor: '#CBD5E1', color: 'white' },
          }}
        >
          {saving ? <CircularProgress size={24} sx={{ color: 'white' }} /> : '저장하기'}
        </Button>
      </Box>
    </Box>
  )
}

export default ProfileEditPage
