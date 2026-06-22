import React from 'react'
import {
  Box,
  Typography,
  Button,
  Dialog
} from '@mui/material'
import { colors } from '../styles/colors'
import { useTheme } from '../contexts/ThemeContext'

interface User {
  id: number
  username: string
  nickname: string
  role: 'super_admin' | 'admin' | 'nurse'
  auth_id?: string
}

interface DeleteUserModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  user: User | null
}

const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  open,
  onClose,
  onConfirm,
  user
}) => {
  const { isDarkMode } = useTheme()
  if (!user) return null

  const getRoleDisplayName = (role: string) => {
    switch(role) {
      case 'super_admin': return '슈퍼관리자'
      case 'admin': return '병원관리자'
      case 'nurse': return '간호사'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'super_admin': return colors.mainColor.deepGreen
      case 'admin': return colors.mainColor.blue
      case 'nurse': return colors.mainColor.blue
      default: return '#757575'
    }
  }

  const getRoleBackgroundOpacity = (role: string) => {
    switch(role) {
      case 'super_admin': return '20'
      case 'admin': return '20'
      case 'nurse': return '20'
      default: return '20'
    }
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
          padding: 4,
          maxWidth: '500px',
          bgcolor: isDarkMode ? colors.gray.gray1000 : 'white'
        }
      }}
    >
      {/* 제목 */}
      <Typography sx={{ fontSize: '24px', fontWeight: 700, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray900, mb: 2 }}>
        사용자 삭제
      </Typography>

      {/* 경고 메시지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          component="img"
          src="/icons/ic_warning.svg"
          sx={{ width: 20, height: 20 }}
          onError={(e: any) => {
            // 아이콘이 없으면 대체 텍스트
            e.target.style.display = 'none'
          }}
        />
        <Typography sx={{ fontSize: '18px', fontWeight: 400, color: colors.mainColor.red }}>
          선택한 사용자를 삭제하시겠습니까?
        </Typography>
      </Box>

      {/* 사용자 정보 카드 */}
      <Box sx={{
        bgcolor: isDarkMode ? colors.gray.gray800 : colors.gray.gray100,
        borderRadius: '16px',
        p: 3,
        mb: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* 유형 뱃지 + 이름 (가로 배치) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          {/* 유형 뱃지 */}
          <Box sx={{
            bgcolor: `${getRoleColor(user.role)}${getRoleBackgroundOpacity(user.role)}`,
            color: getRoleColor(user.role),
            px: 0.8,
            py: 0.8,
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 400,
            minWidth: '80px',
            textAlign: 'center'
          }}>
            {getRoleDisplayName(user.role)}
          </Box>

          {/* 이름 */}
          <Typography sx={{ fontSize: '24px', fontWeight: 400, color: isDarkMode ? colors.gray.gray100 : colors.gray.gray800 }}>
            {user.nickname}
          </Typography>
        </Box>

        {/* auth_id (아래 배치) */}
        <Typography sx={{ fontSize: '18px', fontWeight: 500, color: isDarkMode ? colors.gray.gray300 : colors.gray.gray400 }}>
          {user.auth_id || user.username}
        </Typography>
      </Box>

      {/* 안내 문구 */}
      <Typography sx={{ fontSize: '16px', color: isDarkMode ? colors.gray.gray400 : colors.gray.gray600, mb: 4 }}>
        삭제된 사용자는 복구할 수 없습니다.
      </Typography>

      {/* 버튼 */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          onClick={onClose}
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
        <Button
          onClick={onConfirm}
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
            }
          }}
        >
          삭제
        </Button>
      </Box>
    </Dialog>
  )
}

export default DeleteUserModal
