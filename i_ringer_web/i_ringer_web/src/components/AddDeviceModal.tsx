import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Dialog,
  Select,
  MenuItem,
  FormControl
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
interface Hospital {
  id: number
  name: string
}

interface Ward {
  id: number
  name: string
  hospital_id: number
}

interface DeviceFormData {
  device_name: string
  serial_number: string
  firmware_version: string
  hospital_id: string
  ward_id: string
}

interface AddDeviceModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: DeviceFormData) => void
  editMode?: boolean
  initialData?: DeviceFormData
  hospitals: Hospital[]
  wards: Ward[]
  userRole?: string
  currentUserHospitalId?: number
}

const AddDeviceModal: React.FC<AddDeviceModalProps> = ({
  open,
  onClose,
  onSubmit,
  editMode = false,
  initialData,
  hospitals,
  wards,
  userRole = 'super_admin',
  currentUserHospitalId
}) => {
  const { isDarkMode } = useTheme()
  const [formData, setFormData] = useState<DeviceFormData>({
    device_name: '',
    serial_number: '',
    firmware_version: '',
    hospital_id: '',
    ward_id: ''
  })

  // 선택된 병원에 해당하는 병동 목록
  const filteredWards = formData.hospital_id
    ? wards.filter(w => w.hospital_id === parseInt(formData.hospital_id))
    : []

  useEffect(() => {
    if (editMode && initialData) {
      setFormData(initialData)
    } else if (!editMode && open) {
      // admin인 경우 자동으로 병원 ID 설정
      const defaultHospitalId = (userRole === 'admin' && currentUserHospitalId)
        ? currentUserHospitalId.toString()
        : ''

      setFormData({
        device_name: '',
        serial_number: '',
        firmware_version: '',
        hospital_id: defaultHospitalId,
        ward_id: ''
      })
    }
  }, [open, editMode, userRole, currentUserHospitalId, initialData])

  const handleSubmit = () => {
    // 시리얼 넘버의 내부 및 좌우 공백 제거
    const trimmedData = {
      ...formData,
      serial_number: formData.serial_number.replace(/\s+/g, '')
    }
    onSubmit(trimmedData)
  }


  const isFormValid = formData.device_name.trim() !== '' &&
                      formData.serial_number.trim() !== '' &&
                      formData.firmware_version.trim() !== ''

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
          maxWidth: '500px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white'
        }
      }}
    >
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800 }}>
            {editMode ? '기기 수정하기' : '기기 추가하기'}
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 기기명 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              기기명
            </Typography>
            <TextField
              fullWidth
              placeholder="기기명을 입력하세요."
              value={formData.device_name}
              onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
              inputProps={{ maxLength: 50 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& input': {
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': {
                      color: isDarkMode ? colors.gray.gray600 : '#ADAEBC',
                      opacity: 1,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: 400
                    }
                  }
                }
              }}
            />
          </Box>

          {/* 시리얼 넘버 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              시리얼 넘버
            </Typography>
            <TextField
              fullWidth
              placeholder="시리얼 넘버를 입력하세요."
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              inputProps={{ maxLength: 50 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& input': {
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': {
                      color: isDarkMode ? colors.gray.gray600 : '#ADAEBC',
                      opacity: 1,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      fontWeight: 400
                    }
                  }
                }
              }}
            />
          </Box>

          {/* 펌웨어 버전 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              펌웨어 버전
            </Typography>
            <TextField
              fullWidth
              placeholder="펌웨어 버전을 입력하세요."
              value={formData.firmware_version}
              onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
              inputProps={{ maxLength: 20 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': {
                      color: isDarkMode ? colors.gray.gray600 : '#ADAEBC',
                      opacity: 1
                    }
                  }
                }
              }}
            />
          </Box>

          {/* 병원 선택 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              병원
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.hospital_id}
                onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value, ward_id: '' })}
                disabled={userRole === 'admin'}
                displayEmpty
                sx={{
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& .MuiSelect-select': {
                    fontSize: '16px',
                    color: formData.hospital_id ? (isDarkMode ? colors.gray.gray100 : colors.gray.gray800) : (isDarkMode ? colors.gray.gray200 : '#ADAEBC')
                  },
                  '&.Mui-disabled': {
                    bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
                    '& .MuiSelect-select': {
                      color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                      WebkitTextFillColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray600
                    }
                  }
                }}
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
                        : 'none'
                    }}
                  />
                )}
                MenuProps={{
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
                          }
                        },
                        '&.Mui-disabled': {
                          color: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                        }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="">병원을 선택하세요</MenuItem>
                {hospitals.map(hospital => (
                  <MenuItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* 병동 선택 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              병동
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.ward_id}
                onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
                disabled={!formData.hospital_id}
                displayEmpty
                sx={{
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& .MuiSelect-select': {
                    fontSize: '16px',
                    color: formData.ward_id ? (isDarkMode ? colors.gray.gray100 : colors.gray.gray800) : (isDarkMode ? colors.gray.gray200 : '#ADAEBC')
                  },
                  '&.Mui-disabled': {
                    bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
                    '& .MuiSelect-select': {
                      color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                      WebkitTextFillColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray600
                    }
                  }
                }}
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
                        : 'none'
                    }}
                  />
                )}
                MenuProps={{
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
                          }
                        },
                        '&.Mui-disabled': {
                          color: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                        }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="">병동을 선택하세요</MenuItem>
                {filteredWards.map(ward => (
                  <MenuItem key={ward.id} value={ward.id.toString()}>
                    {ward.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* Footer Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
          <Button
            onClick={onClose}
            sx={{
              bgcolor: colors.gray.gray200,
              color: isDarkMode ? colors.gray.gray800 : colors.gray.gray700,
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': {
                bgcolor: colors.gray.gray300
              }
            }}
          >
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid}
            sx={{
              bgcolor: colors.mainColor.blue,
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.blue,
                opacity: 0.9
              },
              '&.Mui-disabled': {
                bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
              }
            }}
          >
            {editMode ? '수정' : '추가'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

export default AddDeviceModal
