import React from 'react'
import {
  Box,
  Typography,
  Button,
  Dialog,
  CircularProgress
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

interface Device {
  id: number
  device_name: string
  serial_number: string
  firmware_version?: string
}

interface DeleteDeviceModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  onForceDelete?: () => void
  device: Device | null
  error?: string | null
  loading?: boolean
}

const DeleteDeviceModal: React.FC<DeleteDeviceModalProps> = ({
  open,
  onClose,
  onConfirm,
  onForceDelete,
  device,
  error,
  loading = false,
}) => {
  const { isDarkMode } = useTheme()
  if (!device) return null

  const hasAssignmentError = !!error

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          padding: 4,
          maxWidth: '500px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white'
        }
      }}
    >
      {/* 제목 */}
      <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900, mb: 2 }}>
        기기 삭제
      </Typography>

      {/* 경고 메시지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          component="img"
          src="/icons/ic_warning.svg"
          sx={{ width: 20, height: 20 }}
          onError={(e: any) => {
            e.target.style.display = 'none'
          }}
        />
        <Typography sx={{ fontSize: '18px', fontWeight: 400, color: colors.mainColor.red }}>
          {hasAssignmentError
            ? '수액-기기 연결이 존재하여 삭제할 수 없습니다.'
            : '선택한 기기를 삭제하시겠습니까?'}
        </Typography>
      </Box>

      {/* 기기 정보 카드 */}
      <Box sx={{
        bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
        borderRadius: '16px',
        p: 3,
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* 기기명 */}
        <Typography sx={{ fontSize: '24px', fontWeight: 400, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800, mb: 1 }}>
          {device.device_name}
        </Typography>

        {/* 시리얼 넘버 */}
        <Typography sx={{ fontSize: '18px', fontWeight: 500, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray400 }}>
          {device.serial_number}
        </Typography>
      </Box>

      {/* 에러 메시지 또는 안내 문구 */}
      {hasAssignmentError ? (
        <Box sx={{
          bgcolor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '12px',
          p: 2,
          mb: 3,
        }}>
          <Typography sx={{ fontSize: '14px', color: '#991B1B', mb: 1, fontWeight: 600 }}>
            {error}
          </Typography>
          <Typography sx={{ fontSize: '14px', color: '#7F1D1D' }}>
            연결을 강제 해제하면 해당 기기에 연결된 모든 수액 정보가 초기화됩니다.
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, mb: 4 }}>
          삭제된 기기는 복구할 수 없습니다.
        </Typography>
      )}

      {/* 버튼 */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            bgcolor: colors.gray.gray200,
            color: isDarkMode ? colors.gray.gray800 : colors.gray.gray700,
            fontSize: '18px',
            fontWeight: 500,
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
        {hasAssignmentError && onForceDelete ? (
          <Button
            onClick={onForceDelete}
            disabled={loading}
            sx={{
              bgcolor: '#DC2626',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': {
                bgcolor: '#B91C1C',
              },
              '&.Mui-disabled': {
                bgcolor: '#FCA5A5',
                color: 'white',
              }
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: 'white' }} /> : '강제 해제 후 삭제'}
          </Button>
        ) : (
          <Button
            onClick={onConfirm}
            disabled={loading}
            sx={{
              bgcolor: colors.mainColor.red,
              color: 'white',
              fontSize: '18px',
              fontWeight: 500,
              height: '45px',
              px: 3,
              borderRadius: '12px',
              textTransform: 'none',
              '&:hover': {
                bgcolor: colors.mainColor.red,
                opacity: 0.9
              },
              '&.Mui-disabled': {
                bgcolor: '#FCA5A5',
                color: 'white',
              }
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: 'white' }} /> : '삭제'}
          </Button>
        )}
      </Box>
    </Dialog>
  )
}

export default DeleteDeviceModal
