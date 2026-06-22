import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Box,
  Typography,
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

interface AddHospitalModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (hospitalName: string, hospitalId?: number) => void
  editMode?: boolean
  initialName?: string
  hospitalId?: number
}

const AddHospitalModal: React.FC<AddHospitalModalProps> = ({
  open,
  onClose,
  onSubmit,
  editMode = false,
  initialName = '',
  hospitalId
}) => {
  const { isDarkMode } = useTheme()
  const [hospitalName, setHospitalName] = useState('')

  React.useEffect(() => {
    if (open) {
      setHospitalName(initialName)
    }
  }, [open, initialName])

  const handleSubmit = () => {
    const trimmedName = hospitalName.trim()
    if (trimmedName) {
      onSubmit(trimmedName, hospitalId)
      setHospitalName('')
      onClose()
    }
  }

  const handleClose = () => {
    setHospitalName('')
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
          {editMode ? '병원 수정' : '병원 추가'}
        </Typography>

        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 500,
              color: isDarkMode ? colors.gray.gray300 : '#404040',
              mb: 1,
            }}
          >
            병원 이름
          </Typography>
          <TextField
            fullWidth
            placeholder="병원 이름을 입력하세요"
            value={hospitalName}
            onChange={(e) => {
              if (e.target.value.length <= 20) {
                setHospitalName(e.target.value)
              }
            }}
            helperText={`${hospitalName.length}/20자`}
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
            disabled={!hospitalName.trim()}
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

export default AddHospitalModal
