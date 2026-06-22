import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'
import { Hospital, Ward, User } from '../types/models'

interface AddRoomModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (hospitalId: number, wardId: number, roomName: string, bedCount: string, roomId?: number, nurseId?: number) => void
  hospitals: Array<Hospital & { wards?: Ward[] }>
  nurses?: User[]
  selectedHospitalId?: number
  selectedWardId?: number
  selectedNurseId?: number
  editMode?: boolean
  initialRoomName?: string
  initialBedCount?: string
  roomId?: number
  disableHospitalSelect?: boolean
}

const AddRoomModal: React.FC<AddRoomModalProps> = ({
  open,
  onClose,
  onSubmit,
  hospitals,
  nurses = [],
  selectedHospitalId,
  selectedWardId,
  selectedNurseId,
  editMode = false,
  initialRoomName = '',
  initialBedCount = '',
  roomId,
  disableHospitalSelect = false
}) => {
  const { isDarkMode } = useTheme()
  const [hospitalId, setHospitalId] = useState<number>(selectedHospitalId || 0)
  const [wardId, setWardId] = useState<number>(selectedWardId || 0)
  const [roomName, setRoomName] = useState('')
  const [nurseId, setNurseId] = useState<number>(0)

  React.useEffect(() => {
    if (selectedHospitalId) {
      setHospitalId(selectedHospitalId)
    }
    if (selectedWardId) {
      setWardId(selectedWardId)
    }
  }, [selectedHospitalId, selectedWardId])

  React.useEffect(() => {
    if (open) {
      setRoomName(initialRoomName)
      setNurseId(selectedNurseId || 0)
    }
  }, [open, initialRoomName, selectedNurseId])

  const selectedHospital = hospitals.find(h => h.id === hospitalId)
  const wards = selectedHospital?.wards || []

  const handleHospitalChange = (newHospitalId: number) => {
    setHospitalId(newHospitalId)
    setWardId(0)
  }

  const handleSubmit = () => {
    const trimmedRoomName = roomName.trim()
    if (hospitalId && wardId && trimmedRoomName) {
      onSubmit(hospitalId, wardId, trimmedRoomName, '6', roomId, nurseId || undefined)
      setRoomName('')
      setNurseId(0)
      onClose()
    }
  }

  const handleClose = () => {
    setRoomName('')
    setNurseId(0)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: '24px',
          width: '360px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white',
        }
      }}
    >
      <DialogContent sx={{ padding: 0 }}>
        <Typography
          sx={{
            fontSize: '24px',
            fontWeight: 700,
            color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
            mb: 2.5,
          }}
        >
          {editMode ? '병실 수정' : '병실 추가'}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병원 선택
          </Typography>
          <FormControl fullWidth>
            <Select
              value={hospitalId}
              onChange={(e) => handleHospitalChange(e.target.value as number)}
              displayEmpty
              disabled={disableHospitalSelect}
              sx={{
                borderRadius: '12px',
                backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                fontSize: '16px',
                color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                '& fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.mainColor.blue,
                },
                '& .MuiSelect-select': {
                  fontSize: '16px',
                  padding: '10px 14px',
                },
                '&.Mui-disabled': {
                  backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
                  '& .MuiSelect-select': {
                    color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                    WebkitTextFillColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                  }
                },
              }}
              IconComponent={() => (
                <Box
                  component="img"
                  src="/icons/ic_arrow.svg"
                  sx={{
                    mr: 1.5,
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
              <MenuItem value={0} disabled sx={{ fontSize: '16px', color: colors.gray.gray400 }}>
                병원을 선택하세요.
              </MenuItem>
              {hospitals.map((hospital) => (
                <MenuItem key={hospital.id} value={hospital.id} sx={{ fontSize: '16px' }}>
                  {hospital.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병동 선택
          </Typography>
          <FormControl fullWidth>
            <Select
              value={wardId}
              onChange={(e) => setWardId(e.target.value as number)}
              displayEmpty
              disabled={!hospitalId}
              sx={{
                borderRadius: '12px',
                backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                fontSize: '16px',
                color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                '& fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.mainColor.blue,
                },
                '& .MuiSelect-select': {
                  fontSize: '16px',
                  padding: '10px 14px',
                },
                '&.Mui-disabled': {
                  backgroundColor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
                  '& .MuiSelect-select': {
                    color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                    WebkitTextFillColor: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
                  }
                },
              }}
              IconComponent={() => (
                <Box
                  component="img"
                  src="/icons/ic_arrow.svg"
                  sx={{
                    mr: 1.5,
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
              <MenuItem value={0} disabled sx={{ fontSize: '16px', color: colors.gray.gray400 }}>
                병동을 선택하세요.
              </MenuItem>
              {wards.map((ward) => (
                <MenuItem key={ward.id} value={ward.id} sx={{ fontSize: '16px' }}>
                  {ward.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병실 이름
          </Typography>
          <TextField
            fullWidth
            placeholder="병실 이름을 입력하세요."
            value={roomName}
            onChange={(e) => {
              if (e.target.value.length <= 10) {
                setRoomName(e.target.value)
              }
            }}
            helperText={`${roomName.length}/10자`}
            FormHelperTextProps={{
              sx: { textAlign: 'right', fontSize: '12px', color: colors.gray.gray500 }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                fontSize: '16px',
                '& fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.mainColor.blue,
                },
              },
              '& .MuiOutlinedInput-input': {
                fontSize: '16px',
                padding: '10px 14px',
                color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                '&::placeholder': {
                  color: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                  opacity: 1,
                },
              },
            }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병상 갯수
          </Typography>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
              bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? colors.gray.gray700 : colors.gray.gray300}`,
              padding: '10px 14px',
            }}
          >
            6개 (고정)
          </Typography>
        </Box>

        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            담당 간호사
          </Typography>
          <FormControl fullWidth>
            <Select
              value={nurseId}
              onChange={(e) => setNurseId(e.target.value as number)}
              displayEmpty
              sx={{
                borderRadius: '12px',
                backgroundColor: isDarkMode ? colors.gray.gray1000 : 'white',
                fontSize: '16px',
                color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800,
                '& fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                },
                '&:hover fieldset': {
                  borderColor: isDarkMode ? colors.gray.gray600 : colors.gray.gray400,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.mainColor.blue,
                },
                '& .MuiSelect-select': {
                  fontSize: '16px',
                  padding: '10px 14px',
                },
              }}
              IconComponent={() => (
                <Box
                  component="img"
                  src="/icons/ic_arrow.svg"
                  sx={{
                    mr: 1.5,
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
                    }
                  }
                }
              }}
            >
              <MenuItem value={0} sx={{ fontSize: '16px', color: colors.gray.gray400 }}>
                배정 안함
              </MenuItem>
              {nurses.map((nurse) => (
                <MenuItem key={nurse.id} value={nurse.id} sx={{ fontSize: '16px' }}>
                  {nurse.nickname || nurse.name || nurse.auth_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? colors.gray.gray800 : colors.gray.gray600,
              borderColor: colors.gray.gray300,
              bgcolor: colors.gray.gray200,
              height: '40px',
              px: 3,
              textTransform: 'none',
              '&:hover': {
                borderColor: colors.gray.gray400,
                bgcolor: colors.gray.gray300,
              }
            }}
          >
            취소
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!hospitalId || !wardId || !roomName.trim()}
            sx={{
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              bgcolor: colors.mainColor.blue,
              color: 'white',
              height: '40px',
              px: 3,
              textTransform: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.blue,
                opacity: 0.9,
              },
              '&:disabled': {
                bgcolor: isDarkMode ? colors.gray.gray700 : colors.gray.gray300,
                color: isDarkMode ? colors.gray.gray500 : colors.gray.gray600,
              }
            }}
          >
            {editMode ? '수정' : '등록'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default AddRoomModal
