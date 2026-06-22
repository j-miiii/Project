import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Button,
  Dialog,
  CircularProgress,
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { dataProvider } from '../providers/dataProvider'

interface AddPatientModalProps {
  open: boolean
  onClose: () => void
  bedId: number
  bedNumber: string
  roomNumber: string
  onSuccess: () => void
}

const AddPatientModal: React.FC<AddPatientModalProps> = ({
  open,
  onClose,
  bedId,
  bedNumber,
  roomNumber,
  onSuccess,
}) => {
  const { isDarkMode } = useTheme()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    chart_number: '',
    sex: 'M' as 'M' | 'F',
    age: '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (open) {
      setFormData({ name: '', chart_number: '', sex: 'M', age: '' })
      setTouched({})
    }
  }, [open])

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const isFieldError = (field: string, value: string) =>
    touched[field] && value.trim() === ''

  const isFormValid =
    formData.name.trim() !== '' &&
    formData.chart_number.trim() !== '' &&
    formData.age.trim() !== ''

  const handleSubmit = async () => {
    if (!isFormValid || loading) return

    setLoading(true)
    try {
      // 1. 환자 생성
      const patientResponse = await dataProvider.create<any>('patients', {
        name: formData.name.trim(),
        chart_number: formData.chart_number.trim(),
        sex: formData.sex,
        age: parseInt(formData.age),
      })

      const patientId = patientResponse.id || patientResponse.data?.id
      if (!patientId) {
        throw new Error('환자 생성 응답에서 ID를 찾을 수 없습니다.')
      }

      // 2. 환자-침대 배정 (수액 정보는 보내지 않음 - 수액은 별도로 추가)
      await dataProvider.create<any>('patient_bed_assignments', {
        patient_id: patientId,
        bed_id: bedId,
      })

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('환자 추가 실패:', error)
      alert(error.message || '환자 추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const selectSx = {
    borderRadius: '12px',
    bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
    fontSize: '16px',
    height: '45px',
    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
    '& fieldset': {
      borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
      borderWidth: '1px',
    },
    '& .MuiSelect-select': {
      fontSize: '16px',
    },
  }

  const textFieldSx = (hasError = false) => ({
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      bgcolor: hasError
        ? (isDarkMode ? 'rgba(239,68,68,0.08)' : '#FEF2F2')
        : (isDarkMode ? colors.gray.gray1000 : 'white'),
      height: '45px',
      '& fieldset': {
        borderColor: hasError ? '#EF4444' : (isDarkMode ? colors.gray.gray700 : colors.gray.gray300),
        borderWidth: '1px',
      },
      '&:hover fieldset': hasError ? { borderColor: '#DC2626' } : {},
      '&.Mui-focused fieldset': hasError ? { borderColor: '#EF4444' } : {},
      '& input': {
        fontSize: '16px',
        color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
        '&::placeholder': {
          color: hasError ? '#F87171' : (isDarkMode ? colors.gray.gray600 : '#ADAEBC'),
          opacity: 1,
        },
      },
    },
  })

  const menuPropsSx = {
    PaperProps: {
      sx: {
        bgcolor: isDarkMode ? colors.gray.gray900 : 'white',
        '& .MuiMenuItem-root': {
          color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
          fontSize: '16px',
          '&:hover': {
            bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
          },
          '&.Mui-selected': {
            bgcolor: isDarkMode ? `${colors.mainColor.blue}20` : `${colors.mainColor.blue}14`,
            '&:hover': {
              bgcolor: isDarkMode ? `${colors.mainColor.blue}30` : `${colors.mainColor.blue}1F`,
            },
          },
        },
      },
    },
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: 0,
          maxWidth: '480px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
        },
      }}
    >
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800 }}>
            환자 추가
          </Typography>
          <Typography sx={{ fontSize: '14px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray500, mt: 0.5 }}>
            {roomNumber}호 {bedNumber}번 침상
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* 환자 이름 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              환자 이름 *
            </Typography>
            <TextField
              fullWidth
              placeholder="환자 이름을 입력하세요."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={() => handleBlur('name')}
              sx={textFieldSx(isFieldError('name', formData.name))}
            />
          </Box>

          {/* 차트 번호 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              차트 번호 *
            </Typography>
            <TextField
              fullWidth
              placeholder="차트 번호를 입력하세요."
              value={formData.chart_number}
              onChange={(e) => setFormData({ ...formData, chart_number: e.target.value })}
              onBlur={() => handleBlur('chart_number')}
              sx={textFieldSx(isFieldError('chart_number', formData.chart_number))}
            />
          </Box>

          {/* 성별 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              성별 *
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value as 'M' | 'F' })}
                sx={selectSx}
                IconComponent={() => (
                  <Box
                    component="img"
                    src="/icons/ic_arrow.svg"
                    sx={{
                      mr: 2,
                      width: 12,
                      height: 12,
                      pointerEvents: 'none',
                      filter: isDarkMode
                        ? 'brightness(0) saturate(100%) invert(94%) sepia(3%) saturate(485%) hue-rotate(177deg) brightness(92%) contrast(87%)'
                        : 'none',
                    }}
                  />
                )}
                MenuProps={menuPropsSx}
              >
                <MenuItem value="M">남성 (M)</MenuItem>
                <MenuItem value="F">여성 (F)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 나이 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              나이 *
            </Typography>
            <TextField
              fullWidth
              type="number"
              placeholder="나이를 입력하세요."
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              onBlur={() => handleBlur('age')}
              inputProps={{ min: 0, max: 200 }}
              sx={textFieldSx(isFieldError('age', formData.age))}
            />
          </Box>
        </Box>

        {/* Footer Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{
              bgcolor: colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray800 : colors.gray.gray700,
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': { bgcolor: colors.gray.gray300 },
            }}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || loading}
            sx={{
              bgcolor: colors.mainColor.blue,
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': { bgcolor: colors.mainColor.blue, opacity: 0.9 },
              '&:disabled': {
                bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
              },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : '추가'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

export default AddPatientModal
