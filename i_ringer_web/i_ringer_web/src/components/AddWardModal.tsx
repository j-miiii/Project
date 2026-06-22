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

interface AddWardModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (hospitalId: number, wardName: string, wardId?: number) => void
  hospitals: Array<{ id: number; name?: string }>
  selectedHospitalId?: number
  editMode?: boolean
  initialName?: string
  wardId?: number
  disableHospitalSelect?: boolean
}

const AddWardModal: React.FC<AddWardModalProps> = ({
  open,
  onClose,
  onSubmit,
  hospitals,
  selectedHospitalId,
  editMode = false,
  initialName = '',
  wardId,
  disableHospitalSelect = false
}) => {
  const { isDarkMode } = useTheme()
  const [hospitalId, setHospitalId] = useState<number>(selectedHospitalId || 0)
  const [wardName, setWardName] = useState('')

  React.useEffect(() => {
    if (selectedHospitalId) {
      setHospitalId(selectedHospitalId)
    }
  }, [selectedHospitalId])

  React.useEffect(() => {
    if (open) {
      setWardName(initialName)
    }
  }, [open, initialName])

  const handleSubmit = () => {
    const trimmedName = wardName.trim()
    if (hospitalId && trimmedName) {
      onSubmit(hospitalId, trimmedName, wardId)
      setWardName('')
      onClose()
    }
  }

  const handleClose = () => {
    setWardName('')
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
          {editMode ? '병동 수정' : '병동 추가'}
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
              onChange={(e) => setHospitalId(e.target.value as number)}
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
                  color: hospitalId ? (isDarkMode ? colors.gray.gray100 : colors.gray.gray800) : (isDarkMode ? colors.gray.gray200 : colors.gray.gray400),
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

        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병동 이름
          </Typography>
          <TextField
            fullWidth
            placeholder="병동 이름을 입력하세요"
            value={wardName}
            onChange={(e) => {
              if (e.target.value.length <= 15) {
                setWardName(e.target.value)
              }
            }}
            helperText={`${wardName.length}/15자`}
            FormHelperTextProps={{
              sx: { textAlign: 'right', fontSize: '12px', color: isDarkMode ? colors.gray.gray500 : colors.gray.gray500 }
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
            disabled={!hospitalId || !wardName.trim()}
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

export default AddWardModal
