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
  IconButton,
  InputAdornment
} from '@mui/material'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material'
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

interface UserFormData {
  role: 'super_admin' | 'admin' | 'nurse'
  nickname: string
  username: string
  password: string
  hospital_id: string
  ward_id: string
  emr_user_key: string
  emr_group_code: string
  emr_group_desc: string
  dept_code: string
  employee_number: string
}

interface AddUserModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: UserFormData) => void
  editMode?: boolean
  initialData?: UserFormData
  hospitals: Hospital[]
  wards: Ward[]
  userRole?: string
  currentUserHospitalId?: number
}

const AddUserModal: React.FC<AddUserModalProps> = ({
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
  const [formData, setFormData] = useState<UserFormData>({
    role: 'nurse',
    nickname: '',
    username: '',
    password: '',
    hospital_id: '',
    ward_id: '',
    emr_user_key: '',
    emr_group_code: '',
    emr_group_desc: '',
    dept_code: '',
    employee_number: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // console.log('==== AddUserModal useEffect ====')
    // console.log('editMode:', editMode)
    // console.log('initialData:', initialData)
    // console.log('open:', open)
    // console.log('userRole:', userRole)
    // console.log('currentUserHospitalId:', currentUserHospitalId)
    // console.log('currentUserHospitalId type:', typeof currentUserHospitalId)

    if (editMode && initialData) {
      // console.log('Setting formData from initialData (edit mode)')
      setFormData(initialData)
    } else if (!editMode && open) {
      // console.log('Setting formData to default (new user - add mode)')

      // admin인 경우 자동으로 병원 ID 설정
      const defaultHospitalId = (userRole === 'admin' && currentUserHospitalId)
        ? currentUserHospitalId.toString()
        : ''

      // console.log('Default hospital_id:', defaultHospitalId)
      // console.log('Is admin?', userRole === 'admin')
      // console.log('Has currentUserHospitalId?', !!currentUserHospitalId)

      const newFormData = {
        role: 'nurse' as 'super_admin' | 'admin' | 'nurse',
        nickname: '',
        username: '',
        password: '',
        hospital_id: defaultHospitalId,
        ward_id: '',
        emr_user_key: '',
        emr_group_code: '',
        emr_group_desc: '',
        dept_code: '',
        employee_number: '',
      }

      // console.log('FormData to set:', newFormData)
      setFormData(newFormData)
    }
  }, [open, editMode, userRole, currentUserHospitalId])

  const handleSubmit = () => {
    onSubmit(formData)
  }

  // Form validation
  const isFormValid =
    formData.nickname.trim() !== '' &&
    formData.username.trim() !== '' &&
    (editMode || formData.password.trim() !== '') && // 비밀번호는 신규 추가시에만 필수
    (formData.role === 'super_admin' || formData.hospital_id !== '') && // super_admin이 아니면 병원 필수
    (formData.role !== 'nurse' || formData.ward_id !== '') // nurse면 병동 필수

  const filteredWards = formData.hospital_id
    ? wards.filter(w => {
        // console.log('Filtering ward:', w, 'w.hospital_id:', w.hospital_id, 'formData.hospital_id:', formData.hospital_id, 'parseInt:', parseInt(formData.hospital_id), 'match?', w.hospital_id === parseInt(formData.hospital_id))
        return w.hospital_id === parseInt(formData.hospital_id)
      })
    : []

  // 디버깅 로그
  // console.log('==== AddUserModal Render Debug ====')
  // console.log('formData:', formData)
  // console.log('formData.hospital_id:', formData.hospital_id, 'type:', typeof formData.hospital_id)
  // console.log('hospitals:', hospitals)
  // console.log('hospitals count:', hospitals.length)
  // if (hospitals.length > 0) {
  //   console.log('Sample hospital:', hospitals[0])
  //   console.log('Sample hospital id:', hospitals[0].id, 'type:', typeof hospitals[0].id)
  // }

  // if (formData.hospital_id) {
  //   console.log('==== AddUserModal Debug (Hospital Selected) ====')
  //   console.log('AddUserModal - formData.hospital_id:', formData.hospital_id, 'type:', typeof formData.hospital_id)
  //   console.log('AddUserModal - parseInt(formData.hospital_id):', parseInt(formData.hospital_id))
  //   console.log('AddUserModal - formData.role:', formData.role)
  //   console.log('AddUserModal - wards (all):', wards)
  //   console.log('AddUserModal - wards count:', wards.length)
  //   if (wards.length > 0) {
  //     console.log('AddUserModal - sample ward structure:', wards[0])
  //   }
  //   console.log('AddUserModal - filteredWards:', filteredWards)
  //   console.log('AddUserModal - filteredWards count:', filteredWards.length)
  //   console.log('AddUserModal - ward dropdown disabled?', !formData.hospital_id || formData.role === 'admin')
  //   console.log('=============================')
  // }

  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'super_admin': return '슈퍼관리자'
      case 'admin': return '병원관리자'
      case 'nurse': return '간호사'
      default: return role
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: 0,
          maxWidth: '780px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white'
        }
      }}
    >
      <Box sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800 }}>
            {editMode ? '사용자 수정' : '사용자 추가'}
          </Typography>
        </Box>

        {/* 2열 레이아웃: 좌(필수) / 우(선택) */}
        <Box sx={{ display: 'flex', gap: 4 }}>

        {/* 좌측: 필수 정보 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
            필수 정보
          </Typography>
          <Box sx={{
            bgcolor: isDarkMode ? colors.gray.gray900 : '#F8FAFC',
            border: `1px solid ${isDarkMode ? colors.gray.gray700 : '#E2E8F0'}`,
            borderRadius: '16px',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}>
          {/* 유형 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              유형
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                sx={{
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  fontSize: '16px',
                  height: '45px',
                  color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                  '& fieldset': {
                    borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                    borderWidth: '1px'
                  },
                  '& .MuiSelect-select': {
                    fontSize: '16px',
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
                {userRole === 'super_admin' && (
                  <MenuItem value="super_admin">{getRoleDisplayName('super_admin')}</MenuItem>
                )}
                <MenuItem value="admin">{getRoleDisplayName('admin')}</MenuItem>
                <MenuItem value="nurse">{getRoleDisplayName('nurse')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* 이름 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              이름
            </Typography>
            <TextField
              fullWidth
              placeholder="이름을 입력하세요."
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
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

          {/* 사용자 ID */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              사용자 ID
            </Typography>
            <TextField
              fullWidth
              placeholder="아이디를 입력하세요."
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="off"
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
                    },
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: `0 0 0 100px ${isDarkMode ? colors.gray.gray1000 : 'white'} inset !important`,
                      WebkitTextFillColor: `${isDarkMode ? colors.gray.gray100 : colors.gray.gray800} !important`,
                    }
                  }
                }
              }}
            />
          </Box>

          {/* 비밀번호 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              비밀번호 {editMode && <Typography component="span" sx={{ fontSize: '12px', color: colors.gray.gray1000 }}>(변경하지 않으려면 비워두세요)</Typography>}
            </Typography>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder={editMode ? "새 비밀번호를 입력하세요." : "비밀번호를 입력하세요."}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600 }}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
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
                    },
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: `0 0 0 100px ${isDarkMode ? colors.gray.gray1000 : 'white'} inset !important`,
                      WebkitTextFillColor: `${isDarkMode ? colors.gray.gray100 : colors.gray.gray800} !important`,
                    }
                  }
                }
              }}
            />
          </Box>

          {/* 병원 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              병원
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.hospital_id}
                onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value, ward_id: '' })}
                disabled={formData.role === 'super_admin' || userRole === 'admin'}
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
                <MenuItem value="">선택하지 않음</MenuItem>
                {hospitals.map(hospital => (
                  <MenuItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* 병동 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              병동
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.ward_id}
                onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
                disabled={!formData.hospital_id || formData.role === 'admin'}
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
                      color: '#ADAEBC',
                      WebkitTextFillColor: '#ADAEBC'
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
                <MenuItem value="">선택하지 않음</MenuItem>
                {filteredWards.map(ward => (
                  <MenuItem key={ward.id} value={ward.id.toString()}>
                    {ward.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          </Box>
        </Box>

        {/* 우측: 선택 정보 (EMR 연동) */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: isDarkMode ? colors.gray.gray200 : colors.gray.gray900 }}>
            선택 정보 (EMR 연동)
          </Typography>
          <Box sx={{
            bgcolor: isDarkMode ? colors.gray.gray900 : '#F8FAFC',
            border: `1px solid ${isDarkMode ? colors.gray.gray700 : '#E2E8F0'}`,
            borderRadius: '16px',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}>
          {/* 사번 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              사번
            </Typography>
            <TextField
              fullWidth
              placeholder="사번"
              value={formData.employee_number}
              onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300, borderWidth: '1px' },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 }
                  }
                }
              }}
            />
          </Box>

          {/* EMR User Key */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              EMR User Key
            </Typography>
            <TextField
              fullWidth
              placeholder="EMR User Key"
              value={formData.emr_user_key}
              onChange={(e) => setFormData({ ...formData, emr_user_key: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300, borderWidth: '1px' },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 }
                  }
                }
              }}
            />
          </Box>

          {/* EMR Group Code */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              EMR Group Code
            </Typography>
            <TextField
              fullWidth
              placeholder="Group Code"
              value={formData.emr_group_code}
              onChange={(e) => setFormData({ ...formData, emr_group_code: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300, borderWidth: '1px' },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 }
                  }
                }
              }}
            />
          </Box>

          {/* EMR Group 설명 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              EMR Group 설명
            </Typography>
            <TextField
              fullWidth
              placeholder="Group 설명"
              value={formData.emr_group_desc}
              onChange={(e) => setFormData({ ...formData, emr_group_desc: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300, borderWidth: '1px' },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 }
                  }
                }
              }}
            />
          </Box>

          {/* 부서 코드 */}
          <Box>
            <Typography sx={{ mb: 1, fontSize: '14px', fontWeight: 400, color: isDarkMode ? colors.gray.gray300 : '#404040' }}>
              부서 코드
            </Typography>
            <TextField
              fullWidth
              placeholder="부서 코드"
              value={formData.dept_code}
              onChange={(e) => setFormData({ ...formData, dept_code: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
                  height: '45px',
                  '& fieldset': { borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300, borderWidth: '1px' },
                  '& input': {
                    fontSize: '16px',
                    color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                    '&::placeholder': { color: isDarkMode ? colors.gray.gray600 : '#ADAEBC', opacity: 1 }
                  }
                }
              }}
            />
          </Box>
          </Box>
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
              '&:disabled': {
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

export default AddUserModal
